import winston from 'winston';
import nodemailer, { Transporter } from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/winstonLogger.js';

export interface ErrorAlertConfig {
    enabled: boolean;
    email: {
        enabled: boolean;
        recipients: string[];
        smtp: {
            host: string;
            port: number;
            secure: boolean;
            auth: {
                user: string;
                pass: string;
            };
        };
    };
    slack?: {
        enabled: boolean;
        webhookUrl: string;
        channel?: string;
    };
    criticalErrorThreshold: number; // Number of critical errors before alert
    errorWindowMs: number; // Time window for error counting
}

export interface ErrorContext {
    service: string;
    operation: string;
    userId?: string;
    sessionId?: string;
    metadata?: any;
    stack?: string;
}

export interface CriticalError extends Error {
    context: ErrorContext;
    errorId: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryable: boolean;
    recoveryActions?: string[];
}

class ErrorHandler {
    private config: ErrorAlertConfig;
    private emailTransporter: Transporter | null = null;
    private errorCounts: Map<string, { count: number; firstOccurrence: Date }> = new Map();
    private stateBackupPath: string;
    private isShuttingDown: boolean = false;

    constructor(config: ErrorAlertConfig) {
        this.config = config;
        this.stateBackupPath = path.join(process.cwd(), 'backups', 'error-state.json');
        this.initializeEmailTransporter();
        this.setupGlobalErrorHandlers();
        this.loadErrorState();
    }

    /**
     * Initialize email transporter for alerts
     */
    private initializeEmailTransporter(): void {
        if (this.config.email.enabled) {
            try {
                this.emailTransporter = nodemailer.createTransporter({
                    host: this.config.email.smtp.host,
                    port: this.config.email.smtp.port,
                    secure: this.config.email.smtp.secure,
                    auth: this.config.email.smtp.auth
                });
                logger.systemEvent('Email transporter initialized for error alerts');
            } catch (error) {
                logger.error('Failed to initialize email transporter for error alerts', { error });
            }
        }
    }

    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers(): void {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error: Error) => {
            const criticalError = this.createCriticalError(
                error,
                {
                    service: 'system',
                    operation: 'uncaughtException',
                    stack: error.stack
                },
                'critical',
                false
            );

            this.handleCriticalError(criticalError);
            this.gracefulShutdown('uncaughtException');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            const criticalError = this.createCriticalError(
                error,
                {
                    service: 'system',
                    operation: 'unhandledRejection',
                    stack: error.stack,
                    metadata: { reason, promise: promise.toString() }
                },
                'critical',
                true
            );

            this.handleCriticalError(criticalError);
        });

        // Handle SIGTERM and SIGINT for graceful shutdown
        process.on('SIGTERM', () => {
            logger.systemEvent('SIGTERM received, initiating graceful shutdown');
            this.gracefulShutdown('SIGTERM');
        });

        process.on('SIGINT', () => {
            logger.systemEvent('SIGINT received, initiating graceful shutdown');
            this.gracefulShutdown('SIGINT');
        });

        // Handle process warnings
        process.on('warning', (warning) => {
            logger.warn('Process warning', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });
    }

    /**
     * Create a critical error object
     */
    private createCriticalError(
        error: Error,
        context: ErrorContext,
        severity: 'low' | 'medium' | 'high' | 'critical',
        retryable: boolean = true
    ): CriticalError {
        const criticalError = Object.assign(error, {
            context,
            errorId: uuidv4(),
            timestamp: new Date(),
            severity,
            retryable,
            recoveryActions: this.getRecoveryActions(context.service, error.message)
        }) as CriticalError;

        return criticalError;
    }

    /**
     * Get recovery actions based on service and error
     */
    private getRecoveryActions(service: string, errorMessage: string): string[] {
        const actions: string[] = [];

        switch (service) {
            case 'linkedin':
                if (errorMessage.includes('rate limit') || errorMessage.includes('jail')) {
                    actions.push('Wait for rate limit reset', 'Reduce automation frequency', 'Check LinkedIn account status');
                } else if (errorMessage.includes('login') || errorMessage.includes('authentication')) {
                    actions.push('Re-authenticate LinkedIn account', 'Check credentials', 'Clear browser cache');
                } else if (errorMessage.includes('browser') || errorMessage.includes('page')) {
                    actions.push('Restart browser', 'Check network connection', 'Update browser drivers');
                }
                break;

            case 'email':
                if (errorMessage.includes('smtp') || errorMessage.includes('connection')) {
                    actions.push('Check SMTP settings', 'Verify network connection', 'Check email provider status');
                } else if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
                    actions.push('Verify email credentials', 'Check app passwords', 'Enable 2FA if required');
                }
                break;

            case 'database':
                actions.push('Check database connection', 'Verify database credentials', 'Check disk space');
                break;

            case 'ai':
                if (errorMessage.includes('api key') || errorMessage.includes('authentication')) {
                    actions.push('Verify API key', 'Check API quota', 'Update API credentials');
                } else if (errorMessage.includes('rate limit')) {
                    actions.push('Wait for API rate limit reset', 'Reduce API call frequency');
                }
                break;

            default:
                actions.push('Check service configuration', 'Restart service', 'Review logs for details');
        }

        return actions;
    }

    /**
     * Handle critical errors with alerting and recovery
     */
    public async handleCriticalError(error: CriticalError): Promise<void> {
        try {
            // Log the critical error
            logger.error('Critical error occurred', {
                errorId: error.errorId,
                message: error.message,
                service: error.context.service,
                operation: error.context.operation,
                severity: error.severity,
                retryable: error.retryable,
                stack: error.stack,
                metadata: error.context.metadata,
                recoveryActions: error.recoveryActions
            });

            // Track error frequency
            this.trackErrorFrequency(error);

            // Check if we should send alerts
            if (this.shouldSendAlert(error)) {
                await this.sendErrorAlert(error);
            }

            // Save error state
            await this.saveErrorState();

            // Attempt recovery for retryable errors
            if (error.retryable && error.severity !== 'critical') {
                await this.attemptRecovery(error);
            }

        } catch (handlingError) {
            logger.error('Failed to handle critical error', {
                originalError: error.message,
                handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error'
            });
        }
    }

    /**
     * Track error frequency for alerting
     */
    private trackErrorFrequency(error: CriticalError): void {
        const key = `${error.context.service}:${error.context.operation}`;
        const now = new Date();

        if (this.errorCounts.has(key)) {
            const entry = this.errorCounts.get(key)!;

            // Reset counter if outside the error window
            if (now.getTime() - entry.firstOccurrence.getTime() > this.config.errorWindowMs) {
                this.errorCounts.set(key, { count: 1, firstOccurrence: now });
            } else {
                entry.count++;
            }
        } else {
            this.errorCounts.set(key, { count: 1, firstOccurrence: now });
        }
    }

    /**
     * Check if we should send an alert
     */
    private shouldSendAlert(error: CriticalError): boolean {
        if (!this.config.enabled) return false;

        const key = `${error.context.service}:${error.context.operation}`;
        const entry = this.errorCounts.get(key);

        return error.severity === 'critical' ||
            (entry && entry.count >= this.config.criticalErrorThreshold);
    }

    /**
     * Send error alert via email
     */
    private async sendErrorAlert(error: CriticalError): Promise<void> {
        if (!this.config.email.enabled || !this.emailTransporter) {
            return;
        }

        try {
            const subject = `[${error.severity.toUpperCase()}] Cold Email Bot Error Alert - ${error.context.service}`;
            const html = this.generateErrorEmailHTML(error);
            const text = this.generateErrorEmailText(error);

            for (const recipient of this.config.email.recipients) {
                await this.emailTransporter.sendMail({
                    from: this.config.email.smtp.auth.user,
                    to: recipient,
                    subject,
                    html,
                    text
                });
            }

            logger.systemEvent('Error alert sent via email', {
                errorId: error.errorId,
                recipients: this.config.email.recipients,
                severity: error.severity
            });

        } catch (alertError) {
            logger.error('Failed to send error alert', {
                errorId: error.errorId,
                alertError: alertError instanceof Error ? alertError.message : 'Unknown error'
            });
        }
    }

    /**
     * Generate HTML email content for error alerts
     */
    private generateErrorEmailHTML(error: CriticalError): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Error Alert - Cold Email Bot</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .error-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .recovery-actions { background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    .footer { background-color: #6c757d; color: white; padding: 10px; text-align: center; font-size: 12px; }
                    .severity-critical { color: #dc3545; font-weight: bold; }
                    .severity-high { color: #fd7e14; font-weight: bold; }
                    .severity-medium { color: #ffc107; font-weight: bold; }
                    .severity-low { color: #28a745; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🚨 Cold Email Bot Error Alert</h1>
                </div>
                <div class="content">
                    <h2>Error Details</h2>
                    <div class="error-details">
                        <p><strong>Error ID:</strong> ${error.errorId}</p>
                        <p><strong>Timestamp:</strong> ${error.timestamp.toISOString()}</p>
                        <p><strong>Severity:</strong> <span class="severity-${error.severity}">${error.severity.toUpperCase()}</span></p>
                        <p><strong>Service:</strong> ${error.context.service}</p>
                        <p><strong>Operation:</strong> ${error.context.operation}</p>
                        <p><strong>Message:</strong> ${error.message}</p>
                        <p><strong>Retryable:</strong> ${error.retryable ? 'Yes' : 'No'}</p>
                        ${error.stack ? `<p><strong>Stack Trace:</strong></p><pre>${error.stack}</pre>` : ''}
                    </div>

                    ${error.recoveryActions && error.recoveryActions.length > 0 ? `
                    <h2>Suggested Recovery Actions</h2>
                    <div class="recovery-actions">
                        <ul>
                            ${error.recoveryActions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}

                    ${error.context.metadata ? `
                    <h2>Additional Context</h2>
                    <div class="error-details">
                        <pre>${JSON.stringify(error.context.metadata, null, 2)}</pre>
                    </div>
                    ` : ''}
                </div>
                <div class="footer">
                    <p>This is an automated error alert from Cold Email Bot</p>
                    <p>Error ID: ${error.errorId} | Timestamp: ${error.timestamp.toISOString()}</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate text email content for error alerts
     */
    private generateErrorEmailText(error: CriticalError): string {
        let text = `COLD EMAIL BOT ERROR ALERT\n\n`;
        text += `Error ID: ${error.errorId}\n`;
        text += `Timestamp: ${error.timestamp.toISOString()}\n`;
        text += `Severity: ${error.severity.toUpperCase()}\n`;
        text += `Service: ${error.context.service}\n`;
        text += `Operation: ${error.context.operation}\n`;
        text += `Message: ${error.message}\n`;
        text += `Retryable: ${error.retryable ? 'Yes' : 'No'}\n\n`;

        if (error.stack) {
            text += `Stack Trace:\n${error.stack}\n\n`;
        }

        if (error.recoveryActions && error.recoveryActions.length > 0) {
            text += `Suggested Recovery Actions:\n`;
            error.recoveryActions.forEach((action, index) => {
                text += `${index + 1}. ${action}\n`;
            });
            text += `\n`;
        }

        if (error.context.metadata) {
            text += `Additional Context:\n${JSON.stringify(error.context.metadata, null, 2)}\n\n`;
        }

        text += `This is an automated error alert from Cold Email Bot\n`;
        text += `Error ID: ${error.errorId} | Timestamp: ${error.timestamp.toISOString()}`;

        return text;
    }

    /**
     * Attempt recovery for retryable errors
     */
    private async attemptRecovery(error: CriticalError): Promise<void> {
        logger.info('Attempting recovery for retryable error', {
            errorId: error.errorId,
            service: error.context.service,
            operation: error.context.operation
        });

        // Implement recovery logic based on service and error type
        switch (error.context.service) {
            case 'linkedin':
                await this.recoverLinkedInService(error);
                break;
            case 'email':
                await this.recoverEmailService(error);
                break;
            case 'database':
                await this.recoverDatabaseService(error);
                break;
            case 'ai':
                await this.recoverAIService(error);
                break;
            default:
                logger.warn('No recovery strategy available for service', {
                    service: error.context.service,
                    errorId: error.errorId
                });
        }
    }

    /**
     * Recovery strategies for different services
     */
    private async recoverLinkedInService(error: CriticalError): Promise<void> {
        // Implement LinkedIn service recovery
        logger.info('Attempting LinkedIn service recovery', { errorId: error.errorId });
        // Add specific recovery logic here
    }

    private async recoverEmailService(error: CriticalError): Promise<void> {
        // Implement email service recovery
        logger.info('Attempting email service recovery', { errorId: error.errorId });
        // Add specific recovery logic here
    }

    private async recoverDatabaseService(error: CriticalError): Promise<void> {
        // Implement database service recovery
        logger.info('Attempting database service recovery', { errorId: error.errorId });
        // Add specific recovery logic here
    }

    private async recoverAIService(error: CriticalError): Promise<void> {
        // Implement AI service recovery
        logger.info('Attempting AI service recovery', { errorId: error.errorId });
        // Add specific recovery logic here
    }

    /**
     * Save error state to file
     */
    private async saveErrorState(): Promise<void> {
        try {
            const state = {
                errorCounts: Array.from(this.errorCounts.entries()),
                lastUpdated: new Date().toISOString(),
                totalErrors: Array.from(this.errorCounts.values()).reduce((sum, entry) => sum + entry.count, 0)
            };

            await fs.promises.mkdir(path.dirname(this.stateBackupPath), { recursive: true });
            await fs.promises.writeFile(this.stateBackupPath, JSON.stringify(state, null, 2));

        } catch (error) {
            logger.error('Failed to save error state', { error });
        }
    }

    /**
     * Load error state from file
     */
    private async loadErrorState(): Promise<void> {
        try {
            if (fs.existsSync(this.stateBackupPath)) {
                const data = await fs.promises.readFile(this.stateBackupPath, 'utf8');
                const state = JSON.parse(data);

                // Restore error counts if within the error window
                const now = new Date();
                for (const [key, { count, firstOccurrence }] of state.errorCounts) {
                    const entryDate = new Date(firstOccurrence);
                    if (now.getTime() - entryDate.getTime() < this.config.errorWindowMs) {
                        this.errorCounts.set(key, { count, firstOccurrence: entryDate });
                    }
                }

                logger.info('Error state loaded from backup', {
                    totalErrors: state.totalErrors,
                    lastUpdated: state.lastUpdated
                });
            }
        } catch (error) {
            logger.error('Failed to load error state', { error });
        }
    }

    /**
     * Graceful shutdown with state saving
     */
    public async gracefulShutdown(reason: string): Promise<void> {
        if (this.isShuttingDown) {
            logger.warn('Graceful shutdown already in progress');
            return;
        }

        this.isShuttingDown = true;
        logger.systemEvent('Starting graceful shutdown', { reason });

        try {
            // Save current state
            await this.saveErrorState();

            // Close email transporter
            if (this.emailTransporter) {
                this.emailTransporter.close();
            }

            // Give some time for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));

            logger.systemEvent('Graceful shutdown completed', { reason });

            // Exit the process
            process.exit(0);

        } catch (error) {
            logger.error('Error during graceful shutdown', { error, reason });
            process.exit(1);
        }
    }

    /**
     * Wrap a function with error handling
     */
    public wrapWithErrorHandling<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        context: ErrorContext
    ): (...args: T) => Promise<R> {
        return async (...args: T): Promise<R> => {
            try {
                return await fn(...args);
            } catch (error) {
                const criticalError = this.createCriticalError(
                    error instanceof Error ? error : new Error(String(error)),
                    context,
                    'medium',
                    true
                );

                await this.handleCriticalError(criticalError);
                throw criticalError;
            }
        };
    }

    /**
     * Get current error statistics
     */
    public getErrorStatistics(): any {
        const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, entry) => sum + entry.count, 0);
        const serviceStats = new Map<string, number>();

        for (const [key, entry] of this.errorCounts.entries()) {
            const service = key.split(':')[0];
            serviceStats.set(service, (serviceStats.get(service) || 0) + entry.count);
        }

        return {
            totalErrors,
            errorCounts: Object.fromEntries(this.errorCounts),
            serviceStats: Object.fromEntries(serviceStats),
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Reset error counts (for manual intervention)
     */
    public resetErrorCounts(): void {
        this.errorCounts.clear();
        logger.systemEvent('Error counts reset manually');
    }
}

export default ErrorHandler;
