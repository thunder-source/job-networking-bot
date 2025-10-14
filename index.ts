#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import databaseService from './src/services/databaseService.js';
import { createLinkedInCommand } from './src/commands/linkedin.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('job-networking-bot')
  .description('A CLI tool for job networking automation')
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'enable verbose logging')
  .option('--config <path>', 'specify config file path', '.env');

// Example command structure
program
  .command('connect')
  .description('Connect to networking platforms')
  .option('-p, --platform <platform>', 'specify platform (linkedin, indeed, etc.)')
  .action(async (options: { platform?: string }) => {
    console.log(chalk.blue('🔗 Connecting to networking platforms...'));
    console.log(chalk.gray(`Platform: ${options.platform || 'all'}`));
    // TODO: Implement connection logic
  });

program
  .command('search')
  .description('Search for job opportunities')
  .option('-k, --keywords <keywords>', 'search keywords')
  .option('-l, --location <location>', 'job location')
  .action(async (options: { keywords?: string; location?: string }) => {
    console.log(chalk.green('🔍 Searching for job opportunities...'));
    console.log(chalk.gray(`Keywords: ${options.keywords || 'none'}`));
    console.log(chalk.gray(`Location: ${options.location || 'any'}`));
    // TODO: Implement search logic
  });

program
  .command('apply')
  .description('Apply to job postings')
  .option('-j, --job-id <id>', 'specific job ID to apply to')
  .option('--auto', 'automatically apply to all matching jobs')
  .action(async (options: { jobId?: string; auto?: boolean }) => {
    console.log(chalk.yellow('📝 Applying to job postings...'));
    console.log(chalk.gray(`Job ID: ${options.jobId || 'all'}`));
    console.log(chalk.gray(`Auto mode: ${options.auto ? 'enabled' : 'disabled'}`));
    // TODO: Implement application logic
  });

program
  .command('network')
  .description('Manage professional network')
  .option('-a, --add <email>', 'add contact to network')
  .option('-l, --list', 'list all contacts')
  .action(async (options: { add?: string; list?: boolean }) => {
    console.log(chalk.cyan('👥 Managing professional network...'));
    if (options.add) {
      console.log(chalk.gray(`Adding contact: ${options.add}`));
    }
    if (options.list) {
      console.log(chalk.gray('Listing all contacts...'));
    }
    // TODO: Implement networking logic
  });

// Database management commands
program
  .command('db:init')
  .description('Initialize database connection')
  .action(async () => {
    try {
      await databaseService.initialize();
      console.log(chalk.green('✅ Database initialized successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize database:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('db:health')
  .description('Check database health')
  .action(async () => {
    try {
      const health = await databaseService.healthCheck();
      console.log(chalk.blue('🏥 Database Health Check:'));
      console.log(chalk.gray(`Status: ${health.status}`));
      console.log(chalk.gray(`Message: ${health.message}`));
    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), (error as Error).message);
    }
  });

program
  .command('db:stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 Database Statistics:'));

      const contactStats = await databaseService.getContactStats();
      console.log(chalk.cyan('Contacts:'));
      contactStats.forEach(stat => {
        console.log(chalk.gray(`  ${stat._id}: ${stat.count}`));
      });

      const campaignStats = await databaseService.getCampaignStats();
      console.log(chalk.cyan('Campaigns:'));
      campaignStats.forEach(stat => {
        console.log(chalk.gray(`  ${stat._id}: ${stat.count}`));
      });

      const templateStats = await databaseService.getTemplateStats();
      console.log(chalk.cyan('Templates:'));
      templateStats.forEach(stat => {
        console.log(chalk.gray(`  ${stat._id}: ${stat.count} (${stat.totalUsage} uses)`));
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to get statistics:'), (error as Error).message);
    }
  });

// Add LinkedIn automation commands
program.addCommand(createLinkedInCommand());

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
  console.log(chalk.gray('See --help for a list of available commands.'));
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
