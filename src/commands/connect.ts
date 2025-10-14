import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LinkedInService, LinkedInCredentials } from '../services/linkedinService.js';
import DatabaseService from '../services/databaseService.js';
import { AIService } from '../services/aiService.js';
import { TemplateService } from '../services/templateService.js';

export function createConnectCommand(): Command {
    const connectCommand = new Command('connect')
        .description('Send connection requests from saved contact list')
        .option('-c, --campaign <name>', 'Campaign name to get contacts from')
        .option('-f, --file <file>', 'File containing LinkedIn URLs (one per line)')
        .option('-u, --urls <urls...>', 'LinkedIn profile URLs to connect with')
        .option('-t, --template <template>', 'Template name to use for connection messages')
        .option('-m, --message <message>', 'Custom connection message')
        .option('--max-requests <number>', 'Maximum number of connection requests to send', '20')
        .option('--status <status>', 'Filter contacts by status (new, connected, rejected)', 'new')
        .option('--headless', 'Run in headless mode (no browser window)')
        .option('--dry-run', 'Simulate the connection requests without sending them')
        .option('--check-limits', 'Check daily limits before sending')
        .action(async (options) => {
            const spinner = ora('Preparing connection requests...').start();

            try {
                // Initialize services
                const linkedinService = new LinkedInService({
                    headless: options.headless || false,
                    timeout: 30000
                });

                const dbService = DatabaseService;
                const aiService = new AIService();
                const templateService = new TemplateService();

                // Get contacts to connect with
                let contacts = [];

                if (options.campaign) {
                    // Get contacts from campaign
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }

                    contacts = await dbService.getContactsByCampaign(campaign._id, options.status);
                    console.log(chalk.blue(`Found ${contacts.length} contacts in campaign "${options.campaign}"`));
                } else if (options.file) {
                    // Load URLs from file
                    const fs = await import('fs');
                    const fileContent = await fs.promises.readFile(options.file, 'utf8');
                    const urls = fileContent.split('\n').filter(url => url.trim());

                    contacts = urls.map(url => ({
                        linkedinUrl: url.trim(),
                        name: 'Unknown',
                        company: 'Unknown'
                    }));
                    console.log(chalk.blue(`Loaded ${contacts.length} URLs from file`));
                } else if (options.urls && options.urls.length > 0) {
                    // Use provided URLs
                    contacts = options.urls.map(url => ({
                        linkedinUrl: url,
                        name: 'Unknown',
                        company: 'Unknown'
                    }));
                    console.log(chalk.blue(`Using ${contacts.length} provided URLs`));
                } else {
                    spinner.fail('Please provide contacts via --campaign, --file, or --urls option');
                    return;
                }

                if (contacts.length === 0) {
                    spinner.warn('No contacts found to connect with');
                    return;
                }

                // Limit number of requests
                const maxRequests = parseInt(options.maxRequests);
                if (contacts.length > maxRequests) {
                    contacts = contacts.slice(0, maxRequests);
                    console.log(chalk.yellow(`Limited to ${maxRequests} contacts`));
                }

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

                // Check limits if requested
                if (options.checkLimits) {
                    const limits = linkedinService.getLimitsStatus();
                    console.log(chalk.blue('\n📊 Daily Limits Status:'));
                    console.log(chalk.gray(`Connection Requests: ${limits.current?.connectionRequests || 0}/${limits.remaining?.connectionRequests || 0} remaining`));
                    console.log(chalk.gray(`Messages: ${limits.current?.messages || 0}/${limits.remaining?.messages || 0} remaining`));
                    console.log(chalk.gray(`Profile Views: ${limits.current?.profileViews || 0}/${limits.remaining?.profileViews || 0} remaining`));
                }

                // Prepare connection requests
                const profilesToConnect = [];

                for (const contact of contacts) {
                    let message = options.message || '';

                    // Generate personalized message if template is provided
                    if (options.template && !message) {
                        const template = await templateService.getTemplate(options.template);
                        if (template) {
                            const userInfo = {
                                name: process.env.USER_NAME || 'User',
                                targetRole: process.env.TARGET_ROLE || 'Software Engineer',
                                skills: process.env.USER_SKILLS?.split(',') || [],
                                experience: process.env.USER_EXPERIENCE || '5+ years'
                            };

                            message = await aiService.generatePersonalizedMessage(
                                {
                                    name: contact.name,
                                    company: contact.company,
                                    position: contact.position || 'Professional',
                                    industry: contact.industry
                                },
                                'initial',
                                userInfo
                            );
                        }
                    }

                    profilesToConnect.push({
                        url: contact.linkedinUrl,
                        message
                    });
                }

                if (options.dryRun) {
                    spinner.succeed(chalk.yellow('Dry run completed - no actual requests sent'));

                    console.log(chalk.blue('\n📋 Connection Requests (Dry Run):'));
                    profilesToConnect.forEach((profile, index) => {
                        console.log(chalk.yellow(`\n${index + 1}. ${profile.url}`));
                        if (profile.message) {
                            console.log(chalk.gray(`   Message: ${profile.message}`));
                        }
                    });

                    await linkedinService.close();
                    return;
                }

                // Send connection requests
                spinner.text = 'Sending connection requests...';
                const results = await linkedinService.sendBulkConnectionRequests(profilesToConnect);

                const successCount = results.filter(r => r.success).length;
                const failCount = results.length - successCount;

                spinner.succeed(chalk.green(`Connection requests completed: ${successCount}/${results.length} successful`));

                // Display results
                console.log(chalk.blue('\n🔗 Connection Request Results:'));
                results.forEach((result, index) => {
                    if (result.success) {
                        console.log(chalk.green(`✓ ${index + 1}. ${result.profileUrl}`));
                        if (result.message) {
                            console.log(chalk.gray(`   Message: ${result.message}`));
                        }
                    } else {
                        console.log(chalk.red(`✗ ${index + 1}. ${result.profileUrl} - ${result.error}`));
                    }
                });

                // Update contact statuses in database
                if (options.campaign) {
                    spinner.text = 'Updating contact statuses...';

                    for (let i = 0; i < results.length; i++) {
                        const result = results[i];
                        const contact = contacts[i];

                        if (contact._id) {
                            contact.status = result.success ? 'connected' : 'rejected';
                            contact.lastActivity = new Date();
                            await dbService.saveContact(contact);
                        }
                    }

                    console.log(chalk.green(`Updated ${results.length} contact statuses`));
                }

                await linkedinService.close();

                console.log(chalk.blue('\n📊 Connection Summary:'));
                console.log(chalk.gray(`Total Requests: ${results.length}`));
                console.log(chalk.green(`Successful: ${successCount}`));
                console.log(chalk.red(`Failed: ${failCount}`));
                console.log(chalk.gray(`Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`));

            } catch (error) {
                spinner.fail(chalk.red(`Connection request failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return connectCommand;
}
