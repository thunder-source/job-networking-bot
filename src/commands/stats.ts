import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import DatabaseService from '../services/databaseService.js';
import { SchedulerService } from '../services/schedulerService.js';

export function createStatsCommand(): Command {
    const statsCommand = new Command('stats')
        .description('Show campaign statistics and analytics')
        .option('-c, --campaign <name>', 'Show stats for specific campaign')
        .option('--all', 'Show stats for all campaigns')
        .option('--export <file>', 'Export stats to JSON file')
        .option('--format <format>', 'Output format (table, json, csv)', 'table')
        .action(async (options) => {
            const spinner = ora('Loading campaign statistics...').start();

            try {
                // Initialize services
                const dbService = DatabaseService;
                const schedulerService = new SchedulerService();

                let campaigns = [];

                if (options.all) {
                    // Get all campaigns
                    campaigns = await dbService.getAllCampaigns();
                } else if (options.campaign) {
                    // Get specific campaign
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }
                    campaigns = [campaign];
                } else {
                    // Get active campaigns
                    campaigns = await dbService.getActiveCampaigns();
                }

                if (campaigns.length === 0) {
                    spinner.warn('No campaigns found');
                    return;
                }

                spinner.succeed(chalk.green(`Loaded ${campaigns.length} campaign(s)`));

                // Calculate statistics for each campaign
                const campaignStats = [];

                for (const campaign of campaigns) {
                    const contacts = await dbService.getContactsByCampaign(campaign._id);
                    const scheduledEmails = await schedulerService.getScheduledEmails({
                        campaignId: campaign._id
                    });

                    // Calculate contact statistics
                    const contactStats = {
                        total: contacts.length,
                        new: contacts.filter(c => c.status === 'new').length,
                        connected: contacts.filter(c => c.status === 'connected').length,
                        rejected: contacts.filter(c => c.status === 'rejected').length,
                        withEmail: contacts.filter(c => c.email).length,
                        withoutEmail: contacts.filter(c => !c.email).length
                    };

                    // Calculate email statistics
                    const emailStats = {
                        scheduled: scheduledEmails.length,
                        sent: scheduledEmails.filter(e => e.status === 'sent').length,
                        pending: scheduledEmails.filter(e => e.status === 'pending').length,
                        failed: scheduledEmails.filter(e => e.status === 'failed').length
                    };

                    // Calculate response rates
                    const responseRate = contactStats.connected > 0
                        ? ((contactStats.connected / contactStats.total) * 100).toFixed(1)
                        : '0.0';

                    const emailOpenRate = emailStats.sent > 0
                        ? ((emailStats.sent / emailStats.scheduled) * 100).toFixed(1)
                        : '0.0';

                    campaignStats.push({
                        campaign,
                        contactStats,
                        emailStats,
                        responseRate,
                        emailOpenRate
                    });
                }

                // Display statistics
                if (options.format === 'json') {
                    console.log(JSON.stringify(campaignStats, null, 2));
                } else if (options.format === 'csv') {
                    // Generate CSV format
                    console.log('Campaign,Total Contacts,Connected,Rejected,Response Rate,Scheduled Emails,Sent Emails,Email Open Rate');
                    campaignStats.forEach(stat => {
                        console.log(`${stat.campaign.name},${stat.contactStats.total},${stat.contactStats.connected},${stat.contactStats.rejected},${stat.responseRate}%,${stat.emailStats.scheduled},${stat.emailStats.sent},${stat.emailOpenRate}%`);
                    });
                } else {
                    // Display table format
                    campaignStats.forEach((stat, index) => {
                        console.log(chalk.blue(`\n📊 Campaign: ${stat.campaign.name}`));
                        console.log(chalk.gray(`Status: ${stat.campaign.status}`));
                        console.log(chalk.gray(`Created: ${stat.campaign.createdAt.toLocaleDateString()}`));

                        console.log(chalk.yellow('\n👥 Contact Statistics:'));
                        console.log(chalk.gray(`  Total Contacts: ${stat.contactStats.total}`));
                        console.log(chalk.green(`  Connected: ${stat.contactStats.connected}`));
                        console.log(chalk.red(`  Rejected: ${stat.contactStats.rejected}`));
                        console.log(chalk.blue(`  New: ${stat.contactStats.new}`));
                        console.log(chalk.gray(`  With Email: ${stat.contactStats.withEmail}`));
                        console.log(chalk.gray(`  Without Email: ${stat.contactStats.withoutEmail}`));
                        console.log(chalk.green(`  Response Rate: ${stat.responseRate}%`));

                        console.log(chalk.yellow('\n📧 Email Statistics:'));
                        console.log(chalk.gray(`  Scheduled: ${stat.emailStats.scheduled}`));
                        console.log(chalk.green(`  Sent: ${stat.emailStats.sent}`));
                        console.log(chalk.yellow(`  Pending: ${stat.emailStats.pending}`));
                        console.log(chalk.red(`  Failed: ${stat.emailStats.failed}`));
                        console.log(chalk.green(`  Email Open Rate: ${stat.emailOpenRate}%`));

                        // Show recent activity
                        const recentContacts = contacts.slice(-5);
                        if (recentContacts.length > 0) {
                            console.log(chalk.yellow('\n🕒 Recent Contacts:'));
                            recentContacts.forEach(contact => {
                                const statusColor = contact.status === 'connected' ? chalk.green :
                                    contact.status === 'rejected' ? chalk.red : chalk.yellow;
                                console.log(chalk.gray(`  ${contact.name} (${contact.company}) - ${statusColor(contact.status)}`));
                            });
                        }
                    });

                    // Overall summary
                    if (campaignStats.length > 1) {
                        const totalContacts = campaignStats.reduce((sum, stat) => sum + stat.contactStats.total, 0);
                        const totalConnected = campaignStats.reduce((sum, stat) => sum + stat.contactStats.connected, 0);
                        const totalScheduled = campaignStats.reduce((sum, stat) => sum + stat.emailStats.scheduled, 0);
                        const totalSent = campaignStats.reduce((sum, stat) => sum + stat.emailStats.sent, 0);
                        const overallResponseRate = totalContacts > 0 ? ((totalConnected / totalContacts) * 100).toFixed(1) : '0.0';
                        const overallEmailRate = totalScheduled > 0 ? ((totalSent / totalScheduled) * 100).toFixed(1) : '0.0';

                        console.log(chalk.blue('\n📈 Overall Summary:'));
                        console.log(chalk.gray(`Total Campaigns: ${campaignStats.length}`));
                        console.log(chalk.gray(`Total Contacts: ${totalContacts}`));
                        console.log(chalk.green(`Total Connected: ${totalConnected}`));
                        console.log(chalk.gray(`Total Scheduled Emails: ${totalScheduled}`));
                        console.log(chalk.green(`Total Sent Emails: ${totalSent}`));
                        console.log(chalk.green(`Overall Response Rate: ${overallResponseRate}%`));
                        console.log(chalk.green(`Overall Email Open Rate: ${overallEmailRate}%`));
                    }
                }

                // Export to file if requested
                if (options.export) {
                    const fs = await import('fs');
                    const exportData = {
                        generatedAt: new Date().toISOString(),
                        campaigns: campaignStats.map(stat => ({
                            name: stat.campaign.name,
                            status: stat.campaign.status,
                            createdAt: stat.campaign.createdAt,
                            contactStats: stat.contactStats,
                            emailStats: stat.emailStats,
                            responseRate: stat.responseRate,
                            emailOpenRate: stat.emailOpenRate
                        }))
                    };

                    await fs.promises.writeFile(options.export, JSON.stringify(exportData, null, 2));
                    console.log(chalk.green(`\nStatistics exported to ${options.export}`));
                }

            } catch (error) {
                spinner.fail(chalk.red(`Failed to load statistics: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return statsCommand;
}
