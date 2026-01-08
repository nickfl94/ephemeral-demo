# Multi-stage build for the ephemeral demo web application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for health checks and monitoring
RUN apk add --no-cache \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S demoapp -u 1001

# Set working directory
WORKDIR /app

# Copy application from builder stage
COPY --from=builder --chown=demoapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=demoapp:nodejs /app/package*.json ./
COPY --from=builder --chown=demoapp:nodejs /app/server.js ./
COPY --from=builder --chown=demoapp:nodejs /app/public ./public

# Switch to non-root user
USER demoapp

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"]