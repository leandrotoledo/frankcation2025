# Multi-stage build for Go backend
FROM golang:1.21-alpine AS builder

# Install build dependencies for CGO (required for SQLite)
RUN apk add --no-cache git gcc musl-dev sqlite-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application with SQLite compatibility flags for Alpine/musl
RUN CGO_ENABLED=1 GOOS=linux \
    CGO_CFLAGS="-D_LARGEFILE64_SOURCE" \
    go build -a -installsuffix cgo \
    -tags "sqlite_omit_load_extension" \
    -o main cmd/api/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests and sqlite for database
RUN apk --no-cache add ca-certificates sqlite

# Create app directory
WORKDIR /root/

# Create uploads directory
RUN mkdir -p /app/uploads/profiles /app/uploads/posts /app/uploads/challenges /app/uploads/temp

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy any static files or configuration if needed
COPY --from=builder /app/uploads ./uploads

# Create a non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership of uploads directory
RUN chown -R appuser:appgroup /app/uploads
RUN chown -R appuser:appgroup /root/uploads

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/leaderboard || exit 1

# Run the application
CMD ["./main"]