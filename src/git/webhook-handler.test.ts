/**
 * Tests for Git webhook handler
 */

import { GitWebhookHandler, WebhookConfig } from './webhook-handler';

describe('GitWebhookHandler', () => {
  let webhookHandler: GitWebhookHandler;
  let config: WebhookConfig;

  beforeEach(() => {
    config = {
      port: 3001,
      secret: 'test-secret-key',
      path: '/webhook',
    };
  });

  afterEach(async () => {
    if (webhookHandler) {
      await webhookHandler.stop();
    }
  });

  describe('constructor', () => {
    it('should create webhook handler with valid config', () => {
      webhookHandler = new GitWebhookHandler(config);
      expect(webhookHandler).toBeDefined();
      expect(webhookHandler.getConfig()).toEqual(config);
    });
  });

  describe('event handling', () => {
    it('should register event handlers', () => {
      webhookHandler = new GitWebhookHandler(config);
      const mockHandler = jest.fn();
      
      webhookHandler.onEvent('pull_request', mockHandler);
      
      // Handler registration should not throw
      expect(() => {
        webhookHandler.onEvent('push', mockHandler);
      }).not.toThrow();
    });
  });

  describe('server lifecycle', () => {
    it('should start and stop server', async () => {
      webhookHandler = new GitWebhookHandler(config);
      await expect(webhookHandler.start()).resolves.not.toThrow();
      await expect(webhookHandler.stop()).resolves.not.toThrow();
    });

    it('should handle start errors gracefully', async () => {
      webhookHandler = new GitWebhookHandler(config);
      // Create another handler with same port to cause conflict
      const conflictHandler = new GitWebhookHandler(config);
      
      await webhookHandler.start();
      
      // The second handler should fail to start on the same port
      try {
        await conflictHandler.start();
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // This is expected - starting on the same port should fail
        expect(error).toBeDefined();
      }
      
      await conflictHandler.stop();
    });
  });

  describe('configuration', () => {
    it('should return configuration copy', () => {
      webhookHandler = new GitWebhookHandler(config);
      const returnedConfig = webhookHandler.getConfig();
      
      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // Should be a copy
    });
  });
});