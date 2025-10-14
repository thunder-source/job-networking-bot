import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';

// Simple rate limiter for email sending
class EmailRateLimiter {
    private requests: Map<string, number[]> = new Map();
    private maxRequests: number;
    private windowMs: number;

    constructor(maxRequests: number, windowMs: number) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    async canMakeRequest(key: string): Promise<boolean> {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }

        const userRequests = this.requests.get(key)!;

        // Remove old requests outside the window
        const validRequests = userRequests.filter(time => time > windowStart);
        this.requests.set(key, validRequests);

        if (validRequests.length >= this.maxRequests) {
            return false;
        }

        validRequests.push(now);
        return true;
    }
}

// Email Service for sending emails with tracking, templates, and rate limiting
export class EmailService {
    private transporter: Transporter;
    private rateLimiter: EmailRateLimiter;
    private trackingBaseUrl: string;
    private unsubscribeBaseUrl: string;

    // Email templates
    public readonly emailTemplates = {
        coldOutreach: {
            name: 'Cold Outreach Email',
            subject: 'Quick question about {{company}} opportunities',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>{{subject}}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2c3e50; margin-top: 0;">Hi {{name}},</h2>
                        <p>I hope this email finds you well. I came across your profile and was impressed by your work at {{company}} in {{position}}.</p>
                        <p>I'm particularly interested in your experience with {{technology}} and would love to learn more about how {{company}} approaches {{topic}}.</p>
                        <p>Would you be open to a brief 15-minute conversation this week? I'd be happy to share some insights I've gained in {{industry}} that might be relevant to your work.</p>
                        <p>Best regards,<br>{{senderName}}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            <a href="{{unsubscribeUrl}}" style="color: #666; text-decoration: none;">Unsubscribe</a> | 
                            <a href="{{trackingUrl}}" style="color: #666; text-decoration: none;">View Online</a>
                        </p>
                    </div>
                    <img src="{{trackingPixel}}" width="1" height="1" style="display: none;" alt="" />
                </body>
                </html>
            `,
            text: `Hi {{name}},\n\nI hope this email finds you well. I came across your profile and was impressed by your work at {{company}} in {{position}}.\n\nI'm particularly interested in your experience with {{technology}} and would love to learn more about how {{company}} approaches {{topic}}.\n\nWould you be open to a brief 15-minute conversation this week? I'd be happy to share some insights I've gained in {{industry}} that might be relevant to your work.\n\nBest regards,\n{{senderName}}`
        },
        followUp: {
            name: 'Follow-up Email',
            subject: 'Following up on {{topic}}',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>{{subject}}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2c3e50; margin-top: 0;">Hi {{name}},</h2>
                        <p>I wanted to follow up on my previous email about {{topic}}.</p>
                        <p>I understand you're busy, but I believe there could be mutual value in connecting. I have some insights about {{industry}} trends that might be relevant to your work at {{company}}.</p>
                        <p>If you're interested, I'd be happy to share a brief case study I've been working on that relates to {{specificTopic}}.</p>
                        <p>Would you be available for a quick call this week or next?</p>
                        <p>Best regards,<br>{{senderName}}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            <a href="{{unsubscribeUrl}}" style="color: #666; text-decoration: none;">Unsubscribe</a> | 
                            <a href="{{trackingUrl}}" style="color: #666; text-decoration: none;">View Online</a>
                        </p>
                    </div>
                    <img src="{{trackingPixel}}" width="1" height="1" style="display: none;" alt="" />
                </body>
                </html>
            `,
            text: `Hi {{name}},\n\nI wanted to follow up on my previous email about {{topic}}.\n\nI understand you're busy, but I believe there could be mutual value in connecting. I have some insights about {{industry}} trends that might be relevant to your work at {{company}}.\n\nIf you're interested, I'd be happy to share a brief case study I've been working on that relates to {{specificTopic}}.\n\nWould you be available for a quick call this week or next?\n\nBest regards,\n{{senderName}}`
        },
        thankYou: {
            name: 'Thank You Email',
            subject: 'Thank you for connecting!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>{{subject}}</title>
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #2c3e50; margin-top: 0;">Thank you, {{name}}!</h2>
                        <p>I really appreciate you taking the time to connect and share insights about {{topic}}.</p>
                        <p>Your perspective on {{specificInsight}} was particularly valuable, and I'll definitely keep that in mind as I continue working on {{project}}.</p>
                        <p>I look forward to staying in touch and potentially collaborating in the future. Please don't hesitate to reach out if you have any questions or if there's anything I can help with.</p>
                        <p>Best regards,<br>{{senderName}}</p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            <a href="{{unsubscribeUrl}}" style="color: #666; text-decoration: none;">Unsubscribe</a> | 
                            <a href="{{trackingUrl}}" style="color: #666; text-decoration: none;">View Online</a>
                        </p>
                    </div>
                    <img src="{{trackingPixel}}" width="1" height="1" style="display: none;" alt="" />
                </body>
                </html>
            `,
            text: `Thank you, {{name}}!\n\nI really appreciate you taking the time to connect and share insights about {{topic}}.\n\nYour perspective on {{specificInsight}} was particularly valuable, and I'll definitely keep that in mind as I continue working on {{project}}.\n\nI look forward to staying in touch and potentially collaborating in the future. Please don't hesitate to reach out if you have any questions or if there's anything I can help with.\n\nBest regards,\n{{senderName}}`
        }
    };

    constructor(config: IEmailConfig) {
        this.trackingBaseUrl = config.trackingBaseUrl || 'https://your-domain.com/track';
        this.unsubscribeBaseUrl = config.unsubscribeBaseUrl || 'https://your-domain.com/unsubscribe';

        // Initialize rate limiter
        this.rateLimiter = new EmailRateLimiter(
            config.rateLimit?.maxEmailsPerHour || 50,
            config.rateLimit?.windowMs || 60 * 60 * 1000 // 1 hour
        );

        // Create transporter based on provider
        this.transporter = this.createTransporter(config);
    }

    /**
     * Send email using template
     * @param emailData - Email data and template information
     * @returns Promise<IEmailResult> - Send result with tracking information
     */
    async sendEmail(emailData: IEmailData): Promise<IEmailResult> {
        try {
            // Validate email data
            const validationErrors = this.validateEmailData(emailData);
            if (validationErrors.length > 0) {
                throw new Error(`Email validation failed: ${validationErrors.join(', ')}`);
            }

            // Check rate limits
            await this.checkRateLimit(emailData.to);

            // Generate tracking data
            const trackingData = this.generateTrackingData(emailData);

            // Get template
            const template = this.getTemplate(emailData.templateType);

            // Render template with data
            const renderedContent = this.renderTemplate(template, {
                ...emailData.variables,
                ...trackingData
            });

            // Prepare email options
            const mailOptions: SendMailOptions = {
                from: emailData.from || process.env.EMAIL_FROM,
                to: emailData.to,
                subject: renderedContent.subject,
                html: renderedContent.html,
                text: renderedContent.text,
                headers: {
                    'X-Tracking-ID': trackingData.trackingId,
                    'X-Campaign-ID': emailData.campaignId || 'default',
                    'List-Unsubscribe': `<${trackingData.unsubscribeUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
                }
            };

            // Send email
            const info = await this.transporter.sendMail(mailOptions);

            // Log email sent
            logger.info(`Email sent successfully: ${emailData.to} (${emailData.templateType})`);

            return {
                success: true,
                messageId: info.messageId,
                trackingId: trackingData.trackingId,
                sentAt: new Date(),
                recipient: emailData.to,
                templateType: emailData.templateType
            };

        } catch (error) {
            logger.error('Error sending email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                sentAt: new Date(),
                recipient: emailData.to,
                templateType: emailData.templateType
            };
        }
    }

    /**
     * Send bulk emails with rate limiting
     * @param emails - Array of email data
     * @param options - Bulk send options
     * @returns Promise<IEmailResult[]> - Array of send results
     */
    async sendBulkEmails(emails: IEmailData[], options: IBulkEmailOptions = {}): Promise<IEmailResult[]> {
        const results: IEmailResult[] = [];
        const delay = options.delayBetweenEmails || 1000; // 1 second default delay

        logger.info(`Starting bulk email send: ${emails.length} emails`);

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];

            try {
                // Add delay between emails to respect rate limits
                if (i > 0) {
                    await this.sleep(delay);
                }

                const result = await this.sendEmail(email);
                results.push(result);

                // Log progress
                if ((i + 1) % 10 === 0) {
                    logger.info(`Bulk email progress: ${i + 1}/${emails.length} sent`);
                }

            } catch (error) {
                logger.error(`Error sending email ${i + 1}:`, error);
                results.push({
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    sentAt: new Date(),
                    recipient: email.to,
                    templateType: email.templateType
                });
            }
        }

        logger.info(`Bulk email send completed: ${results.length} emails processed`);
        return results;
    }

    /**
     * Track email open
     * @param trackingId - Tracking ID from email
     * @returns Promise<void>
     */
    async trackEmailOpen(trackingId: string): Promise<void> {
        try {
            // In a real implementation, you would store this in a database
            logger.info(`Email opened: ${trackingId}`);

            // You could store this in MongoDB or another database
            // await this.storeEmailEvent('open', trackingId, new Date());

        } catch (error) {
            logger.error('Error tracking email open:', error);
        }
    }

    /**
     * Handle unsubscribe request
     * @param trackingId - Tracking ID from unsubscribe link
     * @returns Promise<void>
     */
    async handleUnsubscribe(trackingId: string): Promise<void> {
        try {
            // In a real implementation, you would store this in a database
            logger.info(`User unsubscribed: ${trackingId}`);

            // You could store this in MongoDB or another database
            // await this.storeEmailEvent('unsubscribe', trackingId, new Date());

        } catch (error) {
            logger.error('Error handling unsubscribe:', error);
        }
    }

    /**
     * Validate email address
     * @param email - Email address to validate
     * @returns boolean - True if valid
     */
    validateEmail(email: string): boolean {
        return validator.isEmail(email);
    }

    /**
     * Get email template by type
     * @param templateType - Template type
     * @returns IEmailTemplate - Email template
     */
    getTemplate(templateType: keyof typeof this.emailTemplates): IEmailTemplate {
        const template = this.emailTemplates[templateType];
        if (!template) {
            throw new Error(`Template not found: ${templateType}`);
        }
        return template;
    }

    /**
     * Create custom email template
     * @param template - Template data
     * @returns void
     */
    addCustomTemplate(template: IEmailTemplate): void {
        this.emailTemplates[template.name as keyof typeof this.emailTemplates] = template;
    }

    /**
     * Get email statistics
     * @param campaignId - Campaign ID (optional)
     * @returns Promise<IEmailStats> - Email statistics
     */
    async getEmailStats(campaignId?: string): Promise<IEmailStats> {
        // In a real implementation, you would query your database
        return {
            totalSent: 0,
            totalOpened: 0,
            totalUnsubscribed: 0,
            openRate: 0,
            unsubscribeRate: 0,
            campaignId
        };
    }

    /**
     * Test email configuration
     * @returns Promise<boolean> - True if configuration is valid
     */
    async testConfiguration(): Promise<boolean> {
        try {
            await this.transporter.verify();
            logger.info('Email configuration is valid');
            return true;
        } catch (error) {
            logger.error('Email configuration test failed:', error);
            return false;
        }
    }

    /**
     * Create transporter based on configuration
     */
    private createTransporter(config: IEmailConfig): Transporter {
        const { provider, credentials } = config;

        switch (provider) {
            case 'gmail':
                return nodemailer.createTransporter({
                    service: 'gmail',
                    auth: {
                        user: credentials.email,
                        pass: credentials.password
                    }
                });

            case 'outlook':
                return nodemailer.createTransporter({
                    service: 'hotmail',
                    auth: {
                        user: credentials.email,
                        pass: credentials.password
                    }
                });

            case 'custom':
                return nodemailer.createTransporter({
                    host: credentials.host,
                    port: credentials.port || 587,
                    secure: credentials.secure || false,
                    auth: {
                        user: credentials.email,
                        pass: credentials.password
                    }
                });

            default:
                throw new Error(`Unsupported email provider: ${provider}`);
        }
    }

    /**
     * Validate email data
     */
    private validateEmailData(emailData: IEmailData): string[] {
        const errors: string[] = [];

        if (!emailData.to || !this.validateEmail(emailData.to)) {
            errors.push('Invalid recipient email address');
        }

        if (!emailData.templateType) {
            errors.push('Template type is required');
        }

        if (!emailData.variables) {
            errors.push('Variables are required');
        }

        return errors;
    }

    /**
     * Check rate limits
     */
    private async checkRateLimit(email: string): Promise<void> {
        const canSend = await this.rateLimiter.canMakeRequest(email);
        if (!canSend) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
    }

    /**
     * Generate tracking data
     */
    private generateTrackingData(emailData: IEmailData): ITrackingData {
        const trackingId = uuidv4();

        return {
            trackingId,
            trackingUrl: `${this.trackingBaseUrl}/${trackingId}`,
            trackingPixel: `${this.trackingBaseUrl}/pixel/${trackingId}`,
            unsubscribeUrl: `${this.unsubscribeBaseUrl}/${trackingId}`,
            campaignId: emailData.campaignId || 'default'
        };
    }

    /**
     * Render template with variables
     */
    private renderTemplate(template: IEmailTemplate, variables: Record<string, any>): IRenderedTemplate {
        const render = (content: string): string => {
            return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return variables[key] || match;
            });
        };

        return {
            subject: render(template.subject),
            html: render(template.html),
            text: render(template.text)
        };
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Interface definitions
export interface IEmailConfig {
    provider: 'gmail' | 'outlook' | 'custom';
    credentials: IEmailCredentials;
    trackingBaseUrl?: string;
    unsubscribeBaseUrl?: string;
    rateLimit?: {
        maxEmailsPerHour: number;
        windowMs: number;
    };
}

export interface IEmailCredentials {
    email: string;
    password: string;
    host?: string;
    port?: number;
    secure?: boolean;
}

export interface IEmailData {
    to: string;
    from?: string;
    templateType: keyof typeof EmailService.prototype.emailTemplates;
    variables: Record<string, any>;
    campaignId?: string;
    priority?: 'high' | 'normal' | 'low';
}

export interface IEmailTemplate {
    name: string;
    subject: string;
    html: string;
    text: string;
}

export interface IEmailResult {
    success: boolean;
    messageId?: string;
    trackingId?: string;
    error?: string;
    sentAt: Date;
    recipient: string;
    templateType: string;
}

export interface IBulkEmailOptions {
    delayBetweenEmails?: number;
    maxConcurrent?: number;
    stopOnError?: boolean;
}

export interface ITrackingData {
    trackingId: string;
    trackingUrl: string;
    trackingPixel: string;
    unsubscribeUrl: string;
    campaignId: string;
}

export interface IRenderedTemplate {
    subject: string;
    html: string;
    text: string;
}

export interface IEmailStats {
    totalSent: number;
    totalOpened: number;
    totalUnsubscribed: number;
    openRate: number;
    unsubscribeRate: number;
    campaignId?: string;
}

export default EmailService;
