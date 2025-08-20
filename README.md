# Orlando Challenge App 🎢

A mobile-first web application for gamifying theme park visits through photo/video challenges, points, and social interactions.

## 🚀 **Quick Start with Docker**

### One-Command Deployment

```bash
# Clone and deploy
git clone <your-repo-url> orlando-app
cd orlando-app

# Setup and deploy
./deploy.sh setup
./deploy.sh deploy
```

Your app will be running at `http://localhost` 🎉

## 🐳 **Production Architecture**

```
Cloudflare CDN → Nginx Frontend → Go Backend → PostgreSQL
    (HTTPS)        (Port 80)      (Port 8080)   (Port 5432)
```

## 📦 **What's Included**

### Frontend (React Native/Expo + Nginx)
- ✅ Mobile-first web app
- ✅ Instagram-style feed
- ✅ Challenge system
- ✅ Real-time leaderboard
- ✅ File upload with compression

### Backend (Go + PostgreSQL)
- ✅ REST API with JWT authentication
- ✅ Challenge management (exclusive & open)
- ✅ Social features (likes, comments)
- ✅ Admin dashboard
- ✅ File upload handling

### Infrastructure
- ✅ Docker containerization
- ✅ PostgreSQL database
- ✅ Nginx reverse proxy
- ✅ Environment configuration
- ✅ Health checks & monitoring

## 🛠️ **Management Commands**

```bash
# Application management
./deploy.sh status    # Check health & status
./deploy.sh logs      # View application logs
./deploy.sh backup    # Backup database & files
./deploy.sh update    # Update application

# Service management
./deploy.sh stop      # Stop all services
./deploy.sh restart   # Restart all services
./deploy.sh clean     # Clean Docker resources
```

## 🔧 **Configuration**

### Required Environment Variables

Create `.env` file with:

```bash
# Database password (REQUIRED)
DB_PASSWORD=your-super-secure-database-password

# JWT secret (REQUIRED - 32+ characters)
JWT_SECRET=your-super-secret-jwt-key-for-production-at-least-32-characters-long
```

### Production Domain

Configured for `frankcation.com` with Cloudflare:
- **Frontend**: https://frankcation.com
- **API**: https://frankcation.com/api/
- **CORS**: Restricted to frankcation.com

## 📚 **Documentation**

- **[Docker Deployment Guide](DOCKER_DEPLOYMENT.md)** - Complete Docker setup
- **[Environment Configuration](ENVIRONMENT.md)** - Environment variables
- **[Cloudflare Deployment](CLOUDFLARE_DEPLOYMENT.md)** - Cloudflare + server setup

## 🎯 **Features**

### Challenge System
- **Exclusive Challenges**: One user at a time
- **Open Challenges**: Multiple participants, admin picks winner
- **Point System**: Dynamic scoring based on completion
- **Media Upload**: Photos and videos with compression

### Social Features
- **Feed**: Instagram-style timeline
- **Interactions**: Likes and comments
- **Leaderboard**: Real-time rankings
- **Profiles**: User stats and challenge history

### Admin Dashboard
- **Challenge Management**: Create, edit, delete challenges
- **Content Moderation**: Approve/reject submissions
- **User Management**: View stats and activity
- **Points Management**: Award/revoke points

## 🛡️ **Security Features**

- ✅ JWT authentication with secure secrets
- ✅ CORS protection (domain-restricted)
- ✅ Rate limiting on API endpoints
- ✅ File upload validation & size limits
- ✅ SQL injection protection
- ✅ XSS protection headers
- ✅ Environment-based configuration

## 📊 **Production Ready**

### Performance
- ✅ Container health checks
- ✅ Nginx caching & compression
- ✅ Database indexing
- ✅ Lightweight infinite scroll
- ✅ Image optimization

### Monitoring
- ✅ Application logs
- ✅ Health check endpoints
- ✅ Resource monitoring
- ✅ Automated backups

### Deployment
- ✅ Zero-downtime updates
- ✅ Database migrations
- ✅ Volume persistence
- ✅ Service isolation

## 🔄 **Development vs Production**

### Development
```bash
# Backend
cd backend && go run cmd/api/main.go

# Frontend  
cd frontend && npm start
```

### Production
```bash
# Docker (recommended)
./deploy.sh deploy

# Manual deployment
docker-compose up -d
```

## 🆘 **Troubleshooting**

### Quick Health Check
```bash
./deploy.sh status
```

### View Logs
```bash
./deploy.sh logs           # All services
./deploy.sh logs backend   # Specific service
```

### Common Issues

**Services won't start:**
```bash
# Check configuration
docker-compose config

# Check environment
cat .env
```

**Database connection issues:**
```bash
# Test database
docker-compose exec database pg_isready

# Check logs
./deploy.sh logs database
```

**File upload problems:**
```bash
# Check permissions
docker-compose exec backend ls -la /app/uploads

# Check disk space
df -h
```

## 📈 **Scaling**

The Docker setup supports easy scaling:

```bash
# Scale backend instances
docker-compose up -d --scale backend=3

# Add load balancer
# Add read replicas for database
# Use Redis for sessions
```

## 🤝 **Contributing**

1. Fork the repository
2. Create feature branch
3. Test with Docker: `./deploy.sh deploy`
4. Submit pull request

## 📄 **License**

This project is licensed under the MIT License.

---

**Ready for production deployment to frankcation.com! 🚀**