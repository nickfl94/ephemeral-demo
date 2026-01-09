/**
 * Command implementations for the ephemeral deployment demo CLI
 */

import { CommandResult, EnvironmentConfig } from '../types';
import { configManager } from '../config';
import { ConfigCLIUtils } from '../config/cli-utils';
import { DemoOrchestrator } from '../orchestrator/demo-orchestrator';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Main commands class that implements all CLI command functionality
 */
export class DemoCommands {
  private configUtils: ConfigCLIUtils;
  private orchestrator: DemoOrchestrator;

  constructor() {
    this.configUtils = new ConfigCLIUtils(configManager);
    
    // Initialize orchestrator with configuration
    this.orchestrator = new DemoOrchestrator({
      configManager,
      ecrRegistry: 'your-account-id.dkr.ecr.us-east-1.amazonaws.com/ephemeral-demo',
      enableGitIntegration: false // Will be enabled based on configuration
    });
  }
  /**
   * Provision a new ephemeral environment
   */
  async provision(options: {
    branch?: string;
    template?: string;
    region?: string;
    instanceType?: string;
    autoDestroy?: boolean;
    maxLifetime?: string;
    costThreshold?: string;
  }): Promise<CommandResult> {
    try {
      // Load configuration if not already loaded
      try {
        configManager.getConfig();
      } catch {
        // Try to load from default location
        try {
          await configManager.loadConfig();
        } catch {
          // Initialize with defaults if no config exists
          configManager.initializeConfig();
        }
      }

      // Create overrides from command line options
      const overrides: Partial<EnvironmentConfig> = {};
      if (options.template) overrides.template = options.template as 'webapp' | 'api' | 'fullstack' | 'demo';
      if (options.region) overrides.region = options.region;
      if (options.instanceType) overrides.instanceType = options.instanceType;
      if (options.autoDestroy !== undefined) overrides.autoDestroy = options.autoDestroy;
      if (options.maxLifetime) overrides.maxLifetime = parseInt(options.maxLifetime, 10);
      if (options.costThreshold) overrides.costThreshold = parseFloat(options.costThreshold);

      // Use orchestrator to provision environment
      return await this.orchestrator.provisionEnvironment(
        options.branch || 'main',
        overrides
      );

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'PROVISION_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Destroy an ephemeral environment
   */
  async destroy(
    environmentId: string,
    options: { force?: boolean }
  ): Promise<CommandResult> {
    try {
      if (!environmentId) {
        throw new Error('Environment ID is required');
      }

      return await this.orchestrator.destroyEnvironment(environmentId, options.force);

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'DESTROY_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Show status of environments
   */
  async status(options: {
    environment?: string;
    all?: boolean;
  }): Promise<CommandResult> {
    try {
      return await this.orchestrator.getEnvironmentStatus(options.environment);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'STATUS_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Run a complete demonstration workflow
   */
  async runDemo(options: {
    scenario?: string;
    interactive?: boolean;
  }): Promise<CommandResult> {
    try {
      return await this.orchestrator.runDemoWorkflow(
        options.scenario || 'basic',
        options.interactive || false
      );
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'DEMO_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Show cost analysis and reports
   */
  async showCosts(options: {
    environment?: string;
    report?: boolean;
  }): Promise<CommandResult> {
    try {
      return await this.orchestrator.getCostAnalysis(options.environment);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'COSTS_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Manage configuration settings
   */
  async manageConfig(options: {
    init?: boolean;
    validate?: boolean;
    show?: boolean;
    profile?: string;
    listProfiles?: boolean;
    createProfile?: boolean;
    copyExample?: string;
    listExamples?: boolean;
  }): Promise<CommandResult> {
    try {
      if (options.init) {
        await this.configUtils.initializeConfigInteractive();
        return {
          success: true,
          message: 'Configuration initialized successfully',
        };
      }

      if (options.validate) {
        this.configUtils.validateConfiguration();
        return {
          success: true,
          message: 'Configuration validation completed',
        };
      }

      if (options.show) {
        this.configUtils.showConfiguration();
        return {
          success: true,
          message: 'Configuration displayed',
        };
      }

      if (options.listProfiles) {
        this.configUtils.listProfiles();
        return {
          success: true,
          message: 'Profiles listed',
        };
      }

      if (options.profile) {
        configManager.setCurrentProfile(options.profile);
        return {
          success: true,
          message: `Switched to profile: ${options.profile}`,
        };
      }

      if (options.createProfile) {
        await this.configUtils.createProfile();
        return {
          success: true,
          message: 'Profile created successfully',
        };
      }

      if (options.copyExample) {
        await this.configUtils.copyExampleConfig(options.copyExample);
        return {
          success: true,
          message: `Example configuration '${options.copyExample}' copied successfully`,
        };
      }

      if (options.listExamples) {
        this.configUtils.listExampleConfigs();
        return {
          success: true,
          message: 'Example configurations listed',
        };
      }

      return {
        success: true,
        message: 'No configuration action specified. Use --help for available options.',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'CONFIG_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Cleanup environments based on criteria
   */
  async cleanup(options: {
    expired?: boolean;
    branch?: string;
    olderThan?: string;
    force?: boolean;
    dryRun?: boolean;
  }): Promise<CommandResult> {
    try {
      // Get all environments first
      const statusResult = await this.orchestrator.getEnvironmentStatus();
      if (!statusResult.success) {
        return statusResult;
      }

      const environments = (statusResult.data as any) || [];
      let environmentsToCleanup: any[] = [];

      // Filter environments based on criteria
      if (options.expired) {
        environmentsToCleanup = environments.filter((env: any) => {
          const environment = env.environment;
          return environment.destroyAt && new Date(environment.destroyAt) <= new Date();
        });
      }

      if (options.branch) {
        environmentsToCleanup = environments.filter((env: any) => {
          return env.environment.branch === options.branch;
        });
      }

      if (options.olderThan) {
        const hoursAgo = parseInt(options.olderThan, 10);
        const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
        environmentsToCleanup = environments.filter((env: any) => {
          return new Date(env.environment.createdAt) < cutoffTime;
        });
      }

      if (environmentsToCleanup.length === 0) {
        return {
          success: true,
          message: 'No environments found matching cleanup criteria',
        };
      }

      if (options.dryRun) {
        let message = `Would cleanup ${environmentsToCleanup.length} environment(s):\n`;
        environmentsToCleanup.forEach((env: any) => {
          message += `  - ${env.environment.name} (${env.environment.id}) - Branch: ${env.environment.branch}\n`;
        });
        return {
          success: true,
          message,
        };
      }

      // Perform cleanup
      let cleanedUp = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const env of environmentsToCleanup) {
        try {
          const result = await this.orchestrator.destroyEnvironment(env.environment.id, options.force);
          if (result.success) {
            cleanedUp++;
          } else {
            failed++;
            errors.push(`${env.environment.name}: ${result.message}`);
          }
        } catch (error) {
          failed++;
          errors.push(`${env.environment.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      let message = `Cleanup completed: ${cleanedUp} environments destroyed`;
      if (failed > 0) {
        message += `, ${failed} failed`;
        if (errors.length > 0) {
          message += `\nErrors:\n${errors.join('\n')}`;
        }
      }

      return {
        success: failed === 0,
        message,
        data: {
          cleanedUp,
          failed,
          errors
        }
      };

    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'CLEANUP_ERROR',
          details: String(error),
        },
      };
    }
  }

  /**
   * Generate a unique environment name based on branch name
   */
  private generateEnvironmentName(branch: string): string {
    // Sanitize branch name for AWS resource naming
    const sanitized = branch
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36);

    return `ephemeral-${sanitized}-${timestamp}`;
  }

  /**
   * Validate environment configuration
   */
  private validateEnvironmentConfig(config: EnvironmentConfig): void {
    if (!config.name) {
      throw new Error('Environment name is required');
    }

    if (!config.branch) {
      throw new Error('Branch name is required');
    }

    if (!['webapp', 'api', 'fullstack', 'demo'].includes(config.template)) {
      throw new Error('Template must be one of: webapp, api, fullstack, demo');
    }

    if (!config.region) {
      throw new Error('AWS region is required');
    }

    if (config.maxLifetime <= 0) {
      throw new Error('Max lifetime must be greater than 0 hours');
    }

    if (config.costThreshold <= 0) {
      throw new Error('Cost threshold must be greater than 0');
    }
  }
}
