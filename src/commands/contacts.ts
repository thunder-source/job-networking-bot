import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import DatabaseService from '../services/databaseService.js';
import { EmailLookupService } from '../services/emailLookupService.js';

export function createContactsCommand(): Command {
    const contactsCommand = new Command('contacts')
        .description('View and manage contacts (list, filter, export)')
        .action(() => {
            console.log(chalk.blue('Use subcommands to manage contacts:'));
            console.log(chalk.gray('  list    - List contacts with filters'));
            console.log(chalk.gray('  export  - Export contacts to CSV/JSON'));
            console.log(chalk.gray('  lookup  - Look up email addresses'));
            console.log(chalk.gray('  update  - Update contact information'));
            console.log(chalk.gray('  delete  - Delete contacts'));
        });

    // List contacts subcommand
    contactsCommand
        .command('list')
        .description('List contacts with optional filters')
        .option('-c, --campaign <name>', 'Filter by campaign name')
        .option('-s, --status <status>', 'Filter by status (new, connected, rejected)')
        .option('--has-email', 'Only show contacts with email addresses')
        .option('--no-email', 'Only show contacts without email addresses')
        .option('--limit <number>', 'Limit number of results', '50')
        .option('--format <format>', 'Output format (table, json, csv)', 'table')
        .action(async (options) => {
            const spinner = ora('Loading contacts...').start();

            try {
                const dbService = DatabaseService;
                let contacts = [];

                if (options.campaign) {
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }
                    contacts = await dbService.getContactsByCampaign(campaign._id, options.status);
                } else {
                    contacts = await dbService.getAllContacts(options.status);
                }

                // Apply additional filters
                if (options.hasEmail) {
                    contacts = contacts.filter(c => c.email);
                } else if (options.noEmail) {
                    contacts = contacts.filter(c => !c.email);
                }

                // Limit results
                const limit = parseInt(options.limit);
                if (contacts.length > limit) {
                    contacts = contacts.slice(0, limit);
                }

                if (contacts.length === 0) {
                    spinner.warn('No contacts found matching criteria');
                    return;
                }

                spinner.succeed(chalk.green(`Found ${contacts.length} contact(s)`));

                if (options.format === 'json') {
                    console.log(JSON.stringify(contacts, null, 2));
                } else if (options.format === 'csv') {
                    // Generate CSV format
                    console.log('Name,Email,Company,Position,Status,LinkedIn URL,Campaign');
                    contacts.forEach(contact => {
                        console.log(`"${contact.name}","${contact.email || ''}","${contact.company || ''}","${contact.position || ''}","${contact.status}","${contact.linkedinUrl || ''}","${contact.campaignId || ''}"`);
                    });
                } else {
                    // Display table format
                    console.log(chalk.blue('\n👥 Contacts:'));
                    contacts.forEach((contact, index) => {
                        const statusColor = contact.status === 'connected' ? chalk.green :
                            contact.status === 'rejected' ? chalk.red : chalk.yellow;

                        console.log(chalk.yellow(`\n${index + 1}. ${contact.name}`));
                        console.log(chalk.gray(`   Email: ${contact.email || 'Not available'}`));
                        console.log(chalk.gray(`   Company: ${contact.company || 'Not specified'}`));
                        console.log(chalk.gray(`   Position: ${contact.position || 'Not specified'}`));
                        console.log(chalk.gray(`   Status: ${statusColor(contact.status)}`));
                        console.log(chalk.gray(`   LinkedIn: ${contact.linkedinUrl || 'Not available'}`));
                        if (contact.lastActivity) {
                            console.log(chalk.gray(`   Last Activity: ${contact.lastActivity.toLocaleDateString()}`));
                        }
                    });
                }

            } catch (error) {
                spinner.fail(chalk.red(`Failed to load contacts: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Export contacts subcommand
    contactsCommand
        .command('export')
        .description('Export contacts to CSV or JSON file')
        .option('-c, --campaign <name>', 'Export contacts from specific campaign')
        .option('-s, --status <status>', 'Filter by status')
        .option('-f, --format <format>', 'Export format (csv, json)', 'csv')
        .option('-o, --output <file>', 'Output file path')
        .action(async (options) => {
            const spinner = ora('Exporting contacts...').start();

            try {
                const dbService = DatabaseService;
                let contacts = [];

                if (options.campaign) {
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }
                    contacts = await dbService.getContactsByCampaign(campaign._id, options.status);
                } else {
                    contacts = await dbService.getAllContacts(options.status);
                }

                if (contacts.length === 0) {
                    spinner.warn('No contacts found to export');
                    return;
                }

                // Generate filename if not provided
                const timestamp = new Date().toISOString().split('T')[0];
                const filename = options.output || `contacts_${timestamp}.${options.format}`;

                const fs = await import('fs');

                if (options.format === 'json') {
                    const exportData = {
                        exportedAt: new Date().toISOString(),
                        totalContacts: contacts.length,
                        contacts: contacts.map(contact => ({
                            name: contact.name,
                            email: contact.email,
                            company: contact.company,
                            position: contact.position,
                            status: contact.status,
                            linkedinUrl: contact.linkedinUrl,
                            location: contact.location,
                            about: contact.about,
                            lastActivity: contact.lastActivity
                        }))
                    };
                    await fs.promises.writeFile(filename, JSON.stringify(exportData, null, 2));
                } else {
                    // CSV format
                    const csvHeader = 'Name,Email,Company,Position,Status,LinkedIn URL,Location,Last Activity\n';
                    const csvRows = contacts.map(contact =>
                        `"${contact.name}","${contact.email || ''}","${contact.company || ''}","${contact.position || ''}","${contact.status}","${contact.linkedinUrl || ''}","${contact.location || ''}","${contact.lastActivity ? contact.lastActivity.toISOString() : ''}"`
                    ).join('\n');

                    await fs.promises.writeFile(filename, csvHeader + csvRows);
                }

                spinner.succeed(chalk.green(`Exported ${contacts.length} contacts to ${filename}`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to export contacts: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Lookup emails subcommand
    contactsCommand
        .command('lookup')
        .description('Look up email addresses for contacts')
        .option('-c, --campaign <name>', 'Look up emails for specific campaign')
        .option('--max <number>', 'Maximum number of contacts to process', '20')
        .option('--dry-run', 'Simulate email lookup without making API calls')
        .action(async (options) => {
            const spinner = ora('Looking up email addresses...').start();

            try {
                const dbService = DatabaseService;
                const emailLookupService = new EmailLookupService();

                let contacts = [];

                if (options.campaign) {
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }
                    contacts = await dbService.getContactsByCampaign(campaign._id);
                } else {
                    contacts = await dbService.getAllContacts();
                }

                // Filter contacts without email addresses
                contacts = contacts.filter(c => !c.email && c.linkedinUrl);

                // Limit number of contacts
                const maxContacts = parseInt(options.max);
                if (contacts.length > maxContacts) {
                    contacts = contacts.slice(0, maxContacts);
                }

                if (contacts.length === 0) {
                    spinner.warn('No contacts found without email addresses');
                    return;
                }

                console.log(chalk.blue(`Looking up emails for ${contacts.length} contacts`));

                let successCount = 0;
                let failCount = 0;

                for (let i = 0; i < contacts.length; i++) {
                    const contact = contacts[i];
                    spinner.text = `Looking up email ${i + 1}/${contacts.length}: ${contact.name}`;

                    try {
                        if (options.dryRun) {
                            console.log(chalk.yellow(`[DRY RUN] Would look up email for ${contact.name} (${contact.company})`));
                            successCount++;
                        } else {
                            // Extract domain from LinkedIn URL or use company name
                            let domain = '';
                            if (contact.company) {
                                // Simple domain extraction (in real implementation, you'd use a proper service)
                                domain = contact.company.toLowerCase().replace(/\s+/g, '') + '.com';
                            }

                            const emailResult = await emailLookupService.findEmail({
                                firstName: contact.name.split(' ')[0],
                                lastName: contact.name.split(' ').slice(1).join(' '),
                                domain: domain,
                                linkedinUrl: contact.linkedinUrl
                            });

                            if (emailResult.success && emailResult.email) {
                                contact.email = emailResult.email;
                                await dbService.saveContact(contact);
                                console.log(chalk.green(`✓ Found email for ${contact.name}: ${emailResult.email}`));
                                successCount++;
                            } else {
                                console.log(chalk.red(`✗ No email found for ${contact.name}`));
                                failCount++;
                            }
                        }

                        // Add delay to avoid rate limiting
                        if (i < contacts.length - 1 && !options.dryRun) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }

                    } catch (error) {
                        console.log(chalk.red(`✗ Error looking up email for ${contact.name}: ${error instanceof Error ? error.message : 'Unknown error'}`));
                        failCount++;
                    }
                }

                spinner.succeed(chalk.green(`Email lookup completed: ${successCount}/${contacts.length} successful`));

                console.log(chalk.blue('\n📊 Email Lookup Summary:'));
                console.log(chalk.green(`Successful: ${successCount}`));
                console.log(chalk.red(`Failed: ${failCount}`));
                console.log(chalk.gray(`Success Rate: ${((successCount / contacts.length) * 100).toFixed(1)}%`));

            } catch (error) {
                spinner.fail(chalk.red(`Email lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Update contact subcommand
    contactsCommand
        .command('update')
        .description('Update contact information')
        .option('--id <id>', 'Contact ID to update')
        .option('--name <name>', 'Contact name to find and update')
        .option('--email <email>', 'New email address')
        .option('--status <status>', 'New status')
        .option('--interactive', 'Update contact interactively')
        .action(async (options) => {
            const spinner = ora('Loading contact...').start();

            try {
                const dbService = DatabaseService;
                let contact;

                if (options.id) {
                    contact = await dbService.getContactById(options.id);
                } else if (options.name) {
                    const contacts = await dbService.getAllContacts();
                    contact = contacts.find(c => c.name.toLowerCase().includes(options.name.toLowerCase()));
                } else {
                    spinner.fail('Please provide either --id or --name');
                    return;
                }

                if (!contact) {
                    spinner.fail('Contact not found');
                    return;
                }

                spinner.succeed(chalk.green(`Found contact: ${contact.name}`));

                if (options.interactive) {
                    const inquirer = await import('inquirer');

                    const answers = await inquirer.default.prompt([
                        {
                            type: 'input',
                            name: 'email',
                            message: 'Email address:',
                            default: contact.email || ''
                        },
                        {
                            type: 'list',
                            name: 'status',
                            message: 'Status:',
                            choices: ['new', 'connected', 'rejected'],
                            default: contact.status
                        },
                        {
                            type: 'input',
                            name: 'company',
                            message: 'Company:',
                            default: contact.company || ''
                        },
                        {
                            type: 'input',
                            name: 'position',
                            message: 'Position:',
                            default: contact.position || ''
                        }
                    ]);

                    contact.email = answers.email;
                    contact.status = answers.status;
                    contact.company = answers.company;
                    contact.position = answers.position;
                } else {
                    if (options.email) contact.email = options.email;
                    if (options.status) contact.status = options.status;
                }

                await dbService.saveContact(contact);
                console.log(chalk.green(`Contact "${contact.name}" updated successfully`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to update contact: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Delete contacts subcommand
    contactsCommand
        .command('delete')
        .description('Delete contacts')
        .option('-c, --campaign <name>', 'Delete contacts from specific campaign')
        .option('-s, --status <status>', 'Delete contacts with specific status')
        .option('--id <id>', 'Delete specific contact by ID')
        .option('--force', 'Skip confirmation prompt')
        .action(async (options) => {
            const spinner = ora('Loading contacts...').start();

            try {
                const dbService = DatabaseService;
                let contacts = [];

                if (options.id) {
                    const contact = await dbService.getContactById(options.id);
                    if (contact) {
                        contacts = [contact];
                    }
                } else if (options.campaign) {
                    const campaign = await dbService.getCampaignByName(options.campaign);
                    if (!campaign) {
                        spinner.fail(`Campaign "${options.campaign}" not found`);
                        return;
                    }
                    contacts = await dbService.getContactsByCampaign(campaign._id, options.status);
                } else {
                    spinner.fail('Please provide --id, --campaign, or --status');
                    return;
                }

                if (contacts.length === 0) {
                    spinner.warn('No contacts found to delete');
                    return;
                }

                spinner.succeed(chalk.green(`Found ${contacts.length} contact(s) to delete`));

                if (!options.force) {
                    const inquirer = await import('inquirer');
                    const { confirm } = await inquirer.default.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: `Are you sure you want to delete ${contacts.length} contact(s)?`,
                            default: false
                        }
                    ]);

                    if (!confirm) {
                        console.log(chalk.yellow('Contact deletion cancelled'));
                        return;
                    }
                }

                let deletedCount = 0;
                for (const contact of contacts) {
                    await dbService.deleteContact(contact._id);
                    deletedCount++;
                }

                console.log(chalk.green(`Deleted ${deletedCount} contact(s) successfully`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to delete contacts: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    return contactsCommand;
}
