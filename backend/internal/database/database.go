package database

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type DB struct {
	*sql.DB
}

func NewDB(dataSourceName string) (*DB, error) {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		return nil, err
	}

	if err = db.Ping(); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func (db *DB) CreateTables() error {
	// First create tables
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			profile_image TEXT,
			role TEXT DEFAULT 'user',
			total_points INTEGER DEFAULT 0,
			challenges_completed INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS challenges (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT NOT NULL,
			image_url TEXT,
			points INTEGER NOT NULL,
			assigned_to INTEGER REFERENCES users(id),
			status TEXT DEFAULT 'available',
			completed_by INTEGER REFERENCES users(id),
			completed_post_id INTEGER REFERENCES posts(id),
			completed_at TIMESTAMP,
			start_date TIMESTAMP,
			end_date TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS posts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER REFERENCES users(id),
			challenge_id INTEGER REFERENCES challenges(id),
			media_url TEXT NOT NULL,
			media_type TEXT NOT NULL,
			caption TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS likes (
			user_id INTEGER REFERENCES users(id),
			post_id INTEGER REFERENCES posts(id),
			PRIMARY KEY (user_id, post_id)
		);`,
		`CREATE TABLE IF NOT EXISTS comments (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER REFERENCES users(id),
			post_id INTEGER REFERENCES posts(id),
			content TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS temp_media (
			media_id TEXT PRIMARY KEY,
			user_id INTEGER REFERENCES users(id),
			media_url TEXT NOT NULL,
			media_type TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			expires_at TIMESTAMP NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);`,
		`CREATE INDEX IF NOT EXISTS idx_challenges_assigned_to ON challenges(assigned_to);`,
		`CREATE INDEX IF NOT EXISTS idx_challenges_completed_by ON challenges(completed_by);`,
		`CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`,
		`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);`,
		`CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);`,
		`CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);`,
		`CREATE INDEX IF NOT EXISTS idx_temp_media_expires_at ON temp_media(expires_at);`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return fmt.Errorf("failed to execute query: %v", err)
		}
	}

	// Add migration for start_date and end_date columns if they don't exist
	migrationQueries := []string{
		`ALTER TABLE challenges ADD COLUMN start_date TIMESTAMP;`,
		`ALTER TABLE challenges ADD COLUMN end_date TIMESTAMP;`,
		`ALTER TABLE posts ADD COLUMN revoked BOOLEAN DEFAULT FALSE;`,
		`ALTER TABLE challenges ADD COLUMN challenge_type TEXT DEFAULT 'exclusive';`,
		`CREATE TABLE IF NOT EXISTS challenge_submissions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			challenge_id INTEGER REFERENCES challenges(id),
			user_id INTEGER REFERENCES users(id),
			post_id INTEGER REFERENCES posts(id),
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(challenge_id, user_id)
		);`,
	}

	for _, query := range migrationQueries {
		if _, err := db.Exec(query); err != nil {
			// Ignore errors for columns that already exist
			if err.Error() != "duplicate column name: start_date" && 
			   err.Error() != "duplicate column name: end_date" &&
			   err.Error() != "duplicate column name: revoked" {
				log.Printf("Migration warning: %v", err)
			}
		}
	}

	log.Println("Database tables created successfully")
	return nil
}

func (db *DB) CreateDefaultAdmin() error {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
	if err != nil {
		return err
	}

	if count == 0 {
		// Hash the password properly
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		_, err = db.Exec(`
			INSERT INTO users (username, password_hash, first_name, last_name, role)
			VALUES ('admin', ?, 'Admin', 'User', 'admin')
		`, string(hashedPassword))
		if err != nil {
			return err
		}
		log.Println("Default admin user created (username: admin, password: admin123)")
	}

	return nil
}

func (db *DB) LoadChallengesFromCSV(csvPath string) error {
	// Check if challenges already exist
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM challenges").Scan(&count)
	if err != nil {
		return err
	}

	if count > 0 {
		log.Printf("Challenges already exist (%d), skipping CSV import", count)
		return nil
	}

	// Open and read CSV file
	file, err := os.Open(csvPath)
	if err != nil {
		return fmt.Errorf("failed to open CSV file: %v", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return fmt.Errorf("failed to read CSV: %v", err)
	}

	if len(records) < 2 {
		return fmt.Errorf("CSV file must have at least a header and one data row")
	}

	// Skip header row
	for i, record := range records[1:] {
		if len(record) < 6 {
			log.Printf("Skipping row %d: insufficient columns", i+2)
			continue
		}

		title := record[0]
		description := record[1]
		pointsStr := record[2]
		challengeType := record[3]
		startDateStr := record[4]
		endDateStr := record[5]

		// Parse points
		points, err := strconv.Atoi(pointsStr)
		if err != nil {
			log.Printf("Skipping row %d: invalid points value '%s'", i+2, pointsStr)
			continue
		}

		// Parse start date
		var startDate *time.Time
		if startDateStr != "" {
			parsed, err := time.Parse("1/2/2006", startDateStr)
			if err != nil {
				log.Printf("Warning: invalid start date '%s' for challenge '%s', using nil", startDateStr, title)
			} else {
				startDate = &parsed
			}
		}

		// Parse end date
		var endDate *time.Time
		if endDateStr != "" {
			parsed, err := time.Parse("1/2/2006", endDateStr)
			if err != nil {
				log.Printf("Warning: invalid end date '%s' for challenge '%s', using nil", endDateStr, title)
			} else {
				endDate = &parsed
			}
		}

		// Insert challenge into database
		_, err = db.Exec(`
			INSERT INTO challenges (title, description, points, challenge_type, start_date, end_date, status)
			VALUES (?, ?, ?, ?, ?, ?, 'available')
		`, title, description, points, challengeType, startDate, endDate)

		if err != nil {
			log.Printf("Failed to insert challenge '%s': %v", title, err)
			continue
		}
	}

	log.Printf("Successfully loaded %d challenges from CSV", len(records)-1)
	return nil
}