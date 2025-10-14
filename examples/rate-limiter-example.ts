import { AdaptiveRateLimiter, AccountType, ActionType } from '../src/services/rateLimiter.js';
import { logger } from '../src/utils/logger.js';

/**
 * Example demonstrating the AdaptiveRateLimiter service
 * This shows how to use the rate limiter for LinkedIn operations
 */

async function demonstrateRateLimiter() {
    console.log('🚀 Starting Rate Limiter Example\n');

    // Initialize the rate limiter with custom configuration
    const rateLimiter = new AdaptiveRateLimiter({
        dailyLimits: {
            [AccountType.NEW]: {
                connections: { min: 5, max: 10 },
                messages: { min: 3, max: 5 },
                profileViews: { min: 20, max: 30 }
            },
            [AccountType.ESTABLISHED]: {
                connections: { min: 20, max: 30 },
                messages: { min: 10, max: 15 },
                profileViews: { min: 50, max: 80 }
            },
            [AccountType.PREMIUM]: {
                connections: { min: 80, max: 100 },
                messages: { min: 30, max: 50 },
                profileViews: { min: 200, max: 300 }
            }
        },
        weeklyCap: 500,
        monthlyCap: 2000,
        delayRanges: {
            min: 30000, // 30 seconds
            max: 90000  // 90 seconds
        }
    });

    await rateLimiter.initialize();

    // Register different types of accounts
    console.log('📝 Registering accounts...');

    // New account (0-30 days old)
    await rateLimiter.registerAccount('new-account-1', AccountType.NEW);

    // Established account (30-365 days old)
    await rateLimiter.registerAccount('established-account-1', AccountType.ESTABLISHED);

    // Premium account (365+ days old)
    await rateLimiter.registerAccount('premium-account-1', AccountType.PREMIUM, true);

    console.log('✅ Accounts registered successfully\n');

    // Demonstrate rate limiting for different account types
    await demonstrateAccountLimits(rateLimiter, 'new-account-1', 'New Account');
    await demonstrateAccountLimits(rateLimiter, 'established-account-1', 'Established Account');
    await demonstrateAccountLimits(rateLimiter, 'premium-account-1', 'Premium Account');

    // Demonstrate suspicious activity detection
    await demonstrateSuspiciousActivity(rateLimiter);

    // Demonstrate success rate adjustments
    await demonstrateSuccessRateAdjustments(rateLimiter);

    // Show account profiles
    console.log('\n📊 Account Profiles:');
    console.log('==================');

    const accounts = ['new-account-1', 'established-account-1', 'premium-account-1'];
    for (const accountId of accounts) {
        const profile = rateLimiter.getAccountProfile(accountId);
        if (profile) {
            console.log(`\n${accountId}:`);
            console.log(`  Type: ${profile.accountType}`);
            console.log(`  Age: ${profile.accountAge} days`);
            console.log(`  Premium: ${profile.isPremium}`);
            console.log(`  Success Rate: ${(profile.successRate * 100).toFixed(1)}%`);
            console.log(`  Rejection Rate: ${(profile.rejectionRate * 100).toFixed(1)}%`);
            console.log(`  Suspicious Score: ${(profile.suspiciousActivityScore * 100).toFixed(1)}%`);
            console.log(`  Weekly Usage: ${profile.weeklyUsage}`);
            console.log(`  Monthly Usage: ${profile.monthlyUsage}`);
            console.log(`  Cooldown Until: ${profile.cooldownUntil || 'None'}`);
        }
    }

    // Show action history
    console.log('\n📈 Recent Action History:');
    console.log('========================');
    const history = rateLimiter.getActionHistory(undefined, 10);
    history.forEach((action, index) => {
        console.log(`${index + 1}. ${action.actionType} - ${action.success ? '✅' : '❌'} - ${action.timestamp.toISOString()}`);
    });

    console.log('\n🎉 Rate Limiter Example Complete!');
}

async function demonstrateAccountLimits(rateLimiter: AdaptiveRateLimiter, accountId: string, accountLabel: string) {
    console.log(`\n🔍 Testing ${accountLabel} (${accountId}):`);
    console.log('='.repeat(50));

    // Test connection requests
    console.log('\n📞 Testing Connection Requests:');
    for (let i = 1; i <= 12; i++) {
        const result = await rateLimiter.checkAction(accountId, ActionType.CONNECTION_REQUEST);

        if (result.allowed) {
            console.log(`  ${i}. ✅ Allowed - Delay: ${(result.delay / 1000).toFixed(1)}s`);

            // Simulate the action
            const success = Math.random() > 0.1; // 90% success rate
            await rateLimiter.recordAction(accountId, ActionType.CONNECTION_REQUEST, success);

            if (result.delay > 0) {
                console.log(`     ⏳ Waiting ${(result.delay / 1000).toFixed(1)}s...`);
                await new Promise(resolve => setTimeout(resolve, Math.min(result.delay, 1000))); // Cap at 1s for demo
            }
        } else {
            console.log(`  ${i}. ❌ Blocked - ${result.reason}`);
            if (result.cooldownUntil) {
                console.log(`     🕐 Cooldown until: ${result.cooldownUntil.toISOString()}`);
            }
            break;
        }
    }

    // Test profile views
    console.log('\n👁️  Testing Profile Views:');
    for (let i = 1; i <= 15; i++) {
        const result = await rateLimiter.checkAction(accountId, ActionType.PROFILE_VIEW);

        if (result.allowed) {
            console.log(`  ${i}. ✅ Allowed - Delay: ${(result.delay / 1000).toFixed(1)}s`);

            // Simulate the action
            const success = Math.random() > 0.05; // 95% success rate
            await rateLimiter.recordAction(accountId, ActionType.PROFILE_VIEW, success);

            if (result.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(result.delay, 500))); // Cap at 0.5s for demo
            }
        } else {
            console.log(`  ${i}. ❌ Blocked - ${result.reason}`);
            break;
        }
    }
}

async function demonstrateSuspiciousActivity(rateLimiter: AdaptiveRateLimiter) {
    console.log('\n🚨 Demonstrating Suspicious Activity Detection:');
    console.log('='.repeat(50));

    // Create a test account
    await rateLimiter.registerAccount('suspicious-test', AccountType.NEW);

    console.log('\n⚡ Simulating rapid actions (suspicious pattern):');

    // Simulate rapid actions to trigger suspicious activity detection
    for (let i = 1; i <= 8; i++) {
        const result = await rateLimiter.checkAction('suspicious-test', ActionType.CONNECTION_REQUEST);

        if (result.allowed) {
            console.log(`  ${i}. ✅ Allowed - Delay: ${(result.delay / 1000).toFixed(1)}s`);

            // Simulate action with high failure rate
            const success = Math.random() > 0.7; // 30% success rate (suspicious)
            await rateLimiter.recordAction('suspicious-test', ActionType.CONNECTION_REQUEST, success,
                success ? undefined : 'User not found');

            // Very short delay to simulate rapid actions
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            console.log(`  ${i}. ❌ Blocked - ${result.reason}`);
            if (result.cooldownUntil) {
                console.log(`     🕐 Cooldown until: ${result.cooldownUntil.toISOString()}`);
            }
            break;
        }
    }

    // Check the account profile after suspicious activity
    const profile = rateLimiter.getAccountProfile('suspicious-test');
    if (profile) {
        console.log(`\n📊 Suspicious Account Profile:`);
        console.log(`  Suspicious Score: ${(profile.suspiciousActivityScore * 100).toFixed(1)}%`);
        console.log(`  Success Rate: ${(profile.successRate * 100).toFixed(1)}%`);
        console.log(`  Rejection Rate: ${(profile.rejectionRate * 100).toFixed(1)}%`);
        console.log(`  Cooldown Until: ${profile.cooldownUntil || 'None'}`);
    }
}

async function demonstrateSuccessRateAdjustments(rateLimiter: AdaptiveRateLimiter) {
    console.log('\n📈 Demonstrating Success Rate Adjustments:');
    console.log('='.repeat(50));

    // Create test accounts for different success rates
    await rateLimiter.registerAccount('high-success', AccountType.ESTABLISHED);
    await rateLimiter.registerAccount('low-success', AccountType.ESTABLISHED);

    console.log('\n🎯 High Success Rate Account:');

    // Simulate high success rate actions
    for (let i = 1; i <= 10; i++) {
        const result = await rateLimiter.checkAction('high-success', ActionType.CONNECTION_REQUEST);

        if (result.allowed) {
            // Simulate high success rate (90%)
            const success = Math.random() > 0.1;
            await rateLimiter.recordAction('high-success', ActionType.CONNECTION_REQUEST, success);

            if (result.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(result.delay, 200)));
            }
        }
    }

    console.log('\n📉 Low Success Rate Account:');

    // Simulate low success rate actions
    for (let i = 1; i <= 10; i++) {
        const result = await rateLimiter.checkAction('low-success', ActionType.CONNECTION_REQUEST);

        if (result.allowed) {
            // Simulate low success rate (20%)
            const success = Math.random() > 0.8;
            await rateLimiter.recordAction('low-success', ActionType.CONNECTION_REQUEST, success,
                success ? undefined : 'Connection declined');

            if (result.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(result.delay, 200)));
            }
        }
    }

    // Show adjusted limits
    const highSuccessProfile = rateLimiter.getAccountProfile('high-success');
    const lowSuccessProfile = rateLimiter.getAccountProfile('low-success');

    if (highSuccessProfile && lowSuccessProfile) {
        const highSuccessLimits = rateLimiter.getCurrentLimits(highSuccessProfile);
        const lowSuccessLimits = rateLimiter.getCurrentLimits(lowSuccessProfile);

        console.log('\n📊 Adjusted Limits Comparison:');
        console.log(`High Success Account (${(highSuccessProfile.successRate * 100).toFixed(1)}% success):`);
        console.log(`  Connections: ${highSuccessLimits.connections}`);
        console.log(`  Messages: ${highSuccessLimits.messages}`);
        console.log(`  Profile Views: ${highSuccessLimits.profileViews}`);

        console.log(`\nLow Success Account (${(lowSuccessProfile.successRate * 100).toFixed(1)}% success):`);
        console.log(`  Connections: ${lowSuccessLimits.connections}`);
        console.log(`  Messages: ${lowSuccessLimits.messages}`);
        console.log(`  Profile Views: ${lowSuccessLimits.profileViews}`);
    }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateRateLimiter().catch(console.error);
}

export { demonstrateRateLimiter };
