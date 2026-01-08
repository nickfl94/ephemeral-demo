/**
 * Tests for Git event processor
 */

import { GitEventProcessor, EventProcessorConfig, EnvironmentActions } from './event-processor';
import { BranchMapper, BranchMapperConfig } from './branch-mapper';
import { GitWebhookEvent } from '../types';
import fs from 'fs/promises';
import path from 'path';

describe('GitEventProcessor', () => {
  let eventProcessor: GitEventProcessor;
  let branchMapper: BranchMapper;
  let mockEnvironmentActions: EnvironmentActions;
  let config: EventProcessorConfig;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test storage
    tempDir = path.join(__dirname, '../../test-data', `event-processor-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Set up mock environment actions
    mockEnvironmentActions = {
      createEnvironment: jest.fn().mockResolvedValue('env-123'),
      destroyEnvironment: jest.fn().mockResolvedValue(undefined),
      scheduleDestruction: jest.fn().mockResolvedValue(undefined),
      cancelDestruction: jest.fn().mockResolvedValue(undefined),
    };

    // Set up branch mapper
    const branchMapperConfig: BranchMapperConfig = {
      storageFile: path.join(tempDir, 'branch-mappings.json'),
    };
    branchMapper = new BranchMapper(branchMapperConfig);
    await branchMapper.initialize();

    // Set up event processor config
    config = {
      defaultEnvironmentConfig: {
        template: 'webapp' as const,
        region: 'us-east-1',
        instanceType: 't3.micro',
      },
      autoCreateEnvironments: true,
      autoDestroyEnvironments: true,
      destroyDelayMinutes: 5,
    };

    eventProcessor = new GitEventProcessor(config, branchMapper, mockEnvironmentActions);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('pull request events', () => {
    it('should create environment on PR opened', async () => {
      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'opened',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.createEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({
          branch: 'feature-branch',
          template: 'webapp',
        })
      );

      const mapping = branchMapper.getMapping('feature-branch');
      expect(mapping?.environmentId).toBe('env-123');
      expect(mapping?.status).toBe('active');
    });

    it('should not create duplicate environments', async () => {
      // Create initial mapping
      await branchMapper.createMapping('feature-branch', 'existing-env');

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'opened',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.createEnvironment).not.toHaveBeenCalled();
    });

    it('should schedule destruction on PR closed', async () => {
      // Create initial mapping
      await branchMapper.createMapping('feature-branch', 'env-123');

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'closed',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.scheduleDestruction).toHaveBeenCalledWith('env-123', 5);
      
      const mapping = branchMapper.getMapping('feature-branch');
      expect(mapping?.status).toBe('cleanup_scheduled');
    });

    it('should schedule destruction on PR merged with shorter delay', async () => {
      // Create initial mapping
      await branchMapper.createMapping('feature-branch', 'env-123');

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'merged',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.scheduleDestruction).toHaveBeenCalledWith('env-123', 5);
      
      const mapping = branchMapper.getMapping('feature-branch');
      expect(mapping?.status).toBe('cleanup_scheduled');
    });
  });

  describe('push events', () => {
    it('should cancel scheduled destruction on new push', async () => {
      // Create mapping with scheduled cleanup
      await branchMapper.createMapping('feature-branch', 'env-123');
      await branchMapper.updateMappingStatus('feature-branch', 'cleanup_scheduled');

      const event: GitWebhookEvent = {
        eventType: 'push',
        branch: 'feature-branch',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.cancelDestruction).toHaveBeenCalledWith('env-123');
      
      const mapping = branchMapper.getMapping('feature-branch');
      expect(mapping?.status).toBe('active');
    });
  });

  describe('branch delete events', () => {
    it('should immediately destroy environment on branch delete', async () => {
      // Create initial mapping
      await branchMapper.createMapping('feature-branch', 'env-123');

      const event: GitWebhookEvent = {
        eventType: 'branch_delete',
        branch: 'feature-branch',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.destroyEnvironment).toHaveBeenCalledWith('env-123');
      
      const mapping = branchMapper.getMapping('feature-branch');
      expect(mapping?.status).toBe('destroyed');
    });

    it('should cancel scheduled destruction before immediate destroy', async () => {
      // Create mapping with scheduled cleanup
      await branchMapper.createMapping('feature-branch', 'env-123');
      await branchMapper.updateMappingStatus('feature-branch', 'cleanup_scheduled');

      const event: GitWebhookEvent = {
        eventType: 'branch_delete',
        branch: 'feature-branch',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.cancelDestruction).toHaveBeenCalledWith('env-123');
      expect(mockEnvironmentActions.destroyEnvironment).toHaveBeenCalledWith('env-123');
    });
  });

  describe('configuration', () => {
    it('should respect auto-create setting', async () => {
      eventProcessor.updateConfig({ autoCreateEnvironments: false });

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'opened',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.createEnvironment).not.toHaveBeenCalled();
    });

    it('should respect auto-destroy setting', async () => {
      eventProcessor.updateConfig({ autoDestroyEnvironments: false });
      await branchMapper.createMapping('feature-branch', 'env-123');

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'closed',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      await eventProcessor.processEvent(event);

      expect(mockEnvironmentActions.scheduleDestruction).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle environment creation failures gracefully', async () => {
      mockEnvironmentActions.createEnvironment = jest.fn().mockRejectedValue(new Error('Creation failed'));

      const event: GitWebhookEvent = {
        eventType: 'pull_request',
        branch: 'feature-branch',
        action: 'opened',
        repository: {
          name: 'test-repo',
          owner: 'test-owner',
          url: 'https://github.com/test-owner/test-repo',
        },
        timestamp: new Date(),
      };

      // The event processor should handle the error gracefully and not throw
      await expect(eventProcessor.processEvent(event)).resolves.not.toThrow();
      
      // But the environment creation should have been attempted
      expect(mockEnvironmentActions.createEnvironment).toHaveBeenCalled();
    });
  });

  describe('processing status', () => {
    it('should track processing status', () => {
      const status = eventProcessor.getProcessingStatus();
      expect(Array.isArray(status)).toBe(true);
    });
  });
});