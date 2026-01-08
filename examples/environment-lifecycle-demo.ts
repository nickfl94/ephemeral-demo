/**
 * Example demonstrating environment lifecycle management
 * This shows how to use the state tracker, lifecycle manager, and cleanup scheduler together
 */

import {
  EnvironmentStateTracker,
  EnvironmentLifecycleManager,
  CleanupScheduler,
  EnvironmentConfig,
} from '../src/environment';

async function demonstrateEnvironmentLifecycle() {
  console.log('🚀 Environment Lifecycle Management Demo\n');

  // Initialize components
  const stateTracker = new EnvironmentStateTracker(
    '.demo-data/environments.json'
  );
  await stateTracker.initialize();

  const lifecycleManager = new EnvironmentLifecycleManager(stateTracker);
  const cleanupScheduler = new CleanupScheduler(
    stateTracker,
    lifecycleManager,
    {
      defaultTimeoutHours: 2, // Short timeout for demo
      gracePeriodMinutes: 5,
      checkIntervalMinutes: 1,
    }
  );

  try {
    // 1. Create a new environment
    console.log('1️⃣ Creating new environment...');
    const config: EnvironmentConfig = {
      name: 'demo-environment',
      branch: 'feature/demo',
      template: 'webapp',
      region: 'us-east-1',
      instanceType: 't3.micro',
      autoDestroy: true,
      maxLifetime: 2, // 2 hours
      costThreshold: 25,
      tags: {
        project: 'demo',
        owner: 'demo-user',
      },
    };

    const environment = await lifecycleManager.createEnvironment(config);
    console.log(`✅ Environment created: ${environment.id}`);
    console.log(`   Status: ${environment.status}`);
    console.log(
      `   Will be destroyed at: ${environment.destroyAt?.toISOString()}\n`
    );

    // 2. Update environment status (simulate provisioning completion)
    console.log('2️⃣ Updating environment status...');
    await stateTracker.updateEnvironment(environment.id, {
      status: 'ready',
      urls: {
        application: 'https://demo-app.example.com',
        monitoring: 'https://monitoring.example.com',
      },
    });
    console.log('✅ Environment is now ready\n');

    // 3. Start cleanup scheduler
    console.log('3️⃣ Starting cleanup scheduler...');
    cleanupScheduler.start();
    console.log('✅ Cleanup scheduler started\n');

    // 4. Schedule immediate cleanup for demo
    console.log('4️⃣ Scheduling cleanup...');
    const cleanupJob = await cleanupScheduler.scheduleCleanup(
      environment.id,
      new Date(Date.now() + 10000) // 10 seconds from now
    );
    console.log(
      `✅ Cleanup scheduled for: ${cleanupJob.executeAt.toISOString()}\n`
    );

    // 5. Show environment stats
    console.log('5️⃣ Environment statistics:');
    const stats = await stateTracker.getStats();
    console.log(`   Total environments: ${stats.totalEnvironments}`);
    console.log(`   Active environments: ${stats.activeEnvironments}`);
    console.log(`   Total cost: $${stats.totalCost.toFixed(2)}\n`);

    // 6. Show cleanup stats
    console.log('6️⃣ Cleanup statistics:');
    const cleanupStats = cleanupScheduler.getCleanupStats();
    console.log(`   Scheduled cleanups: ${cleanupStats.totalScheduled}`);
    console.log(`   Completed cleanups: ${cleanupStats.totalCompleted}`);
    console.log(`   Failed cleanups: ${cleanupStats.totalFailed}`);
    if (cleanupStats.nextScheduledCleanup) {
      console.log(
        `   Next cleanup: ${cleanupStats.nextScheduledCleanup.toISOString()}`
      );
    }
    console.log();

    // 7. Wait for cleanup to execute (in real scenario, this would happen automatically)
    console.log('7️⃣ Waiting for cleanup to execute...');
    await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds

    // 8. Check final status
    console.log('8️⃣ Final environment status:');
    const finalEnvironment = await stateTracker.getEnvironment(environment.id);
    if (finalEnvironment) {
      console.log(`   Status: ${finalEnvironment.status}`);
    } else {
      console.log('   Environment has been removed from database');
    }

    // Stop scheduler
    cleanupScheduler.stop();
    console.log('\n✅ Demo completed successfully!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    cleanupScheduler.stop();
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateEnvironmentLifecycle().catch(console.error);
}

export { demonstrateEnvironmentLifecycle };
