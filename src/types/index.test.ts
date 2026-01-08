/**
 * Tests for TypeScript interfaces and type definitions
 */

import {
  EnvironmentConfig,
  EnvironmentState,
  ResourceCost,
  CommandResult,
} from './index';

describe('Type Definitions', () => {
  describe('EnvironmentConfig', () => {
    it('should accept valid configuration', () => {
      const config: EnvironmentConfig = {
        name: 'test-env',
        branch: 'main',
        template: 'webapp',
        region: 'us-east-1',
        instanceType: 't3.micro',
        autoDestroy: true,
        maxLifetime: 24,
        costThreshold: 50,
        tags: {
          Project: 'test',
        },
      };

      expect(config.name).toBe('test-env');
      expect(config.template).toBe('webapp');
      expect(config.autoDestroy).toBe(true);
    });
  });

  describe('EnvironmentState', () => {
    it('should accept valid state', () => {
      const state: EnvironmentState = {
        id: 'env-123',
        name: 'test-env',
        status: 'ready',
        branch: 'main',
        createdAt: new Date(),
        urls: {
          application: 'https://app.example.com',
        },
        costs: {
          current: 10.5,
          projected: 25.0,
          breakdown: [],
        },
        resources: [],
      };

      expect(state.id).toBe('env-123');
      expect(state.status).toBe('ready');
      expect(state.costs.current).toBe(10.5);
    });
  });

  describe('ResourceCost', () => {
    it('should accept valid cost data', () => {
      const cost: ResourceCost = {
        resourceId: 'i-1234567890abcdef0',
        resourceType: 'EC2',
        service: 'Amazon Elastic Compute Cloud',
        cost: 5.25,
        unit: 'USD',
        timeframe: '24h',
      };

      expect(cost.resourceId).toBe('i-1234567890abcdef0');
      expect(cost.cost).toBe(5.25);
    });
  });

  describe('CommandResult', () => {
    it('should accept successful result', () => {
      const result: CommandResult = {
        success: true,
        message: 'Operation completed',
        data: { id: 'test-123' },
      };

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'test-123' });
    });

    it('should accept error result', () => {
      const result: CommandResult = {
        success: false,
        message: 'Operation failed',
        error: {
          code: 'TEST_ERROR',
          details: 'Something went wrong',
        },
      };

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TEST_ERROR');
    });
  });
});
