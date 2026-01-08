/**
 * Main demo orchestrator that wires all components together
 * Provides a unified interface for the entire ephemeral deployment demo system
 */

import { EnvironmentConfig, EnvironmentState, CommandResult, DemoConfig } from '../types';
import { ConfigurationManager } from '../config';
import { EnvironmentLifecycleManager } from '../environment/lifecycle-manager';
import { EnvironmentStateTracker } from '../environment/state-tracker';
import { CleanupScheduler } from '../environment/cleanup-scheduler';
import { DeploymentPipeline } from '../application/deployment-pipeline';
import { ApplicationFactory } from '../application/application-factory';
import { ConfigManager } from '../application/config-manager';
import { GitIntegration, GitIntegrationConfig } from '../git/git-integration';
import { EnvironmentActions } from '../git/event-processor';
import { DeploymentTarget } from '../application/types';
import chalk from 'chalk';
import ora from 'ora';

/**
 * Demo orchestrator configuration
 */
export interface DemoOrchestratorConfig {
  /** Configuration manager instance */
  configManager: ConfigurationManager;
  /** ECR registry for Docker images */
  ecrRegistry: string;
  /** Enable Git integration */
  enableGitIntegration?: boolean;
  /** Git integration configuration (required if enableGitIntegration is true) */
  gitConfig?: Omit<GitIntegrationConfig, 'eventProcessor'>;
}

/**
 * Main orchestrator class that coordinates all system components
 */
export class DemoOrchestrator {
  private configManager: ConfigurationManager;
  private stateTracker: EnvironmentStateTracker;
  private lifecycleManager: EnvironmentLifecycleManager;
  private cleanupScheduler: CleanupScheduler;
  private deploymentPipeline: DeploymentPipeline;
  private applicationFactory: ApplicationFactory;
  private appConfigManager: ConfigManager;
  private gitIntegration?: GitIntegration;
  private config: DemoOrchestratorConfig;
  private isInitialized: boolean = false;

  constructor(config: DemoOrchestratorConfig) {
    this.config = config;
    this.configManager = config.configManager;
    
    // Initialize core components
    this.stateTracker = new EnvironmentStateTracker();
    this.lifecycleManager = new EnvironmentLifecycleManager(this.stateTracker);
    this.cleanupScheduler = new CleanupScheduler(this.stateTracker, this.lifecycleManager);
    this.deploymentPipeline = new DeploymentPipeline(config.ecrRegistry);
    this.applicationFactory = new ApplicationFactory({
      ecrRegistry: config.ecrRegistry,
      region: 'us-east-1' // Default region, will be overridden by environment config
    });
    this.appConfigManager = new ConfigManager();
    
    // Initialize application config manager with default profiles
    this.appConfigManager.initializeDefaultProfiles();
  }

  /**
   * Initialize the orchestrator and all components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const spinner = ora('Initializing demo orchestrator...').start();

    try {
      // Ensure configuration is loaded
      try {
        this.configManager.getConfig();
      } catch {
        // Try to load from default location
        try {
          await this.configManager.loadConfig();
        } catch {
          // Initialize with defaults if no config exists
          this.configManager.initializeConfig();
        }
      }

      // Initialize state tracker
      spinner.text = 'Initializing environment state tracker...';
      await this.stateTracker.initialize();

      // Initialize cleanup scheduler
      spinner.text = 'Starting cleanup scheduler...';
      await this.cleanupScheduler.start();

      // Initialize Git integration if enabled
      if (this.config.enableGitIntegration && this.config.gitConfig) {
        spinner.text = 'Initializing Git integration...';
        await this.initializeGitIntegration();
      }

      this.isInitialized = true;
      spinner.succeed('Demo orchestrator initialized successfully');
    } catch (error) {
      spinner.fail('Failed to initialize demo orchestrator');
      throw error;
    }
  }

  /**
   * Shutdown the orchestrator and all components
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const spinner = ora('Shutting down demo orchestrator...').start();

    try {
      // Shutdown Git integration
      if (this.gitIntegration) {
        spinner.text = 'Shutting down Git integration...';
        await this.gitIntegration.shutdown();
      }

      // Stop cleanup scheduler
      spinner.text = 'Stopping cleanup scheduler...';
      await this.cleanupScheduler.stop();

      this.isInitialized = false;
      spinner.succeed('Demo orchestrator shut down successfully');
    } catch (error) {
      spinner.fail('Error during shutdown');
      throw error;
    }
  }

  /**
   * Provision a new ephemeral environment
   */
  async provisionEnvironment(
    branch: string,
    overrides: Partial<EnvironmentConfig> = {}
  ): Promise<CommandResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const spinner = ora('Provisioning ephemeral environment...').start();

    try {
      // Create environment configuration
      spinner.text = 'Creating environment configuration...';
      const envConfig = this.configManager.createEnvironmentConfig(branch, overrides);

      // Create environment
      spinner.text = 'Creating environment infrastructure...';
      const environment = await this.lifecycleManager.createEnvironment(envConfig);

      // TODO: This will integrate with Terraform orchestration in future tasks
      // For now, we'll simulate infrastructure provisioning
      spinner.text = 'Provisioning AWS infrastructure...';
      await this.simulateInfrastructureProvisioning(environment);

      // Deploy sample application
      spinner.text = 'Deploying sample application...';
      const deploymentResult = await this.deploySampleApplication(environment, envConfig);

      if (!deploymentResult.success) {
        spinner.fail('Application deployment failed');
        return {
          success: false,
          message: deploymentResult.message,
          error: deploymentResult.error
        };
      }

      // Update environment with deployment URLs
      await this.stateTracker.updateEnvironment(environment.id, {
        status: 'ready',
        urls: deploymentResult.urls
      });

      // Register with Git integration if enabled
      if (this.gitIntegration) {
        await this.gitIntegration.getBranchMapper().createMapping(branch, environment.id);
      }

      spinner.succeed(`Environment ${environment.name} provisioned successfully`);

      return {
        success: true,
        message: `Environment provisioned successfully`,
        data: {
          environmentId: environment.id,
          name: environment.name,
          urls: deploymentResult.urls,
          branch: branch
        }
      };

    } catch (error) {
      spinner.fail('Environment provisioning failed');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'PROVISION_ERROR',
          details: String(error)
        }
      };
    }
  }

  /**
   * Destroy an ephemeral environment
   */
  async destroyEnvironment(environmentId: string, force: boolean = false): Promise<CommandResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const spinner = ora(`Destroying environment ${environmentId}...`).start();

    try {
      const environment = await this.stateTracker.getEnvironment(environmentId);
      if (!environment) {
        spinner.fail('Environment not found');
        return {
          success: false,
          message: `Environment ${environmentId} not found`,
          error: {
            code: 'ENVIRONMENT_NOT_FOUND',
            details: `No environment found with ID: ${environmentId}`
          }
        };
      }

      // Destroy environment
      spinner.text = 'Destroying AWS infrastructure...';
      const cleanupResult = await this.lifecycleManager.destroyEnvironment(environmentId, {
        forceDestroy: force,
        maxRetries: force ? 1 : 3
      });

      if (!cleanupResult.success) {
        spinner.fail('Environment destruction failed');
        return {
          success: false,
          message: `Environment destruction failed: ${cleanupResult.errors.join(', ')}`,
          error: {
            code: 'DESTROY_ERROR',
            details: cleanupResult.errors.join('; ')
          }
        };
      }

      // Remove Git mapping if exists
      if (this.gitIntegration) {
        await this.gitIntegration.getBranchMapper().removeMapping(environment.branch);
      }

      spinner.succeed(`Environment ${environment.name} destroyed successfully`);

      return {
        success: true,
        message: `Environment destroyed successfully`,
        data: {
          environmentId,
          resourcesRemoved: cleanupResult.resourcesRemoved.length,
          retryCount: cleanupResult.retryCount
        }
      };

    } catch (error) {
      spinner.fail('Environment destruction failed');
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'DESTROY_ERROR',
          details: String(error)
        }
      };
    }
  }

  /**
   * Get status of environments
   */
  async getEnvironmentStatus(environmentId?: string): Promise<CommandResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      if (environmentId) {
        const environment = await this.stateTracker.getEnvironment(environmentId);
        if (!environment) {
          return {
            success: false,
            message: `Environment ${environmentId} not found`,
            error: {
              code: 'ENVIRONMENT_NOT_FOUND',
              details: `No environment found with ID: ${environmentId}`
            }
          };
        }

        const deploymentStatus = await this.deploymentPipeline.getDeploymentStatus(environment);
        
        return {
          success: true,
          message: this.formatEnvironmentStatus(environment, deploymentStatus),
          data: { environment, deploymentStatus }
        };
      } else {
        const environments = await this.stateTracker.listEnvironments();
        const statusList = await Promise.all(
          environments.map(async (env) => {
            const deploymentStatus = await this.deploymentPipeline.getDeploymentStatus(env);
            return { environment: env, deploymentStatus };
          })
        );

        return {
          success: true,
          message: this.formatEnvironmentsList(statusList),
          data: statusList
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          code: 'STATUS_ERROR',
          details: String(error)
        }
      };
    }
  }

  /**
   * Run a complete demonstration workflow
   */
  async runDemoWorkflow(scenario: string = 'basic', interactive: boolean = false): Promise<CommandResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(chalk.magenta(`🎭 Starting ${scenario} demo scenario`));
    console.log(chalk.gray('This will demonstrate the complete ephemeral environment lifecycle\n'));

    try {
      // Demo scenario implementation
      switch (scenario) {
        case 'basic':
          return await this.runBasicDemo(interactive);
        case 'git-integration':
          return await this.runGitIntegrationDemo(interactive);
        case 'cost-comparison':
          return await this.runCostComparisonDemo(interactive);
        default:
          return {
            success: false,
            message: `Unknown demo scenario: ${scenario}`,
            error: {
              code: 'UNKNOWN_SCENARIO',
              details: `Scenario '${scenario}' is not supported`
            }
          };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Demo workflow failed',
        error: {
          code: 'DEMO_ERROR',
          details: String(error)
        }
      };
    }
  }

  /**
   * Get cost analysis and reports
   */
  async getCostAnalysis(environmentId?: string): Promise<CommandResult> {
    // TODO: This will integrate with cost monitoring in future tasks
    return {
      success: true,
      message: 'Cost analysis not yet implemented',
      data: {
        message: 'Cost monitoring will be implemented in task 6'
      }
    };
  }

  /**
   * Initialize Git integration
   */
  private async initializeGitIntegration(): Promise<void> {
    if (!this.config.gitConfig) {
      throw new Error('Git configuration is required when Git integration is enabled');
    }

    const demoConfig = this.configManager.getConfig();
    
    // Create environment actions for Git integration
    const environmentActions: EnvironmentActions = {
      createEnvironment: async (config: EnvironmentConfig) => {
        const result = await this.provisionEnvironment(config.branch, config);
        if (!result.success) {
          throw new Error(result.message);
        }
        return (result.data as any).environmentId;
      },
      destroyEnvironment: async (environmentId: string) => {
        const result = await this.destroyEnvironment(environmentId);
        if (!result.success) {
          throw new Error(result.message);
        }
      },
      scheduleDestruction: async (environmentId: string, delayMinutes: number) => {
        // TODO: Implement scheduled destruction
        console.log(`Scheduling destruction of ${environmentId} in ${delayMinutes} minutes`);
      },
      cancelDestruction: async (environmentId: string) => {
        // TODO: Implement cancellation of scheduled destruction
        console.log(`Cancelling scheduled destruction of ${environmentId}`);
      }
    };

    // Create Git integration configuration
    const gitIntegrationConfig: GitIntegrationConfig = {
      ...this.config.gitConfig,
      eventProcessor: {
        defaultEnvironmentConfig: {
          template: 'webapp',
          region: demoConfig.aws.region,
          instanceType: demoConfig.defaults.instanceType,
          autoDestroy: true,
          maxLifetime: demoConfig.defaults.maxLifetime,
          costThreshold: demoConfig.defaults.costThreshold
        },
        autoCreateEnvironments: true,
        autoDestroyEnvironments: true,
        destroyDelayMinutes: 5
      }
    };

    this.gitIntegration = new GitIntegration(gitIntegrationConfig, environmentActions);
    await this.gitIntegration.initialize();
  }

  /**
   * Simulate infrastructure provisioning (placeholder for Terraform integration)
   */
  private async simulateInfrastructureProvisioning(environment: EnvironmentState): Promise<void> {
    // TODO: This will be replaced with actual Terraform orchestration
    console.log(`Simulating infrastructure provisioning for ${environment.name}`);
    
    // Simulate provisioning delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Add simulated resources to environment
    const simulatedResources = [
      {
        address: 'aws_vpc.main',
        type: 'aws_vpc',
        name: `${environment.name}-vpc`,
        attributes: { cidr_block: '10.0.0.0/16' }
      },
      {
        address: 'aws_subnet.public',
        type: 'aws_subnet',
        name: `${environment.name}-public-subnet`,
        attributes: { cidr_block: '10.0.1.0/24' }
      },
      {
        address: 'aws_instance.app',
        type: 'aws_instance',
        name: `${environment.name}-app-instance`,
        attributes: { instance_type: 't3.micro' }
      }
    ];

    await this.stateTracker.updateEnvironment(environment.id, {
      resources: simulatedResources
    });
  }

  /**
   * Deploy sample application to environment
   */
  private async deploySampleApplication(environment: EnvironmentState, envConfig: EnvironmentConfig): Promise<any> {
    // Get application configuration based on environment template
    const appConfig = this.applicationFactory.createApplicationFromTemplate(
      envConfig.template,
      environment.name,
      envConfig,
      {
        version: '1.0.0'
      }
    );

    // Create deployment target (simulated)
    const deploymentTarget: DeploymentTarget = {
      type: 'ec2',
      region: envConfig.region,
      config: {
        instanceId: 'i-1234567890abcdef0', // Simulated instance ID
        keyName: 'ephemeral-demo-key',
        securityGroups: ['sg-1234567890abcdef0']
      }
    };

    // Deploy application
    return await this.deploymentPipeline.deployApplication(
      appConfig,
      deploymentTarget,
      environment
    );
  }

  /**
   * Run basic demo scenario
   */
  private async runBasicDemo(interactive: boolean): Promise<CommandResult> {
    console.log(chalk.blue('📋 Basic Demo: Provision → Deploy → Destroy'));
    
    // Step 1: Provision environment
    console.log(chalk.yellow('\n1. Provisioning ephemeral environment...'));
    const provisionResult = await this.provisionEnvironment('demo-branch');
    
    if (!provisionResult.success) {
      return provisionResult;
    }

    const environmentId = (provisionResult.data as any).environmentId;
    console.log(chalk.green(`✅ Environment provisioned: ${(provisionResult.data as any).name}`));
    console.log(chalk.cyan(`   Application URL: ${(provisionResult.data as any).urls.application}`));

    // Step 2: Show status
    console.log(chalk.yellow('\n2. Checking environment status...'));
    const statusResult = await this.getEnvironmentStatus(environmentId);
    console.log(statusResult.message);

    // Step 3: Wait for user input if interactive
    if (interactive) {
      console.log(chalk.magenta('\n🎯 Demo environment is ready! Press Enter to continue with cleanup...'));
      // In a real implementation, we'd wait for user input here
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log(chalk.gray('\n⏳ Waiting 10 seconds before cleanup...'));
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Step 4: Destroy environment
    console.log(chalk.yellow('\n3. Destroying ephemeral environment...'));
    const destroyResult = await this.destroyEnvironment(environmentId);
    
    if (!destroyResult.success) {
      return destroyResult;
    }

    console.log(chalk.green('✅ Environment destroyed successfully'));
    console.log(chalk.magenta('\n🎉 Basic demo completed successfully!'));

    return {
      success: true,
      message: 'Basic demo completed successfully',
      data: {
        environmentId,
        provisionTime: '~2 minutes',
        destroyTime: '~1 minute',
        totalCost: '$0.05 (estimated)'
      }
    };
  }

  /**
   * Run Git integration demo scenario
   */
  private async runGitIntegrationDemo(interactive: boolean): Promise<CommandResult> {
    if (!this.gitIntegration) {
      return {
        success: false,
        message: 'Git integration is not enabled',
        error: {
          code: 'GIT_INTEGRATION_DISABLED',
          details: 'Git integration must be enabled to run this demo'
        }
      };
    }

    console.log(chalk.blue('🔗 Git Integration Demo: Webhook → Auto-provision → Auto-cleanup'));
    
    // TODO: Implement Git integration demo
    return {
      success: true,
      message: 'Git integration demo not yet fully implemented',
      data: {
        gitIntegrationStatus: this.gitIntegration.getStatus()
      }
    };
  }

  /**
   * Run cost comparison demo scenario
   */
  private async runCostComparisonDemo(interactive: boolean): Promise<CommandResult> {
    console.log(chalk.blue('💰 Cost Comparison Demo: Ephemeral vs Persistent'));
    
    // TODO: Implement cost comparison demo
    return {
      success: true,
      message: 'Cost comparison demo not yet implemented',
      data: {
        message: 'Cost monitoring will be implemented in task 6'
      }
    };
  }

  /**
   * Format environment status for display
   */
  private formatEnvironmentStatus(environment: EnvironmentState, deploymentStatus: any): string {
    let status = chalk.blue(`Environment: ${environment.name}\n`);
    status += `  ID: ${environment.id}\n`;
    status += `  Branch: ${environment.branch}\n`;
    status += `  Status: ${this.getStatusColor(environment.status)}${environment.status}${chalk.reset()}\n`;
    status += `  Created: ${environment.createdAt.toISOString()}\n`;
    
    if (environment.urls.application) {
      status += `  Application URL: ${chalk.cyan(environment.urls.application)}\n`;
    }
    
    if (deploymentStatus.deployed) {
      status += `  Health Status: ${deploymentStatus.healthy ? chalk.green('Healthy') : chalk.red('Unhealthy')}\n`;
    }
    
    status += `  Resources: ${environment.resources.length} items\n`;
    status += `  Current Cost: $${environment.costs.current.toFixed(2)}\n`;

    return status;
  }

  /**
   * Format environments list for display
   */
  private formatEnvironmentsList(statusList: any[]): string {
    if (statusList.length === 0) {
      return chalk.yellow('No environments found');
    }

    let output = chalk.blue(`Found ${statusList.length} environment(s):\n\n`);
    
    statusList.forEach(({ environment, deploymentStatus }) => {
      output += `${chalk.white(environment.name)} (${environment.id})\n`;
      output += `  Status: ${this.getStatusColor(environment.status)}${environment.status}${chalk.reset()}\n`;
      output += `  Branch: ${environment.branch}\n`;
      output += `  Created: ${environment.createdAt.toISOString()}\n`;
      if (environment.urls.application) {
        output += `  URL: ${chalk.cyan(environment.urls.application)}\n`;
      }
      output += '\n';
    });

    return output;
  }

  /**
   * Get color for environment status
   */
  private getStatusColor(status: EnvironmentState['status']): string {
    switch (status) {
      case 'ready': return chalk.green('');
      case 'creating': return chalk.yellow('');
      case 'destroying': return chalk.yellow('');
      case 'destroyed': return chalk.gray('');
      case 'failed': return chalk.red('');
      default: return chalk.white('');
    }
  }
}