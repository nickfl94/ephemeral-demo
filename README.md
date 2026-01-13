# Ephemeral Deployment Demo

A comprehensive demonstration system that showcases the benefits of using Terraform and AWS to create temporary, on-demand environments for development and testing.

## Features

- **Configuration Management**: Flexible configuration system with multiple profiles
- **Environment Lifecycle**: Complete environment provisioning and cleanup
- **Application Deployment**: Automated application deployment pipeline
- **Git Integration**: Webhook-based environment management
- **GitHub Actions Integration**: Automated CI/CD with ephemeral environments
- **Demo Web Application**: Interactive web interface showcasing ephemeral environments
- **Cost Monitoring**: Real-time cost tracking and reporting (coming soon)
- **Demo Workflows**: Interactive demonstration scenarios

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Configuration

Initialize your configuration:

```bash
npm run dev -- config --init
```

Or copy an example configuration:

```bash
# List available examples
npm run dev -- config --list-examples

# Copy an example
npm run dev -- config --copy-example basic-demo
```

### Basic Usage

```bash
# Provision an environment
npm run dev -- provision --branch my-feature --template demo

# Check environment status
npm run dev -- status

# Run a demo workflow
npm run dev -- demo --scenario basic

# Destroy an environment
npm run dev -- destroy <environment-id>

# Cleanup environments
npm run dev -- cleanup --expired --force
```

## GitHub Actions Integration

This system integrates seamlessly with GitHub Actions for automated ephemeral environment management:

### Automatic Environment Provisioning
- **PR Opened**: Automatically provisions environment for the branch
- **PR Updated**: Updates the existing environment
- **PR Closed**: Automatically destroys the environment

### CI/CD Pipeline
- **Build & Test**: Runs tests against the ephemeral environment
- **Integration Testing**: Validates application in isolated environment
- **Cost Tracking**: Monitors and reports environment costs
- **Automatic Cleanup**: Ensures no resources are left behind

### Setup Guide
See [GitHub Actions Setup Guide](docs/GITHUB_ACTIONS_SETUP.md) for detailed integration instructions.

## Configuration Profiles

The system supports multiple configuration profiles for different use cases:

- **default**: General-purpose configuration
- **development**: Extended lifetime for development work
- **demo**: Optimized for live demonstrations
- **production**: Production-like testing environment

Switch between profiles:

```bash
npm run dev -- config --list-profiles
npm run dev -- config --profile development
```

## Demo Scenarios

### Demo Web Application

The system includes a comprehensive demo web application (`demo-app/`) that provides an interactive interface for exploring ephemeral environments:

- **Real-time Environment Info**: Displays branch, region, uptime, and deployment details
- **System Metrics**: Live CPU, memory, and load monitoring with auto-refresh
- **Load Testing**: Interactive performance testing with configurable intensity
- **Infrastructure Overview**: Visual representation of AWS components
- **Health Monitoring**: Real-time health status and alerts

To run the demo webapp locally:
```bash
cd demo-app
npm install
npm start
```

The demo webapp is automatically deployed when using the "demo" application template and provides a visual demonstration of ephemeral environment capabilities.

### Basic Demo
```bash
npm run dev -- demo --scenario basic
```
Demonstrates the complete lifecycle: provision → deploy → destroy

### Git Integration Demo
```bash
npm run dev -- demo --scenario git-integration
```
Shows automated environment management via Git webhooks

### Cost Comparison Demo
```bash
npm run dev -- demo --scenario cost-comparison
```
Compares costs between ephemeral and persistent environments

## Architecture

The system is built with a modular architecture:

- **Configuration Manager**: Handles settings and profiles
- **Environment Lifecycle Manager**: Manages environment creation/destruction
- **Application Factory**: Creates and deploys applications
- **Git Integration**: Processes webhook events
- **Demo Orchestrator**: Coordinates all components

## AWS Integration

### Required AWS Services
- **EC2**: Virtual machines for application hosting
- **ECS**: Container orchestration (optional)
- **ECR**: Container registry for Docker images
- **S3**: Terraform state storage
- **DynamoDB**: Terraform state locking
- **CloudWatch**: Monitoring and logging
- **Cost Explorer**: Cost tracking and analysis

### IAM Permissions
The system requires specific IAM permissions for:
- EC2 instance management
- ECS cluster operations
- ECR image operations
- S3 state management
- DynamoDB locking
- CloudWatch logging
- Cost Explorer access

See [IAM Policy](aws/iam-policies/ephemeral-demo-policy.json) for complete permissions.

## Development Status

This is a demonstration system. Current implementation status:

✅ **Completed**:
- Configuration management system
- Environment state tracking
- Application deployment pipeline
- Git integration framework
- CLI interface and commands
- Component integration
- GitHub Actions workflows
- AWS IAM policies
- Docker containerization

🚧 **In Progress**:
- Terraform orchestration
- Docker build system
- Cost monitoring
- Error handling and recovery

## Example Configurations

The system includes example configurations for different scenarios:

- `basic-demo.json`: Simple demo setup
- `development.json`: Development team workflow
- `enterprise.json`: Enterprise-grade configuration

## Docker Support

The system can be containerized for consistent deployment:

```bash
# Build Docker image
docker build -t ephemeral-demo .

# Run in container
docker run -it --rm \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  -e AWS_REGION=us-east-1 \
  ephemeral-demo provision --branch test
```

## Contributing

This is a demonstration project showcasing infrastructure-as-code principles and ephemeral environment management.

## License

MIT