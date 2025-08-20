package models

import (
	"time"
)

type User struct {
	ID                   int       `json:"id" db:"id"`
	Username             string    `json:"username" db:"username"`
	PasswordHash         string    `json:"-" db:"password_hash"`
	FirstName            string    `json:"first_name" db:"first_name"`
	LastName             string    `json:"last_name" db:"last_name"`
	ProfileImage         *string   `json:"profile_image" db:"profile_image"`
	Role                 string    `json:"role" db:"role"`
	TotalPoints          int       `json:"total_points" db:"total_points"`
	ChallengesCompleted  int       `json:"challenges_completed" db:"challenges_completed"`
	CreatedAt            time.Time `json:"created_at" db:"created_at"`
}

type Challenge struct {
	ID              int       `json:"id" db:"id"`
	Title           string    `json:"title" db:"title"`
	Description     string    `json:"description" db:"description"`
	ImageURL        *string   `json:"image_url" db:"image_url"`
	Points          int       `json:"points" db:"points"`
	AssignedTo      *int      `json:"assigned_to" db:"assigned_to"`
	Status          string    `json:"status" db:"status"`
	CompletedBy     *int      `json:"completed_by" db:"completed_by"`
	CompletedPostID *int      `json:"completed_post_id" db:"completed_post_id"`
	CompletedAt     *time.Time `json:"completed_at" db:"completed_at"`
	StartDate       *time.Time `json:"start_date" db:"start_date"`
	EndDate         *time.Time `json:"end_date" db:"end_date"`
	ChallengeType   string    `json:"challenge_type" db:"challenge_type"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	
	// Joined fields for display
	CompletedByUsername *string `json:"completed_by_username,omitempty"`
	AssignedToUsername  *string `json:"assigned_to_username,omitempty"`
	Submissions         []ChallengeSubmission `json:"submissions,omitempty"`
}

type Post struct {
	ID          int       `json:"id" db:"id"`
	UserID      int       `json:"user_id" db:"user_id"`
	ChallengeID int       `json:"challenge_id" db:"challenge_id"`
	MediaURL    string    `json:"media_url" db:"media_url"`
	MediaType   string    `json:"media_type" db:"media_type"`
	Caption     *string   `json:"caption" db:"caption"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	Revoked     bool      `json:"revoked" db:"revoked"`
	
	// Joined fields
	Username             string  `json:"username,omitempty"`
	UserProfileImage     *string `json:"user_profile_image,omitempty"`
	ChallengeTitle       string  `json:"challenge_title,omitempty"`
	ChallengePoints      int     `json:"challenge_points,omitempty"`
	ChallengeType        string  `json:"challenge_type,omitempty"`
	ChallengeStatus      string  `json:"challenge_status,omitempty"`
	ChallengeCompletedBy *int    `json:"challenge_completed_by,omitempty"`
	LikesCount           int     `json:"likes_count,omitempty"`
	CommentsCount        int     `json:"comments_count,omitempty"`
	UserLiked            bool    `json:"user_liked,omitempty"`
}

type Like struct {
	UserID int `json:"user_id" db:"user_id"`
	PostID int `json:"post_id" db:"post_id"`
}

type Comment struct {
	ID        int       `json:"id" db:"id"`
	UserID    int       `json:"user_id" db:"user_id"`
	PostID    int       `json:"post_id" db:"post_id"`
	Content   string    `json:"content" db:"content"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	
	// Joined fields
	Username         string  `json:"username,omitempty"`
	UserProfileImage *string `json:"user_profile_image,omitempty"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

type AuthResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	User         User   `json:"user"`
}

type CreateChallengeRequest struct {
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	Points        int        `json:"points"`
	StartDate     *time.Time `json:"start_date"`
	EndDate       *time.Time `json:"end_date"`
	ChallengeType string     `json:"challenge_type"`
}

type CompleteActivityRequest struct {
	Caption *string `json:"caption"`
}

type CreateCommentRequest struct {
	Content string `json:"content"`
}

type ChallengeSubmission struct {
	ID               int       `json:"id" db:"id"`
	ChallengeID      int       `json:"challenge_id" db:"challenge_id"`
	UserID           int       `json:"user_id" db:"user_id"`
	PostID           int       `json:"post_id" db:"post_id"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	
	// Joined fields for display
	Username         string  `json:"username,omitempty"`
	UserProfileImage *string `json:"user_profile_image,omitempty"`
}