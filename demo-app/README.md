# Ephemeral Environment Demo Web Application

This is a comprehensive demo web application that showcases the capabilities of ephemeral environments. It's designed to be deployed to automatically provisioned AWS infrastructure and provides an interactive interface for exploring the environment.

## Features

### 🏠 Overview Page
- Welcome message and environment statistics
- Real-time uptime, branch, and region information
- Feature highlights explaining ephemeral environments
- Step-by-step workflow visualization

### 🖥️ Environment Page
- Detailed environment information (ID, branch, version, etc.)
- System information (Node.js version, platform, architecture)
- Infrastructure components overview
- Visual representation of AWS resources

### 📊 Metrics Page
- Real-time system metrics (CPU, memory, load)
- Health status indicators
- Auto-refresh functionality
- Color-coded performance indicators

### 🧪 Testing Page
- Interactive load testing capabilities
- Configurable test duration and intensity
- Real-time test results and feedback
- Performance impact visualization

## API Endpoints

### Health Check
```
GET /health
```
Returns comprehensive health information including uptime, memory usage, and system status.

### Environment Information
```
GET /api/environment
```
Returns detailed environment metadata including branch, region, deployment info, and system details.

### System Metrics
```
GET /api/metrics
```
Returns real-time system performance metrics including CPU, memory, load average, and platform information.

### Load Testing
```
POST /api/load-test
Content-Type: application/json

{
  "duration": 5000,    // Test duration in milliseconds
  "intensity": "medium" // "light", "medium", or "heavy"
}
```
Starts a configurable load test to simulate system stress and demonstrate performance monitoring.

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Styling**: Custom CSS with responsive design and animations
- **Security**: Helmet.js for security headers, CORS support
- **Monitoring**: Built-in health checks and metrics collection
- **Containerization**: Docker with multi-stage builds

## Environment Variables

The application uses the following environment variables to display dynamic information:

- `ENVIRONMENT_ID`: Unique identifier for the ephemeral environment
- `BRANCH`: Git branch that triggered the deployment
- `AWS_REGION`: AWS region where the environment is deployed
- `INSTANCE_TYPE`: EC2 instance type being used
- `DEPLOYED_AT`: Timestamp of deployment
- `APP_VERSION`: Application version
- `BUILD_NUMBER`: CI/CD build number
- `GIT_COMMIT`: Git commit hash
- `PORT`: Server port (default: 3000)

## Development

### Local Development
```bash
npm install
npm start
```

The application will start on port 3000 (or the port specified in the PORT environment variable).

### Docker Build
```bash
docker build -t ephemeral-demo-webapp .
docker run -p 3000:3000 ephemeral-demo-webapp
```

### Testing
```bash
npm test
```

## Integration with Ephemeral Deployment System

This demo application is designed to work seamlessly with the ephemeral deployment system:

1. **Template Integration**: Uses the "demo" template in `ApplicationTemplates`
2. **Environment Variables**: Automatically populated by the deployment system
3. **Health Checks**: Provides endpoints for infrastructure health monitoring
4. **Load Testing**: Demonstrates system resilience and monitoring capabilities
5. **Real-time Data**: Shows live environment information and metrics

## Usage in Ephemeral Environments

When deployed through the ephemeral deployment system:

1. The application automatically receives environment-specific configuration
2. Health checks ensure the deployment is successful
3. Metrics provide real-time monitoring of the ephemeral infrastructure
4. Load testing allows validation of the environment's performance
5. The interface provides a visual demonstration of the ephemeral environment capabilities

This makes it perfect for:
- Demonstrating ephemeral environments to stakeholders
- Testing infrastructure provisioning and monitoring
- Validating deployment pipelines
- Showcasing DevOps capabilities
- Training and educational purposes

## Security Considerations

- Uses Helmet.js for security headers
- Implements CORS for cross-origin requests
- Runs as non-root user in Docker container
- Includes health check endpoints for monitoring
- Environment variables are safely handled and displayed