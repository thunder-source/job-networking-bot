import * as cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { ContactStatus, ConversationType, ConversationDirection } from '../types/index.js';
import { IContactDocument } from '../models/Contact.js';
import { ICampaignDocument } from '../models/Campaign.js';
import { EmailService } from './emailService.js';
import { LinkedInService } from './linkedinService.js';
import DatabaseService from './databaseService.js';

export interface IScheduledTask {
    id: string;
    contactId: string;
    campaignId: string;
    type: ScheduledTaskType;
    scheduledDate: Date;
    status: ScheduledTaskStatus;
    retryCount: number;
    maxRetries: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ISchedulerConfig {
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

export enum ScheduledTaskType {
    LINKEDIN_REMINDER = 'linkedin_reminder',
    FOLLOW_UP_EMAIL = 'follow_up_email',
    FOLLOW_UP_LINKEDIN = 'follow_up_linkedin',
    THANK_YOU_EMAIL = 'thank_you_email',
    THANK_YOU_LINKEDIN = 'thank_you_linkedin',
    VALUE_ADD_EMAIL = 'value_add_email',
    FINAL_FOLLOW_UP = 'final_follow_up',
    STATUS_CHECK = 'status_check'
}

export enum ScheduledTaskStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
    RETRYING = 'retrying'
}

export class SchedulerService {
    private tasks: Map<string, IScheduledTask> = new Map();
    private cronJobs: Map<string, cron.ScheduledTask> = new Map();
    private config: ISchedulerConfig;
    private emailService: EmailService;
    private linkedinService: LinkedInService;
    private databaseService: typeof DatabaseService;
    private isRunning: boolean = false;

    constructor(
        config: ISchedulerConfig,
        emailService: EmailService,
        linkedinService: LinkedInService,
        databaseService: typeof DatabaseService
    ) {
        this.config = config;
        this.emailService = emailService;
        this.linkedinService = linkedinService;
        this.databaseService = databaseService;

        logger.info('SchedulerService initialized', { config });
    }

    /**
     * Start the scheduler service
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Scheduler is already running');
            return;
        }

        if (!this.config.enabled) {
            logger.info('Scheduler is disabled in configuration');
            return;
        }

        try {
            // Start the main scheduler cron job (runs every hour)
            this.startMainScheduler();

            // Start cleanup cron job (runs daily at midnight)
            this.startCleanupScheduler();

            this.isRunning = true;
            logger.info('Scheduler service started successfully');
        } catch (error) {
            logger.error('Failed to start scheduler service:', error);
            throw error;
        }
    }

    /**
     * Stop the scheduler service
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn('Scheduler is not running');
            return;
        }

        try {
            // Stop all cron jobs
            this.cronJobs.forEach((job, id) => {
                job.stop();
                logger.debug(`Stopped cron job: ${id}`);
            });
            this.cronJobs.clear();

            // Cancel all pending tasks
            this.tasks.forEach(task => {
                if (task.status === ScheduledTaskStatus.PENDING) {
                    task.status = ScheduledTaskStatus.CANCELLED;
                    task.updatedAt = new Date();
                }
            });

            this.isRunning = false;
            logger.info('Scheduler service stopped successfully');
        } catch (error) {
            logger.error('Failed to stop scheduler service:', error);
            throw error;
        }
    }

    /**
     * Schedule a follow-up task for a contact
     */
    async scheduleFollowUp(
        contactId: string,
        campaignId: string,
        followUpType: ScheduledTaskType,
        delayDays: number,
        metadata?: Record<string, any>
    ): Promise<string> {
        const taskId = this.generateTaskId();
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + delayDays);

        const task: IScheduledTask = {
            id: taskId,
            contactId,
            campaignId,
            type: followUpType,
            scheduledDate,
            status: ScheduledTaskStatus.PENDING,
            retryCount: 0,
            maxRetries: this.config.retrySettings.maxRetries,
            metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.tasks.set(taskId, task);

        logger.info('Follow-up task scheduled', {
            taskId,
            contactId,
            campaignId,
            followUpType,
            scheduledDate: scheduledDate.toISOString(),
            delayDays
        });

        return taskId;
    }

    /**
     * Schedule immediate thank you message after connection acceptance
     */
    async scheduleThankYouMessage(
        contactId: string,
        campaignId: string,
        platform: 'email' | 'linkedin',
        metadata?: Record<string, any>
    ): Promise<string> {
        const taskType = platform === 'email'
            ? ScheduledTaskType.THANK_YOU_EMAIL
            : ScheduledTaskType.THANK_YOU_LINKEDIN;

        return await this.scheduleFollowUp(
            contactId,
            campaignId,
            taskType,
            0, // Immediate
            metadata
        );
    }

    /**
     * Check contact status and determine next action
     */
    async checkContactStatus(contactId: string): Promise<{
        status: ContactStatus;
        nextAction: ScheduledTaskType | null;
        daysSinceLastContact: number;
        shouldContact: boolean;
    }> {
        try {
            const contact = await this.databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact not found: ${contactId}`);
            }

            const daysSinceLastContact = this.calculateDaysSinceLastContact(contact);
            const shouldContact = this.shouldContactPerson(contact);

            let nextAction: ScheduledTaskType | null = null;

            if (!shouldContact) {
                return {
                    status: contact.status,
                    nextAction: null,
                    daysSinceLastContact,
                    shouldContact: false
                };
            }

            // Determine next action based on status and days since last contact
            switch (contact.status) {
                case ContactStatus.PENDING:
                    if (daysSinceLastContact >= 3) {
                        nextAction = ScheduledTaskType.LINKEDIN_REMINDER;
                    }
                    break;

                case ContactStatus.CONNECTED:
                    if (daysSinceLastContact >= 7) {
                        nextAction = ScheduledTaskType.FOLLOW_UP_LINKEDIN;
                    }
                    break;

                case ContactStatus.RESPONDED:
                    // If they responded, we might want to send a thank you or follow up
                    if (daysSinceLastContact >= 1) {
                        nextAction = ScheduledTaskType.THANK_YOU_EMAIL;
                    }
                    break;

                case ContactStatus.NOT_INTERESTED:
                    // Don't contact if they're not interested
                    break;

                case ContactStatus.BLOCKED:
                    // Don't contact if blocked
                    break;
            }

            return {
                status: contact.status,
                nextAction,
                daysSinceLastContact,
                shouldContact
            };

        } catch (error) {
            logger.error('Error checking contact status:', error);
            throw error;
        }
    }

    /**
     * Process all pending tasks
     */
    async processPendingTasks(): Promise<void> {
        const now = new Date();
        const pendingTasks = Array.from(this.tasks.values())
            .filter(task =>
                task.status === ScheduledTaskStatus.PENDING &&
                task.scheduledDate <= now
            );

        logger.info(`Processing ${pendingTasks.length} pending tasks`);

        for (const task of pendingTasks) {
            try {
                await this.processTask(task);
            } catch (error) {
                logger.error(`Failed to process task ${task.id}:`, error);
                await this.handleTaskFailure(task, error);
            }
        }
    }

    /**
     * Process a single task
     */
    private async processTask(task: IScheduledTask): Promise<void> {
        logger.info(`Processing task: ${task.id} (${task.type})`);

        task.status = ScheduledTaskStatus.RUNNING;
        task.updatedAt = new Date();

        try {
            // Check if we should still process this task
            const contact = await this.databaseService.getContactById(task.contactId);
            if (!contact) {
                throw new Error(`Contact not found: ${task.contactId}`);
            }

            if (!this.shouldContactPerson(contact)) {
                logger.info(`Skipping task ${task.id} - contact should not be contacted`);
                task.status = ScheduledTaskStatus.CANCELLED;
                task.updatedAt = new Date();
                return;
            }

            // Execute the task based on type
            switch (task.type) {
                case ScheduledTaskType.LINKEDIN_REMINDER:
                    await this.executeLinkedInReminder(task, contact);
                    break;

                case ScheduledTaskType.FOLLOW_UP_EMAIL:
                case ScheduledTaskType.FOLLOW_UP_LINKEDIN:
                    await this.executeFollowUp(task, contact);
                    break;

                case ScheduledTaskType.THANK_YOU_EMAIL:
                case ScheduledTaskType.THANK_YOU_LINKEDIN:
                    await this.executeThankYou(task, contact);
                    break;

                case ScheduledTaskType.VALUE_ADD_EMAIL:
                    await this.executeValueAddEmail(task, contact);
                    break;

                case ScheduledTaskType.FINAL_FOLLOW_UP:
                    await this.executeFinalFollowUp(task, contact);
                    break;

                case ScheduledTaskType.STATUS_CHECK:
                    await this.executeStatusCheck(task, contact);
                    break;

                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }

            task.status = ScheduledTaskStatus.COMPLETED;
            task.updatedAt = new Date();

            logger.info(`Task completed successfully: ${task.id}`);

        } catch (error) {
            throw error;
        }
    }

    /**
     * Execute LinkedIn reminder task
     */
    private async executeLinkedInReminder(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        if (!contact.linkedinUrl) {
            throw new Error('LinkedIn URL not available for contact');
        }

        const message = this.generateLinkedInReminderMessage(contact);

        const result = await this.linkedinService.sendConnectionRequest(
            contact.linkedinUrl,
            message
        );

        if (!result.success) {
            throw new Error(`LinkedIn reminder failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.LINKEDIN_MESSAGE,
            content: message,
            direction: ConversationDirection.SENT,
            subject: 'Connection Reminder'
        });

        logger.info(`LinkedIn reminder sent to ${contact.name}`);
    }

    /**
     * Execute follow-up task
     */
    private async executeFollowUp(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        const campaign = await this.databaseService.getCampaignById(task.campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${task.campaignId}`);
        }

        const followUpNumber = this.getFollowUpNumber(contact);

        if (followUpNumber === 1) {
            // Day 7 follow-up
            await this.sendFollowUpEmail(contact, campaign, 1);
        } else if (followUpNumber === 2) {
            // Day 14 follow-up with value-add
            await this.sendValueAddEmail(contact, campaign);
        } else if (followUpNumber === 3) {
            // Day 21 final follow-up
            await this.sendFinalFollowUpEmail(contact, campaign);
        }
    }

    /**
     * Execute thank you message
     */
    private async executeThankYou(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        const campaign = await this.databaseService.getCampaignById(task.campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${task.campaignId}`);
        }

        if (task.type === ScheduledTaskType.THANK_YOU_EMAIL) {
            await this.sendThankYouEmail(contact, campaign);
        } else {
            await this.sendThankYouLinkedIn(contact, campaign);
        }
    }

    /**
     * Execute value-add email
     */
    private async executeValueAddEmail(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        const campaign = await this.databaseService.getCampaignById(task.campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${task.campaignId}`);
        }

        await this.sendValueAddEmail(contact, campaign);
    }

    /**
     * Execute final follow-up
     */
    private async executeFinalFollowUp(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        const campaign = await this.databaseService.getCampaignById(task.campaignId);
        if (!campaign) {
            throw new Error(`Campaign not found: ${task.campaignId}`);
        }

        await this.sendFinalFollowUpEmail(contact, campaign);
    }

    /**
     * Execute status check
     */
    private async executeStatusCheck(task: IScheduledTask, contact: IContactDocument): Promise<void> {
        const statusInfo = await this.checkContactStatus(contact._id!.toString());

        logger.info(`Status check for ${contact.name}:`, {
            status: statusInfo.status,
            nextAction: statusInfo.nextAction,
            daysSinceLastContact: statusInfo.daysSinceLastContact,
            shouldContact: statusInfo.shouldContact
        });

        // If there's a next action, schedule it
        if (statusInfo.nextAction && statusInfo.shouldContact) {
            await this.scheduleFollowUp(
                contact._id!.toString(),
                task.campaignId,
                statusInfo.nextAction,
                0 // Schedule immediately
            );
        }
    }

    /**
     * Send follow-up email
     */
    private async sendFollowUpEmail(
        contact: IContactDocument,
        campaign: ICampaignDocument,
        followUpNumber: number
    ): Promise<void> {
        const emailData = {
            to: contact.email,
            templateType: 'followUp' as const,
            variables: {
                name: contact.name,
                company: contact.company || 'your company',
                topic: 'our previous conversation',
                industry: contact.industry || 'your industry',
                specificTopic: 'the opportunities we discussed'
            },
            campaignId: campaign._id!.toString()
        };

        const result = await this.emailService.sendEmail(emailData);

        if (!result.success) {
            throw new Error(`Follow-up email failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.EMAIL,
            content: `Follow-up email #${followUpNumber}`,
            direction: ConversationDirection.SENT,
            subject: `Following up on our conversation`
        });

        logger.info(`Follow-up email #${followUpNumber} sent to ${contact.name}`);
    }

    /**
     * Send value-add email with article/insight
     */
    private async sendValueAddEmail(contact: IContactDocument, campaign: ICampaignDocument): Promise<void> {
        const emailData = {
            to: contact.email,
            templateType: 'followUp' as const,
            variables: {
                name: contact.name,
                company: contact.company || 'your company',
                topic: 'our previous conversation',
                industry: contact.industry || 'your industry',
                specificTopic: 'this industry insight I thought you might find valuable'
            },
            campaignId: campaign._id!.toString()
        };

        const result = await this.emailService.sendEmail(emailData);

        if (!result.success) {
            throw new Error(`Value-add email failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.EMAIL,
            content: 'Value-add email with industry insight',
            direction: ConversationDirection.SENT,
            subject: 'Industry insight you might find valuable'
        });

        logger.info(`Value-add email sent to ${contact.name}`);
    }

    /**
     * Send final follow-up email
     */
    private async sendFinalFollowUpEmail(contact: IContactDocument, campaign: ICampaignDocument): Promise<void> {
        const emailData = {
            to: contact.email,
            templateType: 'followUp' as const,
            variables: {
                name: contact.name,
                company: contact.company || 'your company',
                topic: 'our previous conversation',
                industry: contact.industry || 'your industry',
                specificTopic: 'this final opportunity to connect'
            },
            campaignId: campaign._id!.toString()
        };

        const result = await this.emailService.sendEmail(emailData);

        if (!result.success) {
            throw new Error(`Final follow-up email failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.EMAIL,
            content: 'Final gentle follow-up email',
            direction: ConversationDirection.SENT,
            subject: 'Final follow-up - no pressure'
        });

        // Mark contact as not interested after final follow-up
        await contact.updateStatus(ContactStatus.NOT_INTERESTED);

        logger.info(`Final follow-up email sent to ${contact.name}`);
    }

    /**
     * Send thank you email
     */
    private async sendThankYouEmail(contact: IContactDocument, campaign: ICampaignDocument): Promise<void> {
        const emailData = {
            to: contact.email,
            templateType: 'thankYou' as const,
            variables: {
                name: contact.name,
                topic: 'our conversation',
                specificInsight: 'your perspective',
                project: 'my current work'
            },
            campaignId: campaign._id!.toString()
        };

        const result = await this.emailService.sendEmail(emailData);

        if (!result.success) {
            throw new Error(`Thank you email failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.EMAIL,
            content: 'Thank you email',
            direction: ConversationDirection.SENT,
            subject: 'Thank you for connecting!'
        });

        logger.info(`Thank you email sent to ${contact.name}`);
    }

    /**
     * Send thank you LinkedIn message
     */
    private async sendThankYouLinkedIn(contact: IContactDocument, campaign: ICampaignDocument): Promise<void> {
        if (!contact.linkedinUrl) {
            throw new Error('LinkedIn URL not available for contact');
        }

        const message = this.generateThankYouLinkedInMessage(contact);

        const result = await this.linkedinService.sendConnectionRequest(
            contact.linkedinUrl,
            message
        );

        if (!result.success) {
            throw new Error(`Thank you LinkedIn message failed: ${result.error}`);
        }

        // Update contact with conversation history
        await contact.addConversation({
            date: new Date(),
            type: ConversationType.LINKEDIN_MESSAGE,
            content: message,
            direction: ConversationDirection.SENT,
            subject: 'Thank you for connecting!'
        });

        logger.info(`Thank you LinkedIn message sent to ${contact.name}`);
    }

    /**
     * Handle task failure with retry logic
     */
    private async handleTaskFailure(task: IScheduledTask, error: any): Promise<void> {
        task.retryCount++;
        task.updatedAt = new Date();

        if (task.retryCount < task.maxRetries) {
            task.status = ScheduledTaskStatus.RETRYING;

            // Calculate retry delay with exponential backoff
            const delay = this.config.retrySettings.exponentialBackoff
                ? this.config.retrySettings.retryDelay * Math.pow(2, task.retryCount - 1)
                : this.config.retrySettings.retryDelay;

            // Reschedule the task
            setTimeout(() => {
                task.status = ScheduledTaskStatus.PENDING;
                task.scheduledDate = new Date();
                task.updatedAt = new Date();
            }, delay);

            logger.warn(`Task ${task.id} failed, retrying in ${delay}ms (attempt ${task.retryCount}/${task.maxRetries})`, {
                error: error.message
            });
        } else {
            task.status = ScheduledTaskStatus.FAILED;
            logger.error(`Task ${task.id} failed permanently after ${task.maxRetries} attempts`, {
                error: error.message
            });
        }
    }

    /**
     * Start the main scheduler cron job
     */
    private startMainScheduler(): void {
        const cronJob = cron.schedule('0 * * * *', async () => {
            try {
                await this.processPendingTasks();
            } catch (error) {
                logger.error('Error in main scheduler:', error);
            }
        }, {
            timezone: this.config.timezone
        });

        this.cronJobs.set('main-scheduler', cronJob);
        logger.info('Main scheduler started (runs every hour)');
    }

    /**
     * Start the cleanup scheduler cron job
     */
    private startCleanupScheduler(): void {
        const cronJob = cron.schedule('0 0 * * *', async () => {
            try {
                await this.cleanupCompletedTasks();
            } catch (error) {
                logger.error('Error in cleanup scheduler:', error);
            }
        }, {
            timezone: this.config.timezone
        });

        this.cronJobs.set('cleanup-scheduler', cronJob);
        logger.info('Cleanup scheduler started (runs daily at midnight)');
    }

    /**
     * Clean up completed and failed tasks older than 30 days
     */
    private async cleanupCompletedTasks(): Promise<void> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const tasksToCleanup = Array.from(this.tasks.values())
            .filter(task =>
                (task.status === ScheduledTaskStatus.COMPLETED ||
                    task.status === ScheduledTaskStatus.FAILED ||
                    task.status === ScheduledTaskStatus.CANCELLED) &&
                task.updatedAt < thirtyDaysAgo
            );

        for (const task of tasksToCleanup) {
            this.tasks.delete(task.id);
        }

        logger.info(`Cleaned up ${tasksToCleanup.length} old tasks`);
    }

    /**
     * Calculate days since last contact
     */
    private calculateDaysSinceLastContact(contact: IContactDocument): number {
        if (!contact.lastContactDate) {
            return 0;
        }

        const now = new Date();
        const diffTime = Math.abs(now.getTime() - contact.lastContactDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Check if we should contact this person
     */
    private shouldContactPerson(contact: IContactDocument): boolean {
        // Check for "do not contact" flags
        if (contact.tags.includes('do_not_contact') ||
            contact.tags.includes('blocked') ||
            contact.tags.includes('unsubscribed')) {
            return false;
        }

        // Check status
        if (contact.status === ContactStatus.BLOCKED ||
            contact.status === ContactStatus.NOT_INTERESTED) {
            return false;
        }

        return true;
    }

    /**
     * Get follow-up number based on conversation history
     */
    private getFollowUpNumber(contact: IContactDocument): number {
        const followUpEmails = contact.conversationHistory.filter(
            conv => conv.type === ConversationType.EMAIL &&
                conv.direction === ConversationDirection.SENT &&
                conv.content.includes('follow-up')
        );

        return followUpEmails.length + 1;
    }

    /**
     * Generate LinkedIn reminder message
     */
    private generateLinkedInReminderMessage(contact: IContactDocument): string {
        return `Hi ${contact.name}, I sent you a connection request a few days ago. I'd love to connect and learn more about your work at ${contact.company || 'your company'}. Would you be open to a brief conversation?`;
    }

    /**
     * Generate thank you LinkedIn message
     */
    private generateThankYouLinkedInMessage(contact: IContactDocument): string {
        return `Thank you for connecting, ${contact.name}! I'm excited to learn more about your work at ${contact.company || 'your company'}. Looking forward to staying in touch!`;
    }

    /**
     * Generate task ID
     */
    private generateTaskId(): string {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        totalTasks: number;
        pendingTasks: number;
        completedTasks: number;
        failedTasks: number;
        activeCronJobs: number;
    } {
        const tasks = Array.from(this.tasks.values());

        return {
            isRunning: this.isRunning,
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === ScheduledTaskStatus.PENDING).length,
            completedTasks: tasks.filter(t => t.status === ScheduledTaskStatus.COMPLETED).length,
            failedTasks: tasks.filter(t => t.status === ScheduledTaskStatus.FAILED).length,
            activeCronJobs: this.cronJobs.size
        };
    }

    /**
     * Get tasks by contact ID
     */
    getTasksByContact(contactId: string): IScheduledTask[] {
        return Array.from(this.tasks.values())
            .filter(task => task.contactId === contactId);
    }

    /**
     * Cancel a specific task
     */
    cancelTask(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (task && task.status === ScheduledTaskStatus.PENDING) {
            task.status = ScheduledTaskStatus.CANCELLED;
            task.updatedAt = new Date();
            logger.info(`Task cancelled: ${taskId}`);
            return true;
        }
        return false;
    }

    /**
     * Cancel all tasks for a contact
     */
    cancelTasksForContact(contactId: string): number {
        const tasks = this.getTasksByContact(contactId);
        let cancelledCount = 0;

        for (const task of tasks) {
            if (this.cancelTask(task.id)) {
                cancelledCount++;
            }
        }

        logger.info(`Cancelled ${cancelledCount} tasks for contact ${contactId}`);
        return cancelledCount;
    }
}

export default SchedulerService;
