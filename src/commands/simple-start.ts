import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LinkedInService, LinkedInCredentials } from '../services/linkedinService.js';
import { AIService } from '../services/aiService.js';
import DatabaseService from '../services/databaseService.js';

export function createSimpleStartCommand(): Command {
    const startCommand = new Command('start')
        .description('Begin automation campaign with LinkedIn networking and email outreach')
        .option('-c, --campaign <name>', 'Campaign name', 'Default Campaign')
        .option('-k, --keywords <keywords>', 'Search keywords for recruiters', 'recruiter')
        .option('-l, --location <location>', 'Location filter for search')
        .option('-i, --industry <industry>', 'Industry filter for search')
        .option('-m, --max-contacts <number>', 'Maximum number of contacts to process', '50')
        .option('--headless', 'Run in headless mode (no browser window)')
        .option('--dry-run', 'Simulate the campaign without sending actual requests')
        .action(async (options) => {
            const spinner = ora('Starting automation campaign...').start();

            try {
                // Initialize services
                const dbService = DatabaseService;
                await dbService.initialize();
                const aiService = new AIService();

                // Create or get campaign
                let campaign = await dbService.getCampaignById(options.campaign);
                if (!campaign) {
                    campaign = await dbService.createCampaign({
                        name: options.campaign,
                        status: 'active' as any,
                        settings: {
                            maxContacts: parseInt(options.maxContacts),
                            keywords: options.keywords,
                            location: options.location,
                            industry: options.industry
                        } as any
                    });
                    console.log(chalk.green(`Created new campaign: ${options.campaign}`));
                } else {
                    console.log(chalk.blue(`Using existing campaign: ${options.campaign}`));
                }

                // LinkedIn automation
                if (!options.dryRun) {
                    spinner.text = 'Setting up LinkedIn automation...';

                    const linkedinService = new LinkedInService({
                        headless: options.headless || false,
                        timeout: 30000
                    });

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
                            location: profile.location,
                            campaignId: campaign._id,
                            status: 'new' as any
                        });
                    }

                    // Send connection requests
                    spinner.text = 'Sending connection requests...';

                    const profilesToConnect = profiles.map(profile => {
                        let message = '';

                        // Generate personalized message using AI
                        const userInfo = {
                            name: process.env.USER_NAME || 'User',
                            targetRole: process.env.TARGET_ROLE || 'Software Engineer',
                            skills: process.env.USER_SKILLS?.split(',') || [],
                            experience: process.env.USER_EXPERIENCE || '5+ years'
                        };

                        // Note: This would need to be awaited in a real implementation
                        // message = await aiService.generatePersonalizedMessage(...);

                        return {
                            url: profile.profileUrl,
                            message
                        };
                    });

                    const connectionResults = await linkedinService.sendBulkConnectionRequests(profilesToConnect);
                    const successCount = connectionResults.filter(r => r.success).length;

                    console.log(chalk.green(`Sent ${successCount}/${connectionResults.length} connection requests`));

                    await linkedinService.close();
                }

                // Update campaign status
                await dbService.updateCampaign(campaign._id, { status: 'running' as any });

                spinner.succeed(chalk.green('Campaign started successfully!'));

                console.log(chalk.blue('\n📊 Campaign Summary:'));
                console.log(chalk.gray(`Campaign: ${campaign.name}`));
                console.log(chalk.gray(`Status: ${campaign.status}`));
                console.log(chalk.gray(`Max Contacts: ${options.maxContacts}`));
                console.log(chalk.gray(`Keywords: ${options.keywords}`));
                if (options.location) console.log(chalk.gray(`Location: ${options.location}`));
                if (options.industry) console.log(chalk.gray(`Industry: ${options.industry}`));

            } catch (error) {
                spinner.fail(chalk.red(`Campaign start failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return startCommand;
}
