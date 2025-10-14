import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SchedulerService } from '../services/schedulerService.js';
import { EmailService } from '../services/emailService.js';
import DatabaseService from '../services/databaseService.js';
import { AIService } from '../services/aiService.js';
import { TemplateService } from '../services/templateService.js';

export function createFollowupCommand(): Command {
    const followupCommand = new Command('followup')
        .description('Run follow-up scheduler to process scheduled emails')
        .option('-c, --campaign <name>', 'Process follow-ups for specific campaign')
        .option('--type <type>', 'Email type to process (initial, followup, thankyou)', 'followup')
        .option('--max-emails <number>', 'Maximum number of emails to send', '10')
        .option('--dry-run', 'Simulate email sending without actually sending')
        .option('--force', 'Force processing even if not scheduled time')
        .option('--status <status>', 'Filter contacts by status', 'connected')
        .action(async (options) => {
            const spinner = ora('Processing follow-up emails...').start();

            try {
                // Initialize services
                const schedulerService = new SchedulerService();
                const emailService = new EmailService();
                const dbService = DatabaseService;
                const aiService = new AIService();
                const templateService = new TemplateService();

                // Get scheduled emails
                spinner.text = 'Fetching scheduled emails...';
                const scheduledEmails = await schedulerService.getScheduledEmails({
                    campaignName: options.campaign,
                    type: options.type,
                    status: options.status,
                    limit: parseInt(options.maxEmails)
                });

                if (scheduledEmails.length === 0) {
                    spinner.warn('No scheduled emails found to process');
                    return;
                }

                console.log(chalk.blue(`Found ${scheduledEmails.length} scheduled emails`));

                // Check if it's the right time to send (unless forced)
                if (!options.force) {
                    const now = new Date();
                    const scheduledFor = new Date(scheduledEmails[0].scheduledFor);
                    const timeDiff = scheduledFor.getTime() - now.getTime();

                    if (timeDiff > 0) {
                        const hoursUntil = Math.ceil(timeDiff / (1000 * 60 * 60));
                        spinner.warn(`Emails are scheduled for ${hoursUntil} hours from now. Use --force to send immediately.`);
                        return;
                    }
                }

                // Process each scheduled email
                let processedCount = 0;
                let successCount = 0;
                let failCount = 0;

                for (const scheduledEmail of scheduledEmails) {
                    try {
                        spinner.text = `Processing email ${processedCount + 1}/${scheduledEmails.length}...`;

                        // Get contact details
                        const contact = await dbService.getContactById(scheduledEmail.contactId);
                        if (!contact) {
                            console.log(chalk.red(`Contact not found for scheduled email ${scheduledEmail._id}`));
                            failCount++;
                            continue;
                        }

                        // Get campaign details
                        const campaign = await dbService.getCampaignById(scheduledEmail.campaignId);
                        if (!campaign) {
                            console.log(chalk.red(`Campaign not found for scheduled email ${scheduledEmail._id}`));
                            failCount++;
                            continue;
                        }

                        // Generate email content
                        let subject = '';
                        let content = '';

                        if (scheduledEmail.templateId) {
                            // Use template
                            const template = await templateService.getTemplate(scheduledEmail.templateId);
                            if (template) {
                                subject = template.subject || `Follow-up from ${process.env.USER_NAME || 'User'}`;
                                content = template.content;

                                // Replace template variables
                                content = content.replace(/\{name\}/g, contact.name);
                                content = content.replace(/\{company\}/g, contact.company || 'your company');
                                content = content.replace(/\{position\}/g, contact.position || 'your role');
                            }
                        } else {
                            // Generate AI content
                            const userInfo = {
                                name: process.env.USER_NAME || 'User',
                                targetRole: process.env.TARGET_ROLE || 'Software Engineer',
                                skills: process.env.USER_SKILLS?.split(',') || [],
                                experience: process.env.USER_EXPERIENCE || '5+ years'
                            };

                            subject = `Follow-up: ${contact.name}`;
                            content = await aiService.generatePersonalizedMessage(
                                {
                                    name: contact.name,
                                    company: contact.company || 'your company',
                                    position: contact.position || 'your role',
                                    industry: contact.industry
                                },
                                scheduledEmail.type as 'initial' | 'followup' | 'thankyou',
                                userInfo
                            );
                        }

                        if (options.dryRun) {
                            console.log(chalk.yellow(`\n📧 Email ${processedCount + 1} (Dry Run):`));
                            console.log(chalk.gray(`To: ${contact.email}`));
                            console.log(chalk.gray(`Subject: ${subject}`));
                            console.log(chalk.gray(`Content: ${content.substring(0, 200)}...`));
                            successCount++;
                        } else {
                            // Send email
                            const emailResult = await emailService.sendEmail({
                                to: contact.email,
                                subject,
                                content,
                                type: scheduledEmail.type
                            });

                            if (emailResult.success) {
                                console.log(chalk.green(`✓ Sent email to ${contact.name} (${contact.email})`));
                                successCount++;

                                // Update contact status
                                contact.lastActivity = new Date();
                                contact.emailStatus = 'sent';
                                await dbService.saveContact(contact);
                            } else {
                                console.log(chalk.red(`✗ Failed to send email to ${contact.name}: ${emailResult.error}`));
                                failCount++;
                            }
                        }

                        // Mark scheduled email as processed
                        await schedulerService.markEmailAsProcessed(scheduledEmail._id);
                        processedCount++;

                    } catch (error) {
                        console.log(chalk.red(`Error processing email ${processedCount + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                        failCount++;
                        processedCount++;
                    }
                }

                spinner.succeed(chalk.green(`Follow-up processing completed: ${successCount}/${processedCount} successful`));

                console.log(chalk.blue('\n📊 Follow-up Summary:'));
                console.log(chalk.gray(`Total Processed: ${processedCount}`));
                console.log(chalk.green(`Successful: ${successCount}`));
                console.log(chalk.red(`Failed: ${failCount}`));
                console.log(chalk.gray(`Success Rate: ${((successCount / processedCount) * 100).toFixed(1)}%`));

                if (options.dryRun) {
                    console.log(chalk.yellow('\n⚠️  This was a dry run - no actual emails were sent'));
                }

            } catch (error) {
                spinner.fail(chalk.red(`Follow-up processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });

    return followupCommand;
}
