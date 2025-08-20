-- Orlando Challenge App - PostgreSQL Initialization Script
-- This script sets up the database schema for production

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    profile_image VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    total_points INTEGER DEFAULT 0,
    challenges_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(255),
    points INTEGER NOT NULL,
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'available',
    completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_post_id INTEGER,
    completed_at TIMESTAMP,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    challenge_type VARCHAR(50) DEFAULT 'exclusive',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    media_url VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    caption TEXT,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create temp_media table for temporary uploads
CREATE TABLE IF NOT EXISTS temp_media (
    media_id VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url VARCHAR(255) NOT NULL,
    media_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

-- Create challenge_submissions table for open challenges
CREATE TABLE IF NOT EXISTS challenge_submissions (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_assigned_to ON challenges(assigned_to);
CREATE INDEX IF NOT EXISTS idx_challenges_completed_by ON challenges(completed_by);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(challenge_type);
CREATE INDEX IF NOT EXISTS idx_challenges_created_at ON challenges(created_at);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_challenge_id ON posts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_revoked ON posts(revoked);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

CREATE INDEX IF NOT EXISTS idx_temp_media_expires_at ON temp_media(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_media_user_id ON temp_media(user_id);

CREATE INDEX IF NOT EXISTS idx_submissions_challenge_id ON challenge_submissions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON challenge_submissions(user_id);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Add foreign key constraint for completed_post_id (deferred to avoid circular dependency)
ALTER TABLE challenges 
ADD CONSTRAINT fk_challenges_completed_post_id 
FOREIGN KEY (completed_post_id) REFERENCES posts(id) ON DELETE SET NULL
DEFERRABLE INITIALLY DEFERRED;

-- Create a function to clean up expired temp media
CREATE OR REPLACE FUNCTION cleanup_expired_temp_media()
RETURNS void AS $$
BEGIN
    DELETE FROM temp_media WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Set up proper permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orlando_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orlando_user;
GRANT EXECUTE ON FUNCTION cleanup_expired_temp_media() TO orlando_user;

-- Insert some sample data for testing (optional - remove in production)
-- Uncomment the lines below if you want sample data

/*
-- Insert admin user (password: admin123)
INSERT INTO users (username, password_hash, first_name, last_name, role) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert sample user (password: password123)
INSERT INTO users (username, password_hash, first_name, last_name) 
VALUES ('testuser', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Test', 'User')
ON CONFLICT (username) DO NOTHING;

-- Insert sample challenges
INSERT INTO challenges (title, description, points, challenge_type) VALUES
('Photo Challenge: Main Street', 'Take a photo of yourself on Main Street USA at Magic Kingdom', 100, 'exclusive'),
('Video Challenge: Ride Experience', 'Record a 30-second video of your favorite ride experience', 150, 'open'),
('Scavenger Hunt: Hidden Mickey', 'Find and photograph a hidden Mickey anywhere in the parks', 75, 'open')
ON CONFLICT DO NOTHING;
*/

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Orlando Challenge App database initialization completed successfully!';
END $$;