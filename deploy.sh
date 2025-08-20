#!/bin/bash

# Orlando Challenge App - Production Deployment Script
# Usage: ./deploy.sh [command]
# Commands: setup, deploy, update, backup, logs, status

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="Orlando Challenge App"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
BACKUP_DIR="/backup/orlando-app"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Check if environment file exists
check_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file $ENV_FILE not found!"
        log_info "Creating environment file from template..."
        
        if [[ -f ".env.docker" ]]; then
            cp .env.docker .env
            log_warning "Please edit .env file and update the required variables:"
            log_warning "- DB_PASSWORD"
            log_warning "- JWT_SECRET"
            log_info "After editing, run: ./deploy.sh deploy"
            exit 1
        else
            log_error "No environment template found. Please create $ENV_FILE manually."
            exit 1
        fi
    fi
}

# Validate environment variables
validate_env() {
    source $ENV_FILE
    
    if [[ -z "$DB_PASSWORD" ]] || [[ "$DB_PASSWORD" == "your-super-secure-database-password-change-this" ]]; then
        log_error "DB_PASSWORD is not set or uses default value. Please update $ENV_FILE"
        exit 1
    fi
    
    if [[ -z "$JWT_SECRET" ]] || [[ "$JWT_SECRET" == "CHANGE-THIS-TO-A-STRONG-RANDOM-SECRET-AT-LEAST-32-CHARACTERS-LONG" ]]; then
        log_error "JWT_SECRET is not set or uses default value. Please update $ENV_FILE"
        exit 1
    fi
    
    if [[ ${#JWT_SECRET} -lt 32 ]]; then
        log_error "JWT_SECRET must be at least 32 characters long"
        exit 1
    fi
    
    log_success "Environment validation passed"
}

# Setup function - initial server setup
setup() {
    log_info "Setting up $APP_NAME production environment..."
    
    # Check prerequisites
    check_docker
    
    # Create directories
    log_info "Creating backup directory..."
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown $USER:$USER "$BACKUP_DIR"
    
    # Setup environment
    check_env
    validate_env
    
    # Pull base images
    log_info "Pulling base Docker images..."
    docker pull postgres:15-alpine
    docker pull nginx:alpine
    docker pull golang:1.21-alpine
    docker pull node:18-alpine
    
    # Create Docker network if it doesn't exist
    if ! docker network ls | grep -q "orlando-network"; then
        log_info "Creating Docker network..."
        docker network create orlando-network
    fi
    
    log_success "Setup completed! Run './deploy.sh deploy' to start the application."
}

# Deploy function - build and start services
deploy() {
    log_info "Deploying $APP_NAME..."
    
    check_docker
    check_env
    validate_env
    
    # Stop existing services
    log_info "Stopping existing services..."
    docker-compose down
    
    # Build images
    log_info "Building application images..."
    docker-compose build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    if docker-compose ps | grep -q "unhealthy"; then
        log_error "Some services are unhealthy. Check logs with: ./deploy.sh logs"
        exit 1
    fi
    
    log_success "$APP_NAME deployed successfully!"
    log_info "Application is available at: http://localhost"
    log_info "Check status with: ./deploy.sh status"
}

# Update function - update application
update() {
    log_info "Updating $APP_NAME..."
    
    check_docker
    check_env
    
    # Pull latest code (if in git repo)
    if [[ -d ".git" ]]; then
        log_info "Pulling latest code..."
        git pull origin main
    fi
    
    # Rebuild and restart services
    log_info "Rebuilding services..."
    docker-compose build --no-cache
    
    log_info "Restarting services..."
    docker-compose up -d
    
    log_success "Update completed!"
}

# Backup function
backup() {
    log_info "Creating backup..."
    
    check_docker
    mkdir -p "$BACKUP_DIR"
    
    DATE=$(date +%Y%m%d_%H%M%S)
    
    # Backup database
    log_info "Backing up database..."
    docker-compose exec -T database pg_dump -U orlando_user orlando_app > "$BACKUP_DIR/db_$DATE.sql"
    
    # Backup uploads
    log_info "Backing up uploads..."
    docker run --rm -v orlando_uploads_data:/source -v "$BACKUP_DIR":/backup alpine tar czf /backup/uploads_$DATE.tar.gz -C /source .
    
    # Backup configuration
    log_info "Backing up configuration..."
    cp "$ENV_FILE" "$BACKUP_DIR/env_$DATE.backup"
    cp "$COMPOSE_FILE" "$BACKUP_DIR/"
    
    log_success "Backup completed: $BACKUP_DIR"
    
    # Clean old backups (keep 30 days)
    find "$BACKUP_DIR" -name "*.sql" -mtime +30 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "*.backup" -mtime +30 -delete 2>/dev/null || true
    
    log_info "Cleaned up old backups (30+ days)"
}

# Status function
status() {
    log_info "Checking $APP_NAME status..."
    
    check_docker
    
    echo -e "\n${BLUE}Service Status:${NC}"
    docker-compose ps
    
    echo -e "\n${BLUE}Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    echo -e "\n${BLUE}Health Checks:${NC}"
    
    # Test frontend
    if curl -sf http://localhost/health > /dev/null 2>&1; then
        log_success "Frontend: Healthy"
    else
        log_error "Frontend: Unhealthy"
    fi
    
    # Test backend
    if curl -sf http://localhost/leaderboard > /dev/null 2>&1; then
        log_success "Backend: Healthy"
    else
        log_error "Backend: Unhealthy"
    fi
    
    # Test database
    if docker-compose exec database pg_isready -U orlando_user > /dev/null 2>&1; then
        log_success "Database: Healthy"
    else
        log_error "Database: Unhealthy"
    fi
    
    echo -e "\n${BLUE}Disk Usage:${NC}"
    df -h / | tail -1
    
    echo -e "\n${BLUE}Docker Volume Usage:${NC}"
    docker system df
}

# Logs function
logs() {
    check_docker
    
    if [[ -n "$2" ]]; then
        log_info "Showing logs for service: $2"
        docker-compose logs -f "$2"
    else
        log_info "Showing logs for all services (press Ctrl+C to exit)"
        docker-compose logs -f
    fi
}

# Stop function
stop() {
    log_info "Stopping $APP_NAME..."
    check_docker
    docker-compose down
    log_success "Services stopped"
}

# Restart function
restart() {
    log_info "Restarting $APP_NAME..."
    check_docker
    docker-compose restart
    log_success "Services restarted"
}

# Clean function - cleanup unused Docker resources
clean() {
    log_info "Cleaning up unused Docker resources..."
    check_docker
    
    log_warning "This will remove unused containers, networks, and images"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker system prune -f
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Help function
help() {
    echo -e "${BLUE}$APP_NAME - Deployment Script${NC}"
    echo
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  setup     - Initial server setup and prerequisites"
    echo "  deploy    - Build and deploy the application"
    echo "  update    - Update application (pull code, rebuild, restart)"
    echo "  status    - Show application status and health checks"
    echo "  logs      - Show application logs (optional: service name)"
    echo "  backup    - Create backup of database and uploads"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  clean     - Clean up unused Docker resources"
    echo "  help      - Show this help message"
    echo
    echo "Examples:"
    echo "  $0 setup                 # Initial setup"
    echo "  $0 deploy                # Deploy application"
    echo "  $0 logs backend          # Show backend logs"
    echo "  $0 status                # Check application status"
    echo
}

# Main script logic
case "${1:-help}" in
    setup)
        setup
        ;;
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    status)
        status
        ;;
    logs)
        logs "$@"
        ;;
    backup)
        backup
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    clean)
        clean
        ;;
    help|*)
        help
        ;;
esac