/**
 * Docker containerization and image building functionality
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ApplicationConfig, DockerBuildResult } from './types';

/**
 * Docker builder class for containerizing applications
 */
export class DockerBuilder {
  private readonly ecrRegistry: string;
  private readonly region: string;

  constructor(ecrRegistry: string, region: string = 'ap-southeast-2') {
    this.ecrRegistry = ecrRegistry;
    this.region = region;
  }

  /**
   * Build Docker image for application
   */
  async buildImage(config: ApplicationConfig): Promise<DockerBuildResult> {
    const startTime = Date.now();
    const imageTag = `${config.name}:${config.version}`;
    const imageUri = `${this.ecrRegistry}:${config.version}`;

    try {
      // Ensure build context exists
      if (!existsSync(config.docker.buildContext)) {
        throw new Error(`Build context not found: ${config.docker.buildContext}`);
      }

      // Generate Dockerfile if it doesn't exist
      const dockerfilePath = join(config.docker.buildContext, config.docker.dockerfile);
      if (!existsSync(dockerfilePath)) {
        this.generateDockerfile(config, dockerfilePath);
      }

      // Build Docker image
      const buildCommand = [
        'docker build',
        `-t ${imageTag}`,
        `-f ${dockerfilePath}`,
        config.docker.buildContext
      ].join(' ');

      console.log(`Building Docker image: ${buildCommand}`);
      const buildOutput = execSync(buildCommand, { encoding: 'utf-8' });

      // Tag for ECR
      const tagCommand = `docker tag ${imageTag} ${imageUri}`;
      execSync(tagCommand, { encoding: 'utf-8' });

      // Get image metadata
      const inspectOutput = execSync(`docker inspect ${imageTag}`, { encoding: 'utf-8' });
      const imageInfo = JSON.parse(inspectOutput)[0];
      
      const buildDuration = (Date.now() - startTime) / 1000;

      return {
        success: true,
        imageUri,
        logs: buildOutput.split('\n').filter(line => line.trim()),
        metadata: {
          imageSize: imageInfo.Size || 0,
          buildDuration,
          digest: imageInfo.Id || ''
        }
      };

    } catch (error) {
      return {
        success: false,
        imageUri: '',
        logs: [],
        metadata: {
          imageSize: 0,
          buildDuration: (Date.now() - startTime) / 1000,
          digest: ''
        },
        error: {
          code: 'BUILD_FAILED',
          details: error instanceof Error ? error.message : 'Unknown build error'
        }
      };
    }
  }

  /**
   * Push Docker image to ECR
   */
  async pushImage(imageUri: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Login to ECR
      const loginCommand = `aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${this.ecrRegistry}`;
      execSync(loginCommand, { encoding: 'utf-8' });

      // Push image
      const pushCommand = `docker push ${imageUri}`;
      console.log(`Pushing image to ECR: ${pushCommand}`);
      execSync(pushCommand, { encoding: 'utf-8' });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown push error'
      };
    }
  }

  /**
   * Generate Dockerfile based on application configuration
   */
  private generateDockerfile(config: ApplicationConfig, dockerfilePath: string): void {
    let dockerfile = '';

    switch (config.type) {
      case 'webapp':
        dockerfile = this.generateWebAppDockerfile(config);
        break;
      case 'api':
        dockerfile = this.generateApiDockerfile(config);
        break;
      case 'fullstack':
        dockerfile = this.generateFullStackDockerfile(config);
        break;
      default:
        throw new Error(`Unsupported application type: ${config.type}`);
    }

    writeFileSync(dockerfilePath, dockerfile);
    console.log(`Generated Dockerfile at: ${dockerfilePath}`);
  }

  /**
   * Generate Dockerfile for web application
   */
  private generateWebAppDockerfile(config: ApplicationConfig): string {
    return `# Generated Dockerfile for ${config.name} web application
FROM ${config.docker.baseImage}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application (if needed)
RUN npm run build 2>/dev/null || echo "No build script found"

# Set environment variables
${Object.entries(config.docker.env)
  .map(([key, value]) => `ENV ${key}=${value}`)
  .join('\n')}

# Expose port
EXPOSE ${config.docker.port}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${config.docker.port}${config.healthCheck.path} || exit 1

# Start application
CMD ["npm", "start"]
`;
  }

  /**
   * Generate Dockerfile for API application
   */
  private generateApiDockerfile(config: ApplicationConfig): string {
    return `# Generated Dockerfile for ${config.name} API
FROM ${config.docker.baseImage}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build application (if needed)
RUN npm run build 2>/dev/null || echo "No build script found"

# Set environment variables
${Object.entries(config.docker.env)
  .map(([key, value]) => `ENV ${key}=${value}`)
  .join('\n')}

# Expose port
EXPOSE ${config.docker.port}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${config.docker.port}${config.healthCheck.path} || exit 1

# Start application
CMD ["npm", "start"]
`;
  }

  /**
   * Generate Dockerfile for full-stack application
   */
  private generateFullStackDockerfile(config: ApplicationConfig): string {
    return `# Generated Dockerfile for ${config.name} full-stack application
FROM ${config.docker.baseImage}

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend and backend
RUN npm run build:frontend 2>/dev/null || echo "No frontend build script found"
RUN npm run build:backend 2>/dev/null || echo "No backend build script found"
RUN npm run build 2>/dev/null || echo "No general build script found"

# Set environment variables
${Object.entries(config.docker.env)
  .map(([key, value]) => `ENV ${key}=${value}`)
  .join('\n')}

# Expose port
EXPOSE ${config.docker.port}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${config.docker.port}${config.healthCheck.path} || exit 1

# Start application
CMD ["npm", "start"]
`;
  }
}