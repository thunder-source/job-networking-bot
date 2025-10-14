# Adaptive Rate Limiter Service

The `AdaptiveRateLimiter` is a sophisticated rate limiting service designed specifically for LinkedIn automation and other social media platforms. It implements intelligent, adaptive rate limiting based on account characteristics, activity patterns, and success rates.

## Features

### 🎯 Adaptive Rate Limiting
- **Account Age-Based Limits**: Different limits for new (0-30 days), established (30-365 days), and premium (365+ days) accounts
- **Success Rate Adjustments**: Automatically adjusts limits based on success/rejection rates
- **Suspicious Activity Detection**: Identifies and responds to potentially harmful patterns

### ⏱️ Smart Timing
- **Random Delays**: 30-90 second delays between actions to appear more human-like
- **Adaptive Delays**: Delays adjust based on account type and activity patterns
- **Cooldown Periods**: Automatic cooldowns when suspicious activity is detected

### 📊 Comprehensive Tracking
- **Daily Limits**: Per-action-type daily limits (connections, messages, profile views)
- **Weekly/Monthly Caps**: Overall usage caps to prevent over-activity
- **Success Rate Monitoring**: Tracks and adjusts based on success rates
- **Suspicious Activity Scoring**: Monitors for bot-like behavior patterns

### 🛡️ Safety Features
- **Jail Detection**: Identifies when accounts are restricted by LinkedIn
- **Cooldown Management**: Automatic cooldowns with escalating severity
- **Pattern Recognition**: Detects repetitive or suspicious activity patterns

## Account Types and Limits

### New Accounts (0-30 days)
- **Connections**: 5-10 per day
- **Messages**: 3-5 per day
- **Profile Views**: 20-30 per day
- **Delay Multiplier**: 1.5x (longer delays)

### Established Accounts (30-365 days)
- **Connections**: 20-30 per day
- **Messages**: 10-15 per day
- **Profile Views**: 50-80 per day
- **Delay Multiplier**: 1.0x (standard delays)

### Premium Accounts (365+ days or premium subscription)
- **Connections**: 80-100 per day
- **Messages**: 30-50 per day
- **Profile Views**: 200-300 per day
- **Delay Multiplier**: 0.8x (shorter delays)

## Usage

### Basic Setup

```typescript
import { AdaptiveRateLimiter, AccountType, ActionType } from './src/services/rateLimiter.js';

// Initialize the rate limiter
const rateLimiter = new AdaptiveRateLimiter({
    // Optional: Custom configuration
    delayRanges: {
        min: 30000, // 30 seconds
        max: 90000  // 90 seconds
    }
});

await rateLimiter.initialize();
```

### Registering Accounts

```typescript
// Register a new account
await rateLimiter.registerAccount('account-1', AccountType.NEW);

// Register an established account
await rateLimiter.registerAccount('account-2', AccountType.ESTABLISHED);

// Register a premium account
await rateLimiter.registerAccount('account-3', AccountType.PREMIUM, true);
```

### Checking Actions

```typescript
// Check if a connection request is allowed
const result = await rateLimiter.checkAction('account-1', ActionType.CONNECTION_REQUEST);

if (result.allowed) {
    console.log(`Action allowed. Delay: ${result.delay}ms`);
    
    // Perform the action
    // ... your LinkedIn automation code ...
    
    // Record the result
    await rateLimiter.recordAction('account-1', ActionType.CONNECTION_REQUEST, true);
} else {
    console.log(`Action blocked: ${result.reason}`);
    if (result.cooldownUntil) {
        console.log(`Cooldown until: ${result.cooldownUntil}`);
    }
}
```

### Recording Actions

```typescript
// Record a successful action
await rateLimiter.recordAction('account-1', ActionType.CONNECTION_REQUEST, true);

// Record a failed action with reason
await rateLimiter.recordAction('account-1', ActionType.CONNECTION_REQUEST, false, 'User declined');
```

## Configuration Options

### RateLimitConfig Interface

```typescript
interface RateLimitConfig {
    // Daily limits by account type
    dailyLimits: {
        [AccountType.NEW]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
        [AccountType.ESTABLISHED]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
        [AccountType.PREMIUM]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
    };
    
    // Weekly and monthly caps
    weeklyCap: number;
    monthlyCap: number;
    
    // Delay ranges (in milliseconds)
    delayRanges: {
        min: number;
        max: number;
    };
    
    // Suspicious activity thresholds
    suspiciousActivityThresholds: {
        rapidActions: number; // actions per minute
        highRejectionRate: number; // percentage
        unusualPatterns: number; // score threshold
    };
    
    // Cooldown periods (in minutes)
    cooldownPeriods: {
        warning: number;
        critical: number;
        suspension: number;
    };
    
    // Success rate adjustments
    successRateAdjustments: {
        highSuccess: number; // increase limits by this percentage
        lowSuccess: number;  // decrease limits by this percentage
        threshold: number;   // success rate threshold
    };
}
```

## Suspicious Activity Detection

The rate limiter automatically detects and responds to suspicious activity patterns:

### Detection Criteria
- **Rapid Actions**: More than 5 actions per minute
- **High Rejection Rate**: More than 30% rejection rate
- **Repetitive Patterns**: Same action type repeatedly
- **Unusual Timing**: Actions at unusual hours or intervals

### Response Levels
- **Warning**: 30-minute cooldown
- **Critical**: 2-hour cooldown
- **Suspension**: 24-hour cooldown

## Success Rate Adjustments

The rate limiter automatically adjusts limits based on success rates:

- **High Success Rate (>60%)**: Increases limits by 10%
- **Low Success Rate (<30%)**: Decreases limits by 20%
- **Medium Success Rate**: No adjustment

## Data Persistence

The rate limiter automatically saves data to `rate-limiter-data.json`:

```json
{
    "profiles": {
        "account-1": {
            "accountId": "account-1",
            "accountType": "new",
            "accountAge": 15,
            "isPremium": false,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "lastActivity": "2024-01-15T10:30:00.000Z",
            "totalConnections": 45,
            "totalMessages": 12,
            "totalProfileViews": 89,
            "successRate": 0.85,
            "rejectionRate": 0.15,
            "suspiciousActivityScore": 0.1,
            "weeklyUsage": 25,
            "monthlyUsage": 89
        }
    },
    "actionHistory": [
        {
            "actionType": "connection_request",
            "timestamp": "2024-01-15T10:30:00.000Z",
            "success": true,
            "delayUsed": 45000,
            "accountId": "account-1"
        }
    ],
    "lastSaved": "2024-01-15T10:30:00.000Z"
}
```

## CLI Commands

### Demo the Rate Limiter
```bash
npm run start rate-limiter:demo
```

### Check Account Status
```bash
npm run start rate-limiter:status account-1
```

## Integration with LinkedIn Service

The rate limiter can be integrated with the existing LinkedIn service:

```typescript
import { LinkedInService } from './src/services/linkedinService.js';
import { AdaptiveRateLimiter, AccountType, ActionType } from './src/services/rateLimiter.js';

const rateLimiter = new AdaptiveRateLimiter();
await rateLimiter.initialize();

const linkedinService = new LinkedInService({
    // ... existing config
});

// Register the LinkedIn account
await rateLimiter.registerAccount('linkedin-account', AccountType.ESTABLISHED);

// Before sending connection requests
const result = await rateLimiter.checkAction('linkedin-account', ActionType.CONNECTION_REQUEST);

if (result.allowed) {
    // Wait for the calculated delay
    await new Promise(resolve => setTimeout(resolve, result.delay));
    
    // Send the connection request
    const connectionResult = await linkedinService.sendConnectionRequest(profileUrl, message);
    
    // Record the result
    await rateLimiter.recordAction('linkedin-account', ActionType.CONNECTION_REQUEST, connectionResult.success);
}
```

## Best Practices

### 1. Account Management
- Register accounts immediately when creating LinkedIn service instances
- Use appropriate account types based on actual account age
- Monitor account profiles regularly for suspicious activity

### 2. Error Handling
- Always check the `allowed` property before performing actions
- Handle cooldown periods gracefully
- Log suspicious activity for analysis

### 3. Performance
- Initialize the rate limiter once and reuse the instance
- Use the provided delays to avoid overwhelming the platform
- Monitor success rates and adjust behavior accordingly

### 4. Safety
- Never bypass rate limiting for "urgent" actions
- Respect cooldown periods even if they seem unnecessary
- Monitor suspicious activity scores and investigate patterns

## Troubleshooting

### Common Issues

#### Account Not Found
```
Error: Account not registered
```
**Solution**: Register the account using `registerAccount()` before checking actions.

#### Suspicious Activity Detected
```
Action blocked: Suspicious activity detected: Too many actions in short time period
```
**Solution**: Wait for the cooldown period to expire. Review your automation patterns.

#### High Rejection Rate
```
Action blocked: High rejection rate detected
```
**Solution**: Review your targeting criteria and message templates. Consider reducing activity temporarily.

### Debugging

Enable debug logging to see detailed rate limiter activity:

```typescript
import { logger } from './src/utils/logger.js';

// The rate limiter uses the logger for all operations
// Check logs for detailed information about decisions
```

## Example: Complete Integration

```typescript
import { AdaptiveRateLimiter, AccountType, ActionType } from './src/services/rateLimiter.js';
import { LinkedInService } from './src/services/linkedinService.js';

async function automatedLinkedInOutreach() {
    // Initialize services
    const rateLimiter = new AdaptiveRateLimiter();
    await rateLimiter.initialize();
    
    const linkedinService = new LinkedInService({
        headless: true,
        enableLogging: true
    });
    
    // Register account
    await rateLimiter.registerAccount('my-linkedin', AccountType.ESTABLISHED);
    
    // Login to LinkedIn
    await linkedinService.login({
        email: 'your-email@example.com',
        password: 'your-password'
    });
    
    // Get target profiles
    const profiles = await linkedinService.searchRecruiters({
        keywords: 'recruiter',
        location: 'New York',
        maxResults: 50
    });
    
    // Process each profile with rate limiting
    for (const profileUrl of profiles) {
        // Check if we can send a connection request
        const result = await rateLimiter.checkAction('my-linkedin', ActionType.CONNECTION_REQUEST);
        
        if (!result.allowed) {
            console.log(`Skipping ${profileUrl}: ${result.reason}`);
            continue;
        }
        
        // Wait for the calculated delay
        if (result.delay > 0) {
            console.log(`Waiting ${result.delay}ms before next action...`);
            await new Promise(resolve => setTimeout(resolve, result.delay));
        }
        
        // Send connection request
        const connectionResult = await linkedinService.sendConnectionRequest(profileUrl, 'Hi! I\'d like to connect.');
        
        // Record the result
        await rateLimiter.recordAction('my-linkedin', ActionType.CONNECTION_REQUEST, connectionResult.success);
        
        console.log(`Connection request ${connectionResult.success ? 'sent' : 'failed'}: ${profileUrl}`);
    }
    
    // Clean up
    await linkedinService.close();
}

// Run the automation
automatedLinkedInOutreach().catch(console.error);
```

This comprehensive rate limiter ensures safe, effective LinkedIn automation while maintaining account health and avoiding platform restrictions.
