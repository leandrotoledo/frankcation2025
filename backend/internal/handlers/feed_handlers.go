package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"orlando-app/internal/middleware"
	"orlando-app/internal/models"
	"strconv"

	"github.com/gorilla/mux"
)

func (h *Handler) GetFeed(w http.ResponseWriter, r *http.Request) {
	page := 1
	limit := 20

	if p := r.URL.Query().Get("page"); p != "" {
		if pageNum, err := strconv.Atoi(p); err == nil && pageNum > 0 {
			page = pageNum
		}
	}

	if l := r.URL.Query().Get("limit"); l != "" {
		if limitNum, err := strconv.Atoi(l); err == nil && limitNum > 0 && limitNum <= 50 {
			limit = limitNum
		}
	}

	offset := (page - 1) * limit

	// Get current user if authenticated
	var currentUserID *int
	if user, ok := r.Context().Value(middleware.UserContextKey).(models.User); ok {
		currentUserID = &user.ID
	}

	query := `
		SELECT 
			p.id, p.user_id, p.challenge_id, p.media_url, p.media_type, p.caption, p.created_at, p.revoked,
			u.username, u.profile_image, c.title, c.points, c.challenge_type, c.status, c.completed_by,
			COUNT(DISTINCT l.post_id) as likes_count,
			COUNT(DISTINCT cm.id) as comments_count,
			CASE WHEN ul.user_id IS NOT NULL THEN 1 ELSE 0 END as user_liked
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN challenges c ON p.challenge_id = c.id
		LEFT JOIN likes l ON p.id = l.post_id
		LEFT JOIN comments cm ON p.id = cm.post_id
		LEFT JOIN likes ul ON p.id = ul.post_id AND ul.user_id = ?
		GROUP BY p.id, p.user_id, p.challenge_id, p.media_url, p.media_type, p.caption, p.created_at, p.revoked,
				 u.username, u.profile_image, c.title, c.points, c.challenge_type, c.status, c.completed_by, ul.user_id
		ORDER BY p.created_at DESC
		LIMIT ? OFFSET ?
	`

	var rows *sql.Rows
	var err error

	if currentUserID != nil {
		rows, err = h.db.Query(query, *currentUserID, limit, offset)
	} else {
		rows, err = h.db.Query(query, nil, limit, offset)
	}

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		err := rows.Scan(
			&post.ID, &post.UserID, &post.ChallengeID, &post.MediaURL,
			&post.MediaType, &post.Caption, &post.CreatedAt, &post.Revoked,
			&post.Username, &post.UserProfileImage, &post.ChallengeTitle, &post.ChallengePoints,
			&post.ChallengeType, &post.ChallengeStatus, &post.ChallengeCompletedBy,
			&post.LikesCount, &post.CommentsCount, &post.UserLiked,
		)
		if err != nil {
			http.Error(w, "Failed to scan post", http.StatusInternalServerError)
			return
		}
		posts = append(posts, post)
	}

	if posts == nil {
		posts = []models.Post{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *Handler) GetPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(models.User)

	var post models.Post
	err = h.db.QueryRow(`
		SELECT 
			p.id, p.user_id, p.challenge_id, p.media_url, p.media_type, p.caption, p.created_at, p.revoked,
			u.username, u.profile_image, c.title, c.points, c.challenge_type, c.status, c.completed_by,
			COUNT(DISTINCT l.post_id) as likes_count,
			COUNT(DISTINCT cm.id) as comments_count,
			CASE WHEN ul.user_id IS NOT NULL THEN 1 ELSE 0 END as user_liked
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN challenges c ON p.challenge_id = c.id
		LEFT JOIN likes l ON p.id = l.post_id
		LEFT JOIN comments cm ON p.id = cm.post_id
		LEFT JOIN likes ul ON p.id = ul.post_id AND ul.user_id = ?
		WHERE p.id = ?
		GROUP BY p.id, p.user_id, p.challenge_id, p.media_url, p.media_type, p.caption, p.created_at, p.revoked,
				 u.username, u.profile_image, c.title, c.points, c.challenge_type, c.status, c.completed_by, ul.user_id
	`, user.ID, postID).Scan(
		&post.ID, &post.UserID, &post.ChallengeID, &post.MediaURL,
		&post.MediaType, &post.Caption, &post.CreatedAt, &post.Revoked,
		&post.Username, &post.UserProfileImage, &post.ChallengeTitle, &post.ChallengePoints,
		&post.ChallengeType, &post.ChallengeStatus, &post.ChallengeCompletedBy,
		&post.LikesCount, &post.CommentsCount, &post.UserLiked,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

func (h *Handler) DeletePost(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get post details and verify ownership
	var post models.Post
	var challengePoints int
	err = tx.QueryRow(`
		SELECT p.id, p.user_id, p.challenge_id, c.points
		FROM posts p
		JOIN challenges c ON p.challenge_id = c.id
		WHERE p.id = ? AND p.user_id = ?
	`, postID, user.ID).Scan(&post.ID, &post.UserID, &post.ChallengeID, &challengePoints)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Post not found or not owned by user", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Delete post (cascade will handle likes and comments)
	_, err = tx.Exec(`DELETE FROM posts WHERE id = ?`, postID)
	if err != nil {
		http.Error(w, "Failed to delete post", http.StatusInternalServerError)
		return
	}

	// Return challenge to available pool
	_, err = tx.Exec(`
		UPDATE challenges 
		SET assigned_to = NULL, status = 'available'
		WHERE id = ?
	`, post.ChallengeID)
	if err != nil {
		http.Error(w, "Failed to update challenge", http.StatusInternalServerError)
		return
	}

	// Note: total_points and challenges_completed are now calculated dynamically from completed challenges

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) LikePost(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`
		INSERT OR IGNORE INTO likes (user_id, post_id)
		VALUES (?, ?)
	`, user.ID, postID)

	if err != nil {
		http.Error(w, "Failed to like post", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post liked successfully"})
}

func (h *Handler) UnlikePost(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`
		DELETE FROM likes WHERE user_id = ? AND post_id = ?
	`, user.ID, postID)

	if err != nil {
		http.Error(w, "Failed to unlike post", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post unliked successfully"})
}

func (h *Handler) GetComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	rows, err := h.db.Query(`
		SELECT c.id, c.user_id, c.post_id, c.content, c.created_at, u.username, u.profile_image
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.post_id = ?
		ORDER BY c.created_at ASC
	`, postID)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var comments []models.Comment
	for rows.Next() {
		var comment models.Comment
		err := rows.Scan(
			&comment.ID, &comment.UserID, &comment.PostID,
			&comment.Content, &comment.CreatedAt, &comment.Username, &comment.UserProfileImage,
		)
		if err != nil {
			http.Error(w, "Failed to scan comment", http.StatusInternalServerError)
			return
		}
		comments = append(comments, comment)
	}

	if comments == nil {
		comments = []models.Comment{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value(middleware.UserContextKey).(models.User)
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	var req models.CreateCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	var commentID int
	err = h.db.QueryRow(`
		INSERT INTO comments (user_id, post_id, content)
		VALUES (?, ?, ?)
		RETURNING id
	`, user.ID, postID, req.Content).Scan(&commentID)

	if err != nil {
		http.Error(w, "Failed to create comment", http.StatusInternalServerError)
		return
	}

	var comment models.Comment
	err = h.db.QueryRow(`
		SELECT c.id, c.user_id, c.post_id, c.content, c.created_at, u.username, u.profile_image
		FROM comments c
		JOIN users u ON c.user_id = u.id
		WHERE c.id = ?
	`, commentID).Scan(
		&comment.ID, &comment.UserID, &comment.PostID,
		&comment.Content, &comment.CreatedAt, &comment.Username, &comment.UserProfileImage,
	)

	if err != nil {
		http.Error(w, "Failed to fetch created comment", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT 
			u.id, u.username, u.first_name, u.last_name, u.profile_image,
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
		WHERE u.role != 'admin'
		GROUP BY u.id, u.username, u.first_name, u.last_name, u.profile_image
		ORDER BY total_points DESC, challenges_completed DESC
	`)

	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		err := rows.Scan(
			&user.ID, &user.Username, &user.FirstName, &user.LastName,
			&user.ProfileImage, &user.TotalPoints, &user.ChallengesCompleted,
		)
		if err != nil {
			http.Error(w, "Failed to scan user", http.StatusInternalServerError)
			return
		}
		users = append(users, user)
	}

	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// Admin function to revoke points from a post
func (h *Handler) RevokePostPoints(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Start transaction
	tx, err := h.db.Begin()
	if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// Get post details
	var post models.Post
	var challengePoints int
	var originalUserID int
	err = tx.QueryRow(`
		SELECT p.id, p.user_id, p.challenge_id, c.points
		FROM posts p
		JOIN challenges c ON p.challenge_id = c.id
		WHERE p.id = ?
	`, postID).Scan(&post.ID, &originalUserID, &post.ChallengeID, &challengePoints)

	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "Post not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	// Return challenge to available pool for any user to pick up
	_, err = tx.Exec(`
		UPDATE challenges 
		SET assigned_to = NULL, status = 'available', completed_by = NULL, completed_post_id = NULL, completed_at = NULL
		WHERE id = ?
	`, post.ChallengeID)
	if err != nil {
		http.Error(w, "Failed to reassign challenge", http.StatusInternalServerError)
		return
	}

	// Note: total_points and challenges_completed are now calculated dynamically from completed challenges

	// Mark the post as revoked
	_, err = tx.Exec(`
		UPDATE posts 
		SET revoked = TRUE
		WHERE id = ?
	`, postID)
	if err != nil {
		http.Error(w, "Failed to mark post as revoked", http.StatusInternalServerError)
		return
	}

	if err = tx.Commit(); err != nil {
		http.Error(w, "Failed to complete transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Points revoked successfully. Challenge returned to available pool."})
}