/**
 * Configuration management for applications
 */

import { ApplicationConfig, PartialApplicationConfig } from './types';
import { EnvironmentConfig } from '../types';

/**
 * Application configuration profile
 */
export interface ConfigProfile {
  /** Profile name */
  name: string;
  /** Profile description */
  description: string;
  /** Environment-specific overrides */
  environments: {
    development?: PartialApplicationConfig;
    staging?: PartialApplicationConfig;
    production?: PartialApplicationConfig;
  };
  /** Resource requirements */
  resources: {
    cpu: string;
    memory: string;
    storage?: string;
  };
  /** Scaling configuration */
  scaling: {
    minInstances: number;
    maxInstances: number;
    targetCpuUtilization?: number;
  };
}

/**
 * Configuration manager class
 */
export class ConfigManager {
  private readonly profiles: Map<string, ConfigProfile> = new Map();
  private readonly appConfigs: Map<string, ApplicationConfig> = new Map();

  /**
   * Register a configuration profile
   */
  registerProfile(profile: ConfigProfile): void {
    this.profiles.set(profile.name, profile);
  }

  /**
   * Get configuration profile
   */
  getProfile(name: string): ConfigProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): ConfigProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Apply profile to application configuration
   */
  applyProfile(
    baseConfig: ApplicationConfig,
    profileName: string,
    environment: 'development' | 'staging' | 'production' = 'production'
  ): ApplicationConfig {
    const profile = this.profiles.get(profileName);
    if (!profile) {
      throw new Error(`Configuration profile not found: ${profileName}`);
    }

    const envOverrides = profile.environments[environment] || {};
    
    return this.mergeConfigurations(baseConfig, envOverrides);
  }

  /**
   * Create environment-specific configuration
   */
  createEnvironmentConfig(
    baseConfig: ApplicationConfig,
    envConfig: EnvironmentConfig
  ): ApplicationConfig {
    const environmentOverrides: PartialApplicationConfig = {
      docker: {
        env: {
          ...baseConfig.docker.env,
          ENVIRONMENT: envConfig.name,
          BRANCH: envConfig.branch,
          REGION: envConfig.region,
          INSTANCE_TYPE: envConfig.instanceType
        }
      }
    };

    // Apply template-specific environment configurations
    switch (envConfig.template) {
      case 'webapp':
        environmentOverrides.docker!.env!.PUBLIC_URL = `https://${envConfig.name}.ephemeral-demo.example.com`;
        break;
      case 'api':
        environmentOverrides.docker!.env!.API_BASE_URL = `https://${envConfig.name}.ephemeral-demo.example.com/api`;
        break;
      case 'fullstack':
        environmentOverrides.docker!.env!.FRONTEND_URL = `https://${envConfig.name}.ephemeral-demo.example.com`;
        environmentOverrides.docker!.env!.API_URL = `https://${envConfig.name}.ephemeral-demo.example.com/api`;
        break;
    }

    return this.mergeConfigurations(baseConfig, environmentOverrides);
  }

  /**
   * Store application configuration
   */
  storeConfig(appName: string, config: ApplicationConfig): void {
    this.appConfigs.set(appName, config);
  }

  /**
   * Retrieve application configuration
   */
  getConfig(appName: string): ApplicationConfig | undefined {
    return this.appConfigs.get(appName);
  }

  /**
   * Validate application configuration
   */
  validateConfig(config: ApplicationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!config.name || config.name.trim() === '') {
      errors.push('Application name is required');
    }

    if (!config.version || config.version.trim() === '') {
      errors.push('Application version is required');
    }

    if (!['webapp', 'api', 'fullstack'].includes(config.type)) {
      errors.push('Application type must be webapp, api, or fullstack');
    }

    // Validate Docker configuration
    if (!config.docker.baseImage) {
      errors.push('Docker base image is required');
    }

    if (!config.docker.port || config.docker.port <= 0 || config.docker.port > 65535) {
      errors.push('Docker port must be between 1 and 65535');
    }

    if (!config.docker.buildContext) {
      errors.push('Docker build context is required');
    }

    if (!config.docker.dockerfile) {
      errors.push('Dockerfile path is required');
    }

    // Validate health check configuration
    if (!config.healthCheck.path) {
      errors.push('Health check path is required');
    }

    if (config.healthCheck.expectedStatus < 100 || config.healthCheck.expectedStatus > 599) {
      errors.push('Health check expected status must be a valid HTTP status code');
    }

    if (config.healthCheck.timeout <= 0) {
      errors.push('Health check timeout must be positive');
    }

    if (config.healthCheck.retries < 0) {
      errors.push('Health check retries must be non-negative');
    }

    if (config.healthCheck.interval <= 0) {
      errors.push('Health check interval must be positive');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Initialize default profiles
   */
  initializeDefaultProfiles(): void {
    // Development profile - only override environment variables
    this.registerProfile({
      name: 'development',
      description: 'Development environment with debug settings',
      environments: {
        development: {
          docker: {
            env: {
              NODE_ENV: 'development',
              DEBUG: '*',
              LOG_LEVEL: 'debug'
            }
          }
        }
      },
      resources: {
        cpu: '0.25',
        memory: '512Mi'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 1
      }
    });

    // Production profile
    this.registerProfile({
      name: 'production',
      description: 'Production environment with optimized settings',
      environments: {
        production: {
          docker: {
            env: {
              NODE_ENV: 'production',
              LOG_LEVEL: 'info'
            }
          }
        }
      },
      resources: {
        cpu: '1',
        memory: '1Gi'
      },
      scaling: {
        minInstances: 2,
        maxInstances: 10,
        targetCpuUtilization: 70
      }
    });

    // Demo profile
    this.registerProfile({
      name: 'demo',
      description: 'Demo environment with balanced settings',
      environments: {
        production: {
          docker: {
            env: {
              NODE_ENV: 'production',
              LOG_LEVEL: 'info',
              DEMO_MODE: 'true'
            }
          }
        }
      },
      resources: {
        cpu: '0.5',
        memory: '1Gi'
      },
      scaling: {
        minInstances: 1,
        maxInstances: 3,
        targetCpuUtilization: 80
      }
    });
  }

  /**
   * Merge two application configurations
   */
  private mergeConfigurations(
    base: ApplicationConfig,
    overrides: PartialApplicationConfig
  ): ApplicationConfig {
    return {
      ...base,
      ...overrides,
      docker: {
        ...base.docker,
        ...overrides.docker,
        env: {
          ...base.docker.env,
          ...overrides.docker?.env
        }
      },
      healthCheck: {
        ...base.healthCheck,
        ...overrides.healthCheck
      }
    };
  }
}