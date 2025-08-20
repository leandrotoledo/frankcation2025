# Multi-stage build for React Native/Expo frontend
# This Dockerfile creates a simple HTTP server to serve static files
# It's designed to run behind a reverse proxy (nginx, Traefik, etc.)
FROM node:18-alpine AS builder

# Build arguments for environment variables
ARG EXPO_PUBLIC_API_BASE_URL=https://frankcation.com
ARG EXPO_PUBLIC_ENVIRONMENT=production
ARG EXPO_PUBLIC_ENABLE_DEBUG=false
ARG EXPO_PUBLIC_ENABLE_ANALYTICS=true
ARG EXPO_PUBLIC_APP_NAME="Orlando Challenge App"
ARG EXPO_PUBLIC_APP_VERSION="1.0.0"

# Set environment variables from build args
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL
ENV EXPO_PUBLIC_ENVIRONMENT=$EXPO_PUBLIC_ENVIRONMENT
ENV EXPO_PUBLIC_ENABLE_DEBUG=$EXPO_PUBLIC_ENABLE_DEBUG
ENV EXPO_PUBLIC_ENABLE_ANALYTICS=$EXPO_PUBLIC_ENABLE_ANALYTICS
ENV EXPO_PUBLIC_APP_NAME=$EXPO_PUBLIC_APP_NAME
ENV EXPO_PUBLIC_APP_VERSION=$EXPO_PUBLIC_APP_VERSION

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the web application
RUN npm run build

# Production stage with simple HTTP server
FROM node:18-alpine

# Install serve package globally for serving static files
RUN npm install -g serve

# Create app directory
WORKDIR /app

# Copy built app from builder stage  
COPY --from=builder /app/dist ./

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S frontend -u 1001

# Change ownership of the app directory
RUN chown -R frontend:nodejs /app
USER frontend

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the HTTP server
CMD ["serve", "-s", ".", "-l", "3000"]