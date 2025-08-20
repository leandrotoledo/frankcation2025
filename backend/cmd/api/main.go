package main

import (
	"fmt"
	"log"
	"net/http"
	"orlando-app/internal/config"
	"orlando-app/internal/database"
	"orlando-app/internal/handlers"
	"orlando-app/internal/middleware"

	gorillaHandlers "github.com/gorilla/handlers"
	"github.com/gorilla/mux"
)

func main() {
	// Load configuration
	cfg := config.Load()
	
	log.Printf("🚀 Starting Orlando Challenge App")
	log.Printf("📍 Environment: %s", cfg.Environment)
	log.Printf("🔌 Port: %s", cfg.Port)
	log.Printf("💾 Database: %s", cfg.DatabaseURL)
	
	// Initialize database
	db, err := database.NewDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	if err := db.CreateTables(); err != nil {
		log.Fatal("Failed to create tables:", err)
	}

	// Only create default admin in development
	if cfg.Environment == "development" {
		if err := db.CreateDefaultAdmin(); err != nil {
			log.Fatal("Failed to create default admin:", err)
		}
	}

	h := handlers.NewHandler(db.DB, cfg)

	r := mux.NewRouter()

	// CORS configuration from environment
	log.Printf("🌐 CORS Origins: %v", cfg.AllowedOrigins)
	corsHandler := gorillaHandlers.CORS(
		gorillaHandlers.AllowedOrigins(cfg.AllowedOrigins),
		gorillaHandlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"}),
		gorillaHandlers.AllowedHeaders([]string{"Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"}),
		gorillaHandlers.AllowCredentials(),
		gorillaHandlers.ExposedHeaders([]string{"Content-Length", "Content-Type"}),
	)

	// Auth routes (no auth required)
	r.HandleFunc("/auth/register", h.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/auth/login", h.Login).Methods("POST", "OPTIONS")

	// Protected routes
	protected := r.PathPrefix("/").Subrouter()
	protected.Use(middleware.AuthMiddleware(db.DB, cfg))

	// User routes
	protected.HandleFunc("/users/profile", h.GetProfile).Methods("GET")
	protected.HandleFunc("/users/profile", h.UpdateProfile).Methods("PUT")
	protected.HandleFunc("/users/{id}", h.GetUser).Methods("GET")

	// Challenge routes
	protected.HandleFunc("/challenges", h.GetChallenges).Methods("GET")
	protected.HandleFunc("/challenges/{id}", h.GetChallenge).Methods("GET")
	protected.HandleFunc("/challenges/{id}/pick", h.PickChallenge).Methods("POST")
	protected.HandleFunc("/challenges/{id}/cancel", h.CancelChallenge).Methods("POST")
	protected.HandleFunc("/challenges/{id}/complete", h.CompleteChallenge).Methods("POST")

	// Media upload routes
	protected.HandleFunc("/media/upload", h.UploadMedia).Methods("POST")

	// Admin challenge routes
	admin := protected.PathPrefix("/admin").Subrouter()
	admin.Use(middleware.AdminMiddleware)
	admin.HandleFunc("/challenges", h.GetAllChallenges).Methods("GET")
	admin.HandleFunc("/challenges", h.CreateChallenge).Methods("POST")
	admin.HandleFunc("/challenges/{id}", h.UpdateChallenge).Methods("PUT")
	admin.HandleFunc("/challenges/{id}", h.DeleteChallenge).Methods("DELETE")
	admin.HandleFunc("/challenges/{id}/unassign", h.UnassignChallenge).Methods("POST")
	admin.HandleFunc("/challenges/{id}/award", h.AwardChallenge).Methods("POST")
	admin.HandleFunc("/posts/{id}/revoke", h.RevokePostPoints).Methods("POST")

	// Feed routes
	feedRouter := r.PathPrefix("/feed").Subrouter()
	feedRouter.Use(middleware.OptionalAuthMiddleware(db.DB, cfg))
	feedRouter.HandleFunc("", h.GetFeed).Methods("GET")

	// Post routes
	protected.HandleFunc("/posts/{id}", h.GetPost).Methods("GET")
	protected.HandleFunc("/posts/{id}", h.DeletePost).Methods("DELETE")
	protected.HandleFunc("/posts/{id}/like", h.LikePost).Methods("POST")
	protected.HandleFunc("/posts/{id}/like", h.UnlikePost).Methods("DELETE")
	protected.HandleFunc("/posts/{id}/comments", h.GetComments).Methods("GET")
	protected.HandleFunc("/posts/{id}/comments", h.CreateComment).Methods("POST")

	// Leaderboard routes (no auth required)
	r.HandleFunc("/leaderboard", h.GetLeaderboard).Methods("GET")

	// Serve uploaded files with CORS headers for media playback
	uploadsHandler := http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadPath+"/")))
	r.PathPrefix("/uploads/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Add CORS headers for media files - use first allowed origin instead of wildcard in production
		if cfg.Environment == "production" && len(cfg.AllowedOrigins) > 0 {
			w.Header().Set("Access-Control-Allow-Origin", cfg.AllowedOrigins[0])
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges")
		w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
		
		// Handle OPTIONS preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		uploadsHandler.ServeHTTP(w, r)
	}))

	// Start server
	serverAddr := fmt.Sprintf("0.0.0.0:%s", cfg.Port)
	log.Printf("🌐 Server starting on %s", serverAddr)
	log.Printf("📁 Upload path: %s", cfg.UploadPath)
	if cfg.Environment == "production" {
		log.Println("🔒 Production mode - security settings applied")
	}
	
	log.Fatal(http.ListenAndServe(serverAddr, corsHandler(r)))
}