package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"orlando-app/internal/config"
	"orlando-app/internal/middleware"
	"orlando-app/internal/models"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db  *sql.DB
	cfg *config.Config
}

func NewHandler(db *sql.DB, cfg *config.Config) *Handler {
	return &Handler{
		db:  db,
		cfg: cfg,
	}
}

// Authentication handlers

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		http.Error(w, "All fields are required", http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	var userID int
	err = h.db.QueryRow(`
		INSERT INTO users (username, password_hash, first_name, last_name)
		VALUES (?, ?, ?, ?)
		RETURNING id
	`, req.Username, string(hashedPassword), req.FirstName, req.LastName).Scan(&userID)
	
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			http.Error(w, "Username already exists", http.StatusConflict)
			return
		}
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	token, err := middleware.GenerateJWT(userID, h.cfg)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	var user models.User
	err = h.db.QueryRow(`
		SELECT 
			u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at,
			COALESCE(SUM(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN c.points 
				ELSE 0 
			END), 0) as total_points,
			COUNT(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN p.id 
				ELSE NULL 
			END) as challenges_completed
		FROM users u
		LEFT JOIN posts p ON u.id = p.user_id AND p.revoked = FALSE
		LEFT JOIN challenges c ON p.challenge_id = c.id
		WHERE u.id = ?
		GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at
	`, userID).Scan(
		&user.ID, &user.Username, &user.FirstName, &user.LastName,
		&user.ProfileImage, &user.Role, &user.CreatedAt,
		&user.TotalPoints, &user.ChallengesCompleted,
	)
	if err != nil {
		http.Error(w, "Failed to fetch user", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token:        token,
		RefreshToken: token, // Simplified - same token for both
		User:         user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user models.User
	var passwordHash string
	err := h.db.QueryRow(`
		SELECT 
			u.id, u.username, u.password_hash, u.first_name, u.last_name, u.profile_image, u.role, u.created_at,
			COALESCE(SUM(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN c.points 
				ELSE 0 
			END), 0) as total_points,
			COUNT(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN p.id 
				ELSE NULL 
			END) as challenges_completed
		FROM users u
		LEFT JOIN posts p ON u.id = p.user_id AND p.revoked = FALSE
		LEFT JOIN challenges c ON p.challenge_id = c.id
		WHERE u.username = ?
		GROUP BY u.id, u.username, u.password_hash, u.first_name, u.last_name, u.profile_image, u.role, u.created_at
	`, req.Username).Scan(
		&user.ID, &user.Username, &passwordHash, &user.FirstName, &user.LastName,
		&user.ProfileImage, &user.Role, &user.CreatedAt,
		&user.TotalPoints, &user.ChallengesCompleted,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := middleware.GenerateJWT(user.ID, h.cfg)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token:        token,
		RefreshToken: token,
		User:         user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// User handlers

func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	contextUser := r.Context().Value(middleware.UserContextKey).(models.User)
	
	// Fetch updated user data with dynamic point calculation
	var user models.User
	err := h.db.QueryRow(`
		SELECT 
			u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at,
			COALESCE(SUM(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN c.points 
				ELSE 0 
			END), 0) as total_points,
			COUNT(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN p.id 
				ELSE NULL 
			END) as challenges_completed
		FROM users u
		LEFT JOIN posts p ON u.id = p.user_id AND p.revoked = FALSE
		LEFT JOIN challenges c ON p.challenge_id = c.id
		WHERE u.id = ?
		GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at
	`, contextUser.ID).Scan(
		&user.ID, &user.Username, &user.FirstName, &user.LastName,
		&user.ProfileImage, &user.Role, &user.CreatedAt,
		&user.TotalPoints, &user.ChallengesCompleted,
	)
	
	if err != nil {
		http.Error(w, "Failed to fetch user profile", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	
	log.Printf("UpdateProfile called for user ID: %d", user.ID)
	
	// Handle multipart form for profile image upload
	err := r.ParseMultipartForm(10 << 20) // 10MB max
	if err != nil {
		log.Printf("Failed to parse form: %v", err)
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	firstName := r.FormValue("first_name")
	lastName := r.FormValue("last_name")
	
	log.Printf("Form values - firstName: %s, lastName: %s", firstName, lastName)

	if firstName == "" {
		firstName = user.FirstName
	}
	if lastName == "" {
		lastName = user.LastName
	}

	profileImageURL := user.ProfileImage

	// Handle file upload if present
	file, header, err := r.FormFile("profile_image")
	if err == nil {
		defer file.Close()
		
		log.Printf("File upload detected - filename: %s, size: %d", header.Filename, header.Size)

		// Create uploads directory if it doesn't exist
		profilesDir := filepath.Join(h.cfg.UploadPath, "profiles")
		if err := os.MkdirAll(profilesDir, 0755); err != nil {
			log.Printf("Failed to create upload directory: %v", err)
			http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
			return
		}

		timestamp := time.Now().Unix()
		filename := fmt.Sprintf("%d_%d_%s", user.ID, timestamp, header.Filename)
		filepath := filepath.Join(profilesDir, filename)
		
		log.Printf("Saving file to: %s", filepath)

		dst, err := os.Create(filepath)
		if err != nil {
			log.Printf("Failed to create file: %v", err)
			http.Error(w, "Failed to create file", http.StatusInternalServerError)
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			log.Printf("Failed to save file: %v", err)
			http.Error(w, "Failed to save file", http.StatusInternalServerError)
			return
		}

		imageURL := fmt.Sprintf("/uploads/profiles/%s", filename)
		profileImageURL = &imageURL
		
		log.Printf("File saved successfully, image URL: %s", imageURL)
	} else {
		log.Printf("No file upload detected: %v", err)
	}

	_, err = h.db.Exec(`
		UPDATE users SET first_name = ?, last_name = ?, profile_image = ?
		WHERE id = ?
	`, firstName, lastName, profileImageURL, user.ID)

	if err != nil {
		http.Error(w, "Failed to update profile", http.StatusInternalServerError)
		return
	}

	// Fetch updated user
	err = h.db.QueryRow(`
		SELECT 
			u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at,
			COALESCE(SUM(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN c.points 
				ELSE 0 
			END), 0) as total_points,
			COUNT(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN p.id 
				ELSE NULL 
			END) as challenges_completed
		FROM users u
		LEFT JOIN posts p ON u.id = p.user_id AND p.revoked = FALSE
		LEFT JOIN challenges c ON p.challenge_id = c.id
		WHERE u.id = ?
		GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at
	`, user.ID).Scan(
		&user.ID, &user.Username, &user.FirstName, &user.LastName,
		&user.ProfileImage, &user.Role, &user.CreatedAt,
		&user.TotalPoints, &user.ChallengesCompleted,
	)

	if err != nil {
		http.Error(w, "Failed to fetch updated user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var user models.User
	err = h.db.QueryRow(`
		SELECT 
			u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at,
			COALESCE(SUM(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN c.points 
				ELSE 0 
			END), 0) as total_points,
			COUNT(CASE 
				WHEN c.status = 'completed' AND 
					 ((c.challenge_type = 'exclusive') OR 
					  (c.challenge_type = 'open' AND c.completed_by = u.id))
				THEN p.id 
				ELSE NULL 
			END) as challenges_completed
		FROM users u
		LEFT JOIN posts p ON u.id = p.user_id AND p.revoked = FALSE
		LEFT JOIN challenges c ON p.challenge_id = c.id
		WHERE u.id = ?
		GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_image, u.role, u.created_at
	`, userID).Scan(
		&user.ID, &user.Username, &user.FirstName, &user.LastName,
		&user.ProfileImage, &user.Role, &user.CreatedAt,
		&user.TotalPoints, &user.ChallengesCompleted,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// Challenge handlers

func (h *Handler) GetChallenges(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)

	rows, err := h.db.Query(`
		SELECT 
			c.id, c.title, c.description, c.image_url, c.points, c.assigned_to, c.status, 
			c.completed_by, c.completed_post_id, c.completed_at, c.start_date, c.end_date, c.challenge_type, c.created_at,
			u.username as completed_by_username
		FROM challenges c
		LEFT JOIN users u ON c.completed_by = u.id
		WHERE (
			c.challenge_type = 'open' OR
			(c.challenge_type = 'exclusive' AND (
				(c.status = 'available' AND c.assigned_to IS NULL) OR 
				(c.status = 'in_progress' AND c.assigned_to = ?) OR 
				c.status = 'completed'
			))
		)
		AND (c.start_date IS NULL OR c.start_date <= CURRENT_TIMESTAMP)
		AND (c.end_date IS NULL OR c.end_date >= CURRENT_TIMESTAMP)
		ORDER BY c.created_at DESC
	`, user.ID)

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
			&challenge.CompletedAt, &challenge.StartDate, &challenge.EndDate, &challenge.ChallengeType, &challenge.CreatedAt, &challenge.CompletedByUsername,
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

		// Set status based on assignment and completion
		if challenge.Status == "completed" {
			// Keep as completed - everyone can see who completed it
			challenge.Status = "completed"
		} else if challenge.ChallengeType == "open" {
			// Open challenges are always available
			challenge.Status = "available"
		} else if challenge.AssignedTo != nil && *challenge.AssignedTo == user.ID {
			challenge.Status = "in_progress"
		} else if challenge.AssignedTo != nil {
			continue // Skip exclusive challenges assigned to other users
		} else {
			challenge.Status = "available"
		}

		challenges = append(challenges, challenge)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenges)
}

func (h *Handler) GetChallenge(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	challengeID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	var challenge models.Challenge
	err = h.db.QueryRow(`
		SELECT 
			c.id, c.title, c.description, c.image_url, c.points, c.assigned_to, c.status, 
			c.completed_by, c.completed_post_id, c.completed_at, c.start_date, c.end_date, c.created_at,
			u.username as completed_by_username
		FROM challenges c
		LEFT JOIN users u ON c.completed_by = u.id
		WHERE c.id = ?
	`, challengeID).Scan(
		&challenge.ID, &challenge.Title, &challenge.Description,
		&challenge.ImageURL, &challenge.Points, &challenge.AssignedTo,
		&challenge.Status, &challenge.CompletedBy, &challenge.CompletedPostID,
		&challenge.CompletedAt, &challenge.StartDate, &challenge.EndDate, &challenge.CreatedAt, &challenge.CompletedByUsername,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Challenge not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenge)
}