/**
 * Basic tests for the DemoCommands class
 */

import { DemoCommands } from './index';

describe('DemoCommands', () => {
  let demoCommands: DemoCommands;

  beforeEach(() => {
    demoCommands = new DemoCommands();
  });

  describe('provision', () => {
    it('should create a valid environment configuration', async () => {
      const result = await demoCommands.provision({
        branch: 'test-branch',
        template: 'webapp',
        region: 'us-east-1',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Environment provisioning initiated');
      expect(result.data).toMatch(/^ephemeral-test-branch-/);
    });

    it('should handle missing branch by defaulting to main', async () => {
      const result = await demoCommands.provision({
        template: 'webapp',
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatch(/^ephemeral-main-/);
    });

    it('should validate template parameter', async () => {
      const result = await demoCommands.provision({
        branch: 'test',
        template: 'invalid-template' as any,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Template must be one of');
    });
  });

  describe('destroy', () => {
    it('should require environment ID', async () => {
      const result = await demoCommands.destroy('', {});

      expect(result.success).toBe(false);
      expect(result.message).toBe('Environment ID is required');
    });

    it('should accept valid environment ID', async () => {
      const result = await demoCommands.destroy('test-env-123', {});

      expect(result.success).toBe(true);
      expect(result.message).toContain('destroyed successfully');
    });
  });

  describe('status', () => {
    it('should return status information', async () => {
      const result = await demoCommands.status({});

      expect(result.success).toBe(true);
      expect(result.message).toContain('Environment Status');
    });
  });
});
