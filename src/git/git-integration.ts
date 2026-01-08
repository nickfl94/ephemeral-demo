/**
 * Main Git integration class that coordinates webhook handling and event processing
 * Provides a unified interface for Git integration functionality
 */

import { GitWebhookHandler, WebhookConfig } from './webhook-handler';
import { GitEventProcessor, EventProcessorConfig, EnvironmentActions } from './event-processor';
import { BranchMapper, BranchMapperConfig } from './branch-mapper';
import { GitWebhookEvent } from '../types';

export interface GitIntegrationConfig {
  /** Webhook server configuration */
  webhook: WebhookConfig;
  /** Event processor configuration */
  eventProcessor: EventProcessorConfig;
  /** Branch mapper configuration */
  branchMapper: BranchMapperConfig;
}

/**
 * Main Git integration class that orchestrates all Git-related functionality
 */
export class GitIntegration {
  private webhookHandler: GitWebhookHandler;
  private eventProcessor: GitEventProcessor;
  private branchMapper: BranchMapper;
  private config: GitIntegrationConfig;
  private isInitialized: boolean = false;

  constructor(config: GitIntegrationConfig, environmentActions: EnvironmentActions) {
    this.config = config;
    
    // Initialize components
    this.branchMapper = new BranchMapper(config.branchMapper);
    this.eventProcessor = new GitEventProcessor(
      config.eventProcessor,
      this.branchMapper,
      environmentActions
    );
    this.webhookHandler = new GitWebhookHandler(config.webhook);

    // Set up event handling
    this.setupEventHandlers();
  }

  /**
   * Initialize the Git integration system
   */
  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Git integration...');
      
      // Initialize branch mapper
      await this.branchMapper.initialize();
      
      // Start webhook handler
      await this.webhookHandler.start();
      
      this.isInitialized = true;
      console.log('Git integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Git integration:', error);
      throw error;
    }
  }

  /**
   * Shutdown the Git integration system
   */
  public async shutdown(): Promise<void> {
    try {
      console.log('Shutting down Git integration...');
      
      // Stop webhook handler
      await this.webhookHandler.stop();
      
      this.isInitialized = false;
      console.log('Git integration shut down successfully');
    } catch (error) {
      console.error('Error during Git integration shutdown:', error);
      throw error;
    }
  }

  /**
   * Set up event handlers to connect webhook handler with event processor
   */
  private setupEventHandlers(): void {
    // Handle pull request events
    this.webhookHandler.onEvent('pull_request', async (event: GitWebhookEvent) => {
      await this.eventProcessor.processEvent(event);
    });

    // Handle push events
    this.webhookHandler.onEvent('push', async (event: GitWebhookEvent) => {
      await this.eventProcessor.processEvent(event);
    });

    // Handle branch delete events
    this.webhookHandler.onEvent('branch_delete', async (event: GitWebhookEvent) => {
      await this.eventProcessor.processEvent(event);
    });
  }

  /**
   * Get branch mapper instance for direct access
   */
  public getBranchMapper(): BranchMapper {
    return this.branchMapper;
  }

  /**
   * Get event processor instance for direct access
   */
  public getEventProcessor(): GitEventProcessor {
    return this.eventProcessor;
  }

  /**
   * Get webhook handler instance for direct access
   */
  public getWebhookHandler(): GitWebhookHandler {
    return this.webhookHandler;
  }

  /**
   * Manually process a Git event (useful for testing or manual triggers)
   */
  public async processEvent(event: GitWebhookEvent): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Git integration not initialized');
    }
    
    await this.eventProcessor.processEvent(event);
  }

  /**
   * Get integration status
   */
  public getStatus(): {
    initialized: boolean;
    webhookConfig: WebhookConfig;
    activeMappings: number;
    processingQueue: number;
  } {
    return {
      initialized: this.isInitialized,
      webhookConfig: this.webhookHandler.getConfig(),
      activeMappings: this.branchMapper.getActiveMappings().length,
      processingQueue: this.eventProcessor.getProcessingStatus().length,
    };
  }

  /**
   * Update configuration (requires restart to take effect for webhook settings)
   */
  public updateConfig(newConfig: Partial<GitIntegrationConfig>): void {
    if (newConfig.eventProcessor) {
      this.eventProcessor.updateConfig(newConfig.eventProcessor);
    }
    
    // Note: Webhook and branch mapper config changes require restart
    if (newConfig.webhook || newConfig.branchMapper) {
      console.warn('Webhook and branch mapper configuration changes require restart to take effect');
    }
    
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup old destroyed branch mappings
   */
  public async cleanupOldMappings(olderThanDays: number = 7): Promise<number> {
    return await this.branchMapper.cleanupDestroyedMappings(olderThanDays);
  }
}