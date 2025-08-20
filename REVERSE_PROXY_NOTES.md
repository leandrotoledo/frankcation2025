# Reverse Proxy Configuration Notes

## Frontend Service
- **Port**: 3000
- **Purpose**: Serves static React/Expo web build files
- **Protocol**: HTTP (designed to run behind reverse proxy)

## Backend Service  
- **Port**: 8080
- **Purpose**: REST API, file uploads, authentication
- **Protocol**: HTTP

## Required Reverse Proxy Routes

Your external reverse proxy should handle the following routes:

### API Routes → Backend (port 8080)
- `/api/*` → `http://backend:8080/`
- `/auth/*` → `http://backend:8080/auth/`
- `/uploads/*` → `http://backend:8080/uploads/`
- `/media/*` → `http://backend:8080/media/`
- `/leaderboard` → `http://backend:8080/leaderboard`
- `/feed` → `http://backend:8080/feed`

### Frontend Routes → Frontend (port 3000)
- `/*` → `http://frontend:3000/` (fallback to serve React app)

## Example Nginx Configuration
```nginx
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:8080;
}

server {
    listen 80;
    
    # API routes to backend
    location ~ ^/(api|auth|uploads|media|leaderboard|feed) {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
    
    # All other routes to frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Security Considerations
- Add SSL/TLS termination at reverse proxy level
- Add rate limiting for API endpoints
- Add security headers (CORS, CSP, etc.)
- Consider adding authentication for admin endpoints