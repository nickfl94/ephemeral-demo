/**
 * Application factory for creating and managing application deployments
 */

import { EnvironmentConfig, EnvironmentState } from '../types';
import { ApplicationConfig, PartialApplicationConfig, DeploymentTarget, DeploymentResult } from './types';
import { ApplicationTemplates } from './templates';
import { VersionManager, VersionInfo } from './version-manager';
import { ConfigManager } from './config-manager';
import { DeploymentPipeline } from './deployment-pipeline';

/**
 * Application factory options
 */
export interface ApplicationFactoryOptions {
  /** ECR registry URL */
  ecrRegistry: string;
  /** AWS region */
  region: string;
  /** Default configuration profile */
  defaultProfile?: string;
}

/**
 * Application factory class for managing the complete application lifecycle
 */
export class ApplicationFactory {
  private readonly deploymentPipeline: DeploymentPipeline;
  private readonly versionManager: VersionManager;
  private readonly configManager: ConfigManager;
  private readonly options: ApplicationFactoryOptions;

  constructor(options: ApplicationFactoryOptions) {
    this.options = options;
    this.deploymentPipeline = new DeploymentPipeline(options.ecrRegistry, options.region);
    this.versionManager = new VersionManager();
    this.configManager = new ConfigManager();
    
    // Initialize default configuration profiles
    this.configManager.initializeDefaultProfiles();
  }

  /**
   * Create application configuration from template
   */
  createApplicationFromTemplate(
    templateName: string,
    appName: string,
    environmentConfig: EnvironmentConfig,
    options: {
      version?: string;
      profile?: string;
      customizations?: PartialApplicationConfig;
    } = {}
  ): ApplicationConfig {
    const {
      version = 'latest',
      profile = this.options.defaultProfile || 'demo',
      customizations = {}
    } = options;

    // Create base configuration from template
    let config = ApplicationTemplates.createFromTemplate(templateName, appName, version, customizations);

    // Apply configuration profile if specified
    if (profile) {
      config = this.configManager.applyProfile(config, profile);
    }

    // Apply environment-specific configuration
    config = this.configManager.createEnvironmentConfig(config, environmentConfig);

    // Validate configuration
    const validation = this.configManager.validateConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid application configuration: ${validation.errors.join(', ')}`);
    }

    // Store configuration
    this.configManager.storeConfig(appName, config);

    return config;
  }

  /**
   * Deploy application to environment
   */
  async deployApplication(
    config: ApplicationConfig,
    target: DeploymentTarget,
    environment: EnvironmentState,
    versionInfo?: Partial<VersionInfo>
  ): Promise<DeploymentResult> {
    try {
      // Register version information
      if (versionInfo) {
        const fullVersionInfo: VersionInfo = {
          version: config.version,
          buildTime: new Date(),
          tags: [],
          metadata: {},
          ...versionInfo
        };
        
        this.versionManager.registerVersion(config.name, fullVersionInfo);
        
        // Create versioned configuration
        config = this.versionManager.createVersionedConfig(config, fullVersionInfo);
      }

      // Deploy using the pipeline
      const result = await this.deploymentPipeline.deployApplication(config, target, environment);

      return result;

    } catch (error) {
      return {
        success: false,
        message: 'Application factory deployment failed',
        urls: { application: '', healthCheck: '' },
        metadata: {
          imageUri: '',
          deployedAt: new Date(),
          resources: {}
        },
        error: {
          code: 'FACTORY_ERROR',
          details: error instanceof Error ? error.message : 'Unknown factory error'
        }
      };
    }
  }

  /**
   * Get deployment status for an application
   */
  async getDeploymentStatus(environment: EnvironmentState) {
    return this.deploymentPipeline.getDeploymentStatus(environment);
  }

  /**
   * Get available application templates
   */
  getAvailableTemplates() {
    return ApplicationTemplates.getAvailableTemplates();
  }

  /**
   * Get available configuration profiles
   */
  getAvailableProfiles() {
    return this.configManager.getAvailableProfiles();
  }

  /**
   * Get version history for an application
   */
  getVersionHistory(appName: string, limit?: number) {
    return this.versionManager.getVersionHistory(appName, limit);
  }

  /**
   * Get version statistics for an application
   */
  getVersionStats(appName: string) {
    return this.versionManager.getVersionStats(appName);
  }

  /**
   * Create sample applications for demonstration
   */
  createSampleApplications(): Array<{ name: string; config: ApplicationConfig }> {
    const samples: Array<{
      name: string;
      template: string;
      customizations: PartialApplicationConfig;
    }> = [
      {
        name: 'todo-webapp',
        template: 'react',
        customizations: {
          docker: {
            env: {
              REACT_APP_TITLE: 'Ephemeral Todo App',
              REACT_APP_THEME: 'blue'
            }
          }
        }
      },
      {
        name: 'user-api',
        template: 'express-api',
        customizations: {
          docker: {
            env: {
              API_PREFIX: '/api/v1',
              ENABLE_CORS: 'true'
            }
          }
        }
      },
      {
        name: 'blog-fullstack',
        template: 'nextjs',
        customizations: {
          docker: {
            env: {
              NEXT_PUBLIC_SITE_NAME: 'Ephemeral Blog',
              DATABASE_TYPE: 'sqlite'
            }
          }
        }
      }
    ];

    // Create a dummy environment config for sample generation
    const dummyEnvConfig: EnvironmentConfig = {
      name: 'sample-env',
      branch: 'main',
      template: 'webapp',
      region: this.options.region,
      instanceType: 't3.micro',
      autoDestroy: true,
      maxLifetime: 24,
      costThreshold: 10,
      tags: {}
    };

    return samples.map(sample => ({
      name: sample.name,
      config: this.createApplicationFromTemplate(
        sample.template,
        sample.name,
        dummyEnvConfig,
        {
          version: '1.0.0',
          customizations: sample.customizations
        }
      )
    }));
  }

  /**
   * Clean up old versions for all applications
   */
  cleanupOldVersions(keepCount: number = 5): Record<string, VersionInfo[]> {
    const cleanedUp: Record<string, VersionInfo[]> = {};
    
    // Get all stored application configurations
    const appNames = Array.from(this.configManager['appConfigs'].keys()) as string[];
    
    for (const appName of appNames) {
      const removed = this.versionManager.cleanupOldVersions(appName, keepCount);
      if (removed.length > 0) {
        cleanedUp[appName] = removed;
      }
    }

    return cleanedUp;
  }
}