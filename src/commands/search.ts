import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LinkedInService, LinkedInCredentials, SearchFilters } from '../services/linkedinService.js';
import DatabaseService from '../services/databaseService.js';
import { Contact } from '../models/index.js';

export function createSearchCommand(): Command {
    const searchCommand = new Command('search')
        .description('Find and scrape recruiters based on search criteria')
        .option('-k, --keywords <keywords>', 'Search keywords', 'recruiter')
        .option('-l, --location <location>', 'Location filter (e.g., "San Francisco Bay Area")')
        .option('-i, --industry <industry>', 'Industry filter (e.g., "Information Technology")')
        .option('-c, --company <company>', 'Company filter (e.g., "Google")')
        .option('-m, --max-results <number>', 'Maximum number of results to find', '20')
        .option('-o, --output <file>', 'Output file for scraped data (JSON format)')
        .option('--save-contacts', 'Save scraped profiles as contacts in database')
        .option('--campaign <name>', 'Campaign name to associate contacts with')
        .option('--headless', 'Run in headless mode (no browser window)')
        .option('--timeout <timeout>', 'Request timeout in milliseconds', '30000')
        .action(async (options) => {
            const spinner = ora('Searching for recruiters...').start();

            try {
                // Initialize services
                const linkedinService = new LinkedInService({
                    headless: options.headless || false,
                    timeout: parseInt(options.timeout)
                });

                const dbService = DatabaseService;
                await dbService.initialize();

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

                // Build search filters
                const searchFilters: SearchFilters = {
                    keywords: options.keywords,
                    location: options.location,
                    industry: options.industry,
                    company: options.company,
                    maxResults: parseInt(options.maxResults)
                };

                // Search for recruiters
                spinner.text = `Searching for "${options.keywords}"...`;
                const profileUrls = await linkedinService.searchRecruiters(searchFilters);

                if (profileUrls.length === 0) {
                    spinner.warn('No profiles found with the specified criteria');
                    await linkedinService.close();
                    return;
                }

                console.log(chalk.blue(`Found ${profileUrls.length} profiles`));

                // Scrape profiles
                spinner.text = 'Scraping profile information...';
                const profiles = await linkedinService.scrapeProfiles(profileUrls);

                if (profiles.length === 0) {
                    spinner.warn('No profiles could be scraped successfully');
                    await linkedinService.close();
                    return;
                }

                spinner.succeed(chalk.green(`Successfully scraped ${profiles.length} profiles`));

                // Display results
                console.log(chalk.blue('\n📊 Scraped Profiles:'));
                profiles.forEach((profile, index) => {
                    console.log(chalk.yellow(`\n${index + 1}. ${profile.name}`));
                    console.log(chalk.gray(`   Headline: ${profile.headline}`));
                    console.log(chalk.gray(`   Company: ${profile.company}`));
                    console.log(chalk.gray(`   Location: ${profile.location || 'Not specified'}`));
                    console.log(chalk.gray(`   URL: ${profile.profileUrl}`));
                    if (profile.about) {
                        console.log(chalk.gray(`   About: ${profile.about.substring(0, 100)}...`));
                    }
                });

                // Save to file if requested
                if (options.output) {
                    const fs = await import('fs');
                    const outputData = {
                        searchCriteria: searchFilters,
                        profiles,
                        timestamp: new Date().toISOString(),
                        totalFound: profiles.length
                    };
                    await fs.promises.writeFile(options.output, JSON.stringify(outputData, null, 2));
                    console.log(chalk.green(`\nResults saved to ${options.output}`));
                }

                // Save contacts to database if requested
                if (options.saveContacts) {
                    spinner.text = 'Saving contacts to database...';

                    let campaignId = null;
                    if (options.campaign) {
                        const campaign = await dbService.getCampaignById(options.campaign);
                        if (campaign) {
                            campaignId = campaign._id;
                        } else {
                            console.log(chalk.yellow(`Campaign "${options.campaign}" not found. Creating new campaign...`));
                            const savedCampaign = await dbService.createCampaign({
                                name: options.campaign,
                                status: 'active',
                                settings: {
                                    keywords: options.keywords,
                                    location: options.location,
                                    industry: options.industry,
                                    company: options.company
                                }
                            });
                            campaignId = savedCampaign._id;
                        }
                    }

                    let savedCount = 0;
                    for (const profile of profiles) {
                        await dbService.createContact({
                            name: profile.name,
                            linkedinUrl: profile.profileUrl,
                            company: profile.company,
                            position: profile.headline,
                            location: profile.location,
                            about: profile.about,
                            campaignId: campaignId,
                            status: 'new'
                        });
                        savedCount++;
                    }

                    console.log(chalk.green(`\nSaved ${savedCount} contacts to database`));
                    if (campaignId) {
                        console.log(chalk.blue(`Associated with campaign: ${options.campaign}`));
                    }
                }

                await linkedinService.close();

                console.log(chalk.blue('\n🔍 Search Summary:'));
                console.log(chalk.gray(`Keywords: ${options.keywords}`));
                if (options.location) console.log(chalk.gray(`Location: ${options.location}`));
                if (options.industry) console.log(chalk.gray(`Industry: ${options.industry}`));
                if (options.company) console.log(chalk.gray(`Company: ${options.company}`));
                console.log(chalk.gray(`Results: ${profiles.length}/${profileUrls.length} profiles scraped`));

            } catch (error) {
                spinner.fail(chalk.red(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return searchCommand;
}
