#!/bin/bash
# User data script for EC2 instances in ephemeral environments

# Enable logging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Starting user data script at $(date)"

# Update system packages
echo "Updating system packages..."
yum update -y

# Install required packages
yum install -y docker git python3 pip3 awscli

# Install Node.js using a method compatible with Amazon Linux 2
echo "Installing Node.js..."

# Try Amazon Linux Extras first (nodejs14 is available on AL2)
if amazon-linux-extras list | grep -q nodejs14; then
  echo "Installing Node.js 14 via Amazon Linux Extras..."
  amazon-linux-extras install -y nodejs14
elif amazon-linux-extras list | grep -q nodejs16; then
  echo "Installing Node.js 16 via Amazon Linux Extras..."
  amazon-linux-extras install -y nodejs16
else
  echo "Installing Node.js via binary download..."
  # Download and install Node.js 16 binary (compatible with glibc 2.17+)
  cd /tmp
  curl -fsSL https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz -o node.tar.xz
  tar -xf node.tar.xz
  cp -r node-v16.20.2-linux-x64/* /usr/local/
  ln -sf /usr/local/bin/node /usr/bin/node
  ln -sf /usr/local/bin/npm /usr/bin/npm
  cd -
fi

# Verify Node.js installation
echo "Verifying Node.js installation..."
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js installation failed"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo "ERROR: npm installation failed"
  exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Start and enable Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Create application directory
mkdir -p /opt/app
chown ec2-user:ec2-user /opt/app

# Create CloudWatch agent configuration
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/app/logs/*.log",
            "log_group_name": "/aws/ec2/${environment_name}",
            "log_stream_name": "{instance_id}/application"
          },
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/aws/ec2/${environment_name}",
            "log_stream_name": "{instance_id}/system"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "EphemeralDemo/${environment_name}",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Set environment variables for the application
export ENVIRONMENT_ID="${environment_name}"
export BRANCH="${branch_name}"
export AWS_REGION="${aws_region}"
export INSTANCE_TYPE="${instance_type}"
export DEPLOYED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export APP_VERSION="${app_version}"
export BUILD_NUMBER="${build_number}"
export GIT_COMMIT="${git_commit}"
export PORT="3000"
export NODE_ENV="production"

# Create log directory first
mkdir -p /opt/app/logs
chown ec2-user:ec2-user /opt/app/logs

# Clone and build the demo application
echo "Cloning demo application..."
cd /opt/app

# For now, we'll create the demo app files directly since we don't have git access
# Copy the demo application files (this would normally be done via git clone or artifact deployment)
echo "Setting up demo application files..."

# Create package.json
cat > package.json << 'PACKAGE_EOF'
{
  "name": "ephemeral-demo-react",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "helmet": "^6.0.1",
    "morgan": "^1.10.0"
  },
  "scripts": {
    "start": "node server.js",
    "server": "node server.js"
  }
}
PACKAGE_EOF

# Create the server.js file with the proper demo application
cat > server.js << 'SERVER_EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || ${port};
const isDevelopment = process.env.NODE_ENV === 'development';

// Environment information
const ENVIRONMENT_INFO = {
  environmentId: process.env.ENVIRONMENT_ID || '${environment_name}',
  branch: process.env.BRANCH || '${branch_name}',
  region: process.env.AWS_REGION || '${aws_region}',
  instanceType: process.env.INSTANCE_TYPE || '${instance_type}',
  deployedAt: process.env.DEPLOYED_AT || new Date().toISOString(),
  version: process.env.APP_VERSION || '${app_version}',
  buildNumber: process.env.BUILD_NUMBER || '${build_number}',
  gitCommit: process.env.GIT_COMMIT || '${git_commit}'
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

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

// Root endpoint
app.get('/', (_req, res) => {
  res.send(
    '<html>' +
    '<head>' +
    '<title>Ephemeral Demo - ' + ENVIRONMENT_INFO.environmentId + '</title>' +
    '<style>' +
    'body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }' +
    '.container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }' +
    'h1 { color: #333; }' +
    '.info { background: #e8f4fd; padding: 15px; border-radius: 4px; margin: 20px 0; }' +
    '.links a { display: inline-block; margin: 10px 15px 10px 0; padding: 8px 16px; background: #007cba; color: white; text-decoration: none; border-radius: 4px; }' +
    '.links a:hover { background: #005a87; }' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<div class="container">' +
    '<h1>🚀 Ephemeral Environment Demo</h1>' +
    '<div class="info">' +
    '<p><strong>Environment ID:</strong> ' + ENVIRONMENT_INFO.environmentId + '</p>' +
    '<p><strong>Branch:</strong> ' + ENVIRONMENT_INFO.branch + '</p>' +
    '<p><strong>Region:</strong> ' + ENVIRONMENT_INFO.region + '</p>' +
    '<p><strong>Instance Type:</strong> ' + ENVIRONMENT_INFO.instanceType + '</p>' +
    '<p><strong>Deployed At:</strong> ' + ENVIRONMENT_INFO.deployedAt + '</p>' +
    '<p><strong>Version:</strong> ' + ENVIRONMENT_INFO.version + '</p>' +
    '</div>' +
    '<div class="links">' +
    '<a href="/health">Health Check</a>' +
    '<a href="/api/environment">Environment Info</a>' +
    '<a href="/api/metrics">System Metrics</a>' +
    '</div>' +
    '</div>' +
    '</body>' +
    '</html>'
  );
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
  console.log('🚀 Ephemeral Demo App running on port ' + PORT);
  console.log('📊 Environment: ' + ENVIRONMENT_INFO.environmentId);
  console.log('🌿 Branch: ' + ENVIRONMENT_INFO.branch);
  console.log('🌍 Region: ' + ENVIRONMENT_INFO.region);
  console.log('💻 Instance: ' + ENVIRONMENT_INFO.instanceType);
  console.log('⏰ Deployed: ' + ENVIRONMENT_INFO.deployedAt);
  console.log('🔗 Health check: http://localhost:' + PORT + '/health');
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
SERVER_EOF

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Test the application
echo "Testing Node.js installation and application..."
node --version
if ! node -c server.js; then
  echo "ERROR: server.js has syntax errors"
  exit 1
fi

# Install PM2 globally
echo "Installing PM2..."
npm install -g pm2

# Create PM2 ecosystem file for better process management
cat > /opt/app/ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [{
    name: 'demo-app',
    script: 'server.js',
    cwd: '/opt/app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: '${port}',
      ENVIRONMENT_ID: '${environment_name}',
      BRANCH: '${branch_name}',
      AWS_REGION: '${aws_region}',
      INSTANCE_TYPE: '${instance_type}',
      APP_VERSION: '${app_version}',
      BUILD_NUMBER: '${build_number}',
      GIT_COMMIT: '${git_commit}'
    },
    log_file: '/opt/app/logs/combined.log',
    out_file: '/opt/app/logs/out.log',
    error_file: '/opt/app/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '200M',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
PM2_EOF

# Start application with PM2 using ecosystem file
echo "Starting application with PM2..."
cd /opt/app
su ec2-user -c "pm2 start ecosystem.config.js"

# Wait for application to start
echo "Waiting for application to start..."
sleep 5

# Verify application is running
if su ec2-user -c "pm2 list | grep -q 'demo-app.*online'"; then
  echo "Application started successfully with PM2"
else
  echo "ERROR: Application failed to start with PM2"
  su ec2-user -c "pm2 logs demo-app --lines 20"
  exit 1
fi

# Test health endpoint
echo "Testing health endpoint..."
for i in {1..10}; do
  if curl -f -s http://localhost:${port}/health > /dev/null; then
    echo "Health endpoint is responding"
    break
  else
    echo "Attempt $i: Health endpoint not ready, waiting..."
    sleep 3
  fi
  
  if [ $i -eq 10 ]; then
    echo "ERROR: Health endpoint failed to respond after 30 seconds"
    su ec2-user -c "pm2 logs demo-app --lines 20"
    exit 1
  fi
done

# Configure PM2 to start on boot
echo "Configuring PM2 startup..."
su ec2-user -c "pm2 startup systemd -u ec2-user --hp /home/ec2-user"
su ec2-user -c "pm2 save"

# Set proper ownership
chown -R ec2-user:ec2-user /opt/app

echo "User data script completed successfully at $(date)"