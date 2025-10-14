import { SchedulerService, ISchedulerConfig } from '../src/services/schedulerService.js';
import { EmailService } from '../src/services/emailService.js';
import { LinkedInService } from '../src/services/linkedinService.js';
import DatabaseService from '../src/services/databaseService.js';
import { logger } from '../src/utils/logger.js';

// Example configuration for the scheduler
const schedulerConfig: ISchedulerConfig = {
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
        delayBetweenTasks: 60000 // 1 minute between tasks
    },
    retrySettings: {
        maxRetries: 3,
        retryDelay: 300000, // 5 minutes
        exponentialBackoff: true
    }
};

// Example email service configuration
const emailConfig = {
    provider: 'gmail' as const,
    credentials: {
        email: process.env.EMAIL_USER || 'your-email@gmail.com',
        password: process.env.EMAIL_PASSWORD || 'your-app-password'
    },
    trackingBaseUrl: 'https://your-domain.com/track',
    unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe',
    rateLimit: {
        maxEmailsPerHour: 50,
        windowMs: 60 * 60 * 1000
    }
};

// Example LinkedIn service configuration
const linkedinConfig = {
    headless: true,
    userDataDir: './linkedin-data',
    cookiesPath: './linkedin-cookies.json',
    timeout: 30000,
    retryAttempts: 3,
    enableLogging: true
};

async function runSchedulerExample() {
    try {
        logger.info('Starting Scheduler Service Example');

        // Initialize services
        const emailService = new EmailService(emailConfig);
        const linkedinService = new LinkedInService(linkedinConfig);
        const databaseService = DatabaseService;

        // Initialize database connection
        await databaseService.initialize();

        // Create scheduler service
        const scheduler = new SchedulerService(
            schedulerConfig,
            emailService,
            linkedinService,
            databaseService
        );

        // Start the scheduler
        await scheduler.start();

        // Example: Schedule a follow-up for a contact
        const contactId = '507f1f77bcf86cd799439011'; // Example MongoDB ObjectId
        const campaignId = '507f1f77bcf86cd799439012'; // Example MongoDB ObjectId

        // Schedule day 3 LinkedIn reminder
        const reminderTaskId = await scheduler.scheduleFollowUp(
            contactId,
            campaignId,
            'linkedin_reminder' as any,
            3, // 3 days from now
            { reason: 'Connection pending reminder' }
        );

        logger.info(`Scheduled LinkedIn reminder: ${reminderTaskId}`);

        // Schedule day 7 follow-up email
        const followUpTaskId = await scheduler.scheduleFollowUp(
            contactId,
            campaignId,
            'follow_up_email' as any,
            7, // 7 days from now
            { followUpNumber: 1 }
        );

        logger.info(`Scheduled follow-up email: ${followUpTaskId}`);

        // Schedule day 14 value-add email
        const valueAddTaskId = await scheduler.scheduleFollowUp(
            contactId,
            campaignId,
            'value_add_email' as any,
            14, // 14 days from now
            { includeArticle: true, topic: 'industry insights' }
        );

        logger.info(`Scheduled value-add email: ${valueAddTaskId}`);

        // Schedule day 21 final follow-up
        const finalTaskId = await scheduler.scheduleFollowUp(
            contactId,
            campaignId,
            'final_follow_up' as any,
            21, // 21 days from now
            { isFinal: true }
        );

        logger.info(`Scheduled final follow-up: ${finalTaskId}`);

        // Example: Schedule immediate thank you message
        const thankYouTaskId = await scheduler.scheduleThankYouMessage(
            contactId,
            campaignId,
            'email',
            { connectionAccepted: true, platform: 'linkedin' }
        );

        logger.info(`Scheduled thank you message: ${thankYouTaskId}`);

        // Example: Check contact status
        const statusInfo = await scheduler.checkContactStatus(contactId);
        logger.info('Contact status check:', statusInfo);

        // Get scheduler status
        const status = scheduler.getStatus();
        logger.info('Scheduler status:', status);

        // Get tasks for a specific contact
        const contactTasks = scheduler.getTasksByContact(contactId);
        logger.info(`Tasks for contact ${contactId}:`, contactTasks);

        // Example: Cancel a specific task
        const cancelled = scheduler.cancelTask(reminderTaskId);
        logger.info(`Task cancellation result: ${cancelled}`);

        // Example: Cancel all tasks for a contact
        const cancelledCount = scheduler.cancelTasksForContact(contactId);
        logger.info(`Cancelled ${cancelledCount} tasks for contact`);

        // Keep the scheduler running for demonstration
        logger.info('Scheduler is running. Press Ctrl+C to stop.');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down scheduler...');
            await scheduler.stop();
            await databaseService.cleanup();
            process.exit(0);
        });

        // Keep the process alive
        setInterval(() => {
            const currentStatus = scheduler.getStatus();
            logger.info('Scheduler heartbeat:', {
                isRunning: currentStatus.isRunning,
                pendingTasks: currentStatus.pendingTasks,
                completedTasks: currentStatus.completedTasks
            });
        }, 300000); // Log status every 5 minutes

    } catch (error) {
        logger.error('Scheduler example failed:', error);
        process.exit(1);
    }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runSchedulerExample();
}

export { runSchedulerExample };
