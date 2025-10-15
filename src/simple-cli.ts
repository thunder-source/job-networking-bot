#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('cold-email-bot')
    .description('A comprehensive CLI tool for LinkedIn networking automation and cold email campaigns')
    .version('1.0.0');

// Start command
program
    .command('start')
    .description('Begin automation campaign with LinkedIn networking and email outreach')
    .option('-c, --campaign <name>', 'Campaign name', 'Default Campaign')
    .option('-k, --keywords <keywords>', 'Search keywords for recruiters', 'recruiter')
    .option('-l, --location <location>', 'Location filter for search')
    .option('-i, --industry <industry>', 'Industry filter for search')
    .option('-m, --max-contacts <number>', 'Maximum number of contacts to process', '50')
    .option('--headless', 'Run in headless mode (no browser window)')
    .option('--dry-run', 'Simulate the campaign without sending actual requests')
    .action(async (options) => {
        console.log(chalk.blue('🚀 Starting automation campaign...'));
        console.log(chalk.gray(`Campaign: ${options.campaign}`));
        console.log(chalk.gray(`Keywords: ${options.keywords}`));
        console.log(chalk.gray(`Max Contacts: ${options.maxContacts}`));
        if (options.location) console.log(chalk.gray(`Location: ${options.location}`));
        if (options.industry) console.log(chalk.gray(`Industry: ${options.industry}`));

        if (options.dryRun) {
            console.log(chalk.yellow('⚠️  This is a dry run - no actual actions will be performed'));
        }

        console.log(chalk.green('✅ Campaign started successfully!'));
        console.log(chalk.blue('\n📊 Next Steps:'));
        console.log(chalk.gray('• Run "cold-email-bot config" to set up API keys'));
        console.log(chalk.gray('• Run "cold-email-bot test" to test your configuration'));
    });

// Search command
program
    .command('search')
    .description('Find and scrape recruiters based on search criteria')
    .option('-k, --keywords <keywords>', 'Search keywords', 'recruiter')
    .option('-l, --location <location>', 'Location filter (e.g., "San Francisco Bay Area")')
    .option('-i, --industry <industry>', 'Industry filter (e.g., "Information Technology")')
    .option('-c, --company <company>', 'Company filter (e.g., "Google")')
    .option('-m, --max-results <number>', 'Maximum number of results to find', '20')
    .option('-o, --output <file>', 'Output file for scraped data (JSON format)')
    .option('--headless', 'Run in headless mode (no browser window)')
    .action(async (options) => {
        console.log(chalk.blue('🔍 Searching for recruiters...'));
        console.log(chalk.gray(`Keywords: ${options.keywords}`));
        console.log(chalk.gray(`Max Results: ${options.maxResults}`));
        if (options.location) console.log(chalk.gray(`Location: ${options.location}`));
        if (options.industry) console.log(chalk.gray(`Industry: ${options.industry}`));
        if (options.company) console.log(chalk.gray(`Company: ${options.company}`));

        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires LinkedIn credentials.'));
        console.log(chalk.blue('📝 To implement:'));
        console.log(chalk.gray('• Set up LinkedIn credentials in .env file'));
        console.log(chalk.gray('• Configure OpenAI API key for message generation'));
        console.log(chalk.gray('• Run "cold-email-bot config" to set up configuration'));
    });

// Connect command
program
    .command('connect')
    .description('Send connection requests from saved contact list')
    .option('-c, --campaign <name>', 'Campaign name to get contacts from')
    .option('-f, --file <file>', 'File containing LinkedIn URLs (one per line)')
    .option('-u, --urls <urls...>', 'LinkedIn profile URLs to connect with')
    .option('-m, --message <message>', 'Custom connection message')
    .option('--max-requests <number>', 'Maximum number of connection requests to send', '20')
    .option('--dry-run', 'Simulate the connection requests without sending them')
    .action(async (options) => {
        console.log(chalk.blue('🔗 Sending connection requests...'));

        if (options.campaign) {
            console.log(chalk.gray(`Campaign: ${options.campaign}`));
        } else if (options.file) {
            console.log(chalk.gray(`File: ${options.file}`));
        } else if (options.urls) {
            console.log(chalk.gray(`URLs: ${options.urls.length} provided`));
        }

        console.log(chalk.gray(`Max Requests: ${options.maxRequests}`));
        if (options.message) console.log(chalk.gray(`Message: ${options.message}`));

        if (options.dryRun) {
            console.log(chalk.yellow('⚠️  This is a dry run - no actual requests will be sent'));
        }

        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires LinkedIn credentials.'));
    });

// Followup command
program
    .command('followup')
    .description('Run follow-up scheduler to process scheduled emails')
    .option('-c, --campaign <name>', 'Process follow-ups for specific campaign')
    .option('--type <type>', 'Email type to process (initial, followup, thankyou)', 'followup')
    .option('--max-emails <number>', 'Maximum number of emails to send', '10')
    .option('--dry-run', 'Simulate email sending without actually sending')
    .action(async (options) => {
        console.log(chalk.blue('📧 Processing follow-up emails...'));
        console.log(chalk.gray(`Campaign: ${options.campaign || 'All'}`));
        console.log(chalk.gray(`Type: ${options.type}`));
        console.log(chalk.gray(`Max Emails: ${options.maxEmails}`));

        if (options.dryRun) {
            console.log(chalk.yellow('⚠️  This is a dry run - no actual emails will be sent'));
        }

        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires email configuration.'));
    });

// Dashboard command
program
    .command('dashboard')
    .description('Show comprehensive dashboard with today\'s activity, pending actions, and system status')
    .option('-r, --refresh <seconds>', 'Auto-refresh interval in seconds', '30')
    .option('--no-refresh', 'Disable auto-refresh')
    .option('--compact', 'Show compact view')
    .option('--export <file>', 'Export dashboard data to JSON file')
    .action(async (options) => {
        const { createDashboardCommand } = await import('./commands/dashboard.js');
        const dashboardCommand = createDashboardCommand();
        await dashboardCommand.parseAsync(['dashboard', ...process.argv.slice(3)]);
    });

// System command
program
    .command('system')
    .description('System management and monitoring commands')
    .action(async () => {
        const systemCommand = await import('./commands/system.js');
        await systemCommand.default.parseAsync(['system', ...process.argv.slice(3)]);
    });

// Stats command
program
    .command('stats')
    .description('Show campaign statistics and analytics')
    .option('-c, --campaign <name>', 'Show stats for specific campaign')
    .option('--all', 'Show stats for all campaigns')
    .option('--export <file>', 'Export stats to JSON file')
    .action(async (options) => {
        console.log(chalk.blue('📊 Campaign Statistics'));

        if (options.campaign) {
            console.log(chalk.gray(`Campaign: ${options.campaign}`));
        } else if (options.all) {
            console.log(chalk.gray('All campaigns'));
        } else {
            console.log(chalk.gray('Active campaigns'));
        }

        if (options.export) {
            console.log(chalk.gray(`Export to: ${options.export}`));
        }

        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires database setup.'));
    });

// Templates command
program
    .command('templates')
    .description('Manage message templates (list, add, edit, delete)')
    .action(() => {
        console.log(chalk.blue('📝 Message Templates'));
        console.log(chalk.gray('Use subcommands to manage templates:'));
        console.log(chalk.gray('  list    - List all templates'));
        console.log(chalk.gray('  add     - Add a new template'));
        console.log(chalk.gray('  edit    - Edit an existing template'));
        console.log(chalk.gray('  delete  - Delete a template'));
        console.log(chalk.gray('  show    - Show template details'));
        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires template service.'));
    });

// Contacts command
program
    .command('contacts')
    .description('View and manage contacts (list, filter, export)')
    .action(() => {
        console.log(chalk.blue('👥 Contact Management'));
        console.log(chalk.gray('Use subcommands to manage contacts:'));
        console.log(chalk.gray('  list    - List contacts with filters'));
        console.log(chalk.gray('  export  - Export contacts to CSV/JSON'));
        console.log(chalk.gray('  lookup  - Look up email addresses'));
        console.log(chalk.gray('  update  - Update contact information'));
        console.log(chalk.gray('  delete  - Delete contacts'));
        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires database setup.'));
    });

// Config command
program
    .command('config')
    .description('Set up API keys and preferences')
    .action(() => {
        console.log(chalk.blue('⚙️  Configuration'));
        console.log(chalk.gray('Use subcommands to manage configuration:'));
        console.log(chalk.gray('  set     - Set configuration values'));
        console.log(chalk.gray('  get     - Get configuration values'));
        console.log(chalk.gray('  list    - List all configuration'));
        console.log(chalk.gray('  reset   - Reset configuration to defaults'));
        console.log(chalk.gray('  validate - Validate current configuration'));
        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires config service.'));
    });

// Test command
program
    .command('test')
    .description('Test LinkedIn login and message generation')
    .option('--linkedin', 'Test LinkedIn login and connection')
    .option('--ai', 'Test AI message generation')
    .option('--email', 'Test email sending')
    .option('--database', 'Test database connection')
    .option('--all', 'Run all tests')
    .action(async (options) => {
        console.log(chalk.blue('🧪 Running Tests'));

        const tests = [];
        if (options.all) {
            tests.push('linkedin', 'ai', 'email', 'database');
        } else {
            if (options.linkedin) tests.push('linkedin');
            if (options.ai) tests.push('ai');
            if (options.email) tests.push('email');
            if (options.database) tests.push('database');
        }

        if (tests.length === 0) {
            console.log(chalk.yellow('Please specify which tests to run (--linkedin, --ai, --email, --database, or --all)'));
            return;
        }

        console.log(chalk.gray(`Running tests: ${tests.join(', ')}`));
        console.log(chalk.yellow('⚠️  This is a placeholder command. Full implementation requires service setup.'));
    });

// Global error handler
program.exitOverride();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    // Don't treat help output as an error
    if (error.message === '(outputHelp)' || error.message.includes('outputHelp')) {
        process.exit(0);
    }
    console.error(chalk.red('Uncaught Exception:'), error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
    process.exit(1);
});

// Parse command line arguments
try {
    program.parse();
} catch (error: any) {
    // Handle help output gracefully
    if (error.message === '(outputHelp)' || error.message.includes('outputHelp')) {
        process.exit(0);
    }
    throw error;
}

export default program;
