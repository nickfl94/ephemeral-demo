# Multi-stage Dockerfile for Ephemeral Demo React App

# Builder stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm install

# Copy application code
COPY . .

# Build the React app
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy built application from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.js ./server.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["npm", "run", "server"]