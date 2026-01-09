/**
 * Configuration management system for the ephemeral deployment demo
 * Handles loading, validation, and management of configuration profiles
 */

import * as fs from 'fs';
import * as path from 'path';
import { DemoConfig, EnvironmentConfig } from '../types';

/**
 * Configuration profile for different deployment scenarios
 */
export interface ConfigProfile {
  /** Profile name */
  name: string;
  /** Profile description */
  description: string;
  /** Default environment settings */
  defaults: {
    template: 'webapp' | 'api' | 'fullstack' | 'demo';
    region: string;
    instanceType: string;
    maxLifetime: number;
    costThreshold: number;
    autoDestroy: boolean;
  };
  /** AWS-specific settings */
  aws: {
    region: string;
    profile?: string;
  };
  /** Terraform backend configuration */
  terraform: {
    stateBackend: {
      bucket: string;
      region: string;
      dynamodbTable: string;
    };
  };
  /** Git integration settings (optional) */
  git?: {
    webhookSecret: string;
    repositoryUrl: string;
    webhookPort: number;
  };
  /** Resource tagging strategy */
  tags: Record<string, string>;
}

/**
 * Main configuration manager class
 */
export class ConfigurationManager {
  private config: DemoConfig | null = null;
  private profiles: Map<string, ConfigProfile> = new Map();
  private currentProfile: string = 'default';
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.initializeDefaultProfiles();
  }

  /**
   * Load configuration from file
   */
  async loadConfig(filePath?: string): Promise<void> {
    const configFile = filePath || this.configPath;
    
    try {
      if (!fs.existsSync(configFile)) {
        throw new Error(`Configuration file not found: ${configFile}`);
      }

      const configData = fs.readFileSync(configFile, 'utf8');
      const parsedConfig = JSON.parse(configData);
      
      // Validate configuration structure
      this.validateConfig(parsedConfig);
      
      this.config = parsedConfig;
      
      // Load any additional profiles from config
      if (parsedConfig.profiles) {
        for (const profile of parsedConfig.profiles) {
          this.profiles.set(profile.name, profile);
        }
      }
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(filePath?: string): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    const configFile = filePath || this.configPath;
    
    try {
      // Ensure directory exists
      const configDir = path.dirname(configFile);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Include profiles in saved config
      const configToSave = {
        ...this.config,
        profiles: Array.from(this.profiles.values())
      };

      fs.writeFileSync(configFile, JSON.stringify(configToSave, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize configuration with default values
   */
  initializeConfig(): void {
    this.config = {
      aws: {
        region: 'us-east-1'
      },
      defaults: {
        instanceType: 't3.micro',
        maxLifetime: 24,
        costThreshold: 50
      },
      terraform: {
        stateBackend: {
          bucket: 'ephemeral-demo-terraform-state',
          region: 'us-east-1',
          dynamodbTable: 'ephemeral-demo-terraform-locks'
        }
      }
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): DemoConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() or initializeConfig() first.');
    }
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DemoConfig>): void {
    if (!this.config) {
      this.initializeConfig();
    }
    
    this.config = this.mergeConfig(this.config!, updates);
  }

  /**
   * Validate configuration structure and values
   */
  validateConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate AWS configuration
    if (!config.aws) {
      errors.push('AWS configuration is required');
    } else {
      if (!config.aws.region) {
        errors.push('AWS region is required');
      }
    }

    // Validate defaults
    if (!config.defaults) {
      errors.push('Default configuration is required');
    } else {
      if (!config.defaults.instanceType) {
        errors.push('Default instance type is required');
      }
      if (typeof config.defaults.maxLifetime !== 'number' || config.defaults.maxLifetime <= 0) {
        errors.push('Default max lifetime must be a positive number');
      }
      if (typeof config.defaults.costThreshold !== 'number' || config.defaults.costThreshold <= 0) {
        errors.push('Default cost threshold must be a positive number');
      }
    }

    // Validate Terraform configuration
    if (!config.terraform) {
      errors.push('Terraform configuration is required');
    } else if (!config.terraform.stateBackend) {
      errors.push('Terraform state backend configuration is required');
    } else {
      if (!config.terraform.stateBackend.bucket) {
        errors.push('Terraform state bucket is required');
      }
      if (!config.terraform.stateBackend.region) {
        errors.push('Terraform state region is required');
      }
      if (!config.terraform.stateBackend.dynamodbTable) {
        errors.push('Terraform DynamoDB table is required');
      }
    }

    // Validate Git configuration (if present)
    if (config.git) {
      if (!config.git.webhookSecret) {
        errors.push('Git webhook secret is required when Git integration is enabled');
      }
      if (!config.git.repositoryUrl) {
        errors.push('Git repository URL is required when Git integration is enabled');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get configuration profile
   */
  getProfile(name: string): ConfigProfile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Set current profile
   */
  setCurrentProfile(name: string): void {
    if (!this.profiles.has(name)) {
      throw new Error(`Profile not found: ${name}`);
    }
    this.currentProfile = name;
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): ConfigProfile {
    const profile = this.profiles.get(this.currentProfile);
    if (!profile) {
      throw new Error(`Current profile not found: ${this.currentProfile}`);
    }
    return profile;
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): ConfigProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Add or update a configuration profile
   */
  addProfile(profile: ConfigProfile): void {
    this.profiles.set(profile.name, profile);
  }

  /**
   * Remove a configuration profile
   */
  removeProfile(name: string): boolean {
    if (name === 'default') {
      throw new Error('Cannot remove default profile');
    }
    return this.profiles.delete(name);
  }

  /**
   * Create environment configuration from profile and overrides
   */
  createEnvironmentConfig(
    branch: string,
    overrides: Partial<EnvironmentConfig> = {}
  ): EnvironmentConfig {
    const profile = this.getCurrentProfile();
    const config = this.getConfig();

    const environmentName = this.generateEnvironmentName(branch);

    return {
      name: environmentName,
      branch,
      template: overrides.template || profile.defaults.template,
      region: overrides.region || profile.aws.region,
      instanceType: overrides.instanceType || profile.defaults.instanceType,
      autoDestroy: overrides.autoDestroy !== undefined ? overrides.autoDestroy : profile.defaults.autoDestroy,
      maxLifetime: overrides.maxLifetime || profile.defaults.maxLifetime,
      costThreshold: overrides.costThreshold || profile.defaults.costThreshold,
      tags: {
        ...profile.tags,
        ...overrides.tags,
        Branch: branch,
        Environment: environmentName,
        Profile: profile.name
      }
    };
  }

  /**
   * Get default configuration file path
   */
  private getDefaultConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.ephemeral-demo', 'config.json');
  }

  /**
   * Generate unique environment name
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
   * Initialize default configuration profiles
   */
  private initializeDefaultProfiles(): void {
    // Default profile for general use
    this.profiles.set('default', {
      name: 'default',
      description: 'Default configuration for general use',
      defaults: {
        template: 'demo',
        region: 'us-east-1',
        instanceType: 't3.micro',
        maxLifetime: 24,
        costThreshold: 50,
        autoDestroy: true
      },
      aws: {
        region: 'us-east-1'
      },
      terraform: {
        stateBackend: {
          bucket: 'ephemeral-demo-terraform-state',
          region: 'us-east-1',
          dynamodbTable: 'ephemeral-demo-terraform-locks'
        }
      },
      tags: {
        Project: 'ephemeral-demo',
        ManagedBy: 'ephemeral-demo-cli',
        Purpose: 'demonstration'
      }
    });

    // Development profile for development environments
    this.profiles.set('development', {
      name: 'development',
      description: 'Development environment with extended lifetime and debug settings',
      defaults: {
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.small',
        maxLifetime: 72, // 3 days for development
        costThreshold: 100,
        autoDestroy: true
      },
      aws: {
        region: 'us-east-1'
      },
      terraform: {
        stateBackend: {
          bucket: 'ephemeral-demo-dev-terraform-state',
          region: 'us-east-1',
          dynamodbTable: 'ephemeral-demo-dev-terraform-locks'
        }
      },
      tags: {
        Project: 'ephemeral-demo',
        Environment: 'development',
        ManagedBy: 'ephemeral-demo-cli',
        Purpose: 'development'
      }
    });

    // Demo profile optimized for presentations
    this.profiles.set('demo', {
      name: 'demo',
      description: 'Optimized for live demonstrations with fast provisioning',
      defaults: {
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.micro',
        maxLifetime: 4, // Short lifetime for demos
        costThreshold: 25,
        autoDestroy: true
      },
      aws: {
        region: 'us-east-1'
      },
      terraform: {
        stateBackend: {
          bucket: 'ephemeral-demo-demo-terraform-state',
          region: 'us-east-1',
          dynamodbTable: 'ephemeral-demo-demo-terraform-locks'
        }
      },
      tags: {
        Project: 'ephemeral-demo',
        Environment: 'demo',
        ManagedBy: 'ephemeral-demo-cli',
        Purpose: 'demonstration',
        AutoCleanup: 'aggressive'
      }
    });

    // Production profile for production-like testing
    this.profiles.set('production', {
      name: 'production',
      description: 'Production-like environment for final testing',
      defaults: {
        template: 'fullstack',
        region: 'us-east-1',
        instanceType: 't3.medium',
        maxLifetime: 48,
        costThreshold: 200,
        autoDestroy: true
      },
      aws: {
        region: 'us-east-1'
      },
      terraform: {
        stateBackend: {
          bucket: 'ephemeral-demo-prod-terraform-state',
          region: 'us-east-1',
          dynamodbTable: 'ephemeral-demo-prod-terraform-locks'
        }
      },
      tags: {
        Project: 'ephemeral-demo',
        Environment: 'production-test',
        ManagedBy: 'ephemeral-demo-cli',
        Purpose: 'production-testing'
      }
    });
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(base: DemoConfig, updates: Partial<DemoConfig>): DemoConfig {
    return {
      aws: {
        ...base.aws,
        ...updates.aws
      },
      defaults: {
        ...base.defaults,
        ...updates.defaults
      },
      terraform: {
        stateBackend: {
          ...base.terraform.stateBackend,
          ...updates.terraform?.stateBackend
        }
      },
      ...(updates.git && { git: updates.git })
    };
  }
}

/**
 * Global configuration manager instance
 */
export const configManager = new ConfigurationManager();