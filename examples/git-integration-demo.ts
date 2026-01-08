/**
 * Example demonstrating Git integration functionality
 * Shows how to set up webhook handling and event processing
 */

import { GitIntegration, GitIntegrationConfig, EnvironmentActions } from '../src/git';
import { EnvironmentConfig } from '../src/types';

// Mock environment actions for demonstration
const mockEnvironmentActions: EnvironmentActions = {
  async createEnvironment(config: EnvironmentConfig): Promise<string> {
    console.log(`Creating environment: ${config.name} for branch: ${config.branch}`);
    // In real implementation, this would call the actual environment provisioning
    return `env-${Date.now()}`;
  },

  async destroyEnvironment(environmentId: string): Promise<void> {
    console.log(`Destroying environment: ${environmentId}`);
    // In real implementation, this would call the actual environment destruction
  },

  async scheduleDestruction(environmentId: string, delayMinutes: number): Promise<void> {
    console.log(`Scheduling destruction of ${environmentId} in ${delayMinutes} minutes`);
    // In real implementation, this would schedule the destruction
  },

  async cancelDestruction(environmentId: string): Promise<void> {
    console.log(`Canceling scheduled destruction of ${environmentId}`);
    // In real implementation, this would cancel the scheduled destruction
  },
};

// Configuration for Git integration
const gitConfig: GitIntegrationConfig = {
  webhook: {
    port: 3000,
    secret: 'your-webhook-secret-here',
    path: '/webhook',
  },
  eventProcessor: {
    defaultEnvironmentConfig: {
      template: 'webapp' as const,
      region: 'us-east-1',
      instanceType: 't3.micro',
      autoDestroy: true,
      maxLifetime: 24,
      costThreshold: 50,
    },
    autoCreateEnvironments: true,
    autoDestroyEnvironments: true,
    destroyDelayMinutes: 5,
  },
  branchMapper: {
    storageFile: './data/branch-mappings.json',
  },
};

async function demonstrateGitIntegration() {
  console.log('🚀 Starting Git Integration Demo');

  // Initialize Git integration
  const gitIntegration = new GitIntegration(gitConfig, mockEnvironmentActions);
  
  try {
    // Initialize the system
    await gitIntegration.initialize();
    
    // Show current status
    const status = gitIntegration.getStatus();
    console.log('📊 Git Integration Status:', status);

    // Simulate a pull request opened event
    console.log('\n📝 Simulating pull request opened event...');
    await gitIntegration.processEvent({
      eventType: 'pull_request',
      branch: 'feature/user-authentication',
      action: 'opened',
      repository: {
        name: 'my-app',
        owner: 'my-org',
        url: 'https://github.com/my-org/my-app',
      },
      timestamp: new Date(),
    });

    // Show branch mappings
    const branchMapper = gitIntegration.getBranchMapper();
    const activeMappings = branchMapper.getActiveMappings();
    console.log('\n🔗 Active branch mappings:', activeMappings);

    // Simulate a pull request merged event
    console.log('\n✅ Simulating pull request merged event...');
    await gitIntegration.processEvent({
      eventType: 'pull_request',
      branch: 'feature/user-authentication',
      action: 'merged',
      repository: {
        name: 'my-app',
        owner: 'my-org',
        url: 'https://github.com/my-org/my-app',
      },
      timestamp: new Date(),
    });

    // Show updated mappings
    const scheduledMappings = branchMapper.getMappingsByStatus('cleanup_scheduled');
    console.log('\n⏰ Scheduled for cleanup:', scheduledMappings);

    // Simulate branch deletion
    console.log('\n🗑️  Simulating branch deletion event...');
    await gitIntegration.processEvent({
      eventType: 'branch_delete',
      branch: 'feature/user-authentication',
      repository: {
        name: 'my-app',
        owner: 'my-org',
        url: 'https://github.com/my-org/my-app',
      },
      timestamp: new Date(),
    });

    // Show final mappings
    const destroyedMappings = branchMapper.getMappingsByStatus('destroyed');
    console.log('\n💀 Destroyed environments:', destroyedMappings);

    console.log('\n✨ Demo completed successfully!');
    console.log('\n📡 Webhook server is running at: http://localhost:3000/webhook');
    console.log('   Configure your Git repository to send webhooks to this URL');
    console.log('   Make sure to set the webhook secret in your repository settings');

    // Keep the server running for a bit to demonstrate webhook functionality
    console.log('\n⏳ Keeping webhook server running for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error during demo:', error);
  } finally {
    // Clean shutdown
    await gitIntegration.shutdown();
    console.log('🛑 Git integration shut down');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateGitIntegration().catch(console.error);
}

export { demonstrateGitIntegration };