/**
 * Main deployment pipeline orchestrating Docker build, deployment, and health checks
 */

import { EnvironmentState } from '../types';
import { ApplicationConfig, DeploymentTarget, DeploymentResult } from './types';
import { DockerBuilder } from './docker-builder';
import { HealthChecker } from './health-checker';
import { URLGenerator } from './url-generator';

/**
 * Deployment pipeline class that orchestrates the entire application deployment process
 */
export class DeploymentPipeline {
  private readonly dockerBuilder: DockerBuilder;
  private readonly healthChecker: HealthChecker;
  private readonly urlGenerator: URLGenerator;

  constructor(ecrRegistry: string, region: string = 'us-east-1') {
    this.dockerBuilder = new DockerBuilder(ecrRegistry, region);
    this.healthChecker = new HealthChecker();
    this.urlGenerator = new URLGenerator();
  }

  /**
   * Deploy application to the specified target environment
   */
  async deployApplication(
    config: ApplicationConfig,
    target: DeploymentTarget,
    environment: EnvironmentState
  ): Promise<DeploymentResult> {
    const deploymentStart = Date.now();

    try {
      console.log(`Starting deployment of ${config.name} v${config.version}...`);

      // Step 1: Build Docker image
      console.log('Building Docker image...');
      const buildResult = await this.dockerBuilder.buildImage(config);
      
      if (!buildResult.success) {
        return {
          success: false,
          message: 'Docker image build failed',
          urls: { application: '', healthCheck: '' },
          metadata: {
            imageUri: '',
            deployedAt: new Date(),
            resources: {}
          },
          error: buildResult.error || {
            code: 'BUILD_FAILED',
            details: 'Unknown build error'
          }
        };
      }

      // Step 2: Push image to ECR
      console.log('Pushing image to ECR...');
      const pushResult = await this.dockerBuilder.pushImage(buildResult.imageUri);
      
      if (!pushResult.success) {
        return {
          success: false,
          message: 'Failed to push Docker image to ECR',
          urls: { application: '', healthCheck: '' },
          metadata: {
            imageUri: buildResult.imageUri,
            deployedAt: new Date(),
            resources: {}
          },
          error: {
            code: 'PUSH_FAILED',
            details: pushResult.error || 'Unknown push error'
          }
        };
      }

      // Step 3: Deploy to target infrastructure
      console.log(`Deploying to ${target.type}...`);
      const deployResult = await this.deployToTarget(buildResult.imageUri, config, target, environment);
      
      if (!deployResult.success) {
        return deployResult;
      }

      // Step 4: Generate URLs
      const urls = this.urlGenerator.generateUrls(target, environment, config.docker.port);

      // Step 5: Perform health checks
      console.log('Performing health checks...');
      const healthResult = await this.healthChecker.checkHealth(
        urls.healthCheck,
        config.healthCheck.expectedStatus,
        config.healthCheck.timeout * 1000,
        config.healthCheck.retries,
        config.healthCheck.interval * 1000
      );

      if (!healthResult.healthy) {
        return {
          success: false,
          message: 'Application deployment completed but health checks failed',
          urls,
          metadata: {
            imageUri: buildResult.imageUri,
            deployedAt: new Date(),
            resources: deployResult.metadata.resources
          },
          error: {
            code: 'HEALTH_CHECK_FAILED',
            details: healthResult.error || 'Health check failed',
            logs: buildResult.logs
          }
        };
      }

      const deploymentDuration = (Date.now() - deploymentStart) / 1000;
      
      return {
        success: true,
        message: `Application ${config.name} v${config.version} deployed successfully in ${deploymentDuration.toFixed(1)}s`,
        urls,
        metadata: {
          imageUri: buildResult.imageUri,
          deployedAt: new Date(),
          resources: {
            ...deployResult.metadata.resources,
            dockerImage: buildResult.imageUri,
            healthCheckUrl: urls.healthCheck
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Deployment pipeline failed with unexpected error',
        urls: { application: '', healthCheck: '' },
        metadata: {
          imageUri: '',
          deployedAt: new Date(),
          resources: {}
        },
        error: {
          code: 'PIPELINE_ERROR',
          details: error instanceof Error ? error.message : 'Unknown pipeline error'
        }
      };
    }
  }

  /**
   * Deploy container to specific target infrastructure
   */
  private async deployToTarget(
    imageUri: string,
    config: ApplicationConfig,
    target: DeploymentTarget,
    environment: EnvironmentState
  ): Promise<DeploymentResult> {
    switch (target.type) {
      case 'ec2':
        return this.deployToEC2(imageUri, config, target, environment);
      case 'ecs':
        return this.deployToECS(imageUri, config, target, environment);
      default:
        return {
          success: false,
          message: `Unsupported deployment target: ${target.type}`,
          urls: { application: '', healthCheck: '' },
          metadata: {
            imageUri,
            deployedAt: new Date(),
            resources: {}
          },
          error: {
            code: 'UNSUPPORTED_TARGET',
            details: `Deployment target ${target.type} is not supported`
          }
        };
    }
  }

  /**
   * Deploy to EC2 instance
   */
  private async deployToEC2(
    imageUri: string,
    config: ApplicationConfig,
    target: DeploymentTarget,
    environment: EnvironmentState
  ): Promise<DeploymentResult> {
    try {
      // In a real implementation, this would:
      // 1. SSH into the EC2 instance
      // 2. Pull the Docker image
      // 3. Stop any existing container
      // 4. Start the new container with proper configuration
      
      // For demo purposes, we'll simulate the deployment
      console.log(`Simulating EC2 deployment to instance ${(target.config as any).instanceId}`);
      
      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const urls = this.urlGenerator.generateUrls(target, environment, config.docker.port);

      return {
        success: true,
        message: 'Successfully deployed to EC2',
        urls,
        metadata: {
          imageUri,
          deployedAt: new Date(),
          resources: {
            instanceId: (target.config as any).instanceId,
            containerName: `${config.name}-${config.version}`,
            port: config.docker.port.toString()
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'EC2 deployment failed',
        urls: { application: '', healthCheck: '' },
        metadata: {
          imageUri,
          deployedAt: new Date(),
          resources: {}
        },
        error: {
          code: 'EC2_DEPLOYMENT_FAILED',
          details: error instanceof Error ? error.message : 'Unknown EC2 deployment error'
        }
      };
    }
  }

  /**
   * Deploy to ECS service
   */
  private async deployToECS(
    imageUri: string,
    config: ApplicationConfig,
    target: DeploymentTarget,
    environment: EnvironmentState
  ): Promise<DeploymentResult> {
    try {
      const ecsConfig = target.config as any;
      
      // In a real implementation, this would:
      // 1. Create/update ECS task definition with new image
      // 2. Update ECS service to use new task definition
      // 3. Wait for deployment to complete
      // 4. Verify service is running
      
      // For demo purposes, we'll simulate the deployment
      console.log(`Simulating ECS deployment to cluster ${ecsConfig.clusterName}, service ${ecsConfig.serviceName}`);
      
      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      const urls = this.urlGenerator.generateUrls(target, environment, config.docker.port);

      return {
        success: true,
        message: 'Successfully deployed to ECS',
        urls,
        metadata: {
          imageUri,
          deployedAt: new Date(),
          resources: {
            clusterName: ecsConfig.clusterName,
            serviceName: ecsConfig.serviceName,
            taskDefinition: `${ecsConfig.taskDefinitionFamily}:${Date.now()}`,
            desiredCount: ecsConfig.desiredCount.toString()
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        message: 'ECS deployment failed',
        urls: { application: '', healthCheck: '' },
        metadata: {
          imageUri,
          deployedAt: new Date(),
          resources: {}
        },
        error: {
          code: 'ECS_DEPLOYMENT_FAILED',
          details: error instanceof Error ? error.message : 'Unknown ECS deployment error'
        }
      };
    }
  }

  /**
   * Get deployment status for an environment
   */
  async getDeploymentStatus(environment: EnvironmentState): Promise<{
    deployed: boolean;
    healthy: boolean;
    urls?: { application: string; healthCheck: string };
    lastChecked: Date;
  }> {
    if (!environment.urls.application) {
      return {
        deployed: false,
        healthy: false,
        lastChecked: new Date()
      };
    }

    try {
      const healthResult = await this.healthChecker.checkHealth(
        environment.urls.application + '/health',
        200,
        5000,
        1,
        0
      );

      return {
        deployed: true,
        healthy: healthResult.healthy,
        urls: {
          application: environment.urls.application,
          healthCheck: environment.urls.application + '/health'
        },
        lastChecked: new Date()
      };

    } catch {
      return {
        deployed: true,
        healthy: false,
        urls: {
          application: environment.urls.application,
          healthCheck: environment.urls.application + '/health'
        },
        lastChecked: new Date()
      };
    }
  }
}