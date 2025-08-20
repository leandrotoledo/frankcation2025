# CLAUDE.md - Theme Park Challenge App (MVP)

## Project Overview

A mobile-first web application for gamifying theme park visits through photo/video challenges, points, and social interactions. Built with React Native/Expo (frontend) and Go (backend).

## Core Architecture

### Tech Stack
- **Frontend**: React Native with Expo (web deployment for mobile browsers)
- **Backend**: Go REST API
- **Database**: SQLite
- **Storage**: Local file system for media files
- **Authentication**: JWT tokens with refresh mechanism

### Target Platforms
- Primary: Mobile web browsers (iOS Safari, Chrome Android)
- Secondary: Desktop web browsers (responsive design)

## Feature Specifications

### 1. User Management

#### User Registration
- Required fields: Username, Password, First Name, Last Name
- Profile photo upload capability

#### Authentication
- JWT-based authentication
- Secure password hashing (bcrypt)
- Session management with refresh tokens
- Role-based access (User, Admin)

### 2. Challenge System

#### How It Works
- Admins pre-load challenges into the system
- Users browse available challenges in the Challenges view
- Each challenge shows: title, description, image, and point value
- **Exclusive assignment**: When a user picks a challenge, it becomes unavailable to others
- **One active at a time**: Users can only work on one challenge at a time
- Users must either complete or cancel their current challenge before picking another
- After completing a challenge, users can immediately pick a new one
- Users can complete multiple challenges throughout the game
- Cancelled challenges return to the available pool for others to pick

#### Challenge Structure
```
Challenge {
  id: string
  title: string
  description: string
  image_url: string
  points: number
  status: "available" | "in_progress" | "completed"
  assigned_to: user_id | null
  created_at: timestamp
}
```

### 3. Feed & Social Features

#### Completing Challenges
- Users post an image or video as proof of completion
- Media compression applied for optimal loading
- Post appears in the main feed timeline

#### Feed Features
- Instagram-style timeline of completed challenges
- Like system for posts
- Commenting on posts
- Users can delete their own posts (challenge returns to pool)

#### Post Structure
```
Post {
  id: string
  user_id: string
  challenge_id: string
  media_url: string
  media_type: "photo" | "video"
  caption: string
  points_earned: number
  likes_count: number
  created_at: timestamp
}
```

### 4. Scoring & Leaderboard

#### Point System
- Points awarded upon challenge completion
- Real-time point tracking
- Points removed if post is deleted

#### Leaderboard Display
- Full rankings view showing all users
- Total points displayed for each user

### 5. Admin Dashboard

#### Admin Functions
- Create new challenges
- Edit/delete existing challenges
- Review completed challenges
- Reject inappropriate submissions
- View all users and their statistics
- Manual point adjustments if needed

## UI/UX Guidelines

### Design Philosophy
- **Inspiration**: Strava app's clean, activity-focused interface
- **Navigation**: Fixed bottom tab bar with icons
- **Color Palette**: 
  - Vibrant vacation colors
  - Orlando sunshine oranges/yellows
  - Disney magic purples/blues
  - Theme park excitement reds/pinks
  - Clean white backgrounds with colorful accents

### Navigation Structure (Bottom Tab Bar)
1. **Home** 🏠 - Feed of completed challenges
2. **Challenges** 🎯 - Browse and pick challenges
3. **Leaderboard** 🏆 - Rankings and scores
4. **Profile** 👤 - User stats and settings

### Key Screens

#### Login/Signup
- Welcoming, vacation-themed design
- Simple form with clear CTAs
- Password strength indicator

#### Home Feed
- Vertical scroll of challenge posts
- Each post shows: user, challenge name, media, points earned
- Like button and comment count
- Pull-to-refresh functionality

#### Challenges View
- Grid or card layout of available challenges
- Clear "PICK CHALLENGE" button
- Filter by points or search by name
- Visual indicator for current active challenge

#### Challenge Detail
- Full description and requirements
- Point value prominently displayed
- "PICK THIS CHALLENGE" or "COMPLETE CHALLENGE" button
- "CANCEL CHALLENGE" option if active

#### Upload Screen
- Camera/gallery selection
- Preview before posting
- Optional caption
- Submit button with loading state

#### Leaderboard
- Top 3 with gold, silver, bronze styling
- Scrollable list for remaining users
- User's own position highlighted

#### Profile
- Profile picture and name
- Total points earned
- Number of challenges completed
- Completed challenges history
- Current active challenge (if any)
- Settings/logout option

### Mobile-First Considerations
- Large touch targets (minimum 44x44px)
- Bottom tab navigation for thumb reach
- Swipe gestures where appropriate
- Pull-to-refresh on scrollable views
- Optimized image loading (lazy loading)
- Responsive grid layouts

## Code Structure

### Frontend Structure
```
/src
  /components
    /common       # Buttons, Cards, Headers, etc.
    /feed         # PostCard, CommentSection, LikeButton
    /challenges   # ChallengeCard, ChallengeDetail
    /navigation   # TabBar, NavigationStack
  /screens        # Main app screens
  /services       # API calls
  /utils          # Helpers, formatters
  /context        # Auth context, User context
```

### Backend Structure
```
/cmd
  /api           # Main application entry
/internal
  /handlers      # HTTP request handlers
  /models        # Data models
  /middleware    # Auth, logging
  /database      # SQLite connection and queries
/uploads         # Local media storage
  /profiles      # Profile pictures
  /challenges    # Challenge images
  /posts         # User submissions
```

## Database Schema (SQLite)

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  profile_image TEXT,
  role TEXT DEFAULT 'user',
  total_points INTEGER DEFAULT 0,
  challenges_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Challenges Table
```sql
CREATE TABLE challenges (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  points INTEGER NOT NULL,
  assigned_to INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Posts Table
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  challenge_id INTEGER REFERENCES challenges(id),
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Likes Table
```sql
CREATE TABLE likes (
  user_id INTEGER REFERENCES users(id),
  post_id INTEGER REFERENCES posts(id),
  PRIMARY KEY (user_id, post_id)
);
```

### Comments Table
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  post_id INTEGER REFERENCES posts(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Authentication
- `POST /auth/register` - Create new user account
- `POST /auth/login` - Login user
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout user

### Challenges
- `GET /challenges` - List available challenges
- `GET /challenges/:id` - Get challenge details
- `POST /challenges/:id/pick` - Pick a challenge
- `POST /challenges/:id/cancel` - Cancel active challenge
- `POST /challenges/:id/complete` - Submit completion

### Admin Challenges
- `POST /admin/challenges` - Create new challenge
- `PUT /admin/challenges/:id` - Update challenge
- `DELETE /admin/challenges/:id` - Delete challenge

### Feed
- `GET /feed` - Get feed posts (paginated)
- `GET /posts/:id` - Get single post details
- `DELETE /posts/:id` - Delete own post

### Social
- `POST /posts/:id/like` - Like a post
- `DELETE /posts/:id/like` - Unlike a post
- `GET /posts/:id/comments` - Get post comments
- `POST /posts/:id/comments` - Add comment

### Leaderboard
- `GET /leaderboard` - Get user rankings

### Users
- `GET /users/profile` - Get own profile
- `PUT /users/profile` - Update profile
- `GET /users/:id` - Get user public profile

## Development Phases

### Phase 1: Foundation (Week 1)
- User authentication (register/login)
- Database setup with SQLite
- Basic challenge CRUD (admin)
- JWT implementation

### Phase 2: Core Challenge System (Week 2)
- Challenge picking/canceling logic
- Challenge completion with media upload
- Points calculation
- Local file storage setup

### Phase 3: Social Features (Week 3)
- Feed display
- Like functionality
- Comments system
- Post deletion

### Phase 4: Polish & Deploy (Week 4)
- Leaderboard implementation
- UI/UX improvements
- Mobile optimizations
- Bug fixes and testing

## Security Considerations

- Input validation on all endpoints
- File size limits (10MB images, 50MB videos)
- Allowed file types only (.jpg, .png, .mp4, .mov)
- SQL injection prevention (prepared statements)
- Rate limiting on API endpoints
- Secure file naming to prevent directory traversal

## Performance Optimizations

- Image compression before storage
- Thumbnail generation for feed
- Pagination (20 items per page)
- Database indexing on foreign keys
- Lazy loading for images
- Caching headers for static files

## Testing Approach

### Manual Testing Checklist
- User registration and login flow
- Challenge pick/complete/cancel cycle
- Media upload (photo and video)
- Feed scrolling and interactions
- Leaderboard accuracy
- Admin functions
- Mobile responsiveness

### Key Test Scenarios
1. Can't pick a new challenge when one is already active
2. Can pick a new challenge immediately after completing one
3. Deleted post returns challenge to pool and removes points
4. Only assigned user can complete their challenge
5. Points accumulate correctly across multiple completions
6. Media uploads handle large files gracefully
7. User can see their challenge history in profile

## Prompting Claude for Development

### Context to Always Provide
- Current file structure
- Relevant database schema
- Existing API endpoints being used
- Any error messages or unexpected behavior