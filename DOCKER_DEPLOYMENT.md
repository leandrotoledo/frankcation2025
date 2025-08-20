# Docker Production Deployment Guide

This guide covers deploying the Orlando Challenge App using Docker containers for `frankcation.com`.

## 🐳 **Docker Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare CDN                           │
│                  (HTTPS Termination)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Nginx Frontend                              │
│              (Port 80 → Container)                         │
│   • Serves React app                                       │
│   • Proxies API requests                                   │
│   • Handles static assets                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│               Go Backend API                               │
│              (Port 8080 → Container)                      │
│   • REST API endpoints                                     │
│   • File uploads                                          │
│   • Authentication                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              PostgreSQL Database                           │
│              (Port 5432 → Container)                      │
│   • User data                                             │
│   • Challenges & posts                                    │
│   • Persistent volumes                                    │
└─────────────────────────────────────────────────────────────┘
```

## 📦 **Container Services**

### Frontend Container (Nginx + React)
- **Image**: Custom build from `frontend/Dockerfile`
- **Port**: 80 (HTTP)
- **Features**: Static file serving, API proxying, caching, rate limiting

### Backend Container (Go API)
- **Image**: Custom build from `backend/Dockerfile` 
- **Port**: 8080 (Internal)
- **Features**: REST API, file uploads, JWT authentication

### Database Container (PostgreSQL)
- **Image**: `postgres:15-alpine`
- **Port**: 5432 (Internal)
- **Features**: Data persistence, automatic schema setup

## 🚀 **Quick Start Deployment**

### 1. Server Prerequisites

```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group changes
```

### 2. Clone and Configure

```bash
# Clone your repository
git clone <your-repo-url> orlando-app
cd orlando-app

# Create production environment file
cp .env.docker .env

# Edit the environment variables
nano .env
```

**Required Environment Variables:**
```bash
# CRITICAL: Change these values!
DB_PASSWORD=your-super-secure-database-password-change-this
JWT_SECRET=your-super-secret-jwt-key-for-production-at-least-32-characters-long
```

### 3. Deploy

```bash
# Build and start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## 🔧 **Detailed Configuration**

### Environment Variables

The `docker-compose.yml` uses the following environment structure:

#### Database Configuration
- `DB_PASSWORD`: PostgreSQL password (REQUIRED)
- `POSTGRES_DB`: Database name (default: orlando_app)
- `POSTGRES_USER`: Database user (default: orlando_user)

#### Backend Configuration
- `JWT_SECRET`: JWT signing secret (REQUIRED, 32+ chars)
- `ALLOWED_ORIGINS`: CORS origins (frankcation.com)
- `UPLOAD_PATH`: File upload path (/app/uploads)
- `MAX_FILE_SIZE`: Max upload size (50MB)

#### Frontend Configuration
- `EXPO_PUBLIC_API_BASE_URL`: API endpoint (https://frankcation.com)
- `EXPO_PUBLIC_ENVIRONMENT`: Environment (production)

### Docker Volumes

```bash
# Database persistence
postgres_data: /var/lib/postgresql/data

# File uploads persistence
uploads_data: /app/uploads
```

### Network Configuration

All containers communicate through the `orlando-network` bridge network:
- Frontend → Backend: `http://backend:8080`
- Backend → Database: `postgres://orlando_user:password@database:5432/orlando_app`

## 🔄 **Management Commands**

### Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart backend

# View service status
docker-compose ps

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose exec database psql -U orlando_user -d orlando_app

# Backup database
docker-compose exec database pg_dump -U orlando_user orlando_app > backup.sql

# Restore database
docker-compose exec -T database psql -U orlando_user orlando_app < backup.sql

# Reset database (WARNING: Destroys all data)
docker-compose down -v
docker volume rm orlando_postgres_data
docker-compose up -d
```

### File Management

```bash
# View uploaded files
docker-compose exec backend ls -la /app/uploads

# Backup uploads
docker run --rm -v orlando_uploads_data:/source -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz -C /source .

# Restore uploads
docker run --rm -v orlando_uploads_data:/target -v $(pwd):/backup alpine tar xzf /backup/uploads-backup.tar.gz -C /target
```

## 🔧 **Updates and Deployment**

### Application Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose build --no-cache
docker-compose up -d

# Alternative: Update specific service
docker-compose build backend
docker-compose up -d backend
```

### Database Migrations

```bash
# Run migrations manually if needed
docker-compose exec backend ./main --migrate

# Or recreate database with new schema
docker-compose down
docker volume rm orlando_postgres_data
docker-compose up -d
```

## 📊 **Monitoring and Health Checks**

### Built-in Health Checks

Each service includes health checks:

```bash
# Check health status
docker-compose ps

# Detailed health information
docker inspect orlando-backend | grep -A 10 Health
```

### Manual Health Checks

```bash
# Test frontend
curl -f http://localhost/health

# Test backend API
curl -f http://localhost/leaderboard

# Test database
docker-compose exec database pg_isready -U orlando_user
```

### Log Monitoring

```bash
# Follow all logs
docker-compose logs -f

# Filter by service
docker-compose logs -f backend | grep ERROR

# Export logs
docker-compose logs --since 24h > application.log
```

## 🔒 **Security Considerations**

### Production Security Checklist

- [ ] **Strong Passwords**: Database and JWT secrets
- [ ] **Environment Variables**: No hardcoded secrets
- [ ] **File Permissions**: Proper container user permissions
- [ ] **Network Isolation**: Services communicate only through defined networks
- [ ] **Volume Security**: Persistent data properly secured
- [ ] **Log Security**: No sensitive data in logs

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 80/tcp    # HTTP (Cloudflare)
sudo ufw allow 443/tcp   # HTTPS (Cloudflare)
sudo ufw allow 22/tcp    # SSH
sudo ufw deny 5432/tcp   # Block direct database access
sudo ufw deny 8080/tcp   # Block direct backend access
sudo ufw enable
```

## 🚨 **Troubleshooting**

### Common Issues

#### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check configuration
docker-compose config

# Validate environment
docker-compose exec service-name env
```

#### Database Connection Issues
```bash
# Check database status
docker-compose exec database pg_isready

# Verify credentials
docker-compose exec database psql -U orlando_user -d orlando_app -c "SELECT version();"

# Check network connectivity
docker-compose exec backend nc -z database 5432
```

#### File Upload Issues
```bash
# Check upload directory permissions
docker-compose exec backend ls -la /app/uploads

# Check disk space
docker-compose exec backend df -h

# Monitor upload logs
docker-compose logs -f backend | grep upload
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# Monitor container logs
docker-compose logs -f | grep -E "(ERROR|WARN|slow)"

# Check database performance
docker-compose exec database psql -U orlando_user -d orlando_app -c "SELECT * FROM pg_stat_activity;"
```

### Performance Optimization

#### Resource Limits

Add to `docker-compose.yml` services:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### Database Optimization

```sql
-- Run inside database container
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM posts ORDER BY created_at DESC LIMIT 20;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats WHERE tablename = 'posts';
```

## 📋 **Maintenance Schedule**

### Daily
- Monitor container health status
- Check log files for errors
- Verify backup processes

### Weekly  
- Update container images
- Clean unused Docker resources
- Database performance review

### Monthly
- Security updates
- Full system backup
- Resource usage analysis

### Cleanup Commands

```bash
# Remove unused containers and images
docker system prune -a

# Clean up volumes (BE CAREFUL!)
docker volume prune

# Remove old log files
docker-compose logs --since 7d > recent.log
```

## 🔄 **Backup and Recovery**

### Automated Backup Script

Create `/home/user/backup.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/orlando-app"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T database pg_dump -U orlando_user orlando_app > $BACKUP_DIR/db_$DATE.sql

# Backup uploads
docker run --rm -v orlando_uploads_data:/source -v $BACKUP_DIR:/backup alpine tar czf /backup/uploads_$DATE.tar.gz -C /source .

# Backup configuration
cp .env $BACKUP_DIR/env_$DATE.backup
cp docker-compose.yml $BACKUP_DIR/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable and add to crontab
chmod +x /home/user/backup.sh
echo "0 2 * * * /home/user/backup.sh" | crontab -
```

This Docker setup provides a complete, production-ready deployment that's easy to manage and scale! 🚀