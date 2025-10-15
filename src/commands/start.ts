import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LinkedInService, LinkedInCredentials } from '../services/linkedinService.js';
import { AIService } from '../services/aiService.js';
import DatabaseService from '../services/databaseService.js';
import { SchedulerService } from '../services/schedulerService.js';
import { TemplateService } from '../services/templateService.js';
import { CampaignStatus, ContactStatus, ContactSource } from '../types/index.js';
import { EmailService } from '../services/emailService.js';

export function createStartCommand(): Command {
    const startCommand = new Command('start')
        .description('Begin automation campaign with LinkedIn networking and email outreach')
        .option('-c, --campaign <name>', 'Campaign name', 'Default Campaign')
        .option('-k, --keywords <keywords>', 'Search keywords for recruiters', 'recruiter')
        .option('-l, --location <location>', 'Location filter for search')
        .option('-i, --industry <industry>', 'Industry filter for search')
        .option('-m, --max-contacts <number>', 'Maximum number of contacts to process', '50')
        .option('-t, --template <template>', 'Template name to use for messages')
        .option('--headless', 'Run in headless mode (no browser window)')
        .option('--dry-run', 'Simulate the campaign without sending actual requests')
        .option('--email-only', 'Only send emails, skip LinkedIn connections')
        .option('--linkedin-only', 'Only send LinkedIn connections, skip emails')
        .action(async (options) => {
            const spinner = ora('Starting automation campaign...').start();

            try {
                // Initialize services
                const dbService = DatabaseService;
                await dbService.initialize();
                const templateService = new TemplateService();
                const emailService = new EmailService({
                    provider: 'gmail',
                    credentials: {
                        email: process.env.EMAIL_USER || '',
                        password: process.env.EMAIL_PASS || ''
                    },
                    trackingBaseUrl: 'https://your-domain.com/track',
                    unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe'
                });
                const linkedinService = new LinkedInService({
                    headless: options.headless || false,
                    timeout: 30000
                });
                const schedulerService = new SchedulerService(
                    {
                        enabled: true,
                        timezone: 'UTC',
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
                            maxTasksPerHour: 10,
                            delayBetweenTasks: 60000
                        },
                        retrySettings: {
                            maxRetries: 3,
                            retryDelay: 300000,
                            exponentialBackoff: true
                        }
                    },
                    emailService,
                    linkedinService,
                    DatabaseService
                );
                const aiService = new AIService();

                // Create or get campaign
                let campaign = await dbService.getCampaignById(options.campaign);
                if (!campaign) {
                    campaign = await dbService.createCampaign({
                        name: options.campaign,
                        status: CampaignStatus.ACTIVE,
                        targetCriteria: {
                            industries: options.industry ? [options.industry] : [],
                            locations: options.location ? [{
                                city: options.location,
                                country: 'US'
                            }] : []
                        },
                        settings: {
                            maxMessagesPerDay: 50,
                            maxMessagesPerHour: 10,
                            delayBetweenMessages: 300000,
                            personalizeMessages: true,
                            followUpEnabled: true,
                            followUpDelay: 7,
                            maxFollowUps: 3
                        }
                    });
                    console.log(chalk.green(`Created new campaign: ${options.campaign}`));
                } else {
                    console.log(chalk.blue(`Using existing campaign: ${options.campaign}`));
                }

                // LinkedIn automation (if not email-only)
                if (!options.emailOnly) {
                    spinner.text = 'Setting up LinkedIn automation...';

                    // Login to LinkedIn
                    const credentials: LinkedInCredentials = {
                        email: process.env.LINKEDIN_EMAIL || '',
                        password: process.env.LINKEDIN_PASSWORD || ''
                    };

                    if (!credentials.email || !credentials.password) {
                        spinner.fail('LinkedIn credentials not found. Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables.');
                        return;
                    }

                    spinner.text = 'Logging in to LinkedIn...';
                    await linkedinService.login(credentials);

                    // Search for recruiters
                    spinner.text = 'Searching for recruiters...';
                    const searchFilters = {
                        keywords: options.keywords,
                        location: options.location,
                        industry: options.industry,
                        maxResults: parseInt(options.maxContacts)
                    };

                    const profileUrls = await linkedinService.searchRecruiters(searchFilters);
                    console.log(chalk.blue(`Found ${profileUrls.length} recruiter profiles`));

                    // Scrape profiles
                    spinner.text = 'Scraping profile information...';
                    const profiles = await linkedinService.scrapeProfiles(profileUrls);

                    // Save contacts to database
                    spinner.text = 'Saving contacts to database...';
                    for (const profile of profiles) {
                        await dbService.createContact({
                            name: profile.name,
                            email: '', // Will be looked up later
                            linkedinUrl: profile.profileUrl,
                            company: profile.company,
                            position: profile.headline,
                            location: profile.location ? {
                                city: profile.location,
                                country: 'US'
                            } : undefined,
                            campaigns: [campaign._id!.toString()],
                            status: ContactStatus.PENDING,
                            source: ContactSource.LINKEDIN
                        });
                    }

                    // Send connection requests (if not dry run)
                    if (!options.dryRun) {
                        spinner.text = 'Sending connection requests...';

                        // Get template for connection messages
                        let template: any = null;
                        if (options.template) {
                            template = await templateService.getTemplateById(options.template);
                        }

                        const profilesToConnect = await Promise.all(profiles.map(async profile => {
                            let message = '';
                            if (template) {
                                // Generate personalized message using AI
                                const userInfo = {
                                    name: process.env.USER_NAME || 'User',
                                    targetRole: process.env.TARGET_ROLE || 'Software Engineer',
                                    skills: process.env.USER_SKILLS?.split(',') || [],
                                    experience: process.env.USER_EXPERIENCE || '5+ years'
                                };

                                message = await aiService.generatePersonalizedMessage(
                                    {
                                        name: profile.name,
                                        company: profile.company,
                                        position: profile.headline,
                                        industry: options.industry
                                    },
                                    'initial',
                                    userInfo
                                );
                            }

                            return {
                                url: profile.profileUrl,
                                message
                            };
                        }));

                        const connectionResults = await linkedinService.sendBulkConnectionRequests(profilesToConnect);
                        const successCount = connectionResults.filter(r => r.success).length;

                        console.log(chalk.green(`Sent ${successCount}/${connectionResults.length} connection requests`));
                    }

                    await linkedinService.close();
                }

                // Email automation (if not LinkedIn-only)
                if (!options.linkedinOnly) {
                    spinner.text = 'Setting up email automation...';

                    // Get contacts for this campaign
                    const contacts = await dbService.getContacts({ campaigns: campaign._id!.toString() });
                    console.log(chalk.blue(`Found ${contacts.length} contacts for email outreach`));

                    // Schedule follow-up emails
                    if (!options.dryRun) {
                        spinner.text = 'Scheduling follow-up emails...';

                        for (const contact of contacts) {
                            if (contact.email) {
                                // Schedule initial email
                                await schedulerService.scheduleFollowUp(
                                    contact._id!.toString(),
                                    campaign._id!.toString(),
                                    'FOLLOW_UP_EMAIL' as any,
                                    1 // 1 day delay
                                );

                                // Schedule follow-up emails
                                await schedulerService.scheduleFollowUp(
                                    contact._id!.toString(),
                                    campaign._id!.toString(),
                                    'FOLLOW_UP_EMAIL' as any,
                                    7 // 7 days delay
                                );
                            }
                        }

                        console.log(chalk.green(`Scheduled emails for ${contacts.length} contacts`));
                    }
                }

                // Update campaign status
                await dbService.updateCampaign(campaign._id!.toString(), { status: CampaignStatus.ACTIVE });

                spinner.succeed(chalk.green('Campaign started successfully!'));

                console.log(chalk.blue('\n📊 Campaign Summary:'));
                console.log(chalk.gray(`Campaign: ${campaign.name}`));
                console.log(chalk.gray(`Status: ${campaign.status}`));
                console.log(chalk.gray(`Max Contacts: ${options.maxContacts}`));
                console.log(chalk.gray(`Keywords: ${options.keywords}`));
                if (options.location) console.log(chalk.gray(`Location: ${options.location}`));
                if (options.industry) console.log(chalk.gray(`Industry: ${options.industry}`));

                console.log(chalk.blue('\n🚀 Next Steps:'));
                console.log(chalk.gray('• Run "cold-email-bot stats" to view campaign analytics'));
                console.log(chalk.gray('• Run "cold-email-bot followup" to process scheduled emails'));
                console.log(chalk.gray('• Run "cold-email-bot contacts" to manage your contact list'));

            } catch (error) {
                spinner.fail(chalk.red(`Campaign start failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return startCommand;
}
