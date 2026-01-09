/**
 * Core TypeScript interfaces for the ephemeral deployment demo system
 */

/**
 * Environment configuration interface defining all settings for creating an ephemeral environment
 */
export interface EnvironmentConfig {
  /** Unique name for the environment */
  name: string;
  /** Git branch associated with this environment */
  branch: string;
  /** Template type for the environment */
  template: 'webapp' | 'api' | 'fullstack' | 'demo';
  /** AWS region for deployment */
  region: string;
  /** EC2 instance type to use */
  instanceType: string;
  /** Whether to automatically destroy the environment */
  autoDestroy: boolean;
  /** Maximum lifetime in hours before auto-destruction */
  maxLifetime: number;
  /** Cost threshold in USD that triggers alerts */
  costThreshold: number;
  /** Additional tags to apply to AWS resources */
  tags: Record<string, string>;
}

/**
 * Environment state interface tracking the current status and metadata of an environment
 */
export interface EnvironmentState {
  /** Unique identifier for the environment */
  id: string;
  /** Human-readable name */
  name: string;
  /** Current status of the environment */
  status: 'creating' | 'ready' | 'destroying' | 'destroyed' | 'failed';
  /** Associated Git branch */
  branch: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Scheduled destruction time (if applicable) */
  destroyAt?: Date;
  /** Access URLs for the environment */
  urls: {
    /** Main application URL */
    application?: string;
    /** Monitoring dashboard URL */
    monitoring?: string;
  };
  /** Cost tracking information */
  costs: {
    /** Current accumulated cost */
    current: number;
    /** Projected total cost */
    projected: number;
    /** Detailed cost breakdown by resource */
    breakdown: ResourceCost[];
  };
  /** List of AWS resources created for this environment */
  resources: TerraformResource[];
}

/**
 * Cost tracking interface for individual AWS resources
 */
export interface ResourceCost {
  /** AWS resource identifier */
  resourceId: string;
  /** Type of AWS resource (e.g., 'EC2', 'S3', 'RDS') */
  resourceType: string;
  /** AWS service name */
  service: string;
  /** Cost amount */
  cost: number;
  /** Cost unit (e.g., 'USD') */
  unit: string;
  /** Time period for this cost calculation */
  timeframe: string;
}

/**
 * Terraform resource tracking interface
 */
export interface TerraformResource {
  /** Terraform resource address */
  address: string;
  /** AWS resource type */
  type: string;
  /** AWS resource name */
  name: string;
  /** AWS resource ARN (if applicable) */
  arn?: string;
  /** Resource attributes from Terraform state */
  attributes: Record<string, unknown>;
}

/**
 * Cost report interface for comprehensive cost analysis
 */
export interface CostReport {
  /** Environment identifier */
  environmentId: string;
  /** Total cost accumulated */
  totalCost: number;
  /** Daily cost rate */
  dailyCost: number;
  /** Projected monthly cost if environment persists */
  projectedMonthlyCost: number;
  /** Detailed resource cost breakdown */
  resources: ResourceCost[];
  /** Comparison data for demonstrating savings */
  comparisonData: {
    /** Estimated cost of equivalent persistent environment */
    persistentEnvironmentCost: number;
    /** Percentage savings from using ephemeral environments */
    savingsPercentage: number;
  };
}

/**
 * Git integration interfaces for webhook handling and branch mapping
 */
export interface GitWebhookEvent {
  /** Type of Git event */
  eventType: 'pull_request' | 'push' | 'branch_delete';
  /** Git branch name */
  branch: string;
  /** Pull request action (if applicable) */
  action?: 'opened' | 'closed' | 'merged';
  /** Repository information */
  repository: {
    name: string;
    owner: string;
    url: string;
  };
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Branch mapping interface for tracking Git branch to environment relationships
 */
export interface BranchMapping {
  /** Git branch name */
  branch: string;
  /** Associated environment ID */
  environmentId: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Current status */
  status: 'active' | 'cleanup_scheduled' | 'destroyed';
}

/**
 * Demo configuration interface for customizing demonstration scenarios
 */
export interface DemoConfig {
  /** AWS configuration */
  aws: {
    region: string;
    profile?: string;
  };
  /** Default environment settings */
  defaults: {
    instanceType: string;
    maxLifetime: number;
    costThreshold: number;
  };
  /** Git integration settings */
  git?: {
    webhookSecret: string;
    repositoryUrl: string;
  };
  /** Terraform configuration */
  terraform: {
    stateBackend: {
      bucket: string;
      region: string;
      dynamodbTable: string;
    };
  };
}

/**
 * CLI command result interface for consistent command responses
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Human-readable message */
  message: string;
  /** Additional data returned by the command */
  data?: unknown;
  /** Error details (if applicable) */
  error?: {
    code: string;
    details: string;
  };
}
