/**
 * Git event processor for handling pull request lifecycle events
 * Triggers appropriate environment actions based on Git events
 */

import { GitWebhookEvent, EnvironmentConfig } from '../types';
import { BranchMapper } from './branch-mapper';

export interface EventProcessorConfig {
  /** Default environment configuration for new environments */
  defaultEnvironmentConfig: Partial<EnvironmentConfig>;
  /** Whether to enable automatic environment creation */
  autoCreateEnvironments: boolean;
  /** Whether to enable automatic environment destruction */
  autoDestroyEnvironments: boolean;
  /** Delay in minutes before destroying environments after PR merge/close */
  destroyDelayMinutes: number;
}

export interface EnvironmentActions {
  /** Create a new environment */
  createEnvironment: (config: EnvironmentConfig) => Promise<string>;
  /** Destroy an existing environment */
  destroyEnvironment: (environmentId: string) => Promise<void>;
  /** Schedule environment destruction */
  scheduleDestruction: (environmentId: string, delayMinutes: number) => Promise<void>;
  /** Cancel scheduled destruction */
  cancelDestruction: (environmentId: string) => Promise<void>;
}

/**
 * Git event processor class that handles Git webhook events and triggers environment actions
 */
export class GitEventProcessor {
  private config: EventProcessorConfig;
  private branchMapper: BranchMapper;
  private environmentActions: EnvironmentActions;
  private processingQueue: Map<string, Promise<void>>;

  constructor(
    config: EventProcessorConfig,
    branchMapper: BranchMapper,
    environmentActions: EnvironmentActions
  ) {
    this.config = config;
    this.branchMapper = branchMapper;
    this.environmentActions = environmentActions;
    this.processingQueue = new Map();
  }

  /**
   * Process a Git webhook event
   */
  public async processEvent(event: GitWebhookEvent): Promise<void> {
    const eventKey = `${event.eventType}-${event.branch}-${event.timestamp.getTime()}`;
    
    // Prevent duplicate processing of the same event
    if (this.processingQueue.has(eventKey)) {
      console.log(`Event already being processed: ${eventKey}`);
      return;
    }

    const processingPromise = this.handleEvent(event);
    this.processingQueue.set(eventKey, processingPromise);

    try {
      await processingPromise;
    } finally {
      this.processingQueue.delete(eventKey);
    }
  }

  /**
   * Handle a specific Git event
   */
  private async handleEvent(event: GitWebhookEvent): Promise<void> {
    console.log(`Processing Git event: ${event.eventType} for branch ${event.branch}`);

    try {
      switch (event.eventType) {
        case 'pull_request':
          await this.handlePullRequestEvent(event);
          break;
        case 'push':
          await this.handlePushEvent(event);
          break;
        case 'branch_delete':
          await this.handleBranchDeleteEvent(event);
          break;
        default:
          console.log(`Unsupported event type: ${event.eventType}`);
      }
    } catch (error) {
      console.error(`Error processing Git event ${event.eventType} for branch ${event.branch}:`, error);
      
      // Implement fallback mechanism
      await this.handleEventFailure(event, error);
    }
  }

  /**
   * Handle pull request events (opened, closed, merged)
   */
  private async handlePullRequestEvent(event: GitWebhookEvent): Promise<void> {
    const { branch, action } = event;

    switch (action) {
      case 'opened':
        await this.handlePullRequestOpened(branch, event);
        break;
      case 'closed':
        await this.handlePullRequestClosed(branch, event);
        break;
      case 'merged':
        await this.handlePullRequestMerged(branch, event);
        break;
      default:
        console.log(`Unsupported pull request action: ${action}`);
    }
  }

  /**
   * Handle pull request opened event
   */
  private async handlePullRequestOpened(branch: string, event: GitWebhookEvent): Promise<void> {
    if (!this.config.autoCreateEnvironments) {
      console.log('Auto-creation disabled, skipping environment creation');
      return;
    }

    // Check if environment already exists for this branch
    const existingMapping = this.branchMapper.getMapping(branch);
    if (existingMapping && existingMapping.status === 'active') {
      console.log(`Environment already exists for branch ${branch}: ${existingMapping.environmentId}`);
      return;
    }

    // Create new environment configuration
    const environmentName = this.branchMapper.generateEnvironmentName(branch);
    const environmentConfig: EnvironmentConfig = {
      name: environmentName,
      branch,
      template: 'webapp',
      region: 'us-east-1',
      instanceType: 't3.micro',
      autoDestroy: true,
      maxLifetime: 24,
      costThreshold: 50,
      tags: {
        'git-branch': branch,
        'git-repository': `${event.repository.owner}/${event.repository.name}`,
        'created-by': 'git-integration',
      },
      ...this.config.defaultEnvironmentConfig,
    };

    try {
      console.log(`Creating environment for branch ${branch}`);
      const environmentId = await this.environmentActions.createEnvironment(environmentConfig);
      
      // Create branch mapping
      await this.branchMapper.createMapping(branch, environmentId);
      
      console.log(`Successfully created environment ${environmentId} for branch ${branch}`);
    } catch (error) {
      console.error(`Failed to create environment for branch ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Handle pull request closed event (not merged)
   */
  private async handlePullRequestClosed(branch: string, _event: GitWebhookEvent): Promise<void> {
    if (!this.config.autoDestroyEnvironments) {
      console.log('Auto-destruction disabled, skipping environment cleanup');
      return;
    }

    const mapping = this.branchMapper.getMapping(branch);
    if (!mapping || mapping.status !== 'active') {
      console.log(`No active environment found for branch ${branch}`);
      return;
    }

    try {
      console.log(`Scheduling destruction for environment ${mapping.environmentId} (branch ${branch})`);
      
      // Update mapping status
      await this.branchMapper.updateMappingStatus(branch, 'cleanup_scheduled');
      
      // Schedule destruction with delay
      await this.environmentActions.scheduleDestruction(
        mapping.environmentId,
        this.config.destroyDelayMinutes
      );
      
      console.log(`Scheduled destruction for environment ${mapping.environmentId} in ${this.config.destroyDelayMinutes} minutes`);
    } catch (error) {
      console.error(`Failed to schedule destruction for branch ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Handle pull request merged event
   */
  private async handlePullRequestMerged(branch: string, _event: GitWebhookEvent): Promise<void> {
    if (!this.config.autoDestroyEnvironments) {
      console.log('Auto-destruction disabled, skipping environment cleanup');
      return;
    }

    const mapping = this.branchMapper.getMapping(branch);
    if (!mapping || mapping.status !== 'active') {
      console.log(`No active environment found for branch ${branch}`);
      return;
    }

    try {
      console.log(`Scheduling destruction for merged branch environment ${mapping.environmentId} (branch ${branch})`);
      
      // Update mapping status
      await this.branchMapper.updateMappingStatus(branch, 'cleanup_scheduled');
      
      // Schedule destruction with delay (shorter delay for merged PRs)
      const mergeDelay = Math.min(this.config.destroyDelayMinutes, 5); // Max 5 minutes for merged PRs
      await this.environmentActions.scheduleDestruction(mapping.environmentId, mergeDelay);
      
      console.log(`Scheduled destruction for environment ${mapping.environmentId} in ${mergeDelay} minutes`);
    } catch (error) {
      console.error(`Failed to schedule destruction for merged branch ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Handle push events
   */
  private async handlePushEvent(event: GitWebhookEvent): Promise<void> {
    const { branch } = event;
    
    // For push events, we mainly want to ensure the environment is still active
    // and potentially update it if needed
    const mapping = this.branchMapper.getMapping(branch);
    if (mapping && mapping.status === 'cleanup_scheduled') {
      // If there was a scheduled cleanup but new commits arrived, cancel it
      try {
        console.log(`Canceling scheduled destruction for branch ${branch} due to new commits`);
        await this.environmentActions.cancelDestruction(mapping.environmentId);
        await this.branchMapper.updateMappingStatus(branch, 'active');
        console.log(`Canceled destruction and reactivated environment for branch ${branch}`);
      } catch (error) {
        console.error(`Failed to cancel destruction for branch ${branch}:`, error);
      }
    }
  }

  /**
   * Handle branch delete events
   */
  private async handleBranchDeleteEvent(event: GitWebhookEvent): Promise<void> {
    const { branch } = event;
    
    const mapping = this.branchMapper.getMapping(branch);
    if (!mapping) {
      console.log(`No environment mapping found for deleted branch ${branch}`);
      return;
    }

    if (mapping.status === 'destroyed') {
      console.log(`Environment for branch ${branch} already destroyed`);
      return;
    }

    try {
      console.log(`Immediately destroying environment for deleted branch ${branch}`);
      
      // Cancel any scheduled destruction and destroy immediately
      if (mapping.status === 'cleanup_scheduled') {
        await this.environmentActions.cancelDestruction(mapping.environmentId);
      }
      
      // Destroy the environment
      await this.environmentActions.destroyEnvironment(mapping.environmentId);
      
      // Update mapping status
      await this.branchMapper.updateMappingStatus(branch, 'destroyed');
      
      console.log(`Successfully destroyed environment ${mapping.environmentId} for deleted branch ${branch}`);
    } catch (error) {
      console.error(`Failed to destroy environment for deleted branch ${branch}:`, error);
      throw error;
    }
  }

  /**
   * Handle event processing failures with fallback mechanisms
   */
  private async handleEventFailure(event: GitWebhookEvent, error: any): Promise<void> {
    console.error(`Implementing fallback for failed event processing:`, {
      eventType: event.eventType,
      branch: event.branch,
      error: error.message,
    });

    // Log the failure for manual intervention
    const failureLog = {
      timestamp: new Date().toISOString(),
      event,
      error: error.message,
      stack: error.stack,
    };

    // In a real implementation, this could:
    // 1. Send alerts to monitoring systems
    // 2. Queue the event for retry
    // 3. Create manual intervention tickets
    // 4. Send notifications to team members
    
    console.error('Event processing failure logged:', failureLog);
    
    // For now, we'll just ensure the error is properly logged
    // The calling code can decide whether to retry or escalate
  }

  /**
   * Get current processing queue status
   */
  public getProcessingStatus(): { eventKey: string; isProcessing: boolean }[] {
    return Array.from(this.processingQueue.keys()).map(eventKey => ({
      eventKey,
      isProcessing: true,
    }));
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<EventProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Updated Git event processor configuration');
  }
}