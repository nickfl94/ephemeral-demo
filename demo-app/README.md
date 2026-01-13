# Ephemeral Environment Demo - React App

A modern React/TypeScript application with styled-components that provides an interactive interface for exploring ephemeral environments. Features a clean, professional design inspired by modern dashboard interfaces.

## Features

### 🎨 Modern UI Design
- Clean, professional interface with card-based layout
- Responsive design that works on all devices
- Styled-components for maintainable CSS-in-JS
- Font Awesome icons for visual consistency
- Smooth animations and transitions

### 📊 Real-time Monitoring
- Live environment statistics (uptime, branch, region)
- System metrics with color-coded indicators
- Health status monitoring
- Auto-refresh functionality

### 🧪 Interactive Testing
- Load testing with configurable parameters
- Real-time test results and feedback
- Visual test progress indicators

### 🏗️ Infrastructure Visualization
- AWS component overview
- Environment lifecycle explanation
- Workflow step visualization

## Technology Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Styled Components** - CSS-in-JS styling
- **React Router** - Client-side routing
- **Font Awesome** - Icon library

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

This will start:
- React development server on `http://localhost:3000`
- API server on `http://localhost:3001`

### Available Scripts

```bash
# Start React development server
npm start

# Start API server for development
npm run server

# Start both React and API servers
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx      # Navigation header
│   └── UI.tsx          # Styled UI components
├── pages/              # Page components
│   ├── Overview.tsx    # Environment overview
│   ├── Environment.tsx # Environment details
│   ├── Metrics.tsx     # System metrics
│   └── Testing.tsx     # Load testing
├── services/           # API services
│   └── api.ts          # API client functions
├── utils/              # Utility functions
│   └── formatters.ts   # Data formatting helpers
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## API Integration

The React app communicates with the Express.js backend through REST APIs:

- `GET /api/environment` - Environment information
- `GET /api/metrics` - System metrics
- `POST /api/load-test` - Start load testing
- `GET /health` - Health check

## Styling Architecture

### Styled Components
- All styling done with styled-components
- Consistent design system with shared components
- Responsive design with mobile-first approach
- Theme-based color system

### Design System
- **Colors**: Professional blue/gray palette
- **Typography**: System fonts for readability
- **Spacing**: Consistent 8px grid system
- **Components**: Reusable UI building blocks

## Production Build

```bash
# Build React app
npm run build

# Start production server
NODE_ENV=production node server.js
```

In production:
- React app is served as static files
- API endpoints remain available
- Single server handles both frontend and backend

## Environment Variables

```bash
# Server Configuration
PORT=3001                    # API server port
NODE_ENV=development         # Environment mode

# Environment Information (populated by deployment)
ENVIRONMENT_ID=local-dev     # Unique environment identifier
BRANCH=main                  # Git branch name
AWS_REGION=us-east-1        # AWS region
INSTANCE_TYPE=t3.micro      # EC2 instance type
DEPLOYED_AT=2024-01-01      # Deployment timestamp
APP_VERSION=1.0.0           # Application version
BUILD_NUMBER=local          # Build identifier
GIT_COMMIT=unknown          # Git commit hash
```

## Deployment

### Docker
```bash
# Build Docker image
docker build -t ephemeral-demo-react .

# Run container
docker run -p 3001:3001 ephemeral-demo-react
```

### AWS Deployment
The app is designed to be deployed to ephemeral AWS environments:
- Containerized with Docker
- Environment variables injected at runtime
- Health checks for load balancer integration
- Graceful shutdown handling

## Features in Detail

### Overview Page
- Environment statistics cards
- Feature highlights
- Workflow explanation with step-by-step visualization

### Environment Page
- Detailed environment information
- System specifications
- Infrastructure component overview

### Metrics Page
- Real-time CPU, memory, and load metrics
- Color-coded performance indicators
- Health status monitoring
- Manual refresh capability

### Testing Page
- Interactive load testing interface
- Configurable test parameters
- Real-time test results
- Test completion feedback

## Contributing

1. Follow TypeScript best practices
2. Use styled-components for all styling
3. Maintain responsive design
4. Add proper error handling
5. Include loading states for async operations

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Modern browsers with ES6+ support required.