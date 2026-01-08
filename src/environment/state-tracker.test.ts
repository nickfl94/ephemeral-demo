/**
 * Tests for EnvironmentStateTracker
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentStateTracker } from './state-tracker';
import { EnvironmentConfig } from '../types';

describe('EnvironmentStateTracker', () => {
  let tracker: EnvironmentStateTracker;
  let testDbPath: string;

  beforeEach(async () => {
    // Use a temporary test database
    testDbPath = path.join(__dirname, '../../test-data/test-environments.json');
    tracker = new EnvironmentStateTracker(testDbPath);
    await tracker.initialize();
  });

  afterEach(async () => {
    // Clean up test database
    try {
      await fs.unlink(testDbPath);
      await fs.rmdir(path.dirname(testDbPath));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('createEnvironment', () => {
    it('should create a new environment with correct properties', async () => {
      const config: EnvironmentConfig = {
        name: 'test-env',
        branch: 'feature/test',
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.micro',
        autoDestroy: true,
        maxLifetime: 24,
        costThreshold: 50,
        tags: { project: 'test' },
      };

      const environment = await tracker.createEnvironment(config);

      expect(environment.name).toBe('test-env');
      expect(environment.branch).toBe('feature/test');
      expect(environment.status).toBe('creating');
      expect(environment.id).toMatch(/^test-env-feature-test-/);
      expect(environment.destroyAt).toBeDefined();
      expect(environment.costs.current).toBe(0);
      expect(environment.resources).toEqual([]);
    });

    it('should not set destroyAt when autoDestroy is false', async () => {
      const config: EnvironmentConfig = {
        name: 'persistent-env',
        branch: 'main',
        template: 'api',
        region: 'us-west-2',
        instanceType: 't3.small',
        autoDestroy: false,
        maxLifetime: 0,
        costThreshold: 100,
        tags: {},
      };

      const environment = await tracker.createEnvironment(config);

      expect(environment.destroyAt).toBeUndefined();
    });
  });

  describe('getEnvironment', () => {
    it('should retrieve an existing environment', async () => {
      const config: EnvironmentConfig = {
        name: 'retrieve-test',
        branch: 'test-branch',
        template: 'fullstack',
        region: 'eu-west-1',
        instanceType: 't3.medium',
        autoDestroy: true,
        maxLifetime: 12,
        costThreshold: 25,
        tags: {},
      };

      const created = await tracker.createEnvironment(config);
      const retrieved = await tracker.getEnvironment(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('retrieve-test');
    });

    it('should return null for non-existent environment', async () => {
      const result = await tracker.getEnvironment('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getExpiredEnvironments', () => {
    it('should return environments past their destroyAt time', async () => {
      const config: EnvironmentConfig = {
        name: 'expired-env',
        branch: 'expired-branch',
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.micro',
        autoDestroy: true,
        maxLifetime: 1, // 1 hour
        costThreshold: 10,
        tags: {},
      };

      const environment = await tracker.createEnvironment(config);

      // Manually set destroyAt to past time
      await tracker.updateEnvironment(environment.id, {
        destroyAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      });

      const expired = await tracker.getExpiredEnvironments();
      expect(expired).toHaveLength(1);
      expect(expired[0]?.id).toBe(environment.id);
    });

    it('should not return destroyed environments', async () => {
      const config: EnvironmentConfig = {
        name: 'destroyed-env',
        branch: 'destroyed-branch',
        template: 'api',
        region: 'us-east-1',
        instanceType: 't3.micro',
        autoDestroy: true,
        maxLifetime: 1,
        costThreshold: 10,
        tags: {},
      };

      const environment = await tracker.createEnvironment(config);

      // Set as destroyed and expired
      await tracker.updateEnvironment(environment.id, {
        status: 'destroyed',
        destroyAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const expired = await tracker.getExpiredEnvironments();
      expect(expired).toHaveLength(0);
    });
  });

  describe('updateEnvironment', () => {
    it('should update environment properties', async () => {
      const config: EnvironmentConfig = {
        name: 'update-test',
        branch: 'update-branch',
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.micro',
        autoDestroy: false,
        maxLifetime: 0,
        costThreshold: 50,
        tags: {},
      };

      const environment = await tracker.createEnvironment(config);

      const updated = await tracker.updateEnvironment(environment.id, {
        status: 'ready',
        urls: {
          application: 'https://test.example.com',
          monitoring: 'https://monitor.example.com',
        },
      });

      expect(updated.status).toBe('ready');
      expect(updated.urls.application).toBe('https://test.example.com');
      expect(updated.urls.monitoring).toBe('https://monitor.example.com');
    });

    it('should throw error for non-existent environment', async () => {
      await expect(
        tracker.updateEnvironment('non-existent', { status: 'ready' })
      ).rejects.toThrow('Environment non-existent not found');
    });
  });
});
