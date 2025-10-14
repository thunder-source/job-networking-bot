import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import DatabaseService from '../services/databaseService.js';
import { SchedulerService } from '../services/schedulerService.js';
import { TemplateService } from '../services/templateService.js';
import { AdaptiveRateLimiter } from '../services/rateLimiter.js';
import { SafetyService } from '../services/safetyService.js';
import { EmailService } from '../services/emailService.js';
import { LinkedInService } from '../services/linkedinService.js';
import { AIService } from '../services/aiService.js';
import { ConversationType, ConversationDirection } from '../types/index.js';

interface DashboardData {
    todayActivity: {
        connectionsSent: number;
        emailsSent: number;
        responsesReceived: number;
        newContacts: number;
    };
    pendingActions: Array<{
        type: string;
        count: number;
        description: string;
    }>;
    recentResponses: Array<{
        contact: string;
        response: string;
        timestamp: Date;
        type: 'email' | 'linkedin';
    }>;
    scheduledTasks: Array<{
        id: string;
        type: string;
        contact: string;
        scheduledDate: Date;
        status: string;
    }>;
    topTemplates: Array<{
        name: string;
        type: string;
        usageCount: number;
        successRate: number;
    }>;
    warnings: Array<{
        type: 'warning' | 'critical' | 'info';
        message: string;
        timestamp: Date;
    }>;
    systemHealth: {
        database: boolean;
        email: boolean;
        linkedin: boolean;
        ai: boolean;
        rateLimiter: boolean;
        safety: boolean;
    };
    metrics: {
        totalContacts: number;
        activeCampaigns: number;
        responseRate: number;
        emailOpenRate: number;
    };
}

export function createDashboardCommand(): Command {
    const dashboardCommand = new Command('dashboard')
        .description('Show comprehensive dashboard with today\'s activity, pending actions, and system status')
        .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds', '30')
        .option('--no-refresh', 'Disable auto-refresh')
        .option('--compact', 'Show compact view')
        .option('--export <file>', 'Export dashboard data to JSON file')
        .action(async (options) => {
            let refreshInterval: NodeJS.Timeout | null = null;

            const showDashboard = async () => {
                const spinner = ora('Loading dashboard data...').start();

                try {
                    // Initialize services
                    await DatabaseService.initialize();
                    const templateService = new TemplateService();

                    // Create default scheduler config
                    const schedulerConfig = {
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
                            maxTasksPerHour: 20,
                            delayBetweenTasks: 30000
                        },
                        retrySettings: {
                            maxRetries: 3,
                            retryDelay: 60000,
                            exponentialBackoff: true
                        }
                    };

                    const emailService = new EmailService({
                        provider: 'gmail',
                        credentials: {
                            email: process.env.EMAIL_USER || '',
                            password: process.env.EMAIL_PASSWORD || ''
                        },
                        trackingBaseUrl: 'https://your-domain.com/track',
                        unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe'
                    });
                    const linkedinService = new LinkedInService();
                    const schedulerService = new SchedulerService(schedulerConfig, emailService, linkedinService, DatabaseService);
                    const rateLimiter = new AdaptiveRateLimiter();
                    const safetyService = new SafetyService();
                    const aiService = new AIService(process.env.OPENAI_API_KEY || 'dummy-key');

                    // Load dashboard data
                    const dashboardData = await loadDashboardData({
                        templateService,
                        schedulerService,
                        rateLimiter,
                        safetyService,
                        emailService,
                        linkedinService,
                        aiService
                    });

                    spinner.stop();

                    // Clear screen for refresh
                    if (refreshInterval) {
                        console.clear();
                    }

                    // Display dashboard
                    displayDashboard(dashboardData, options.compact);

                    // Export data if requested
                    if (options.export) {
                        await exportDashboardData(dashboardData, options.export);
                    }

                } catch (error) {
                    spinner.fail(chalk.red(`Failed to load dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`));
                    process.exit(1);
                }
            };

            // Initial display
            await showDashboard();

            // Set up auto-refresh if enabled
            if (options.refresh !== false && !options.export) {
                const refreshSeconds = parseInt(options.refresh);
                if (refreshSeconds > 0) {
                    refreshInterval = setInterval(showDashboard, refreshSeconds * 1000);

                    console.log(chalk.gray(`\nAuto-refreshing every ${refreshSeconds} seconds. Press Ctrl+C to exit.`));

                    // Handle graceful shutdown
                    process.on('SIGINT', () => {
                        if (refreshInterval) {
                            clearInterval(refreshInterval);
                        }
                        console.log(chalk.yellow('\nDashboard stopped.'));
                        process.exit(0);
                    });
                }
            }
        });

    return dashboardCommand;
}

async function loadDashboardData(services: any): Promise<DashboardData> {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Load today's activity
    const todayActivity = await loadTodayActivity(todayStart, todayEnd);

    // Load pending actions
    const pendingActions = await loadPendingActions(services);

    // Load recent responses
    const recentResponses = await loadRecentResponses();

    // Load scheduled tasks
    const scheduledTasks = await loadScheduledTasks(services.schedulerService);

    // Load top performing templates
    const topTemplates = await loadTopTemplates(services.templateService);

    // Load warnings and alerts
    const warnings = await loadWarnings(services);

    // Check system health
    const systemHealth = await checkSystemHealth(services);

    // Load overall metrics
    const metrics = await loadMetrics();

    return {
        todayActivity,
        pendingActions,
        recentResponses,
        scheduledTasks,
        topTemplates,
        warnings,
        systemHealth,
        metrics
    };
}

async function loadTodayActivity(start: Date, end: Date) {
    try {
        const contacts = await DatabaseService.getContacts({
            createdAt: { $gte: start, $lt: end }
        });

        const campaigns = await DatabaseService.getCampaigns({ status: 'active' });

        // Calculate activity metrics
        const connectionsSent = contacts.filter(c => c.status === 'connected').length;
        const emailsSent = contacts.filter(c => c.email && c.conversationHistory.some(conv =>
            conv.type === ConversationType.EMAIL && conv.direction === ConversationDirection.SENT && conv.date >= start
        )).length;

        const responsesReceived = contacts.filter(c => c.conversationHistory.some(conv =>
            conv.direction === ConversationDirection.RECEIVED && conv.date >= start
        )).length;

        return {
            connectionsSent,
            emailsSent,
            responsesReceived,
            newContacts: contacts.length
        };
    } catch (error) {
        return {
            connectionsSent: 0,
            emailsSent: 0,
            responsesReceived: 0,
            newContacts: 0
        };
    }
}

async function loadPendingActions(services: any) {
    const pendingActions = [];

    try {
        // Email lookup pending
        const contactsWithoutEmail = await DatabaseService.getContacts({ email: { $exists: false } });
        if (contactsWithoutEmail.length > 0) {
            pendingActions.push({
                type: 'Email Lookup',
                count: contactsWithoutEmail.length,
                description: 'Contacts need email addresses'
            });
        }

        // Follow-up emails pending
        const pendingFollowUps = await services.schedulerService.getTasksByStatus('pending');
        if (pendingFollowUps.length > 0) {
            pendingActions.push({
                type: 'Follow-up Emails',
                count: pendingFollowUps.length,
                description: 'Scheduled follow-up emails'
            });
        }

        // Rate limiting pending
        const rateLimiterProfile = services.rateLimiter.getAccountProfile('main');
        if (rateLimiterProfile && rateLimiterProfile.cooldownUntil && new Date() < rateLimiterProfile.cooldownUntil) {
            pendingActions.push({
                type: 'Rate Limit',
                count: 1,
                description: 'Account in cooldown period'
            });
        }

        // Safety alerts pending
        const recentAlerts = services.safetyService.getRecentAlerts();
        const criticalAlerts = recentAlerts.filter(alert => alert.type === 'critical' && alert.requiresAction);
        if (criticalAlerts.length > 0) {
            pendingActions.push({
                type: 'Safety Alerts',
                count: criticalAlerts.length,
                description: 'Critical safety issues require attention'
            });
        }

    } catch (error) {
        // Continue with empty array if there's an error
    }

    return pendingActions;
}

async function loadRecentResponses() {
    try {
        const contacts = await DatabaseService.getContacts({});
        const responses = [];

        for (const contact of contacts) {
            const recentConversations = contact.conversationHistory
                .filter(conv => conv.direction === ConversationDirection.RECEIVED)
                .sort((a, b) => b.date.getTime() - a.date.getTime())
                .slice(0, 3);

            for (const conv of recentConversations) {
                responses.push({
                    contact: contact.name,
                    response: conv.content.substring(0, 100) + (conv.content.length > 100 ? '...' : ''),
                    timestamp: conv.date,
                    type: conv.type === ConversationType.EMAIL ? 'email' : 'linkedin'
                });
            }
        }

        return responses
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);
    } catch (error) {
        return [];
    }
}

async function loadScheduledTasks(schedulerService: SchedulerService) {
    try {
        const tasks = schedulerService.getStatus();
        const allTasks = Array.from(schedulerService['tasks']?.values() || []);

        return allTasks
            .filter(task => task.status === 'pending')
            .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
            .slice(0, 10)
            .map(task => ({
                id: task.id,
                type: task.type,
                contact: 'Contact Name', // Would need to fetch contact name
                scheduledDate: task.scheduledDate,
                status: task.status
            }));
    } catch (error) {
        return [];
    }
}

async function loadTopTemplates(templateService: TemplateService) {
    try {
        const templates = await templateService.getMostUsedTemplates(5);

        return templates.map(template => ({
            name: template.name,
            type: template.type,
            usageCount: template.usageCount,
            successRate: 0.75 // Would need to calculate from actual data
        }));
    } catch (error) {
        return [];
    }
}

async function loadWarnings(services: any) {
    const warnings = [];

    try {
        // Safety service warnings
        const safetyAlerts = services.safetyService.getRecentAlerts();
        for (const alert of safetyAlerts) {
            warnings.push({
                type: alert.type,
                message: alert.message,
                timestamp: alert.timestamp
            });
        }

        // Rate limiter warnings
        const rateLimiterProfile = services.rateLimiter.getAccountProfile('main');
        if (rateLimiterProfile) {
            if (rateLimiterProfile.rejectionRate > 0.3) {
                warnings.push({
                    type: 'warning',
                    message: `High rejection rate: ${(rateLimiterProfile.rejectionRate * 100).toFixed(1)}%`,
                    timestamp: new Date()
                });
            }

            if (rateLimiterProfile.suspiciousActivityScore > 0.5) {
                warnings.push({
                    type: 'critical',
                    message: `Suspicious activity detected (score: ${rateLimiterProfile.suspiciousActivityScore.toFixed(2)})`,
                    timestamp: new Date()
                });
            }
        }

        // Database connection warning
        try {
            await DatabaseService.getCampaigns();
        } catch (error) {
            warnings.push({
                type: 'critical',
                message: 'Database connection issues detected',
                timestamp: new Date()
            });
        }

    } catch (error) {
        // Continue with existing warnings
    }

    return warnings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
}

async function checkSystemHealth(services: any) {
    const health = {
        database: false,
        email: false,
        linkedin: false,
        ai: false,
        rateLimiter: false,
        safety: false
    };

    try {
        // Check database
        await DatabaseService.getCampaigns();
        health.database = true;
    } catch (error) {
        health.database = false;
    }

    try {
        // Check email service
        health.email = services.emailService.isConfigured ? services.emailService.isConfigured() : true;
    } catch (error) {
        health.email = false;
    }

    try {
        // Check LinkedIn service
        health.linkedin = services.linkedinService.isLoggedIn ? services.linkedinService.isLoggedIn() : true;
    } catch (error) {
        health.linkedin = false;
    }

    try {
        // Check AI service
        health.ai = services.aiService.isConfigured ? services.aiService.isConfigured() : true;
    } catch (error) {
        health.ai = false;
    }

    try {
        // Check rate limiter
        await services.rateLimiter.initialize();
        health.rateLimiter = true;
    } catch (error) {
        health.rateLimiter = false;
    }

    try {
        // Check safety service
        health.safety = services.safetyService.getMetrics() !== null;
    } catch (error) {
        health.safety = false;
    }

    return health;
}

async function loadMetrics() {
    try {
        const contacts = await DatabaseService.getContacts({});
        const campaigns = await DatabaseService.getCampaigns({ status: 'active' });

        const totalContacts = contacts.length;
        const activeCampaigns = campaigns.length;

        const connectedContacts = contacts.filter(c => c.status === 'connected').length;
        const responseRate = totalContacts > 0 ? (connectedContacts / totalContacts) * 100 : 0;

        // Calculate email open rate (simplified)
        const contactsWithEmails = contacts.filter(c => c.email);
        const emailOpenRate = contactsWithEmails.length > 0 ?
            (contacts.filter(c => c.email && c.conversationHistory.some(conv => conv.type === ConversationType.EMAIL)).length / contactsWithEmails.length) * 100 : 0;

        return {
            totalContacts,
            activeCampaigns,
            responseRate,
            emailOpenRate
        };
    } catch (error) {
        return {
            totalContacts: 0,
            activeCampaigns: 0,
            responseRate: 0,
            emailOpenRate: 0
        };
    }
}

function displayDashboard(data: DashboardData, compact: boolean = false) {
    const now = new Date();

    // Header
    console.log(chalk.blue.bold('\n📊 Cold Email Bot Dashboard'));
    console.log(chalk.gray(`Last updated: ${now.toLocaleString()}`));
    console.log(chalk.gray('─'.repeat(80)));

    if (compact) {
        displayCompactView(data);
    } else {
        displayFullView(data);
    }

    console.log(chalk.gray('\n' + '─'.repeat(80)));
    console.log(chalk.gray('Use --help for more options | Ctrl+C to exit'));
}

function displayCompactView(data: DashboardData) {
    // System Health
    const healthStatus = Object.entries(data.systemHealth)
        .map(([service, status]) => status ? chalk.green('✓') : chalk.red('✗'))
        .join(' ');

    console.log(chalk.yellow('System Health:'), healthStatus);

    // Key Metrics
    console.log(chalk.blue('Today:'),
        `${data.todayActivity.connectionsSent} connections, ${data.todayActivity.emailsSent} emails, ${data.todayActivity.responsesReceived} responses`);

    console.log(chalk.green('Total:'),
        `${data.metrics.totalContacts} contacts, ${data.metrics.activeCampaigns} campaigns, ${data.metrics.responseRate.toFixed(1)}% response rate`);

    // Pending Actions
    if (data.pendingActions.length > 0) {
        console.log(chalk.yellow('Pending:'),
            data.pendingActions.map(action => `${action.count} ${action.type}`).join(', '));
    }

    // Critical Warnings
    const criticalWarnings = data.warnings.filter(w => w.type === 'critical');
    if (criticalWarnings.length > 0) {
        console.log(chalk.red('⚠️'), criticalWarnings.length, 'critical issues');
    }
}

function displayFullView(data: DashboardData) {
    // System Health
    displaySystemHealth(data.systemHealth);

    // Today's Activity
    displayTodayActivity(data.todayActivity);

    // Key Metrics
    displayKeyMetrics(data.metrics);

    // Pending Actions
    if (data.pendingActions.length > 0) {
        displayPendingActions(data.pendingActions);
    }

    // Recent Responses
    if (data.recentResponses.length > 0) {
        displayRecentResponses(data.recentResponses);
    }

    // Upcoming Scheduled Tasks
    if (data.scheduledTasks.length > 0) {
        displayScheduledTasks(data.scheduledTasks);
    }

    // Top Performing Templates
    if (data.topTemplates.length > 0) {
        displayTopTemplates(data.topTemplates);
    }

    // Warnings and Alerts
    if (data.warnings.length > 0) {
        displayWarnings(data.warnings);
    }
}

function displaySystemHealth(health: DashboardData['systemHealth']) {
    console.log(chalk.yellow.bold('\n🔧 System Health'));

    const table = new Table({
        head: ['Service', 'Status'],
        style: { head: [], border: [] }
    });

    const services = [
        { name: 'Database', status: health.database },
        { name: 'Email Service', status: health.email },
        { name: 'LinkedIn Service', status: health.linkedin },
        { name: 'AI Service', status: health.ai },
        { name: 'Rate Limiter', status: health.rateLimiter },
        { name: 'Safety Service', status: health.safety }
    ];

    services.forEach(service => {
        const statusText = service.status ? chalk.green('✓ Online') : chalk.red('✗ Offline');
        table.push([service.name, statusText]);
    });

    console.log(table.toString());
}

function displayTodayActivity(activity: DashboardData['todayActivity']) {
    console.log(chalk.blue.bold('\n📈 Today\'s Activity'));

    const table = new Table({
        head: ['Metric', 'Count'],
        style: { head: [], border: [] }
    });

    table.push(
        ['New Contacts', chalk.green(activity.newContacts)],
        ['Connections Sent', chalk.blue(activity.connectionsSent)],
        ['Emails Sent', chalk.cyan(activity.emailsSent)],
        ['Responses Received', chalk.green(activity.responsesReceived)]
    );

    console.log(table.toString());
}

function displayKeyMetrics(metrics: DashboardData['metrics']) {
    console.log(chalk.green.bold('\n📊 Key Metrics'));

    const table = new Table({
        head: ['Metric', 'Value'],
        style: { head: [], border: [] }
    });

    table.push(
        ['Total Contacts', chalk.blue(metrics.totalContacts)],
        ['Active Campaigns', chalk.cyan(metrics.activeCampaigns)],
        ['Response Rate', chalk.green(`${metrics.responseRate.toFixed(1)}%`)],
        ['Email Open Rate', chalk.yellow(`${metrics.emailOpenRate.toFixed(1)}%`)],
        ['Overall Health', getOverallHealthStatus(metrics)]
    );

    console.log(table.toString());
}

function displayPendingActions(actions: DashboardData['pendingActions']) {
    console.log(chalk.yellow.bold('\n⏳ Pending Actions'));

    const table = new Table({
        head: ['Action Type', 'Count', 'Description'],
        style: { head: [], border: [] }
    });

    actions.forEach(action => {
        const countColor = action.count > 10 ? chalk.red : action.count > 5 ? chalk.yellow : chalk.green;
        table.push([action.type, countColor(action.count), action.description]);
    });

    console.log(table.toString());
}

function displayRecentResponses(responses: DashboardData['recentResponses']) {
    console.log(chalk.green.bold('\n💬 Recent Responses'));

    const table = new Table({
        head: ['Contact', 'Response', 'Platform', 'Time'],
        style: { head: [], border: [] }
    });

    responses.slice(0, 5).forEach(response => {
        const platformIcon = response.type === 'email' ? '📧' : '💼';
        const timeAgo = getTimeAgo(response.timestamp);
        table.push([
            response.contact,
            response.response,
            platformIcon,
            chalk.gray(timeAgo)
        ]);
    });

    console.log(table.toString());
}

function displayScheduledTasks(tasks: DashboardData['scheduledTasks']) {
    console.log(chalk.blue.bold('\n⏰ Upcoming Scheduled Tasks'));

    const table = new Table({
        head: ['Type', 'Contact', 'Scheduled Time', 'Status'],
        style: { head: [], border: [] }
    });

    tasks.slice(0, 5).forEach(task => {
        const timeUntil = getTimeUntil(task.scheduledDate);
        const statusColor = task.status === 'pending' ? chalk.yellow : chalk.green;
        table.push([
            task.type,
            task.contact,
            timeUntil,
            statusColor(task.status)
        ]);
    });

    console.log(table.toString());
}

function displayTopTemplates(templates: DashboardData['topTemplates']) {
    console.log(chalk.cyan.bold('\n🏆 Top Performing Templates'));

    const table = new Table({
        head: ['Template Name', 'Type', 'Usage', 'Success Rate'],
        style: { head: [], border: [] }
    });

    templates.forEach(template => {
        const successColor = template.successRate > 0.7 ? chalk.green : template.successRate > 0.5 ? chalk.yellow : chalk.red;
        table.push([
            template.name,
            template.type,
            chalk.blue(template.usageCount),
            successColor(`${(template.successRate * 100).toFixed(1)}%`)
        ]);
    });

    console.log(table.toString());
}

function displayWarnings(warnings: DashboardData['warnings']) {
    console.log(chalk.red.bold('\n⚠️  Warnings & Alerts'));

    warnings.forEach(warning => {
        const icon = warning.type === 'critical' ? '🔴' : warning.type === 'warning' ? '🟡' : '🔵';
        const color = warning.type === 'critical' ? chalk.red : warning.type === 'warning' ? chalk.yellow : chalk.blue;
        const timeAgo = getTimeAgo(warning.timestamp);

        console.log(`${icon} ${color(warning.message)} ${chalk.gray(`(${timeAgo})`)}`);
    });
}

function getOverallHealthStatus(metrics: DashboardData['metrics']): string {
    const responseRate = metrics.responseRate;
    const emailOpenRate = metrics.emailOpenRate;

    if (responseRate > 20 && emailOpenRate > 30) {
        return chalk.green('🟢 Excellent');
    } else if (responseRate > 10 && emailOpenRate > 20) {
        return chalk.yellow('🟡 Good');
    } else if (responseRate > 5 && emailOpenRate > 10) {
        return chalk.yellow('🟡 Fair');
    } else {
        return chalk.red('🔴 Needs Attention');
    }
}

function getTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else if (diffMins > 0) {
        return `${diffMins}m ago`;
    } else {
        return 'Just now';
    }
}

function getTimeUntil(timestamp: Date): string {
    const now = new Date();
    const diffMs = timestamp.getTime() - now.getTime();

    if (diffMs < 0) {
        return 'Overdue';
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `In ${diffDays}d`;
    } else if (diffHours > 0) {
        return `In ${diffHours}h`;
    } else if (diffMins > 0) {
        return `In ${diffMins}m`;
    } else {
        return 'Due now';
    }
}

async function exportDashboardData(data: DashboardData, filePath: string) {
    const fs = await import('fs');
    const exportData = {
        ...data,
        exportedAt: new Date().toISOString()
    };

    await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2));
    console.log(chalk.green(`\nDashboard data exported to ${filePath}`));
}
