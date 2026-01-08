/**
 * Automatic timeout-based cleanup scheduler
 * Monitors idle environments and schedules cleanup jobs for expired environments
 */

import { EnvironmentState } from '../types';
import { EnvironmentStateTracker } from './state-tracker';
import {
  EnvironmentLifecycleManager,
  CleanupResult,
} from './lifecycle-manager';

export interface TimeoutPolicy {
  /** Default timeout in hours for environments without explicit timeout */
  defaultTimeoutHours: number;
  /** Grace period in minutes before actual cleanup starts */
  gracePeriodMinutes: number;
  /** Maximum number of environments to cleanup in one batch */
  maxBatchSize: number;
  /** Interval in minutes between cleanup checks */
  checkIntervalMinutes: number;
  /** Whether to send notifications before cleanup */
  enableNotifications: boolean;
}

export interface CleanupJob {
  environmentId: string;
  scheduledAt: Date;
  executeAt: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
}

export interface CleanupStats {
  totalScheduled: number;
  totalCompleted: number;
  totalFailed: number;
  currentlyRunning: number;
  nextScheduledCleanup?: Date;
}

export class CleanupScheduler {
  private stateTracker: EnvironmentStateTracker;
  private lifecycleManager: EnvironmentLifecycleManager;
  private timeoutPolicy: TimeoutPolicy;
  private cleanupJobs: Map<string, CleanupJob> = new Map();
  private schedulerInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    stateTracker: EnvironmentStateTracker,
    lifecycleManager: EnvironmentLifecycleManager,
    timeoutPolicy: Partial<TimeoutPolicy> = {}
  ) {
    this.stateTracker = stateTracker;
    this.lifecycleManager = lifecycleManager;
    this.timeoutPolicy = {
      defaultTimeoutHours: 24,
      gracePeriodMinutes: 30,
      maxBatchSize: 5,
      checkIntervalMinutes: 15,
      enableNotifications: true,
      ...timeoutPolicy,
    };
  }

  /**
   * Start the cleanup scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('Cleanup scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(
      `Starting cleanup scheduler with ${this.timeoutPolicy.checkIntervalMinutes}min intervals`
    );

    // Run initial check
    this.performCleanupCheck().catch((error) => {
      console.error('Error in initial cleanup check:', error);
    });

    // Schedule periodic checks
    this.schedulerInterval = setInterval(
      () => {
        this.performCleanupCheck().catch((error) => {
          console.error('Error in scheduled cleanup check:', error);
        });
      },
      this.timeoutPolicy.checkIntervalMinutes * 60 * 1000
    );
  }

  /**
   * Stop the cleanup scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Cleanup scheduler is not running');
      return;
    }

    this.isRunning = false;

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    console.log('Cleanup scheduler stopped');
  }

  /**
   * Schedule cleanup for a specific environment
   */
  async scheduleCleanup(
    environmentId: string,
    executeAt?: Date
  ): Promise<CleanupJob> {
    const environment = await this.stateTracker.getEnvironment(environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    if (
      environment.status === 'destroyed' ||
      environment.status === 'destroying'
    ) {
      throw new Error(
        `Environment ${environmentId} is already being destroyed or destroyed`
      );
    }

    const scheduledAt = new Date();
    const finalExecuteAt = executeAt || this.calculateCleanupTime(environment);

    const job: CleanupJob = {
      environmentId,
      scheduledAt,
      executeAt: finalExecuteAt,
      status: 'scheduled',
      attempts: 0,
    };

    this.cleanupJobs.set(environmentId, job);

    console.log(
      `Scheduled cleanup for environment ${environmentId} at ${finalExecuteAt.toISOString()}`
    );

    if (this.timeoutPolicy.enableNotifications) {
      await this.sendCleanupNotification(environment, job);
    }

    return job;
  }

  /**
   * Cancel scheduled cleanup for an environment
   */
  cancelCleanup(environmentId: string): boolean {
    const job = this.cleanupJobs.get(environmentId);
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      console.log(
        `Cannot cancel cleanup for ${environmentId} - already running`
      );
      return false;
    }

    this.cleanupJobs.delete(environmentId);
    console.log(`Cancelled cleanup for environment ${environmentId}`);
    return true;
  }

  /**
   * Get cleanup job status
   */
  getCleanupJob(environmentId: string): CleanupJob | null {
    return this.cleanupJobs.get(environmentId) || null;
  }

  /**
   * List all cleanup jobs
   */
  listCleanupJobs(status?: CleanupJob['status']): CleanupJob[] {
    const jobs = Array.from(this.cleanupJobs.values());

    if (status) {
      return jobs.filter((job) => job.status === status);
    }

    return jobs.sort((a, b) => a.executeAt.getTime() - b.executeAt.getTime());
  }

  /**
   * Get cleanup statistics
   */
  getCleanupStats(): CleanupStats {
    const jobs = Array.from(this.cleanupJobs.values());
    const scheduledJobs = jobs.filter((job) => job.status === 'scheduled');

    const result: CleanupStats = {
      totalScheduled: jobs.filter((job) => job.status === 'scheduled').length,
      totalCompleted: jobs.filter((job) => job.status === 'completed').length,
      totalFailed: jobs.filter((job) => job.status === 'failed').length,
      currentlyRunning: jobs.filter((job) => job.status === 'running').length,
    };

    if (scheduledJobs.length > 0) {
      const sortedJobs = scheduledJobs.sort(
        (a, b) => a.executeAt.getTime() - b.executeAt.getTime()
      );
      const nextJob = sortedJobs[0];
      if (nextJob) {
        result.nextScheduledCleanup = nextJob.executeAt;
      }
    }

    return result;
  }

  /**
   * Force immediate cleanup of expired environments
   */
  async forceCleanupExpired(): Promise<CleanupResult[]> {
    console.log('Forcing cleanup of all expired environments');

    const expiredEnvironments =
      await this.stateTracker.getExpiredEnvironments();
    const results: CleanupResult[] = [];

    for (const environment of expiredEnvironments) {
      try {
        console.log(`Force cleaning up expired environment ${environment.id}`);
        const result = await this.lifecycleManager.destroyEnvironment(
          environment.id,
          {
            forceDestroy: true,
            maxRetries: 1,
          }
        );
        results.push(result);
      } catch (error) {
        console.error(
          `Failed to force cleanup environment ${environment.id}:`,
          error
        );
        results.push({
          success: false,
          resourcesRemoved: [],
          resourcesRemaining: environment.resources.map((r) => r.address),
          errors: [error instanceof Error ? error.message : String(error)],
          retryCount: 0,
        });
      }
    }

    return results;
  }

  /**
   * Update timeout policy
   */
  updateTimeoutPolicy(updates: Partial<TimeoutPolicy>): void {
    this.timeoutPolicy = { ...this.timeoutPolicy, ...updates };
    console.log('Updated timeout policy:', this.timeoutPolicy);
  }

  /**
   * Perform periodic cleanup check
   */
  private async performCleanupCheck(): Promise<void> {
    try {
      console.log('Performing scheduled cleanup check...');

      // Check for expired environments that need scheduling
      await this.scheduleExpiredEnvironments();

      // Execute ready cleanup jobs
      await this.executeReadyCleanupJobs();

      // Clean up completed/failed jobs older than 24 hours
      this.cleanupOldJobs();
    } catch (error) {
      console.error('Error during cleanup check:', error);
    }
  }

  /**
   * Schedule cleanup for expired environments
   */
  private async scheduleExpiredEnvironments(): Promise<void> {
    const expiredEnvironments =
      await this.stateTracker.getExpiredEnvironments();

    for (const environment of expiredEnvironments) {
      // Skip if already scheduled
      if (this.cleanupJobs.has(environment.id)) {
        continue;
      }

      // Schedule with grace period
      const executeAt = new Date(
        Date.now() + this.timeoutPolicy.gracePeriodMinutes * 60 * 1000
      );
      await this.scheduleCleanup(environment.id, executeAt);
    }
  }

  /**
   * Execute cleanup jobs that are ready
   */
  private async executeReadyCleanupJobs(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.cleanupJobs.values())
      .filter((job) => job.status === 'scheduled' && job.executeAt <= now)
      .slice(0, this.timeoutPolicy.maxBatchSize);

    for (const job of readyJobs) {
      await this.executeCleanupJob(job);
    }
  }

  /**
   * Execute a single cleanup job
   */
  private async executeCleanupJob(job: CleanupJob): Promise<void> {
    console.log(`Executing cleanup job for environment ${job.environmentId}`);

    job.status = 'running';
    job.attempts++;

    try {
      const result = await this.lifecycleManager.destroyEnvironment(
        job.environmentId,
        {
          maxRetries: 2,
          verifyCleanup: true,
        }
      );

      if (result.success) {
        job.status = 'completed';
        console.log(`Successfully cleaned up environment ${job.environmentId}`);
      } else {
        job.status = 'failed';
        job.lastError = result.errors.join('; ');
        console.error(
          `Failed to cleanup environment ${job.environmentId}:`,
          job.lastError
        );
      }
    } catch (error) {
      job.status = 'failed';
      job.lastError = error instanceof Error ? error.message : String(error);
      console.error(
        `Error executing cleanup job for ${job.environmentId}:`,
        job.lastError
      );
    }
  }

  /**
   * Calculate when an environment should be cleaned up
   */
  private calculateCleanupTime(environment: EnvironmentState): Date {
    if (environment.destroyAt) {
      return environment.destroyAt;
    }

    // Use default timeout
    const timeoutMs = this.timeoutPolicy.defaultTimeoutHours * 60 * 60 * 1000;
    return new Date(environment.createdAt.getTime() + timeoutMs);
  }

  /**
   * Send notification about scheduled cleanup
   */
  private async sendCleanupNotification(
    environment: EnvironmentState,
    job: CleanupJob
  ): Promise<void> {
    // TODO: This will integrate with actual notification system (email, Slack, etc.)
    console.log(
      `NOTIFICATION: Environment ${environment.name} (${environment.id}) scheduled for cleanup at ${job.executeAt.toISOString()}`
    );
    console.log(`  Branch: ${environment.branch}`);
    console.log(`  Created: ${environment.createdAt.toISOString()}`);
    console.log(`  Current cost: $${environment.costs.current.toFixed(2)}`);
  }

  /**
   * Clean up old completed/failed jobs
   */
  private cleanupOldJobs(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const jobsToRemove: string[] = [];

    for (const [environmentId, job] of Array.from(this.cleanupJobs.entries())) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.scheduledAt < oneDayAgo
      ) {
        jobsToRemove.push(environmentId);
      }
    }

    for (const environmentId of jobsToRemove) {
      this.cleanupJobs.delete(environmentId);
    }

    if (jobsToRemove.length > 0) {
      console.log(`Cleaned up ${jobsToRemove.length} old cleanup jobs`);
    }
  }
}
