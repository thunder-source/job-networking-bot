# Scheduler Service

The Scheduler Service is a comprehensive follow-up automation system that manages timed communications with contacts based on their status and interaction history. It uses node-cron for scheduling and integrates with both email and LinkedIn services.

## Features

### Follow-up Logic
- **Day 3**: If connection is pending, send LinkedIn reminder
- **Day 7**: If connected but no response, send first follow-up
- **Day 14**: Send second follow-up with value-add content (article/insight)
- **Day 21**: Final gentle follow-up before marking as not interested

### Contact Status Management
- Automatically checks contact status and determines next actions
- Respects "do not contact" flags and tags
- Tracks conversation history and follow-up counts
- Handles immediate thank you messages after connection acceptance

### Scheduling Features
- Cron-based scheduling with timezone support
- Working hours configuration
- Rate limiting and retry logic with exponential backoff
- Task status tracking (pending, running, completed, failed, cancelled)

## Configuration

```typescript
interface ISchedulerConfig {
    enabled: boolean;
    timezone: string;
    workingHours: {
        start: string; // HH:MM format
        end: string;   // HH:MM format
        days: string[]; // ['monday', 'tuesday', etc.]
    };
    followUpSettings: {
        day3Reminder: boolean;
        day7FollowUp: boolean;
        day14FollowUp: boolean;
        day21FinalFollowUp: boolean;
        maxFollowUps: number;
    };
    rateLimiting: {
        maxTasksPerHour: number;
        delayBetweenTasks: number; // milliseconds
    };
    retrySettings: {
        maxRetries: number;
        retryDelay: number; // milliseconds
        exponentialBackoff: boolean;
    };
}
```

## Usage

### Basic Setup

```typescript
import { SchedulerService, ISchedulerConfig } from './src/services/schedulerService.js';
import { EmailService } from './src/services/emailService.js';
import { LinkedInService } from './src/services/linkedinService.js';
import { DatabaseService } from './src/services/databaseService.js';

// Initialize services
const emailService = new EmailService(emailConfig);
const linkedinService = new LinkedInService(linkedinConfig);
const databaseService = new DatabaseService();

// Create scheduler configuration
const config: ISchedulerConfig = {
    enabled: true,
    timezone: 'America/New_York',
    workingHours: {
        start: '09:00',
        end: '17:00',
        days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    },
    followUpSettings: {
        day3Reminder: true,
        day7FollowUp: true,
        day14FollowUp: true,
        day21FinalFollowUp: true,
        maxFollowUps: 3
    },
    rateLimiting: {
        maxTasksPerHour: 50,
        delayBetweenTasks: 60000
    },
    retrySettings: {
        maxRetries: 3,
        retryDelay: 300000,
        exponentialBackoff: true
    }
};

// Create and start scheduler
const scheduler = new SchedulerService(
    config,
    emailService,
    linkedinService,
    databaseService
);

await scheduler.start();
```

### Scheduling Follow-ups

```typescript
// Schedule a LinkedIn reminder for day 3
const reminderTaskId = await scheduler.scheduleFollowUp(
    contactId,
    campaignId,
    ScheduledTaskType.LINKEDIN_REMINDER,
    3, // 3 days from now
    { reason: 'Connection pending reminder' }
);

// Schedule a follow-up email for day 7
const followUpTaskId = await scheduler.scheduleFollowUp(
    contactId,
    campaignId,
    ScheduledTaskType.FOLLOW_UP_EMAIL,
    7, // 7 days from now
    { followUpNumber: 1 }
);

// Schedule immediate thank you message
const thankYouTaskId = await scheduler.scheduleThankYouMessage(
    contactId,
    campaignId,
    'email', // or 'linkedin'
    { connectionAccepted: true }
);
```

### Checking Contact Status

```typescript
const statusInfo = await scheduler.checkContactStatus(contactId);
console.log({
    status: statusInfo.status,
    nextAction: statusInfo.nextAction,
    daysSinceLastContact: statusInfo.daysSinceLastContact,
    shouldContact: statusInfo.shouldContact
});
```

### Managing Tasks

```typescript
// Get scheduler status
const status = scheduler.getStatus();
console.log({
    isRunning: status.isRunning,
    totalTasks: status.totalTasks,
    pendingTasks: status.pendingTasks,
    completedTasks: status.completedTasks,
    failedTasks: status.failedTasks
});

// Get tasks for a specific contact
const contactTasks = scheduler.getTasksByContact(contactId);

// Cancel a specific task
const cancelled = scheduler.cancelTask(taskId);

// Cancel all tasks for a contact
const cancelledCount = scheduler.cancelTasksForContact(contactId);
```

## Task Types

### ScheduledTaskType Enum

- `LINKEDIN_REMINDER`: LinkedIn connection reminder
- `FOLLOW_UP_EMAIL`: Email follow-up message
- `FOLLOW_UP_LINKEDIN`: LinkedIn follow-up message
- `THANK_YOU_EMAIL`: Thank you email after connection
- `THANK_YOU_LINKEDIN`: Thank you LinkedIn message
- `VALUE_ADD_EMAIL`: Email with value-add content (article/insight)
- `FINAL_FOLLOW_UP`: Final gentle follow-up
- `STATUS_CHECK`: Contact status verification

### Task Status

- `PENDING`: Task is scheduled and waiting to run
- `RUNNING`: Task is currently being executed
- `COMPLETED`: Task completed successfully
- `FAILED`: Task failed after all retry attempts
- `CANCELLED`: Task was cancelled
- `RETRYING`: Task failed and is waiting to retry

## Follow-up Logic Details

### Day 3: LinkedIn Reminder
- Triggered when contact status is `PENDING` and 3+ days since last contact
- Sends a gentle reminder about the pending connection request
- Uses LinkedIn service to send connection request with reminder message

### Day 7: First Follow-up
- Triggered when contact status is `CONNECTED` and 7+ days since last contact
- Sends follow-up email using the configured email template
- Records conversation in contact history

### Day 14: Value-add Follow-up
- Triggered when contact status is `CONNECTED` and 14+ days since last contact
- Sends email with valuable content (article, insight, case study)
- Focuses on providing value rather than asking for something

### Day 21: Final Follow-up
- Triggered when contact status is `CONNECTED` and 21+ days since last contact
- Sends final gentle follow-up email
- After sending, marks contact as `NOT_INTERESTED` to stop further outreach

### Immediate Thank You
- Triggered immediately when connection is accepted
- Sends thank you message via email or LinkedIn
- Acknowledges the connection and expresses appreciation

## Do Not Contact Logic

The scheduler respects several "do not contact" indicators:

- Contact tags: `do_not_contact`, `blocked`, `unsubscribed`
- Contact status: `BLOCKED`, `NOT_INTERESTED`
- Custom business logic in `shouldContactPerson()` method

## Rate Limiting

- Maximum tasks per hour (configurable)
- Delay between task executions
- Respects working hours configuration
- Exponential backoff for retries

## Logging

All scheduler activities are logged with appropriate levels:

- `INFO`: Task scheduling, completion, status updates
- `WARN`: Task failures, retries, rate limiting
- `ERROR`: Critical failures, service errors
- `DEBUG`: Detailed execution information

## CLI Commands

### Start Scheduler
```bash
npm run start scheduler:start --timezone America/New_York
```

### Check Status
```bash
npm run start scheduler:status
```

### Run Example
```bash
npm run scheduler:example
```

## Error Handling

- Automatic retry with exponential backoff
- Graceful handling of service failures
- Task status tracking for debugging
- Comprehensive error logging

## Integration

The scheduler integrates with:

- **EmailService**: For sending follow-up emails
- **LinkedInService**: For LinkedIn messages and connection requests
- **DatabaseService**: For contact and campaign data
- **Logger**: For comprehensive logging

## Best Practices

1. **Configure appropriate rate limits** to avoid being flagged as spam
2. **Set reasonable working hours** to respect recipient time zones
3. **Monitor task status** regularly to identify issues
4. **Use meaningful task metadata** for debugging and tracking
5. **Test with small batches** before scaling up
6. **Respect unsubscribe requests** and "do not contact" flags
7. **Monitor email deliverability** and adjust templates as needed

## Troubleshooting

### Common Issues

1. **Tasks not executing**: Check if scheduler is running and cron jobs are active
2. **Email delivery failures**: Verify email service configuration and credentials
3. **LinkedIn rate limiting**: Adjust rate limiting settings and delays
4. **Database connection issues**: Ensure database service is properly initialized

### Debug Mode

Enable verbose logging to see detailed scheduler activity:

```typescript
const config = {
    // ... other config
    enableLogging: true,
    logLevel: 'debug'
};
```

### Monitoring

Use the status methods to monitor scheduler health:

```typescript
const status = scheduler.getStatus();
// Monitor pendingTasks, failedTasks, etc.
```
