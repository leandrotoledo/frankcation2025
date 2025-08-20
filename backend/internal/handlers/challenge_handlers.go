package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"orlando-app/internal/middleware"
	"orlando-app/internal/models"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"crypto/rand"
	"encoding/hex"
)

func (h *Handler) PickChallenge(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	// Get challenge information
	var challengeType string
	var challengeStatus string
	err = h.db.QueryRow(`
		SELECT challenge_type, status FROM challenges 
		WHERE id = ?
		AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
		AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
	`, challengeID).Scan(&challengeType, &challengeStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Challenge not found or outside date range", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if challengeStatus != "available" {
		http.Error(w, "Challenge is not available", http.StatusConflict)
		return
	}

	if challengeType == "open" {
		// For open challenges, check if user already has a submission
		var existingSubmission int
		err = h.db.QueryRow(`
			SELECT COUNT(*) FROM challenge_submissions 
			WHERE challenge_id = ? AND user_id = ?
		`, challengeID, user.ID).Scan(&existingSubmission)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if existingSubmission > 0 {
			http.Error(w, "You have already joined this challenge", http.StatusBadRequest)
			return
		}

		// Add user to challenge submissions (without post_id initially)
		_, err = h.db.Exec(`
			INSERT INTO challenge_submissions (challenge_id, user_id, post_id)
			VALUES (?, ?, 0)
		`, challengeID, user.ID)
		if err != nil {
			http.Error(w, "Failed to join challenge", http.StatusInternalServerError)
			return
		}

		log.Printf("User %d successfully joined open challenge %d", user.ID, challengeID)
	} else {
		// For exclusive challenges, use the original logic
		// Check if user already has this specific challenge
		var alreadyAssigned int
		err = h.db.QueryRow(`
			SELECT COUNT(*) FROM challenges WHERE id = ? AND assigned_to = ?
		`, challengeID, user.ID).Scan(&alreadyAssigned)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if alreadyAssigned > 0 {
			http.Error(w, "You already have this challenge assigned", http.StatusBadRequest)
			return
		}

		// Try to assign the challenge
		result, err := h.db.Exec(`
			UPDATE challenges 
			SET assigned_to = ?, status = 'in_progress'
			WHERE id = ? AND assigned_to IS NULL AND status = 'available'
			AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
			AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
		`, user.ID, challengeID)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		if rowsAffected == 0 {
			http.Error(w, "Challenge not available (may be assigned to another user)", http.StatusConflict)
			return
		}

		log.Printf("Challenge %d successfully picked by user %d", challengeID, user.ID)
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Challenge picked successfully"})
}

func (h *Handler) CancelChallenge(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	// Get challenge type to determine how to handle cancellation
	var challengeType string
	err = h.db.QueryRow(`
		SELECT challenge_type FROM challenges WHERE id = ?
	`, challengeID).Scan(&challengeType)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Challenge not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	var rowsAffected int64
	if challengeType == "open" {
		// For open challenges, remove from challenge_submissions
		result, err := h.db.Exec(`
			DELETE FROM challenge_submissions 
			WHERE challenge_id = ? AND user_id = ? AND post_id = 0
		`, challengeID, user.ID)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		rowsAffected, err = result.RowsAffected()
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	} else {
		// For exclusive challenges, use original logic
		result, err := h.db.Exec(`
			UPDATE challenges 
			SET assigned_to = NULL, status = 'available'
			WHERE id = ? AND assigned_to = ?
		`, challengeID, user.ID)

		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		rowsAffected, err = result.RowsAffected()
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
	}

	if rowsAffected == 0 {
		http.Error(w, "Challenge not found or not assigned to you", http.StatusNotFound)
		return
	}

	log.Printf("Challenge %d successfully cancelled by user %d", challengeID, user.ID)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Challenge cancelled successfully"})
}

// UploadMedia handles background media upload
func (h *Handler) UploadMedia(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)

	// Parse multipart form for media upload
	err := r.ParseMultipartForm(50 << 20) // 50MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Handle file upload
	file, header, err := r.FormFile("media")
	if err != nil {
		http.Error(w, "Media file is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	var mediaType string
	if contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/jpg" {
		mediaType = "photo"
	} else if contentType == "video/mp4" || contentType == "video/quicktime" || contentType == "video/mov" {
		mediaType = "video"
	} else {
		http.Error(w, "Invalid file type. Only images and videos are allowed", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	if err := os.MkdirAll("./uploads/temp", 0755); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Generate unique media ID
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		http.Error(w, "Failed to generate media ID", http.StatusInternalServerError)
		return
	}
	mediaID := hex.EncodeToString(randomBytes)

	// Save file with unique name
	filename := fmt.Sprintf("%s_%d_%s", mediaID, user.ID, header.Filename)
	filepath := filepath.Join("./uploads/temp", filename)

	dst, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	mediaURL := fmt.Sprintf("/uploads/temp/%s", filename)

	// Store temporary media info in database
	_, err = h.db.Exec(`
		INSERT INTO temp_media (media_id, user_id, media_url, media_type, created_at, expires_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, datetime(CURRENT_TIMESTAMP, '+1 hour'))
	`, mediaID, user.ID, mediaURL, mediaType)

	if err != nil {
		log.Printf("Failed to store temp media: %v", err)
		http.Error(w, "Failed to store media", http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"media_id":  mediaID,
		"media_url": mediaURL,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) CompleteChallenge(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	var mediaURL, mediaType, caption string

	// Check if this is a JSON request (pre-uploaded media) or form data (direct upload)
	contentType := r.Header.Get("Content-Type")
	
	if contentType == "application/json" {
		// Handle pre-uploaded media
		var req struct {
			MediaID string `json:"media_id"`
			Caption string `json:"caption"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if req.MediaID == "" {
			http.Error(w, "media_id is required", http.StatusBadRequest)
			return
		}

		// Get temp media info
		var tempMediaURL string
		err = h.db.QueryRow(`
			SELECT media_url, media_type FROM temp_media 
			WHERE media_id = ? AND user_id = ? AND expires_at > CURRENT_TIMESTAMP
		`, req.MediaID, user.ID).Scan(&tempMediaURL, &mediaType)

		if err != nil {
			if err == sql.ErrNoRows {
				http.Error(w, "Media not found or expired", http.StatusNotFound)
				return
			}
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}

		// Move file from temp to posts directory
		if err := os.MkdirAll("./uploads/posts", 0755); err != nil {
			http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
			return
		}

		tempPath := filepath.Join(".", tempMediaURL)
		finalFilename := fmt.Sprintf("%d_%d_%s", user.ID, challengeID, filepath.Base(tempMediaURL))
		finalPath := filepath.Join("./uploads/posts", finalFilename)

		if err := os.Rename(tempPath, finalPath); err != nil {
			http.Error(w, "Failed to move media file", http.StatusInternalServerError)
			return
		}

		mediaURL = fmt.Sprintf("/uploads/posts/%s", finalFilename)
		caption = req.Caption

		// Clean up temp media record
		h.db.Exec("DELETE FROM temp_media WHERE media_id = ?", req.MediaID)

	} else {
		// Handle direct upload (fallback)
		err = r.ParseMultipartForm(50 << 20) // 50MB max
		if err != nil {
			http.Error(w, "Failed to parse form", http.StatusBadRequest)
			return
		}

		caption = r.FormValue("caption")

		// Handle file upload
		file, header, err := r.FormFile("media")
		if err != nil {
			http.Error(w, "Media file is required", http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Validate file type
		contentType := header.Header.Get("Content-Type")
		if contentType == "image/jpeg" || contentType == "image/png" || contentType == "image/jpg" {
			mediaType = "photo"
		} else if contentType == "video/mp4" || contentType == "video/quicktime" || contentType == "video/mov" {
			mediaType = "video"
		} else {
			http.Error(w, "Invalid file type. Only images and videos are allowed", http.StatusBadRequest)
			return
		}

		// Create uploads directory if it doesn't exist
		if err := os.MkdirAll("./uploads/posts", 0755); err != nil {
			http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
			return
		}

		// Save file
		filename := fmt.Sprintf("%d_%d_%s", user.ID, challengeID, header.Filename)
		filepath := filepath.Join("./uploads/posts", filename)

		dst, err := os.Create(filepath)
		if err != nil {
			http.Error(w, "Failed to create file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to save file", http.StatusInternalServerError)
			return
		}

		mediaURL = fmt.Sprintf("/uploads/posts/%s", filename)
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get challenge information
	var challengePoints int
	var challengeType string
	var challengeStatus string
	err = tx.QueryRow(`
		SELECT points, challenge_type, status FROM challenges 
		WHERE id = ?
	`, challengeID).Scan(&challengePoints, &challengeType, &challengeStatus)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Challenge not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Verify user can complete this challenge
	if challengeType == "exclusive" {
		// For exclusive challenges, verify it's assigned to the user (use original simple logic)
		var assignedChallenge int
		err = tx.QueryRow(`
			SELECT COUNT(*) FROM challenges 
			WHERE id = ? AND assigned_to = ? AND status = 'in_progress'
		`, challengeID, user.ID).Scan(&assignedChallenge)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		if assignedChallenge == 0 {
			http.Error(w, "Challenge not found or not assigned to you", http.StatusNotFound)
			return
		}
	} else {
		// For open challenges, verify user has joined it
		var submissionExists int
		err = tx.QueryRow(`
			SELECT COUNT(*) FROM challenge_submissions 
			WHERE challenge_id = ? AND user_id = ?
		`, challengeID, user.ID).Scan(&submissionExists)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		if submissionExists == 0 {
			http.Error(w, "You haven't joined this challenge", http.StatusBadRequest)
			return
		}
		
		// Check if user already has a submission with a post
		var existingPostID sql.NullInt64
		err = tx.QueryRow(`
			SELECT post_id FROM challenge_submissions 
			WHERE challenge_id = ? AND user_id = ?
		`, challengeID, user.ID).Scan(&existingPostID)
		if err != nil {
			http.Error(w, "Database error", http.StatusInternalServerError)
			return
		}
		if existingPostID.Valid && existingPostID.Int64 > 0 {
			http.Error(w, "You have already submitted for this challenge", http.StatusBadRequest)
			return
		}
	}

	// Create post
	var postID int
	err = tx.QueryRow(`
		INSERT INTO posts (user_id, challenge_id, media_url, media_type, caption)
		VALUES (?, ?, ?, ?, ?)
		RETURNING id
	`, user.ID, challengeID, mediaURL, mediaType, caption).Scan(&postID)

	if err != nil {
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	if challengeType == "exclusive" {
		// For exclusive challenges, mark as completed and award points immediately
		_, err = tx.Exec(`
			UPDATE challenges 
			SET assigned_to = NULL, status = 'completed', completed_by = ?, completed_post_id = ?, completed_at = CURRENT_TIMESTAMP
			WHERE id = ?
		`, user.ID, postID, challengeID)

		if err != nil {
			http.Error(w, "Failed to update challenge", http.StatusInternalServerError)
			return
		}

		// Note: total_points and challenges_completed are now calculated dynamically from completed challenges
	} else {
		// For open challenges, update the submission with the post_id (don't award points yet)
		_, err = tx.Exec(`
			UPDATE challenge_submissions 
			SET post_id = ?
			WHERE challenge_id = ? AND user_id = ?
		`, postID, challengeID, user.ID)

		if err != nil {
			http.Error(w, "Failed to update submission", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete transaction", http.StatusInternalServerError)
		return
	}

	var response map[string]interface{}
	if challengeType == "exclusive" {
		response = map[string]interface{}{
			"message":       "Challenge completed successfully",
			"post_id":       postID,
			"points_earned": challengePoints,
		}
	} else {
		response = map[string]interface{}{
			"message":       "Submission completed successfully. Awaiting admin review.",
			"post_id":       postID,
			"points_earned": 0,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Admin challenge handlers

func (h *Handler) CreateChallenge(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	pointsStr := r.FormValue("points")
	startDateStr := r.FormValue("start_date")
	endDateStr := r.FormValue("end_date")
	challengeType := r.FormValue("challenge_type")

	if title == "" || description == "" || pointsStr == "" {
		http.Error(w, "Title, description, and points are required", http.StatusBadRequest)
		return
	}

	// Default to exclusive if not specified
	if challengeType == "" {
		challengeType = "exclusive"
	}

	// Validate challenge type
	if challengeType != "exclusive" && challengeType != "open" {
		http.Error(w, "Challenge type must be 'exclusive' or 'open'", http.StatusBadRequest)
		return
	}

	points, err := strconv.Atoi(pointsStr)
	if err != nil {
		http.Error(w, "Invalid points value", http.StatusBadRequest)
		return
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, startDateStr)
		if err != nil {
			http.Error(w, "Invalid start_date format. Use RFC3339 format", http.StatusBadRequest)
			return
		}
		startDate = &parsed
	}

	if endDateStr != "" {
		parsed, err := time.Parse(time.RFC3339, endDateStr)
		if err != nil {
			http.Error(w, "Invalid end_date format. Use RFC3339 format", http.StatusBadRequest)
			return
		}
		endDate = &parsed
	}

	var imageURL *string

	// Handle file upload if present
	file, header, err := r.FormFile("image")
	if err == nil {
		defer file.Close()

		// Create uploads directory if it doesn't exist
		if err := os.MkdirAll("./uploads/challenges", 0755); err != nil {
			http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("challenge_%s", header.Filename)
		filepath := filepath.Join("./uploads/challenges", filename)

		dst, err := os.Create(filepath)
		if err != nil {
			http.Error(w, "Failed to create file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			http.Error(w, "Failed to save file", http.StatusInternalServerError)
			return
		}

		url := fmt.Sprintf("/uploads/challenges/%s", filename)
		imageURL = &url
	}

	var challengeID int
	err = h.db.QueryRow(`
		INSERT INTO challenges (title, description, image_url, points, start_date, end_date, challenge_type)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id
	`, title, description, imageURL, points, startDate, endDate, challengeType).Scan(&challengeID)

	if err != nil {
		http.Error(w, "Failed to create challenge", http.StatusInternalServerError)
		return
	}

	var challenge models.Challenge
	err = h.db.QueryRow(`
		SELECT id, title, description, image_url, points, assigned_to, status, start_date, end_date, challenge_type, created_at
		FROM challenges WHERE id = ?
	`, challengeID).Scan(
		&challenge.ID, &challenge.Title, &challenge.Description,
		&challenge.ImageURL, &challenge.Points, &challenge.AssignedTo,
		&challenge.Status, &challenge.StartDate, &challenge.EndDate, &challenge.ChallengeType, &challenge.CreatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to fetch created challenge", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(challenge)
}

func (h *Handler) UpdateChallenge(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	var req models.CreateChallengeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`
		UPDATE challenges 
		SET title = ?, description = ?, points = ?, start_date = ?, end_date = ?, challenge_type = ?
		WHERE id = ?
	`, req.Title, req.Description, req.Points, req.StartDate, req.EndDate, req.ChallengeType, challengeID)

	if err != nil {
		http.Error(w, "Failed to update challenge", http.StatusInternalServerError)
		return
	}

	var challenge models.Challenge
	err = h.db.QueryRow(`
		SELECT id, title, description, image_url, points, assigned_to, status, start_date, end_date, challenge_type, created_at
		FROM challenges WHERE id = ?
	`, challengeID).Scan(
		&challenge.ID, &challenge.Title, &challenge.Description,
		&challenge.ImageURL, &challenge.Points, &challenge.AssignedTo,
		&challenge.Status, &challenge.StartDate, &challenge.EndDate, &challenge.ChallengeType, &challenge.CreatedAt,
	)

	if err != nil {
		http.Error(w, "Failed to fetch updated challenge", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenge)
}

func (h *Handler) DeleteChallenge(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	result, err := h.db.Exec(`DELETE FROM challenges WHERE id = ?`, challengeID)
	if err != nil {
		http.Error(w, "Failed to delete challenge", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Challenge not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetAllChallenges(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT 
			c.id, c.title, c.description, c.image_url, c.points, c.assigned_to, c.status, 
			c.completed_by, c.completed_post_id, c.completed_at, c.start_date, c.end_date, c.challenge_type, c.created_at,
			u_completed.username as completed_by_username,
			u_assigned.username as assigned_to_username
		FROM challenges c
		LEFT JOIN users u_completed ON c.completed_by = u_completed.id
		LEFT JOIN users u_assigned ON c.assigned_to = u_assigned.id
		ORDER BY c.created_at DESC
	`)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var challenges []models.Challenge
	for rows.Next() {
		var challenge models.Challenge
		err := rows.Scan(
			&challenge.ID, &challenge.Title, &challenge.Description,
			&challenge.ImageURL, &challenge.Points, &challenge.AssignedTo,
			&challenge.Status, &challenge.CompletedBy, &challenge.CompletedPostID,
			&challenge.CompletedAt, &challenge.StartDate, &challenge.EndDate, &challenge.ChallengeType, &challenge.CreatedAt, &challenge.CompletedByUsername, &challenge.AssignedToUsername,
		)
		if err != nil {
			http.Error(w, "Failed to scan challenge", http.StatusInternalServerError)
			return
		}

		// For open challenges, fetch all submissions (both joined and submitted)
		if challenge.ChallengeType == "open" {
			submissionRows, err := h.db.Query(`
				SELECT 
					cs.id, cs.user_id, cs.post_id, cs.created_at,
					u.username, u.profile_image
				FROM challenge_submissions cs
				JOIN users u ON cs.user_id = u.id
				WHERE cs.challenge_id = ?
				ORDER BY cs.created_at DESC
			`, challenge.ID)
			
			if err != nil {
				log.Printf("Error fetching submissions for challenge %d: %v", challenge.ID, err)
			} else {
				var submissions []models.ChallengeSubmission
				for submissionRows.Next() {
					var submission models.ChallengeSubmission
					err := submissionRows.Scan(
						&submission.ID, &submission.UserID, &submission.PostID, &submission.CreatedAt,
						&submission.Username, &submission.UserProfileImage,
					)
					if err != nil {
						log.Printf("Error scanning submission: %v", err)
						continue
					}
					submission.ChallengeID = challenge.ID
					submissions = append(submissions, submission)
				}
				submissionRows.Close()
				challenge.Submissions = submissions
			}
		}

		challenges = append(challenges, challenge)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenges)
}

func (h *Handler) UnassignChallenge(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	result, err := h.db.Exec(`
		UPDATE challenges 
		SET assigned_to = NULL, status = 'available'
		WHERE id = ? AND status = 'in_progress'
	`, challengeID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if rowsAffected == 0 {
		http.Error(w, "Challenge not found or not assigned", http.StatusNotFound)
		return
	}

	log.Printf("Challenge %d unassigned by admin", challengeID)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Challenge unassigned successfully"})
}

func (h *Handler) AwardChallenge(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	var req struct {
		UserID int `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.UserID == 0 {
		http.Error(w, "User ID is required", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get challenge information and verify it's an open challenge
	var challengeType string
	var challengePoints int
	var challengeStatus string
	err = tx.QueryRow(`
		SELECT challenge_type, points, status FROM challenges WHERE id = ?
	`, challengeID).Scan(&challengeType, &challengePoints, &challengeStatus)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Challenge not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if challengeType != "open" {
		http.Error(w, "Only open challenges can be awarded", http.StatusBadRequest)
		return
	}

	if challengeStatus == "completed" {
		http.Error(w, "Challenge has already been awarded", http.StatusBadRequest)
		return
	}

	// Verify the user has a submission for this challenge
	var submissionPostID int
	err = tx.QueryRow(`
		SELECT post_id FROM challenge_submissions 
		WHERE challenge_id = ? AND user_id = ? AND post_id > 0
	`, challengeID, req.UserID).Scan(&submissionPostID)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User has no submission for this challenge", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Note: total_points and challenges_completed are now calculated dynamically from completed challenges

	// Mark challenge as completed
	_, err = tx.Exec(`
		UPDATE challenges 
		SET status = 'completed', completed_by = ?, completed_post_id = ?, completed_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, req.UserID, submissionPostID, challengeID)
	if err != nil {
		http.Error(w, "Failed to update challenge", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete transaction", http.StatusInternalServerError)
		return
	}

	log.Printf("Challenge %d successfully awarded to user %d with %d points", challengeID, req.UserID, challengePoints)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Challenge awarded successfully"})
}