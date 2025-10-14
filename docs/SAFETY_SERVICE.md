# Safety Service Documentation

The Safety Service is a comprehensive monitoring and protection system designed to keep LinkedIn automation activities safe and undetected. It implements multiple layers of protection including restriction monitoring, human behavior simulation, and intelligent rate limiting.

## Features

### 🛡️ LinkedIn Restriction Monitoring
- **Warning Detection**: Automatically detects LinkedIn warning messages and restriction notices
- **Rate Limiting Alerts**: Monitors for rate limiting messages and adjusts behavior accordingly
- **Account Restriction Detection**: Identifies when accounts are restricted or suspended
- **URL Monitoring**: Detects redirects to restriction pages

### 🤖 Human Behavior Simulation
- **Random Profile Views**: Simulates viewing random profiles between actions (configurable probability)
- **Scrolling Behavior**: Implements realistic scrolling patterns with random intervals
- **Random Pauses**: Adds natural pauses between activities
- **Browsing Simulation**: Mimics human browsing patterns

### 📊 Rejection Rate Tracking
- **Threshold Monitoring**: Tracks rejection rates and triggers alerts when exceeding 30% (configurable)
- **Automatic Slowdown**: Reduces activity speed when rejection rates are high
- **Dynamic Delays**: Adjusts delay times based on rejection patterns
- **Historical Tracking**: Maintains rejection rate history for analysis

### ⏰ Time-based Restrictions
- **Lunch Break Pause**: Automatically pauses activities during 12-1 PM (configurable)
- **Weekend Reduction**: Reduces activity to 50% during weekends (configurable)
- **Working Hours**: Respects business hours for more natural behavior
- **Timezone Support**: Configurable timezone handling

### 🚨 Alert System
- **Real-time Alerts**: Immediate notifications for critical issues
- **Alert Categories**: Warning, Critical, and Info level alerts
- **Persistent Storage**: Alerts are saved and can be retrieved across sessions
- **Email/Webhook Support**: Configurable notification channels

## Configuration

```typescript
interface SafetyConfig {
    rejectionRateThreshold: number;        // Default: 30%
    maxActionsPerHour: number;             // Default: 20
    maxActionsPerDay: number;              // Default: 100
    lunchBreakEnabled: boolean;            // Default: true
    lunchBreakStart: string;               // Default: "12:00"
    lunchBreakEnd: string;                 // Default: "13:00"
    weekendReductionEnabled: boolean;      // Default: true
    weekendActivityMultiplier: number;     // Default: 0.5 (50%)
    timezone: string;                      // Default: 'America/New_York'
    enableHumanBehavior: boolean;          // Default: true
    randomDelayMin: number;                // Default: 2000ms
    randomDelayMax: number;                // Default: 8000ms
    profileViewProbability: number;        // Default: 0.3 (30%)
    scrollProbability: number;             // Default: 0.4 (40%)
    alertEmail?: string;                   // Optional email for alerts
    alertWebhook?: string;                 // Optional webhook for alerts
}
```

## Usage

### Basic Integration

```typescript
import { safetyService } from './services/safetyService.js';
import { Page } from 'playwright';

async function performLinkedInAction(page: Page) {
    // 1. Check if action is allowed
    const actionCheck = safetyService.canPerformAction();
    if (!actionCheck.allowed) {
        console.log(`Action blocked: ${actionCheck.reason}`);
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
```

### Custom Configuration

```typescript
import { SafetyService } from './services/safetyService.js';

const customSafetyService = new SafetyService({
    rejectionRateThreshold: 25,
    maxActionsPerHour: 15,
    maxActionsPerDay: 75,
    lunchBreakEnabled: true,
    lunchBreakStart: "12:30",
    lunchBreakEnd: "13:30",
    weekendReductionEnabled: true,
    weekendActivityMultiplier: 0.3,
    timezone: 'America/Los_Angeles',
    enableHumanBehavior: true,
    profileViewProbability: 0.4,
    scrollProbability: 0.5,
    alertEmail: 'admin@company.com'
});
```

## CLI Commands

### Check Safety Status
```bash
npm run safety:status
```
Shows current safety metrics, alerts, and status flags.

### Run Safety Demo
```bash
npm run safety:demo
```
Demonstrates all safety service features with example scenarios.

### Reset Safety Metrics
```bash
npm run safety:reset --confirm
```
⚠️ **Warning**: This resets all safety metrics and alerts. Use with caution.

## API Reference

### Core Methods

#### `canPerformAction(): { allowed: boolean; reason?: string; waitTime?: number }`
Checks if an action can be performed based on current restrictions.

#### `recordAction(success: boolean): void`
Records the result of an action for rejection rate tracking.

#### `monitorRestrictions(page: Page): Promise<SafetyAlert[]>`
Monitors the current page for LinkedIn restrictions and warnings.

#### `detectCaptcha(page: Page): Promise<boolean>`
Detects CAPTCHA challenges on the current page.

#### `simulateHumanBehavior(page: Page): Promise<HumanBehaviorAction[]>`
Simulates human-like behavior patterns.

#### `alertUserIfRestricted(): Promise<void>`
Checks for critical alerts and notifies the user if account appears restricted.

### Utility Methods

#### `getMetrics(): SafetyMetrics`
Returns current safety metrics and statistics.

#### `getAlerts(): SafetyAlert[]`
Returns all stored alerts.

#### `getRecentAlerts(): SafetyAlert[]`
Returns alerts from the last 24 hours.

#### `shouldSlowDown(): boolean`
Checks if actions should be slowed down due to high rejection rates.

#### `getRecommendedDelay(): number`
Returns recommended delay time based on current conditions.

#### `isLunchBreakTime(): boolean`
Checks if current time is during lunch break.

#### `isWeekendTime(): boolean`
Checks if current time is during weekend.

#### `getActivityMultiplier(): number`
Returns current activity multiplier based on time restrictions.

## Data Persistence

The Safety Service automatically persists data to `safety-data.json`:

- **Metrics**: Action counts, rejection rates, timestamps
- **Alerts**: All alerts with timestamps and severity levels
- **Action Counts**: Hourly and daily action tracking
- **Configuration**: Current safety settings

## Best Practices

### 1. Regular Monitoring
- Check safety status regularly using `safety:status`
- Monitor rejection rates and adjust thresholds if needed
- Review alerts and take appropriate action

### 2. Gradual Scaling
- Start with conservative limits and gradually increase
- Monitor rejection rates closely when scaling up
- Use weekend reduction to test higher limits safely

### 3. Human Behavior
- Enable human behavior simulation for better safety
- Adjust probabilities based on your usage patterns
- Use realistic delay ranges (2-8 seconds minimum)

### 4. Alert Response
- Set up email/webhook alerts for critical issues
- Respond immediately to restriction warnings
- Take breaks when rejection rates are high

### 5. Configuration Tuning
- Adjust limits based on your LinkedIn account type
- Consider your timezone and working hours
- Test different configurations in safe environments

## Troubleshooting

### High Rejection Rates
1. Check if limits are too aggressive
2. Increase delay times between actions
3. Enable more human behavior simulation
4. Review LinkedIn account status

### Frequent CAPTCHA Challenges
1. Reduce action frequency
2. Increase random delays
3. Add more profile viewing behavior
4. Check for account restrictions

### Account Restrictions
1. Stop all automation immediately
2. Review recent actions and alerts
3. Wait for restrictions to lift
4. Reduce limits significantly when resuming

### Performance Issues
1. Clear old alerts regularly
2. Monitor data file size
3. Adjust periodic task intervals
4. Consider data cleanup strategies

## Integration Examples

### With LinkedIn Service
```typescript
import { LinkedInService } from './services/linkedinService.js';
import { safetyService } from './services/safetyService.js';

const linkedinService = new LinkedInService({
    // LinkedIn configuration
});

// Before each LinkedIn action
const actionCheck = safetyService.canPerformAction();
if (!actionCheck.allowed) {
    // Handle restriction
    return;
}

// Monitor for restrictions
await safetyService.monitorRestrictions(linkedinService.getPage());

// Perform action and record result
const result = await linkedinService.sendConnectionRequest(profileUrl);
safetyService.recordAction(result.success);
```

### With Campaign Management
```typescript
import { CampaignService } from './services/campaignService.js';
import { safetyService } from './services/safetyService.js';

async function runCampaign(campaignId: string) {
    const campaign = await campaignService.getCampaign(campaignId);
    
    for (const contact of campaign.contacts) {
        // Check safety before each contact
        if (!safetyService.canPerformAction().allowed) {
            console.log('Campaign paused due to safety restrictions');
            break;
        }
        
        // Simulate human behavior
        await safetyService.simulateHumanBehavior(page);
        
        // Process contact
        const result = await processContact(contact);
        safetyService.recordAction(result.success);
        
        // Check for alerts
        await safetyService.alertUserIfRestricted();
    }
}
```

## Security Considerations

- **Data Privacy**: Safety data is stored locally and not transmitted
- **Credential Safety**: No sensitive credentials are stored in safety data
- **Audit Trail**: All actions are logged for compliance and debugging
- **Rate Limiting**: Built-in protection against aggressive automation
- **Graceful Degradation**: Service continues to function even with partial failures

## Future Enhancements

- **Machine Learning**: Adaptive behavior patterns based on success rates
- **Multi-account Support**: Separate safety profiles for multiple LinkedIn accounts
- **Advanced Analytics**: Detailed reporting and trend analysis
- **Integration APIs**: REST API for external monitoring systems
- **Mobile Notifications**: Push notifications for critical alerts
