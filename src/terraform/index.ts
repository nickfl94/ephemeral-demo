/**
 * Terraform orchestration module for managing infrastructure lifecycle
 */

import { spawn, SpawnOptions } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { EnvironmentConfig, TerraformResource, CommandResult } from '../types';

/**
 * Terraform backend configuration for remote state management
 */
export interface TerraformBackendConfig {
  /** S3 bucket for state storage */
  bucket: string;
  /** S3 key prefix for state files */
  key: string;
  /** AWS region for S3 bucket */
  region: string;
  /** DynamoDB table for state locking */
  dynamodbTable: string;
  /** Whether to encrypt state files */
  encrypt: boolean;
}

/**
 * Terraform operation options
 */
export interface TerraformOptions {
  /** Working directory for Terraform operations */
  workingDir: string;
  /** Environment variables to pass to Terraform */
  env?: Record<string, string>;
  /** Whether to auto-approve operations */
  autoApprove?: boolean;
  /** Additional Terraform variables */
  variables?: Record<string, string>;
}

/**
 * Terraform plan output interface
 */
export interface TerraformPlan {
  /** Whether the plan has changes */
  hasChanges: boolean;
  /** Number of resources to add */
  toAdd: number;
  /** Number of resources to change */
  toChange: number;
  /** Number of resources to destroy */
  toDestroy: number;
  /** Raw plan output */
  planOutput: string;
}

/**
 * Terraform state output interface
 */
export interface TerraformState {
  /** Terraform state format version */
  formatVersion: string;
  /** Terraform version used */
  terraformVersion: string;
  /** List of resources in state */
  resources: TerraformResource[];
  /** State outputs */
  outputs: Record<string, unknown>;
}

/**
 * Terraform wrapper class for infrastructure management
 * Provides high-level methods for Terraform operations with proper error handling
 */
export class TerraformOrchestrator {
  private backendConfig: TerraformBackendConfig;
  private defaultOptions: TerraformOptions;

  constructor(
    backendConfig: TerraformBackendConfig,
    defaultOptions: TerraformOptions
  ) {
    this.backendConfig = backendConfig;
    this.defaultOptions = defaultOptions;
  }

  /**
   * Initialize Terraform in the specified directory
   * Sets up backend configuration and downloads providers
   */
  async init(options?: Partial<TerraformOptions>): Promise<CommandResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Create backend configuration file
      await this.createBackendConfig(opts.workingDir);

      // Run terraform init
      const result = await this.runTerraformCommand(['init'], opts);

      if (result.success) {
        return {
          success: true,
          message: 'Terraform initialized successfully',
          data: { workingDir: opts.workingDir },
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to initialize Terraform',
        error: {
          code: 'TERRAFORM_INIT_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Create a Terraform plan
   * Generates execution plan showing what actions Terraform will take
   */
  async plan(
    options?: Partial<TerraformOptions>
  ): Promise<CommandResult & { data?: TerraformPlan }> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const args = ['plan', '-detailed-exitcode', '-no-color'];

      // Add variables
      if (opts.variables) {
        for (const [key, value] of Object.entries(opts.variables)) {
          args.push('-var', `${key}=${value}`);
        }
      }

      const result = await this.runTerraformCommand(args, opts);

      // Parse plan output
      const planData = this.parsePlanOutput(result.data as string);

      return {
        success: true,
        message: planData.hasChanges
          ? 'Plan created with changes'
          : 'No changes required',
        data: planData,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create Terraform plan',
        error: {
          code: 'TERRAFORM_PLAN_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Apply Terraform configuration
   * Creates or updates infrastructure according to configuration
   */
  async apply(options?: Partial<TerraformOptions>): Promise<CommandResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const args = ['apply', '-no-color'];

      // Add auto-approve if specified
      if (opts.autoApprove) {
        args.push('-auto-approve');
      }

      // Add variables
      if (opts.variables) {
        for (const [key, value] of Object.entries(opts.variables)) {
          args.push('-var', `${key}=${value}`);
        }
      }

      const result = await this.runTerraformCommand(args, opts);

      if (result.success) {
        // Get outputs after successful apply
        const outputs = await this.getOutputs(opts);

        return {
          success: true,
          message: 'Infrastructure applied successfully',
          data: { outputs: outputs.data },
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to apply Terraform configuration',
        error: {
          code: 'TERRAFORM_APPLY_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Destroy Terraform-managed infrastructure
   * Removes all resources defined in the configuration
   */
  async destroy(options?: Partial<TerraformOptions>): Promise<CommandResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const args = ['destroy', '-no-color'];

      // Add auto-approve if specified
      if (opts.autoApprove) {
        args.push('-auto-approve');
      }

      // Add variables
      if (opts.variables) {
        for (const [key, value] of Object.entries(opts.variables)) {
          args.push('-var', `${key}=${value}`);
        }
      }

      const result = await this.runTerraformCommand(args, opts);

      if (result.success) {
        return {
          success: true,
          message: 'Infrastructure destroyed successfully',
          data: { workingDir: opts.workingDir },
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to destroy Terraform infrastructure',
        error: {
          code: 'TERRAFORM_DESTROY_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get Terraform state information
   * Returns current state including all managed resources
   */
  async getState(
    options?: Partial<TerraformOptions>
  ): Promise<CommandResult & { data?: TerraformState }> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const result = await this.runTerraformCommand(['show', '-json'], opts);

      if (result.success) {
        const stateData = JSON.parse(result.data as string) as TerraformState;

        return {
          success: true,
          message: 'State retrieved successfully',
          data: stateData,
        };
      } else {
        return {
          success: false,
          message: result.message,
          ...(result.error && { error: result.error }),
        };
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve Terraform state',
        error: {
          code: 'TERRAFORM_STATE_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Get Terraform outputs
   * Returns all output values from the current state
   */
  async getOutputs(
    options?: Partial<TerraformOptions>
  ): Promise<CommandResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      const result = await this.runTerraformCommand(['output', '-json'], opts);

      if (result.success) {
        const outputs = JSON.parse(result.data as string);

        return {
          success: true,
          message: 'Outputs retrieved successfully',
          data: outputs,
        };
      } else {
        return result;
      }
    } catch (error) {
      return {
        success: false,
        message: 'Failed to retrieve Terraform outputs',
        error: {
          code: 'TERRAFORM_OUTPUT_FAILED',
          details: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Generate resource tags based on environment configuration
   * Creates standardized tags for AWS resources
   */
  generateResourceTags(config: EnvironmentConfig): Record<string, string> {
    const baseTags = {
      Environment: config.name,
      Project: 'ephemeral-demo',
      Branch: config.branch,
      Template: config.template,
      Purpose: 'demo',
      AutoDestroy: config.autoDestroy.toString(),
      MaxLifetime: config.maxLifetime.toString(),
      CreatedBy: 'ephemeral-deployment-demo',
      CreatedAt: new Date().toISOString(),
    };

    // Merge with custom tags from configuration
    return { ...baseTags, ...config.tags };
  }

  /**
   * Generate unique environment name
   * Creates AWS-compatible resource names with uniqueness guarantees
   */
  generateEnvironmentName(config: EnvironmentConfig): string {
    // Sanitize branch name for AWS resource naming
    const sanitizedBranch = config.branch
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20);

    // Add timestamp for uniqueness
    const timestamp = Date.now().toString(36);

    return `ephemeral-${sanitizedBranch}-${timestamp}`;
  }

  /**
   * Create backend configuration file
   * Generates backend.tf file with S3 remote state configuration
   */
  private async createBackendConfig(workingDir: string): Promise<void> {
    const backendContent = `
terraform {
  backend "s3" {
    bucket         = "${this.backendConfig.bucket}"
    key            = "${this.backendConfig.key}"
    region         = "${this.backendConfig.region}"
    dynamodb_table = "${this.backendConfig.dynamodbTable}"
    encrypt        = ${this.backendConfig.encrypt}
  }
}
`;

    const backendPath = path.join(workingDir, 'backend.tf');
    await fs.writeFile(backendPath, backendContent.trim());
  }

  /**
   * Run Terraform command with proper error handling
   * Executes Terraform CLI commands and captures output
   */
  private async runTerraformCommand(
    args: string[],
    options: TerraformOptions
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.workingDir,
        env: { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      };

      const child = spawn('terraform', args, spawnOptions);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            message: 'Terraform command completed successfully',
            data: stdout,
          });
        } else {
          resolve({
            success: false,
            message: `Terraform command failed with exit code ${code}`,
            data: stderr,
            error: {
              code: 'TERRAFORM_COMMAND_FAILED',
              details: stderr || stdout,
            },
          });
        }
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          message: 'Failed to execute Terraform command',
          error: {
            code: 'TERRAFORM_EXECUTION_ERROR',
            details: error.message,
          },
        });
      });
    });
  }

  /**
   * Parse Terraform plan output
   * Extracts plan statistics from Terraform plan command output
   */
  private parsePlanOutput(output: string): TerraformPlan {
    const lines = output.split('\n');
    let toAdd = 0;
    let toChange = 0;
    let toDestroy = 0;

    // Look for plan summary line
    for (const line of lines) {
      const planMatch = line.match(
        /Plan: (\d+) to add, (\d+) to change, (\d+) to destroy/
      );
      if (planMatch && planMatch[1] && planMatch[2] && planMatch[3]) {
        toAdd = parseInt(planMatch[1], 10);
        toChange = parseInt(planMatch[2], 10);
        toDestroy = parseInt(planMatch[3], 10);
        break;
      }
    }

    const hasChanges = toAdd > 0 || toChange > 0 || toDestroy > 0;

    return {
      hasChanges,
      toAdd,
      toChange,
      toDestroy,
      planOutput: output,
    };
  }
}

// Export Terraform modules path for external use
export const TERRAFORM_MODULES_PATH = path.join(
  __dirname,
  '../../terraform/modules'
);

/**
 * Environment template configurations for different application types
 */
export interface EnvironmentTemplate {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Terraform modules to include */
  modules: string[];
  /** Default variable values */
  defaultVariables: Record<string, unknown>;
}

/**
 * Predefined environment templates
 */
export const ENVIRONMENT_TEMPLATES: Record<string, EnvironmentTemplate> = {
  webapp: {
    name: 'Web Application',
    description:
      'Full-stack web application with load balancer, auto-scaling, and monitoring',
    modules: ['networking', 'compute', 'storage', 'monitoring'],
    defaultVariables: {
      enable_load_balancer: true,
      enable_cloudfront: true,
      enable_ecs: false,
      min_instances: 1,
      max_instances: 3,
      desired_instances: 1,
      application_port: 3000,
      instance_type: 't3.micro',
    },
  },
  api: {
    name: 'API Service',
    description: 'RESTful API service with auto-scaling and monitoring',
    modules: ['networking', 'compute', 'monitoring'],
    defaultVariables: {
      enable_load_balancer: true,
      enable_cloudfront: false,
      enable_ecs: true,
      min_instances: 1,
      max_instances: 5,
      desired_instances: 2,
      application_port: 8080,
      instance_type: 't3.small',
    },
  },
  fullstack: {
    name: 'Full-Stack Application',
    description:
      'Complete application stack with frontend, backend, database, and CDN',
    modules: ['networking', 'compute', 'storage', 'monitoring'],
    defaultVariables: {
      enable_load_balancer: true,
      enable_cloudfront: true,
      enable_ecs: true,
      min_instances: 2,
      max_instances: 6,
      desired_instances: 2,
      application_port: 3000,
      instance_type: 't3.medium',
      enable_nat_gateway: true,
      private_subnet_count: 2,
    },
  },
};

/**
 * Generate Terraform configuration for an environment
 * Creates the main.tf file content based on template and configuration
 */
export function generateTerraformConfig(
  template: EnvironmentTemplate,
  config: EnvironmentConfig,
  backendConfig: TerraformBackendConfig
): string {
  const tags = {
    Environment: config.name,
    Project: 'ephemeral-demo',
    Branch: config.branch,
    Template: config.template,
    Purpose: 'demo',
    AutoDestroy: config.autoDestroy.toString(),
    CreatedBy: 'ephemeral-deployment-demo',
    CreatedAt: new Date().toISOString(),
    ...config.tags,
  };

  const terraformConfig = `
# Generated Terraform configuration for ${config.name}
# Template: ${template.name}
# Generated at: ${new Date().toISOString()}

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }

  backend "s3" {
    bucket         = "${backendConfig.bucket}"
    key            = "${backendConfig.key}"
    region         = "${backendConfig.region}"
    dynamodb_table = "${backendConfig.dynamodbTable}"
    encrypt        = ${backendConfig.encrypt}
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
${Object.entries(tags)
  .map(([key, value]) => `      ${key} = "${value}"`)
  .join('\n')}
    }
  }
}

# Local values
locals {
  environment_name = "${config.name}"
  common_tags = {
${Object.entries(tags)
  .map(([key, value]) => `    ${key} = "${value}"`)
  .join('\n')}
  }
}

${
  template.modules.includes('networking')
    ? `
# Networking Module
module "networking" {
  source = "./modules/networking"

  environment_name      = local.environment_name
  vpc_cidr             = var.vpc_cidr
  public_subnet_count  = var.public_subnet_count
  private_subnet_count = var.private_subnet_count
  enable_nat_gateway   = var.enable_nat_gateway
  application_port     = var.application_port
  tags                 = local.common_tags
}
`
    : ''
}

${
  template.modules.includes('storage')
    ? `
# Storage Module
module "storage" {
  source = "./modules/storage"

  environment_name         = local.environment_name
  enable_versioning       = var.enable_versioning
  enable_public_read      = var.enable_public_read
  enable_lifecycle_rules  = var.enable_lifecycle_rules
  object_expiration_days  = var.object_expiration_days
  enable_cloudfront       = var.enable_cloudfront
  tags                    = local.common_tags
}
`
    : ''
}

${
  template.modules.includes('compute')
    ? `
# Compute Module
module "compute" {
  source = "./modules/compute"

  environment_name        = local.environment_name
  vpc_id                 = module.networking.vpc_id
  public_subnet_ids      = module.networking.public_subnet_ids
  private_subnet_ids     = module.networking.private_subnet_ids
  web_security_group_id  = module.networking.web_security_group_id
  instance_type          = var.instance_type
  key_pair_name          = var.key_pair_name
  min_instances          = var.min_instances
  max_instances          = var.max_instances
  desired_instances      = var.desired_instances
  application_port       = var.application_port
  health_check_path      = var.health_check_path
  enable_load_balancer   = var.enable_load_balancer
  enable_ecs             = var.enable_ecs
  s3_bucket_name         = ${template.modules.includes('storage') ? 'module.storage.assets_bucket_name' : '""'}
  s3_bucket_arn          = ${template.modules.includes('storage') ? 'module.storage.assets_bucket_arn' : '""'}
  tags                   = local.common_tags

  depends_on = [${template.modules.includes('networking') ? 'module.networking' : ''}${template.modules.includes('storage') ? ', module.storage' : ''}]
}
`
    : ''
}

${
  template.modules.includes('monitoring')
    ? `
# Monitoring Module
module "monitoring" {
  source = "./modules/monitoring"

  environment_name           = local.environment_name
  aws_region                = var.aws_region
  log_group_name            = module.compute.cloudwatch_log_group_name
  autoscaling_group_name    = module.compute.autoscaling_group_name
  load_balancer_arn_suffix  = var.enable_load_balancer ? split("/", module.compute.load_balancer_arn)[1] : null
  target_group_arn_suffix   = var.enable_load_balancer ? split("/", module.compute.target_group_arn)[1] : null
  cpu_threshold             = var.cpu_threshold
  memory_threshold          = var.memory_threshold
  response_time_threshold   = var.response_time_threshold
  error_rate_threshold      = var.error_rate_threshold
  min_healthy_targets       = var.min_healthy_targets
  enable_custom_metrics     = var.enable_custom_metrics
  create_sns_topic          = var.create_sns_topic
  notification_email        = var.notification_email
  alarm_actions             = var.create_sns_topic ? [aws_sns_topic.alerts[0].arn] : []
  tags                      = local.common_tags

  depends_on = [module.compute]
}
`
    : ''
}
`;

  return terraformConfig.trim();
}

/**
 * Generate Terraform variables file content
 */
export function generateTerraformVariables(
  template: EnvironmentTemplate
): string {
  return `
# Variables for ${template.name} environment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_count" {
  description = "Number of public subnets"
  type        = number
  default     = 2
}

variable "private_subnet_count" {
  description = "Number of private subnets"
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = "Enable NAT gateway for private subnets"
  type        = bool
  default     = true
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "${template.defaultVariables.instance_type || 't3.micro'}"
}

variable "key_pair_name" {
  description = "EC2 key pair name"
  type        = string
  default     = null
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = ${template.defaultVariables.min_instances || 1}
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = ${template.defaultVariables.max_instances || 3}
}

variable "desired_instances" {
  description = "Desired number of instances"
  type        = number
  default     = ${template.defaultVariables.desired_instances || 1}
}

variable "application_port" {
  description = "Application port number"
  type        = number
  default     = ${template.defaultVariables.application_port || 3000}
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

variable "enable_load_balancer" {
  description = "Enable Application Load Balancer"
  type        = bool
  default     = ${template.defaultVariables.enable_load_balancer || true}
}

variable "enable_ecs" {
  description = "Enable ECS for containerized applications"
  type        = bool
  default     = ${template.defaultVariables.enable_ecs || false}
}

variable "enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = false
}

variable "enable_public_read" {
  description = "Enable public read access to assets bucket"
  type        = bool
  default     = false
}

variable "enable_lifecycle_rules" {
  description = "Enable S3 lifecycle rules"
  type        = bool
  default     = true
}

variable "object_expiration_days" {
  description = "Days after which objects expire"
  type        = number
  default     = 30
}

variable "enable_cloudfront" {
  description = "Enable CloudFront distribution"
  type        = bool
  default     = ${template.defaultVariables.enable_cloudfront || false}
}

variable "cpu_threshold" {
  description = "CPU utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "memory_threshold" {
  description = "Memory utilization threshold for alarms"
  type        = number
  default     = 80
}

variable "response_time_threshold" {
  description = "Response time threshold for alarms (seconds)"
  type        = number
  default     = 2
}

variable "error_rate_threshold" {
  description = "Error rate threshold for alarms"
  type        = number
  default     = 10
}

variable "min_healthy_targets" {
  description = "Minimum healthy targets for alarms"
  type        = number
  default     = 1
}

variable "enable_custom_metrics" {
  description = "Enable custom CloudWatch metrics"
  type        = bool
  default     = true
}

variable "create_sns_topic" {
  description = "Create SNS topic for notifications"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email for alarm notifications"
  type        = string
  default     = null
}
`.trim();
}

/**
 * Generate Terraform outputs file content
 */
export function generateTerraformOutputs(
  template: EnvironmentTemplate
): string {
  return `
# Outputs for ${template.name} environment

${
  template.modules.includes('networking')
    ? `
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}
`
    : ''
}

${
  template.modules.includes('compute')
    ? `
output "application_url" {
  description = "URL to access the application"
  value       = module.compute.application_url
}

output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.compute.load_balancer_dns_name
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = module.compute.autoscaling_group_name
}
`
    : ''
}

${
  template.modules.includes('storage')
    ? `
output "assets_bucket_name" {
  description = "Name of the assets S3 bucket"
  value       = module.storage.assets_bucket_name
}

output "data_bucket_name" {
  description = "Name of the data S3 bucket"
  value       = module.storage.data_bucket_name
}

output "assets_url" {
  description = "URL for static assets"
  value       = module.storage.assets_url
}
`
    : ''
}

${
  template.modules.includes('monitoring')
    ? `
output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = module.monitoring.dashboard_url
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = module.monitoring.dashboard_name
}
`
    : ''
}

output "environment_name" {
  description = "Name of the environment"
  value       = local.environment_name
}

output "environment_tags" {
  description = "Tags applied to the environment"
  value       = local.common_tags
}
`.trim();
}
