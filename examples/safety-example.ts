import { SafetyService, SafetyConfig } from '../src/services/safetyService.js';
import { logger } from '../src/utils/logger.js';

async function demonstrateSafetyService() {
    console.log('🔒 Safety Service Example\n');

    // Initialize safety service with custom configuration
    const safetyConfig: Partial<SafetyConfig> = {
        rejectionRateThreshold: 25, // Lower threshold for demonstration
        maxActionsPerHour: 15,
        maxActionsPerDay: 75,
        lunchBreakEnabled: true,
        lunchBreakStart: "12:00",
        lunchBreakEnd: "13:00",
        weekendReductionEnabled: true,
        weekendActivityMultiplier: 0.5,
        timezone: 'America/New_York',
        enableHumanBehavior: true,
        randomDelayMin: 3000,
        randomDelayMax: 10000,
        profileViewProbability: 0.4,
        scrollProbability: 0.5,
        alertEmail: 'admin@example.com'
    };

    const safetyService = new SafetyService(safetyConfig);

    console.log('✅ Safety Service initialized with configuration:');
    console.log(`   - Rejection rate threshold: ${safetyConfig.rejectionRateThreshold}%`);
    console.log(`   - Max actions per hour: ${safetyConfig.maxActionsPerHour}`);
    console.log(`   - Max actions per day: ${safetyConfig.maxActionsPerDay}`);
    console.log(`   - Lunch break: ${safetyConfig.lunchBreakStart} - ${safetyConfig.lunchBreakEnd}`);
    console.log(`   - Weekend reduction: ${(safetyConfig.weekendActivityMultiplier! * 100)}%`);
    console.log(`   - Human behavior: ${safetyConfig.enableHumanBehavior ? 'Enabled' : 'Disabled'}\n`);

    // Demonstrate action tracking
    console.log('📊 Simulating action tracking...');

    // Simulate some successful actions
    for (let i = 0; i < 10; i++) {
        safetyService.recordAction(true); // Success
    }

    // Simulate some failed actions to trigger rejection rate warning
    for (let i = 0; i < 5; i++) {
        safetyService.recordAction(false); // Failure
    }

    const metrics = safetyService.getMetrics();
    console.log('Current metrics:');
    console.log(`   - Total actions: ${metrics.totalActions}`);
    console.log(`   - Rejected actions: ${metrics.rejectedActions}`);
    console.log(`   - Rejection rate: ${metrics.rejectionRate.toFixed(1)}%`);
    console.log(`   - Should slow down: ${safetyService.shouldSlowDown() ? 'Yes' : 'No'}`);
    console.log(`   - Recommended delay: ${safetyService.getRecommendedDelay()}ms\n`);

    // Demonstrate time-based restrictions
    console.log('⏰ Checking time-based restrictions...');
    console.log(`   - Is lunch break: ${safetyService.isLunchBreakTime() ? 'Yes' : 'No'}`);
    console.log(`   - Is weekend: ${safetyService.isWeekendTime() ? 'Yes' : 'No'}`);
    console.log(`   - Activity multiplier: ${safetyService.getActivityMultiplier()}`);

    const actionCheck = safetyService.canPerformAction();
    console.log(`   - Can perform action: ${actionCheck.allowed ? 'Yes' : 'No'}`);
    if (!actionCheck.allowed) {
        console.log(`   - Reason: ${actionCheck.reason}`);
        if (actionCheck.waitTime) {
            console.log(`   - Wait time: ${Math.round(actionCheck.waitTime / 1000)}s`);
        }
    }
    console.log('');

    // Demonstrate human behavior simulation
    console.log('🤖 Simulating human behavior...');

    // Note: In a real scenario, you would pass a Playwright page object
    // For this example, we'll just show the configuration
    console.log('Human behavior features:');
    console.log(`   - Profile view probability: ${(safetyConfig.profileViewProbability! * 100)}%`);
    console.log(`   - Scroll probability: ${(safetyConfig.scrollProbability! * 100)}%`);
    console.log(`   - Random delays: ${safetyConfig.randomDelayMin}ms - ${safetyConfig.randomDelayMax}ms`);
    console.log('');

    // Demonstrate alert system
    console.log('🚨 Alert system demonstration...');
    const alerts = safetyService.getAlerts();
    console.log(`   - Total alerts: ${alerts.length}`);

    if (alerts.length > 0) {
        console.log('   Recent alerts:');
        alerts.slice(-3).forEach((alert, index) => {
            console.log(`   ${index + 1}. [${alert.type.toUpperCase()}] ${alert.message}`);
            console.log(`      Time: ${alert.timestamp.toLocaleString()}`);
            console.log(`      Requires action: ${alert.requiresAction ? 'Yes' : 'No'}`);
        });
    } else {
        console.log('   No alerts currently active');
    }
    console.log('');

    // Demonstrate data persistence
    console.log('💾 Data persistence:');
    console.log('   - Safety metrics are automatically saved to safety-data.json');
    console.log('   - Alerts are persisted and can be retrieved across sessions');
    console.log('   - Hourly and daily action counts are tracked');
    console.log('');

    // Show integration example
    console.log('🔗 Integration example with LinkedIn automation:');
    console.log(`
    // In your LinkedIn automation code:
    
    import { safetyService } from './services/safetyService.js';
    import { Page } from 'playwright';
    
    async function performLinkedInAction(page: Page) {
        // 1. Check if action is allowed
        const actionCheck = safetyService.canPerformAction();
        if (!actionCheck.allowed) {
            console.log(\`Action blocked: \${actionCheck.reason}\`);
            if (actionCheck.waitTime) {
                await new Promise(resolve => setTimeout(resolve, actionCheck.waitTime));
            }
            return;
        }
        
        // 2. Monitor for restrictions before action
        await safetyService.monitorRestrictions(page);
        
        // 3. Check for CAPTCHA
        const hasCaptcha = await safetyService.detectCaptcha(page);
        if (hasCaptcha) {
            console.log('CAPTCHA detected, manual intervention required');
            return;
        }
        
        // 4. Simulate human behavior
        await safetyService.simulateHumanBehavior(page);
        
        // 5. Perform your LinkedIn action
        let success = false;
        try {
            // Your LinkedIn action here
            success = true;
        } catch (error) {
            console.error('Action failed:', error);
        }
        
        // 6. Record the result
        safetyService.recordAction(success);
        
        // 7. Check for alerts
        await safetyService.alertUserIfRestricted();
        
        // 8. Use recommended delay
        const delay = safetyService.getRecommendedDelay();
        await safetyService.randomDelay(delay, delay);
    }
    `);

    console.log('✨ Safety Service example completed!');
    console.log('\nKey benefits:');
    console.log('   🛡️  Protects against LinkedIn restrictions');
    console.log('   🤖 Simulates human behavior patterns');
    console.log('   ⏰ Respects time-based limitations');
    console.log('   📊 Tracks rejection rates and adjusts behavior');
    console.log('   🚨 Provides real-time alerts and warnings');
    console.log('   💾 Persists data across sessions');
}

// Export the function for CLI usage
export { demonstrateSafetyService };

// Run the example if called directly
if (import.meta.url.endsWith(process.argv[1]) || import.meta.url.includes('safety-example')) {
    demonstrateSafetyService().catch(console.error);
}
