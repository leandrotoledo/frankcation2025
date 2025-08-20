package middleware

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"orlando-app/internal/config"
	"orlando-app/internal/models"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(db *sql.DB, cfg *config.Config) func(http.Handler) http.Handler {
	jwtSecret := []byte(cfg.JWTSecret)
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Authorization header required", http.StatusUnauthorized)
				return
			}

			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
				http.Error(w, "Invalid authorization header format", http.StatusUnauthorized)
				return
			}

			tokenString := bearerToken[1]
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return jwtSecret, nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, "Invalid token claims", http.StatusUnauthorized)
				return
			}

			userID, ok := claims["user_id"].(float64)
			if !ok {
				http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
				return
			}

			var user models.User
			err = db.QueryRow(`
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
			`, int(userID)).Scan(
				&user.ID, &user.Username, &user.FirstName, &user.LastName,
				&user.ProfileImage, &user.Role, &user.CreatedAt,
				&user.TotalPoints, &user.ChallengesCompleted,
			)
			if err != nil {
				http.Error(w, "User not found", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuthMiddleware(db *sql.DB, cfg *config.Config) func(http.Handler) http.Handler {
	jwtSecret := []byte(cfg.JWTSecret)
	
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				next.ServeHTTP(w, r)
				return
			}

			bearerToken := strings.Split(authHeader, " ")
			if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
				next.ServeHTTP(w, r)
				return
			}

			tokenString := bearerToken[1]
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return jwtSecret, nil
			})

			if err != nil || !token.Valid {
				next.ServeHTTP(w, r)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			userID, ok := claims["user_id"].(float64)
			if !ok {
				next.ServeHTTP(w, r)
				return
			}

			var user models.User
			err = db.QueryRow(`
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
			`, int(userID)).Scan(
				&user.ID, &user.Username, &user.FirstName, &user.LastName,
				&user.ProfileImage, &user.Role, &user.CreatedAt,
				&user.TotalPoints, &user.ChallengesCompleted,
			)
			if err == nil {
				ctx := context.WithValue(r.Context(), UserContextKey, user)
				r = r.WithContext(ctx)
			}

			next.ServeHTTP(w, r)
		})
	}
}

func AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(UserContextKey).(models.User)
		if user.Role != "admin" {
			http.Error(w, "Admin access required", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func GenerateJWT(userID int, cfg *config.Config) (string, error) {
	jwtSecret := []byte(cfg.JWTSecret)
	
	// Set expiration based on configuration
	expirationTime := time.Now().Add(time.Duration(cfg.JWTExpirationHours) * time.Hour)
	
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     expirationTime.Unix(),
		"iat":     time.Now().Unix(),
	})

	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}