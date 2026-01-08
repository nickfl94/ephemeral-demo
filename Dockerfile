# Multi-stage build for the ephemeral deployment demo
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    curl \
    bash \
    git \
    terraform \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ephemeral -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=ephemeral:nodejs /app/dist ./dist
COPY --from=builder --chown=ephemeral:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=ephemeral:nodejs /app/package*.json ./
COPY --from=builder --chown=ephemeral:nodejs /app/terraform ./terraform

# Create directories for configuration and state
RUN mkdir -p /app/.ephemeral-demo && \
    chown -R ephemeral:nodejs /app/.ephemeral-demo

# Switch to non-root user
USER ephemeral

# Expose port for webhook server (if needed)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/cli.js status --output json || exit 1

# Default command
ENTRYPOINT ["node", "dist/cli.js"]
CMD ["--help"]