package config

import (
	"bufio"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Server configuration
	Port        string
	Environment string // development, staging, production
	
	// Database configuration
	DatabaseURL  string
	DatabaseType string // sqlite, postgres
	
	// Security configuration
	JWTSecret           string
	JWTExpirationHours  int
	
	// CORS configuration
	AllowedOrigins []string
	
	// File upload configuration
	UploadPath     string
	MaxFileSize    int64 // in bytes
	AllowedTypes   []string
	
	// Rate limiting
	RateLimit        int // requests per minute
	RateLimitBurst   int
	
	// Logging
	LogLevel string // debug, info, warn, error
}

func Load() *Config {
	// Load environment file if it exists
	loadEnvFile()
	
	config := &Config{
		// Server defaults
		Port:        getEnv("PORT", "8080"),
		Environment: getEnv("ENVIRONMENT", "development"),
		
		// Database defaults
		DatabaseURL:  getEnv("DATABASE_URL", "./orlando.db"),
		DatabaseType: getEnv("DATABASE_TYPE", "sqlite"),
		
		// Security defaults
		JWTSecret:          getEnvRequired("JWT_SECRET"),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		
		// CORS defaults
		AllowedOrigins: getEnvAsSlice("ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:8081"}),
		
		// File upload defaults
		UploadPath:   getEnv("UPLOAD_PATH", "./uploads"),
		MaxFileSize:  getEnvAsInt64("MAX_FILE_SIZE", 50*1024*1024), // 50MB default
		AllowedTypes: getEnvAsSlice("ALLOWED_FILE_TYPES", []string{"image/jpeg", "image/png", "image/jpg", "video/mp4", "video/quicktime", "video/mov"}),
		
		// Rate limiting defaults
		RateLimit:      getEnvAsInt("RATE_LIMIT", 100),
		RateLimitBurst: getEnvAsInt("RATE_LIMIT_BURST", 200),
		
		// Logging defaults
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}
	
	// Validate critical configuration
	if config.Environment == "production" {
		validateProductionConfig(config)
	}
	
	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvRequired(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return value
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		log.Printf("Invalid integer value for %s: %s, using default: %d", key, valueStr, defaultValue)
		return defaultValue
	}
	return value
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	value, err := strconv.ParseInt(valueStr, 10, 64)
	if err != nil {
		log.Printf("Invalid int64 value for %s: %s, using default: %d", key, valueStr, defaultValue)
		return defaultValue
	}
	return value
}

func getEnvAsSlice(key string, defaultValue []string) []string {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return defaultValue
	}
	
	// Simple comma-separated parsing
	// For production, consider using a proper JSON array or more sophisticated parsing
	result := []string{}
	for _, item := range strings.Split(valueStr, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	
	if len(result) == 0 {
		return defaultValue
	}
	return result
}

func validateProductionConfig(config *Config) {
	issues := []string{}
	
	// Check for development defaults in production
	if config.JWTSecret == "your-secret-key-change-in-production" {
		issues = append(issues, "JWT_SECRET is set to default development value")
	}
	
	if len(config.JWTSecret) < 32 {
		issues = append(issues, "JWT_SECRET should be at least 32 characters long")
	}
	
	if config.DatabaseURL == "./orlando.db" {
		issues = append(issues, "Using SQLite in production is not recommended, consider PostgreSQL")
	}
	
	// Check for insecure CORS
	for _, origin := range config.AllowedOrigins {
		if origin == "*" {
			issues = append(issues, "Wildcard CORS origin (*) is not allowed in production")
			break
		}
	}
	
	if len(issues) > 0 {
		log.Println("⚠️  Production configuration issues detected:")
		for _, issue := range issues {
			log.Printf("   - %s", issue)
		}
		log.Println("Please fix these issues before deploying to production")
	}
}

// loadEnvFile loads environment variables from .env file if it exists
func loadEnvFile() {
	envFile := ".env"
	if _, err := os.Stat(envFile); os.IsNotExist(err) {
		return // .env file doesn't exist, skip loading
	}

	file, err := os.Open(envFile)
	if err != nil {
		log.Printf("Warning: Could not open .env file: %v", err)
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on first = sign
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		// Remove quotes if present
		if len(value) >= 2 && 
		   ((strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")) ||
		    (strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'"))) {
			value = value[1 : len(value)-1]
		}

		// Only set if not already set by actual environment
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Warning: Error reading .env file: %v", err)
	}
}