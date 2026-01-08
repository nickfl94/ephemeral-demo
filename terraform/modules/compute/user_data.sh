#!/bin/bash
# User data script for EC2 instances in ephemeral environments

# Update system packages
yum update -y

# Install required packages
yum install -y docker git nodejs npm python3 pip3 awscli

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

# Create a simple health check endpoint
cat > /opt/app/health.js << EOF
const http = require('http');
const port = ${application_port};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: '${environment_name}'
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <html>
        <head><title>Ephemeral Environment - ${environment_name}</title></head>
        <body>
          <h1>Welcome to ${environment_name}</h1>
          <p>This is an ephemeral environment for demonstration purposes.</p>
          <p>Environment: ${environment_name}</p>
          <p>Instance ID: \$(curl -s http://169.254.169.254/latest/meta-data/instance-id)</p>
          <p>Timestamp: \$(date)</p>
          <a href="/health">Health Check</a>
        </body>
      </html>
    \`);
  }
});

server.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
EOF

# Install PM2 for process management
npm install -g pm2

# Start the application
cd /opt/app
pm2 start health.js --name "demo-app"
pm2 startup
pm2 save

# Create log directory
mkdir -p /opt/app/logs
chown ec2-user:ec2-user /opt/app/logs

# Log the completion
echo "User data script completed at $(date)" >> /opt/app/logs/startup.log