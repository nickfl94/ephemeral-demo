/**
 * CLI utilities for configuration management
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ConfigurationManager, ConfigProfile } from './index';
import { DemoConfig } from '../types';

/**
 * Configuration CLI utilities class
 */
export class ConfigCLIUtils {
  private configManager: ConfigurationManager;

  constructor(configManager: ConfigurationManager) {
    this.configManager = configManager;
  }

  /**
   * Initialize configuration interactively
   */
  async initializeConfigInteractive(): Promise<void> {
    console.log(chalk.blue('🔧 Initializing Ephemeral Demo Configuration'));
    console.log(chalk.gray('This will create a new configuration file with your preferences.\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'awsRegion',
        message: 'AWS Region:',
        default: 'ap-southeast-2',
        validate: (input: string) => input.trim().length > 0 || 'AWS region is required'
      },
      {
        type: 'input',
        name: 'awsProfile',
        message: 'AWS Profile (optional):',
        default: ''
      },
      {
        type: 'list',
        name: 'instanceType',
        message: 'Default instance type:',
        choices: [
          { name: 't3.micro (1 vCPU, 1GB RAM) - Cheapest', value: 't3.micro' },
          { name: 't3.small (2 vCPU, 2GB RAM) - Balanced', value: 't3.small' },
          { name: 't3.medium (2 vCPU, 4GB RAM) - More memory', value: 't3.medium' },
          { name: 't3.large (2 vCPU, 8GB RAM) - High memory', value: 't3.large' }
        ],
        default: 't3.micro'
      },
      {
        type: 'number',
        name: 'maxLifetime',
        message: 'Default max lifetime (hours):',
        default: 24,
        validate: (input: number) => input > 0 || 'Max lifetime must be greater than 0'
      },
      {
        type: 'number',
        name: 'costThreshold',
        message: 'Default cost threshold (USD):',
        default: 50,
        validate: (input: number) => input > 0 || 'Cost threshold must be greater than 0'
      },
      {
        type: 'input',
        name: 'terraformBucket',
        message: 'Terraform state S3 bucket:',
        default: 'ephemeral-demo-terraform-state',
        validate: (input: string) => input.trim().length > 0 || 'Terraform bucket is required'
      },
      {
        type: 'input',
        name: 'terraformTable',
        message: 'Terraform DynamoDB table:',
        default: 'ephemeral-demo-terraform-locks',
        validate: (input: string) => input.trim().length > 0 || 'DynamoDB table is required'
      },
      {
        type: 'confirm',
        name: 'enableGit',
        message: 'Enable Git integration?',
        default: false
      }
    ]);

    let gitConfig;
    if (answers.enableGit) {
      gitConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'repositoryUrl',
          message: 'Git repository URL:',
          validate: (input: string) => input.trim().length > 0 || 'Repository URL is required'
        },
        {
          type: 'password',
          name: 'webhookSecret',
          message: 'Webhook secret:',
          validate: (input: string) => input.trim().length > 0 || 'Webhook secret is required'
        },
        {
          type: 'number',
          name: 'webhookPort',
          message: 'Webhook port:',
          default: 3000,
          validate: (input: number) => (input > 0 && input < 65536) || 'Port must be between 1 and 65535'
        }
      ]);
    }

    // Create configuration
    const config: DemoConfig = {
      aws: {
        region: answers.awsRegion,
        ...(answers.awsProfile && { profile: answers.awsProfile })
      },
      defaults: {
        instanceType: answers.instanceType,
        maxLifetime: answers.maxLifetime,
        costThreshold: answers.costThreshold
      },
      terraform: {
        stateBackend: {
          bucket: answers.terraformBucket,
          region: answers.awsRegion,
          dynamodbTable: answers.terraformTable
        }
      },
      ...(gitConfig && {
        git: {
          repositoryUrl: gitConfig.repositoryUrl,
          webhookSecret: gitConfig.webhookSecret,
          webhookPort: gitConfig.webhookPort
        }
      })
    };

    this.configManager.updateConfig(config);
    await this.configManager.saveConfig();

    console.log(chalk.green('✅ Configuration initialized successfully!'));
    console.log(chalk.cyan(`Configuration saved to: ${this.configManager['configPath']}`));
  }

  /**
   * Show current configuration
   */
  showConfiguration(): void {
    try {
      const config = this.configManager.getConfig();
      const currentProfile = this.configManager.getCurrentProfile();

      console.log(chalk.blue('📋 Current Configuration\n'));

      console.log(chalk.yellow('AWS Settings:'));
      console.log(`  Region: ${config.aws.region}`);
      if (config.aws.profile) {
        console.log(`  Profile: ${config.aws.profile}`);
      }

      console.log(chalk.yellow('\nDefault Settings:'));
      console.log(`  Instance Type: ${config.defaults.instanceType}`);
      console.log(`  Max Lifetime: ${config.defaults.maxLifetime} hours`);
      console.log(`  Cost Threshold: $${config.defaults.costThreshold}`);

      console.log(chalk.yellow('\nTerraform Backend:'));
      console.log(`  S3 Bucket: ${config.terraform.stateBackend.bucket}`);
      console.log(`  Region: ${config.terraform.stateBackend.region}`);
      console.log(`  DynamoDB Table: ${config.terraform.stateBackend.dynamodbTable}`);

      if (config.git) {
        console.log(chalk.yellow('\nGit Integration:'));
        console.log(`  Repository: ${config.git.repositoryUrl}`);
        console.log(`  Webhook Secret: ${'*'.repeat(config.git.webhookSecret.length)}`);
      }

      console.log(chalk.yellow('\nCurrent Profile:'));
      console.log(`  Name: ${currentProfile.name}`);
      console.log(`  Description: ${currentProfile.description}`);

    } catch (error) {
      console.log(chalk.red('❌ No configuration found. Run with --init to create one.'));
    }
  }

  /**
   * List available profiles
   */
  listProfiles(): void {
    const profiles = this.configManager.getAvailableProfiles();
    const currentProfile = this.configManager.getCurrentProfile();

    console.log(chalk.blue('📝 Available Configuration Profiles\n'));

    profiles.forEach(profile => {
      const isCurrent = profile.name === currentProfile.name;
      const marker = isCurrent ? chalk.green('→ ') : '  ';
      const nameColor = isCurrent ? chalk.green : chalk.white;

      console.log(`${marker}${nameColor(profile.name)}`);
      console.log(`    ${chalk.gray(profile.description)}`);
      console.log(`    Template: ${profile.defaults.template}, Instance: ${profile.defaults.instanceType}`);
      console.log(`    Lifetime: ${profile.defaults.maxLifetime}h, Cost: $${profile.defaults.costThreshold}`);
      console.log();
    });
  }

  /**
   * Switch to a different profile
   */
  async switchProfile(): Promise<void> {
    const profiles = this.configManager.getAvailableProfiles();
    const currentProfile = this.configManager.getCurrentProfile();

    if (profiles.length <= 1) {
      console.log(chalk.yellow('Only one profile available. No switching needed.'));
      return;
    }

    const choices = profiles
      .filter(p => p.name !== currentProfile.name)
      .map(p => ({
        name: `${p.name} - ${p.description}`,
        value: p.name
      }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select profile to switch to:',
        choices
      }
    ]);

    this.configManager.setCurrentProfile(answer.profile);
    console.log(chalk.green(`✅ Switched to profile: ${answer.profile}`));
  }

  /**
   * Validate current configuration
   */
  validateConfiguration(): void {
    try {
      const config = this.configManager.getConfig();
      const validation = this.configManager.validateConfig(config);

      if (validation.valid) {
        console.log(chalk.green('✅ Configuration is valid'));
      } else {
        console.log(chalk.red('❌ Configuration validation failed:'));
        validation.errors.forEach(error => {
          console.log(chalk.red(`  • ${error}`));
        });
      }
    } catch (error) {
      console.log(chalk.red('❌ Configuration validation error:'));
      console.log(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  /**
   * Create a new profile interactively
   */
  async createProfile(): Promise<void> {
    console.log(chalk.blue('🆕 Create New Configuration Profile\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Profile name:',
        validate: (input: string) => {
          if (input.trim().length === 0) return 'Profile name is required';
          if (this.configManager.getProfile(input)) return 'Profile already exists';
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Profile description:',
        validate: (input: string) => input.trim().length > 0 || 'Description is required'
      },
      {
        type: 'list',
        name: 'template',
        message: 'Default template:',
        choices: [
          { name: 'Web Application', value: 'webapp' },
          { name: 'API Service', value: 'api' },
          { name: 'Full Stack Application', value: 'fullstack' }
        ]
      },
      {
        type: 'input',
        name: 'region',
        message: 'AWS Region:',
        default: 'ap-southeast-2'
      },
      {
        type: 'list',
        name: 'instanceType',
        message: 'Instance type:',
        choices: [
          't3.micro', 't3.small', 't3.medium', 't3.large', 't3.xlarge'
        ]
      },
      {
        type: 'number',
        name: 'maxLifetime',
        message: 'Max lifetime (hours):',
        default: 24
      },
      {
        type: 'number',
        name: 'costThreshold',
        message: 'Cost threshold (USD):',
        default: 50
      }
    ]);

    const profile: ConfigProfile = {
      name: answers.name,
      description: answers.description,
      defaults: {
        template: answers.template,
        region: answers.region,
        instanceType: answers.instanceType,
        maxLifetime: answers.maxLifetime,
        costThreshold: answers.costThreshold,
        autoDestroy: true
      },
      aws: {
        region: answers.region
      },
      terraform: {
        stateBackend: {
          bucket: `ephemeral-demo-${answers.name}-terraform-state`,
          region: answers.region,
          dynamodbTable: `ephemeral-demo-${answers.name}-terraform-locks`
        }
      },
      tags: {
        Project: 'ephemeral-demo',
        Profile: answers.name,
        ManagedBy: 'ephemeral-demo-cli'
      }
    };

    this.configManager.addProfile(profile);
    await this.configManager.saveConfig();

    console.log(chalk.green(`✅ Profile '${answers.name}' created successfully!`));
  }

  /**
   * Copy example configuration to user directory
   */
  async copyExampleConfig(exampleName: string): Promise<void> {
    const examplePath = path.join(__dirname, '../../examples/configs', `${exampleName}.json`);
    
    if (!fs.existsSync(examplePath)) {
      throw new Error(`Example configuration not found: ${exampleName}`);
    }

    const userConfigPath = this.configManager['configPath'];
    const userConfigDir = path.dirname(userConfigPath);

    // Ensure directory exists
    if (!fs.existsSync(userConfigDir)) {
      fs.mkdirSync(userConfigDir, { recursive: true });
    }

    // Copy example config
    fs.copyFileSync(examplePath, userConfigPath);

    // Load the copied configuration
    await this.configManager.loadConfig();

    console.log(chalk.green(`✅ Example configuration '${exampleName}' copied successfully!`));
    console.log(chalk.cyan(`Configuration saved to: ${userConfigPath}`));
  }

  /**
   * List available example configurations
   */
  listExampleConfigs(): void {
    const examplesDir = path.join(__dirname, '../../examples/configs');
    
    if (!fs.existsSync(examplesDir)) {
      console.log(chalk.yellow('No example configurations found.'));
      return;
    }

    const examples = fs.readdirSync(examplesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));

    console.log(chalk.blue('📚 Available Example Configurations:\n'));

    examples.forEach(example => {
      try {
        const examplePath = path.join(examplesDir, `${example}.json`);
        const config = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
        
        console.log(chalk.white(`  ${example}`));
        console.log(chalk.gray(`    ${config.description || 'No description available'}`));
        console.log();
      } catch (error) {
        console.log(chalk.white(`  ${example}`));
        console.log(chalk.red(`    Error reading configuration`));
        console.log();
      }
    });

    console.log(chalk.cyan('Use --copy-example <name> to copy an example configuration.'));
  }
}