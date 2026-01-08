/**
 * Environment lifecycle management with comprehensive cleanup procedures
 * Handles environment destruction, resource verification, and retry logic
 */

import {
  EnvironmentState,
  EnvironmentConfig,
  TerraformResource,
} from '../types';
import { EnvironmentStateTracker } from './state-tracker';

export interface CleanupResult {
  success: boolean;
  resourcesRemoved: string[];
  resourcesRemaining: string[];
  errors: string[];
  retryCount: number;
}

export interface DestructionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  forceDestroy?: boolean;
  verifyCleanup?: boolean;
}

export class EnvironmentLifecycleManager {
  private stateTracker: EnvironmentStateTracker;
  private defaultOptions: Required<DestructionOptions> = {
    maxRetries: 3,
    retryDelayMs: 5000,
    forceDestroy: false,
    verifyCleanup: true,
  };

  constructor(stateTracker: EnvironmentStateTracker) {
    this.stateTracker = stateTracker;
  }

  /**
   * Create a new environment with proper state tracking
   */
  async createEnvironment(
    config: EnvironmentConfig
  ): Promise<EnvironmentState> {
    // Create environment state entry
    const environment = await this.stateTracker.createEnvironment(config);

    try {
      // Update status to creating
      await this.stateTracker.updateEnvironment(environment.id, {
        status: 'creating',
      });

      // TODO: This will be implemented in terraform orchestration task
      // For now, we'll simulate the creation process
      console.log(
        `Creating environment ${environment.id} with config:`,
        config
      );

      return environment;
    } catch (error) {
      // Mark environment as failed
      await this.stateTracker.updateEnvironment(environment.id, {
        status: 'failed',
      });
      throw error;
    }
  }

  /**
   * Destroy an environment with comprehensive cleanup
   */
  async destroyEnvironment(
    environmentId: string,
    options: DestructionOptions = {}
  ): Promise<CleanupResult> {
    const opts = { ...this.defaultOptions, ...options };

    const environment = await this.stateTracker.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    if (environment.status === 'destroyed') {
      return {
        success: true,
        resourcesRemoved: [],
        resourcesRemaining: [],
        errors: [],
        retryCount: 0,
      };
    }

    // Update status to destroying
    await this.stateTracker.updateEnvironment(environmentId, {
      status: 'destroying',
    });

    let retryCount = 0;
    let lastError: string | null = null;

    while (retryCount <= opts.maxRetries) {
      try {
        const result = await this.performDestruction(environment, opts);

        if (result.success) {
          // Mark environment as destroyed
          await this.stateTracker.updateEnvironment(environmentId, {
            status: 'destroyed',
          });

          return {
            ...result,
            retryCount,
          };
        } else {
          lastError = result.errors.join('; ');
          retryCount++;

          if (retryCount <= opts.maxRetries) {
            console.log(
              `Destruction attempt ${retryCount} failed, retrying in ${opts.retryDelayMs}ms...`
            );
            await this.delay(opts.retryDelayMs);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retryCount++;

        if (retryCount <= opts.maxRetries) {
          console.log(
            `Destruction attempt ${retryCount} failed with error: ${lastError}`
          );
          await this.delay(opts.retryDelayMs);
        }
      }
    }

    // All retries exhausted, mark as failed
    await this.stateTracker.updateEnvironment(environmentId, {
      status: 'failed',
    });

    return {
      success: false,
      resourcesRemoved: [],
      resourcesRemaining: environment.resources.map((r) => r.address),
      errors: [lastError || 'Unknown error during destruction'],
      retryCount,
    };
  }

  /**
   * Verify that all resources for an environment have been completely removed
   */
  async verifyResourceCleanup(environmentId: string): Promise<{
    allResourcesRemoved: boolean;
    remainingResources: TerraformResource[];
    verificationErrors: string[];
  }> {
    const environment = await this.stateTracker.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    const verificationErrors: string[] = [];
    const remainingResources: TerraformResource[] = [];

    try {
      // TODO: This will integrate with actual Terraform state checking
      // For now, we'll simulate resource verification
      console.log(`Verifying cleanup for environment ${environmentId}`);

      // Simulate checking each resource
      for (const resource of environment.resources) {
        const exists = await this.checkResourceExists(resource);
        if (exists) {
          remainingResources.push(resource);
        }
      }

      return {
        allResourcesRemoved: remainingResources.length === 0,
        remainingResources,
        verificationErrors,
      };
    } catch (error) {
      verificationErrors.push(
        error instanceof Error ? error.message : String(error)
      );
      return {
        allResourcesRemoved: false,
        remainingResources: environment.resources,
        verificationErrors,
      };
    }
  }

  /**
   * Force cleanup of stuck resources
   */
  async forceCleanup(environmentId: string): Promise<CleanupResult> {
    console.log(`Performing force cleanup for environment ${environmentId}`);

    return this.destroyEnvironment(environmentId, {
      forceDestroy: true,
      maxRetries: 1,
      verifyCleanup: true,
    });
  }

  /**
   * Get cleanup status for an environment
   */
  async getCleanupStatus(environmentId: string): Promise<{
    status: EnvironmentState['status'];
    resourceCount: number;
    estimatedCleanupTime: number; // minutes
    canForceCleanup: boolean;
  }> {
    const environment = await this.stateTracker.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    // Estimate cleanup time based on resource count and types
    const estimatedCleanupTime = this.estimateCleanupTime(
      environment.resources
    );

    return {
      status: environment.status,
      resourceCount: environment.resources.length,
      estimatedCleanupTime,
      canForceCleanup:
        environment.status === 'failed' || environment.status === 'destroying',
    };
  }

  /**
   * List environments that need cleanup
   */
  async getEnvironmentsNeedingCleanup(): Promise<EnvironmentState[]> {
    const environments = await this.stateTracker.listEnvironments({
      status: 'destroying',
    });

    // Also include failed environments that might have partial resources
    const failedEnvironments = await this.stateTracker.listEnvironments({
      status: 'failed',
    });

    return [
      ...environments,
      ...failedEnvironments.filter((env) => env.resources.length > 0),
    ];
  }

  /**
   * Perform the actual destruction process
   */
  private async performDestruction(
    environment: EnvironmentState,
    options: Required<DestructionOptions>
  ): Promise<CleanupResult> {
    const resourcesRemoved: string[] = [];
    const resourcesRemaining: string[] = [];
    const errors: string[] = [];

    try {
      // TODO: This will integrate with actual Terraform destroy command
      // For now, we'll simulate the destruction process
      console.log(`Destroying resources for environment ${environment.id}`);

      // Simulate destroying each resource
      for (const resource of environment.resources) {
        try {
          const destroyed = await this.destroyResource(
            resource,
            options.forceDestroy
          );
          if (destroyed) {
            resourcesRemoved.push(resource.address);
          } else {
            resourcesRemaining.push(resource.address);
          }
        } catch (error) {
          errors.push(`Failed to destroy ${resource.address}: ${error}`);
          resourcesRemaining.push(resource.address);
        }
      }

      // Verify cleanup if requested
      if (options.verifyCleanup && resourcesRemaining.length === 0) {
        const verification = await this.verifyResourceCleanup(environment.id);
        if (!verification.allResourcesRemoved) {
          resourcesRemaining.push(
            ...verification.remainingResources.map((r) => r.address)
          );
          errors.push(...verification.verificationErrors);
        }
      }

      return {
        success: resourcesRemaining.length === 0 && errors.length === 0,
        resourcesRemoved,
        resourcesRemaining,
        errors,
        retryCount: 0,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        resourcesRemoved,
        resourcesRemaining: environment.resources.map((r) => r.address),
        errors,
        retryCount: 0,
      };
    }
  }

  /**
   * Destroy a single resource
   */
  private async destroyResource(
    resource: TerraformResource,
    forceDestroy: boolean
  ): Promise<boolean> {
    // TODO: This will integrate with actual Terraform resource destruction
    // For now, we'll simulate resource destruction
    console.log(
      `Destroying resource ${resource.address} (type: ${resource.type})`
    );

    // Simulate some resources being harder to destroy
    if (resource.type.includes('aws_rds') && !forceDestroy) {
      // RDS instances take longer and might fail without force
      return Math.random() > 0.3;
    }

    if (resource.type.includes('aws_s3_bucket') && !forceDestroy) {
      // S3 buckets might fail if not empty
      return Math.random() > 0.2;
    }

    // Most resources destroy successfully
    return Math.random() > 0.1;
  }

  /**
   * Check if a resource still exists
   */
  private async checkResourceExists(
    resource: TerraformResource
  ): Promise<boolean> {
    // TODO: This will integrate with actual AWS API calls
    // For now, we'll simulate resource existence checking
    console.log(`Checking existence of resource ${resource.address}`);

    // Simulate some resources taking time to be fully removed
    return Math.random() > 0.8;
  }

  /**
   * Estimate cleanup time based on resources
   */
  private estimateCleanupTime(resources: TerraformResource[]): number {
    let estimatedMinutes = 0;

    for (const resource of resources) {
      // Different resource types have different cleanup times
      if (resource.type.includes('aws_rds')) {
        estimatedMinutes += 10; // RDS instances take longer
      } else if (resource.type.includes('aws_ec2_instance')) {
        estimatedMinutes += 3;
      } else if (resource.type.includes('aws_s3_bucket')) {
        estimatedMinutes += 2;
      } else {
        estimatedMinutes += 1; // Default for other resources
      }
    }

    return Math.max(estimatedMinutes, 2); // Minimum 2 minutes
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
