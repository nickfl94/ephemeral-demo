#!/usr/bin/env node

/**
 * Main CLI entry point for the ephemeral deployment demo
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { DemoCommands } from './commands';

const program = new Command();

// Configure the main program
program
  .name('ephemeral-demo')
  .description('Ephemeral Deployment Demo - Showcase Terraform and AWS for temporary environments')
  .version('1.0.0');

// Initialize demo commands
const demoCommands = new DemoCommands();

// Provision command
program
  .command('provision')
  .description('Create a new ephemeral environment')
  .option('-b, --branch <branch>', 'Git branch name for the environment')
  .option('-t, --template <template>', 'Environment template (webapp|api|fullstack|demo)', 'demo')
  .option('-r, --region <region>', 'AWS region', 'ap-southeast-2')
  .option('-i, --instance-type <type>', 'EC2 instance type', 't3.micro')
  .option('--auto-destroy', 'Enable automatic destruction after timeout', true)
  .option('--max-lifetime <hours>', 'Maximum lifetime in hours', '24')
  .option('--cost-threshold <amount>', 'Cost threshold in USD', '50')
  .option('--output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    try {
      if (options.output !== 'json') {
        console.log(chalk.blue('🚀 Starting environment provisioning...'));
      }
      
      const result = await demoCommands.provision(options);
      
      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(chalk.green('✅ Environment provisioned successfully!'));
          console.log(chalk.cyan(`Environment ID: ${result.data}`));
        } else {
          console.log(chalk.red('❌ Provisioning failed:'), result.message);
        }
      }
      
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      if (options.output === 'json') {
        console.log(JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          error: { code: 'UNEXPECTED_ERROR', details: String(error) }
        }, null, 2));
      } else {
        console.error(chalk.red('❌ Unexpected error:'), error);
      }
      process.exit(1);
    }
  });

// Destroy command
program
  .command('destroy')
  .description('Destroy an ephemeral environment')
  .argument('<environment-id>', 'Environment ID to destroy')
  .option('--force', 'Force destruction without confirmation', false)
  .action(async (environmentId, options) => {
    try {
      console.log(chalk.yellow('🗑️  Starting environment destruction...'));
      const result = await demoCommands.destroy(environmentId, options);
      
      if (result.success) {
        console.log(chalk.green('✅ Environment destroyed successfully!'));
      } else {
        console.log(chalk.red('❌ Destruction failed:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show status of environments')
  .option('-e, --environment <id>', 'Show status for specific environment')
  .option('--all', 'Show all environments including destroyed ones', false)
  .option('--output <format>', 'Output format (text|json)', 'text')
  .action(async (options) => {
    try {
      const result = await demoCommands.status(options);
      
      if (options.output === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success) {
          console.log(result.message);
        } else {
          console.log(chalk.red('❌ Failed to get status:'), result.message);
        }
      }
      
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      if (options.output === 'json') {
        console.log(JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          error: { code: 'UNEXPECTED_ERROR', details: String(error) }
        }, null, 2));
      } else {
        console.error(chalk.red('❌ Unexpected error:'), error);
      }
      process.exit(1);
    }
  });

// Demo command
program
  .command('demo')
  .description('Run a complete demonstration workflow')
  .option('-s, --scenario <scenario>', 'Demo scenario to run', 'basic')
  .option('--interactive', 'Run in interactive mode with prompts', false)
  .action(async (options) => {
    try {
      console.log(chalk.magenta('🎭 Starting demonstration workflow...'));
      const result = await demoCommands.runDemo(options);
      
      if (result.success) {
        console.log(chalk.green('✅ Demo completed successfully!'));
      } else {
        console.log(chalk.red('❌ Demo failed:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error);
      process.exit(1);
    }
  });

// Costs command
program
  .command('costs')
  .description('Show cost analysis and reports')
  .option('-e, --environment <id>', 'Show costs for specific environment')
  .option('--report', 'Generate detailed cost report', false)
  .action(async (options) => {
    try {
      const result = await demoCommands.showCosts(options);
      
      if (result.success) {
        console.log(result.message);
      } else {
        console.log(chalk.red('❌ Failed to get costs:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage configuration settings')
  .option('--init', 'Initialize configuration file interactively', false)
  .option('--validate', 'Validate current configuration', false)
  .option('--show', 'Show current configuration', false)
  .option('--profile <name>', 'Switch to specified profile')
  .option('--list-profiles', 'List available profiles', false)
  .option('--create-profile', 'Create a new profile interactively', false)
  .option('--copy-example <name>', 'Copy example configuration')
  .option('--list-examples', 'List available example configurations', false)
  .action(async (options) => {
    try {
      const result = await demoCommands.manageConfig(options);
      
      if (result.success) {
        if (result.message !== 'Configuration displayed' && 
            result.message !== 'Profiles listed' && 
            result.message !== 'Example configurations listed') {
          console.log(result.message);
        }
      } else {
        console.log(chalk.red('❌ Configuration error:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error);
      process.exit(1);
    }
  });

// Cleanup command for CI/CD
program
  .command('cleanup')
  .description('Cleanup environments based on criteria')
  .option('--expired', 'Cleanup expired environments', false)
  .option('--branch <branch>', 'Cleanup environments for specific branch')
  .option('--older-than <hours>', 'Cleanup environments older than specified hours')
  .option('--force', 'Force cleanup without confirmation', false)
  .option('--dry-run', 'Show what would be cleaned up without actually doing it', false)
  .action(async (options) => {
    try {
      const result = await demoCommands.cleanup(options);
      
      if (result.success) {
        console.log(result.message);
      } else {
        console.log(chalk.red('❌ Cleanup failed:'), result.message);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Unexpected error:'), error);
      process.exit(1);
    }
  });

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught Exception:'), error);
  process.exit(1);
});

// Parse command line arguments
program.parse();