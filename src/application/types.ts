/**
 * Application deployment types and interfaces
 */

/**
 * Application configuration for deployment
 */
export interface ApplicationConfig {
  /** Application name */
  name: string;
  /** Application type */
  type: 'webapp' | 'api' | 'fullstack';
  /** Application version/tag */
  version: string;
  /** Docker image configuration */
  docker: {
    /** Base image to use */
    baseImage: string;
    /** Port the application listens on */
    port: number;
    /** Environment variables */
    env: Record<string, string>;
    /** Build context path */
    buildContext: string;
    /** Dockerfile path relative to build context */
    dockerfile: string;
  };
  /** Health check configuration */
  healthCheck: {
    /** Health check endpoint path */
    path: string;
    /** Expected HTTP status code */
    expectedStatus: number;
    /** Timeout in seconds */
    timeout: number;
    /** Number of retries */
    retries: number;
    /** Interval between retries in seconds */
    interval: number;
  };
}

/**
 * Partial application configuration for overrides
 */
export interface PartialApplicationConfig {
  /** Application name */
  name?: string;
  /** Application type */
  type?: 'webapp' | 'api' | 'fullstack';
  /** Application version/tag */
  version?: string;
  /** Docker image configuration */
  docker?: {
    /** Base image to use */
    baseImage?: string;
    /** Port the application listens on */
    port?: number;
    /** Environment variables */
    env?: Record<string, string>;
    /** Build context path */
    buildContext?: string;
    /** Dockerfile path relative to build context */
    dockerfile?: string;
  };
  /** Health check configuration */
  healthCheck?: {
    /** Health check endpoint path */
    path?: string;
    /** Expected HTTP status code */
    expectedStatus?: number;
    /** Timeout in seconds */
    timeout?: number;
    /** Number of retries */
    retries?: number;
    /** Interval between retries in seconds */
    interval?: number;
  };
}

/**
 * Deployment target configuration
 */
export interface DeploymentTarget {
  /** Target type */
  type: 'ec2' | 'ecs';
  /** AWS region */
  region: string;
  /** Instance/service configuration */
  config: EC2Config | ECSConfig;
}

/**
 * EC2 deployment configuration
 */
export interface EC2Config {
  /** Instance ID to deploy to */
  instanceId: string;
  /** SSH key for access */
  keyName: string;
  /** Security group IDs */
  securityGroups: string[];
}

/**
 * ECS deployment configuration
 */
export interface ECSConfig {
  /** ECS cluster name */
  clusterName: string;
  /** ECS service name */
  serviceName: string;
  /** Task definition family */
  taskDefinitionFamily: string;
  /** Desired task count */
  desiredCount: number;
  /** Subnets for deployment */
  subnets: string[];
  /** Security group IDs */
  securityGroups: string[];
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Deployment message */
  message: string;
  /** Application URLs */
  urls: {
    /** Primary application URL */
    application: string;
    /** Health check URL */
    healthCheck: string;
  };
  /** Deployment metadata */
  metadata: {
    /** Docker image URI */
    imageUri: string;
    /** Deployment timestamp */
    deployedAt: Date;
    /** Resource identifiers */
    resources: Record<string, string>;
  };
  /** Error details if deployment failed */
  error?: {
    code: string;
    details: string;
    logs?: string[];
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether health check passed */
  healthy: boolean;
  /** Response status code */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
  /** Response body (truncated) */
  responseBody?: string;
  /** Error message if unhealthy */
  error?: string;
}

/**
 * Docker build result
 */
export interface DockerBuildResult {
  /** Whether build succeeded */
  success: boolean;
  /** Docker image URI */
  imageUri: string;
  /** Build logs */
  logs: string[];
  /** Build metadata */
  metadata: {
    /** Image size in bytes */
    imageSize: number;
    /** Build duration in seconds */
    buildDuration: number;
    /** Image digest */
    digest: string;
  };
  /** Error details if build failed */
  error?: {
    code: string;
    details: string;
  };
}