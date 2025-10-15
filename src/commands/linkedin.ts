import { Command } from 'commander';
import { LinkedInService, LinkedInCredentials, SearchFilters } from '../services/linkedinService.js';
import chalk from 'chalk';
import ora from 'ora';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export function createLinkedInCommand(): Command {
    const linkedinCommand = new Command('linkedin')
        .description('LinkedIn automation commands for networking and job searching')
        .option('-e, --email <email>', 'LinkedIn email address')
        .option('-p, --password <password>', 'LinkedIn password')
        .option('--headless', 'Run in headless mode (no browser window)')
        .option('--timeout <timeout>', 'Request timeout in milliseconds', '30000');

    // Login subcommand
    linkedinCommand
        .command('login')
        .description('Login to LinkedIn with 2FA support')
        .option('-e, --email <email>', 'LinkedIn email address')
        .option('-p, --password <password>', 'LinkedIn password')
        .action(async (options) => {
            const spinner = ora('Logging in to LinkedIn...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                const credentials: LinkedInCredentials = {
                    email: options.email || process.env.LINKEDIN_EMAIL || '',
                    password: options.password || process.env.LINKEDIN_PASSWORD || ''
                };

                if (!credentials.email || !credentials.password) {
                    spinner.fail('Email and password are required. Set them via options or environment variables.');
                    return;
                }

                const loginSuccess = await linkedinService.login(credentials);

                if (loginSuccess) {
                    spinner.succeed(chalk.green('Successfully logged in to LinkedIn!'));
                    console.log(chalk.blue('Session saved. You can now use other LinkedIn commands.'));
                } else {
                    spinner.fail(chalk.red('Login failed. Please check your credentials.'));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Login error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Search subcommand
    linkedinCommand
        .command('search')
        .description('Search for recruiters or professionals on LinkedIn')
        .option('-k, --keywords <keywords>', 'Search keywords', 'recruiter')
        .option('-l, --location <location>', 'Location filter')
        .option('-i, --industry <industry>', 'Industry filter')
        .option('-c, --company <company>', 'Company filter')
        .option('-m, --max-results <number>', 'Maximum number of results', '20')
        .option('--save-cookies', 'Save session cookies for future use')
        .action(async (options) => {
            const spinner = ora('Searching for professionals...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Try to load existing session first
                const credentials: LinkedInCredentials = {
                    email: process.env.LINKEDIN_EMAIL || '',
                    password: process.env.LINKEDIN_PASSWORD || ''
                };

                if (credentials.email && credentials.password) {
                    await linkedinService.login(credentials);
                }

                const searchFilters: SearchFilters = {
                    keywords: options.keywords,
                    location: options.location,
                    industry: options.industry,
                    company: options.company,
                    maxResults: parseInt(options.maxResults)
                };

                const profileUrls = await linkedinService.searchRecruiters(searchFilters);

                spinner.succeed(chalk.green(`Found ${profileUrls.length} profiles`));

                console.log(chalk.blue('\nProfile URLs:'));
                profileUrls.forEach((url, index) => {
                    console.log(chalk.gray(`${index + 1}. ${url}`));
                });

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Search error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Scrape subcommand
    linkedinCommand
        .command('scrape')
        .description('Scrape profile information from LinkedIn profiles')
        .option('-u, --urls <urls...>', 'Profile URLs to scrape')
        .option('-f, --file <file>', 'File containing profile URLs (one per line)')
        .option('-o, --output <file>', 'Output file for scraped data (JSON)')
        .action(async (options) => {
            const spinner = ora('Scraping profiles...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Load existing session
                const credentials: LinkedInCredentials = {
                    email: process.env.LINKEDIN_EMAIL || '',
                    password: process.env.LINKEDIN_PASSWORD || ''
                };

                if (credentials.email && credentials.password) {
                    await linkedinService.login(credentials);
                }

                let profileUrls: string[] = [];

                if (options.urls && options.urls.length > 0) {
                    profileUrls = options.urls;
                } else if (options.file) {
                    const fs = await import('fs');
                    const fileContent = await fs.promises.readFile(options.file, 'utf8');
                    profileUrls = fileContent.split('\n').filter(url => url.trim());
                } else {
                    spinner.fail('Please provide profile URLs via --urls or --file option');
                    return;
                }

                const profiles = await linkedinService.scrapeProfiles(profileUrls);

                spinner.succeed(chalk.green(`Successfully scraped ${profiles.length} profiles`));

                // Display results
                console.log(chalk.blue('\nScraped Profiles:'));
                profiles.forEach((profile, index) => {
                    console.log(chalk.yellow(`\n${index + 1}. ${profile.name}`));
                    console.log(chalk.gray(`   Headline: ${profile.headline}`));
                    console.log(chalk.gray(`   Company: ${profile.company}`));
                    console.log(chalk.gray(`   Location: ${profile.location || 'Not specified'}`));
                    console.log(chalk.gray(`   URL: ${profile.profileUrl}`));
                });

                // Save to file if requested
                if (options.output) {
                    const fs = await import('fs');
                    await fs.promises.writeFile(options.output, JSON.stringify(profiles, null, 2));
                    console.log(chalk.green(`\nResults saved to ${options.output}`));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Scraping error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Connect subcommand
    linkedinCommand
        .command('connect')
        .description('Send connection requests to LinkedIn profiles')
        .option('-u, --urls <urls...>', 'Profile URLs to connect with')
        .option('-f, --file <file>', 'File containing profile URLs (one per line)')
        .option('-m, --message <message>', 'Custom connection message')
        .option('-b, --bulk', 'Send bulk connection requests with smart timing')
        .option('--check-limits', 'Check daily limits before sending')
        .action(async (options) => {
            const spinner = ora('Sending connection requests...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Load existing session
                const credentials: LinkedInCredentials = {
                    email: process.env.LINKEDIN_EMAIL || '',
                    password: process.env.LINKEDIN_PASSWORD || ''
                };

                if (credentials.email && credentials.password) {
                    await linkedinService.login(credentials);
                }

                let profileUrls: string[] = [];

                if (options.urls && options.urls.length > 0) {
                    profileUrls = options.urls;
                } else if (options.file) {
                    const fs = await import('fs');
                    const fileContent = await fs.promises.readFile(options.file, 'utf8');
                    profileUrls = fileContent.split('\n').filter(url => url.trim());
                } else {
                    spinner.fail('Please provide profile URLs via --urls or --file option');
                    return;
                }

                // Check limits if requested
                if (options.checkLimits) {
                    const limits = linkedinService.getLimitsStatus();
                    spinner.info(`Daily limits: ${JSON.stringify(limits.remaining)}`);
                }

                if (options.bulk) {
                    // Send bulk connection requests
                    const profiles = profileUrls.map(url => ({ url, message: options.message }));
                    const results = await linkedinService.sendBulkConnectionRequests(profiles);

                    const successCount = results.filter(r => r.success).length;
                    spinner.succeed(chalk.green(`Bulk connection requests completed: ${successCount}/${results.length} successful`));

                    // Display results
                    results.forEach((result, index) => {
                        if (result.success) {
                            console.log(chalk.green(`✓ ${index + 1}. ${result.profileUrl}`));
                        } else {
                            console.log(chalk.red(`✗ ${index + 1}. ${result.profileUrl} - ${result.error}`));
                        }
                    });
                } else {
                    // Send individual connection requests
                    for (let i = 0; i < profileUrls.length; i++) {
                        const url = profileUrls[i];
                        spinner.text = `Sending connection request ${i + 1}/${profileUrls.length}`;

                        const result = await linkedinService.sendConnectionRequest(url, options.message);

                        if (result.success) {
                            console.log(chalk.green(`✓ ${i + 1}. ${url}`));
                        } else {
                            console.log(chalk.red(`✗ ${i + 1}. ${url} - ${result.error}`));
                        }
                    }

                    spinner.succeed(chalk.green('Connection requests completed'));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Connection request error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Status subcommand
    linkedinCommand
        .command('status')
        .description('Check LinkedIn service status and limits')
        .action(async (options) => {
            const spinner = ora('Checking LinkedIn status...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Load existing session
                const credentials: LinkedInCredentials = {
                    email: process.env.LINKEDIN_EMAIL || '',
                    password: process.env.LINKEDIN_PASSWORD || ''
                };

                if (credentials.email && credentials.password) {
                    await linkedinService.login(credentials);
                }

                // Check limits
                const limits = linkedinService.getLimitsStatus();
                console.log(chalk.blue('\n📊 Daily Limits Status:'));
                console.log(chalk.gray(`Connection Requests: ${limits.current?.connectionRequests || 0}/${limits.remaining?.connectionRequests || 0} remaining`));
                console.log(chalk.gray(`Messages: ${limits.current?.messages || 0}/${limits.remaining?.messages || 0} remaining`));
                console.log(chalk.gray(`Profile Views: ${limits.current?.profileViews || 0}/${limits.remaining?.profileViews || 0} remaining`));

                // Check jail status
                const jailStatus = await linkedinService.getJailStatus();
                console.log(chalk.blue('\n🔒 Jail Status:'));
                if (jailStatus.isJailed) {
                    console.log(chalk.red(`❌ Account is restricted: ${jailStatus.reason}`));
                    console.log(chalk.gray(`Restrictions: ${jailStatus.restrictions?.join(', ')}`));
                    console.log(chalk.gray(`Can Continue: ${jailStatus.canContinue ? 'Yes' : 'No'}`));
                } else {
                    console.log(chalk.green('✅ Account is in good standing'));
                }

                // Check login status
                const isLoggedIn = linkedinService.isLoggedInStatus();
                console.log(chalk.blue('\n🔐 Login Status:'));
                console.log(chalk.gray(`Logged In: ${isLoggedIn ? 'Yes' : 'No'}`));

                spinner.succeed(chalk.green('Status check completed'));

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Status check error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Full automation subcommand
    linkedinCommand
        .command('automate')
        .description('Full automation: search, scrape, and connect with recruiters')
        .option('-k, --keywords <keywords>', 'Search keywords', 'recruiter')
        .option('-l, --location <location>', 'Location filter')
        .option('-i, --industry <industry>', 'Industry filter')
        .option('-c, --company <company>', 'Company filter')
        .option('-m, --max-results <number>', 'Maximum number of results', '10')
        .option('-o, --output <file>', 'Output file for scraped data (JSON)')
        .option('--connect', 'Send connection requests after scraping')
        .option('--message <message>', 'Custom connection message')
        .action(async (options) => {
            const spinner = ora('Starting LinkedIn automation...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Login
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

                // Search
                spinner.text = 'Searching for recruiters...';
                const searchFilters: SearchFilters = {
                    keywords: options.keywords,
                    location: options.location,
                    industry: options.industry,
                    company: options.company,
                    maxResults: parseInt(options.maxResults)
                };

                const profileUrls = await linkedinService.searchRecruiters(searchFilters);

                if (profileUrls.length === 0) {
                    spinner.warn('No profiles found with the specified filters');
                    await linkedinService.close();
                    return;
                }

                // Scrape
                spinner.text = `Scraping ${profileUrls.length} profiles...`;
                const profiles = await linkedinService.scrapeProfiles(profileUrls);

                let connectionResults: any[] = [];

                // Send connection requests if requested
                if (options.connect) {
                    spinner.text = 'Sending connection requests...';
                    const profilesToConnect = profiles.map(profile => ({
                        url: profile.profileUrl,
                        message: options.message
                    }));

                    connectionResults = await linkedinService.sendBulkConnectionRequests(profilesToConnect);
                    const successCount = connectionResults.filter(r => r.success).length;

                    console.log(chalk.blue('\n🔗 Connection Requests:'));
                    connectionResults.forEach((result, index) => {
                        if (result.success) {
                            console.log(chalk.green(`✓ ${index + 1}. ${result.profileUrl}`));
                        } else {
                            console.log(chalk.red(`✗ ${index + 1}. ${result.profileUrl} - ${result.error}`));
                        }
                    });

                    spinner.succeed(chalk.green(`Automation completed! Scraped ${profiles.length} profiles, sent ${successCount}/${connectionResults.length} connection requests`));
                } else {
                    spinner.succeed(chalk.green(`Automation completed! Scraped ${profiles.length} profiles`));
                }

                // Display results
                console.log(chalk.blue('\n📊 Scraped Profiles:'));
                profiles.forEach((profile, index) => {
                    console.log(chalk.yellow(`\n${index + 1}. ${profile.name}`));
                    console.log(chalk.gray(`   Headline: ${profile.headline}`));
                    console.log(chalk.gray(`   Company: ${profile.company}`));
                    console.log(chalk.gray(`   Location: ${profile.location || 'Not specified'}`));
                    console.log(chalk.gray(`   URL: ${profile.profileUrl}`));
                });

                // Save to file if requested
                if (options.output) {
                    const fs = await import('fs');
                    const outputData = {
                        profiles,
                        timestamp: new Date().toISOString(),
                        ...(options.connect && { connectionResults })
                    };
                    await fs.promises.writeFile(options.output, JSON.stringify(outputData, null, 2));
                    console.log(chalk.green(`\nResults saved to ${options.output}`));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Automation error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Cookie management command with subcommands
    const cookiesCommand = new Command('cookies')
        .description('Manage LinkedIn session cookies');

    cookiesCommand
        .command('status')
        .description('Check cookie status and validity')
        .action(async () => {
            const spinner = ora('Checking cookie status...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: true,
                    timeout: 10000
                });

                const hasValidCookies = linkedinService.hasValidCookies();

                if (hasValidCookies) {
                    spinner.succeed(chalk.green('Valid cookies found! You can use LinkedIn commands without logging in.'));
                } else {
                    spinner.fail(chalk.yellow('No valid cookies found. You need to login first.'));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Error checking cookies: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    cookiesCommand
        .command('clear')
        .description('Clear stored cookies (force re-login)')
        .action(async () => {
            const spinner = ora('Clearing stored cookies...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: true,
                    timeout: 10000
                });

                await linkedinService.clearCookies();
                spinner.succeed(chalk.green('Cookies cleared successfully! You will need to login again.'));

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Error clearing cookies: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    cookiesCommand
        .command('refresh')
        .description('Refresh cookies from current session')
        .action(async () => {
            const spinner = ora('Refreshing cookies...').start();

            try {
                const linkedinService = new LinkedInService({
                    headless: linkedinCommand.opts().headless || false,
                    timeout: parseInt(linkedinCommand.opts().timeout)
                });

                // Try to load existing session
                const cookiesLoaded = await (linkedinService as any).loadCookies();
                if (cookiesLoaded) {
                    const isLoggedIn = await (linkedinService as any).checkLoginStatus();
                    if (isLoggedIn) {
                        await (linkedinService as any).refreshCookies();
                        spinner.succeed(chalk.green('Cookies refreshed successfully!'));
                    } else {
                        spinner.fail(chalk.yellow('No active session found. Please login first.'));
                    }
                } else {
                    spinner.fail(chalk.yellow('No cookies found. Please login first.'));
                }

                await linkedinService.close();
            } catch (error) {
                spinner.fail(chalk.red(`Error refreshing cookies: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    linkedinCommand.addCommand(cookiesCommand);

    return linkedinCommand;
}
