const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment information
const ENVIRONMENT_INFO = {
  environmentId: process.env.ENVIRONMENT_ID || 'local-dev',
  branch: process.env.BRANCH || 'main',
  region: process.env.AWS_REGION || 'us-east-1',
  instanceType: process.env.INSTANCE_TYPE || 't3.micro',
  deployedAt: process.env.DEPLOYED_AT || new Date().toISOString(),
  version: process.env.APP_VERSION || '1.0.0',
  buildNumber: process.env.BUILD_NUMBER || 'local',
  gitCommit: process.env.GIT_COMMIT || 'unknown'
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
    }
  }
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENVIRONMENT_INFO,
    checks: {
      server: 'ok',
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    }
  });
});

// API endpoint for environment info
app.get('/api/environment', (_req, res) => {
  res.json({
    ...ENVIRONMENT_INFO,
    serverTime: new Date().toISOString(),
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

// API endpoint for system metrics
app.get('/api/metrics', (_req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    loadAverage: require('os').loadavg(),
    freeMemory: require('os').freemem(),
    totalMemory: require('os').totalmem(),
    platform: {
      type: require('os').type(),
      release: require('os').release(),
      arch: require('os').arch(),
      hostname: require('os').hostname()
    }
  };
  
  res.json(metrics);
});

// API endpoint to simulate load testing
app.post('/api/load-test', (req, res) => {
  const { duration = 5000, intensity = 'medium' } = req.body;
  
  const startTime = Date.now();
  const endTime = startTime + duration;
  
  // Simulate CPU load based on intensity
  const loadFactor = {
    light: 100,
    medium: 1000,
    heavy: 10000
  }[intensity] || 1000;
  
  const loadTest = () => {
    if (Date.now() < endTime) {
      // Simulate CPU work
      for (let i = 0; i < loadFactor; i++) {
        Math.random() * Math.random();
      }
      setImmediate(loadTest);
    }
  };
  
  loadTest();
  
  res.json({
    message: 'Load test started',
    duration,
    intensity,
    startTime: new Date(startTime).toISOString(),
    estimatedEndTime: new Date(endTime).toISOString()
  });
});

// Catch-all handler for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ephemeral Demo App running on port ${PORT}`);
  console.log(`📊 Environment: ${ENVIRONMENT_INFO.environmentId}`);
  console.log(`🌿 Branch: ${ENVIRONMENT_INFO.branch}`);
  console.log(`🌍 Region: ${ENVIRONMENT_INFO.region}`);
  console.log(`💻 Instance: ${ENVIRONMENT_INFO.instanceType}`);
  console.log(`⏰ Deployed: ${ENVIRONMENT_INFO.deployedAt}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;