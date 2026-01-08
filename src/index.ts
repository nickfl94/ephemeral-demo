/**
 * Main entry point for the ephemeral deployment demo library
 * Exports all public interfaces and classes
 */

// Export all types
export * from './types';

// Export command implementations
export * from './commands';

// Export environment management
export * from './environment';

// Export application deployment
export * from './application';

// Export git integration
export * from './git';

// Export configuration management
export { ConfigurationManager, configManager } from './config';
export { ConfigCLIUtils } from './config/cli-utils';
export type { ConfigProfile as DemoConfigProfile } from './config';

// Export orchestrator
export * from './orchestrator';

// Re-export commonly used types for convenience
export type {
  EnvironmentConfig,
  EnvironmentState,
  ResourceCost,
  CostReport,
  CommandResult,
  DemoConfig,
} from './types';