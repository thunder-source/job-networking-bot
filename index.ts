#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import databaseService from './src/services/databaseService.js';
import { createLinkedInCommand } from './src/commands/linkedin.js';
import { SchedulerService, ISchedulerConfig } from './src/services/schedulerService.js';
import { EmailService } from './src/services/emailService.js';
import { LinkedInService } from './src/services/linkedinService.js';
import conversationService from './src/services/conversationService.js';

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

// Scheduler commands
program
  .command('scheduler:start')
  .description('Start the follow-up scheduler service')
  .option('--timezone <timezone>', 'timezone for scheduling', 'America/New_York')
  .action(async (options: { timezone: string }) => {
    try {
      console.log(chalk.blue('⏰ Starting scheduler service...'));

      // Initialize database
      await databaseService.initialize();

      // Create scheduler configuration
      const schedulerConfig: ISchedulerConfig = {
        enabled: true,
        timezone: options.timezone,
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
          maxTasksPerHour: 50,
          delayBetweenTasks: 60000
        },
        retrySettings: {
          maxRetries: 3,
          retryDelay: 300000,
          exponentialBackoff: true
        }
      };

      // Initialize services
      const emailService = new EmailService({
        provider: 'gmail',
        credentials: {
          email: process.env.EMAIL_USER || '',
          password: process.env.EMAIL_PASSWORD || ''
        }
      });

      const linkedinService = new LinkedInService({
        headless: true,
        enableLogging: true
      });

      // Create and start scheduler
      const scheduler = new SchedulerService(
        schedulerConfig,
        emailService,
        linkedinService,
        databaseService
      );

      await scheduler.start();

      console.log(chalk.green('✅ Scheduler started successfully'));
      console.log(chalk.gray('Press Ctrl+C to stop the scheduler'));

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('🛑 Stopping scheduler...'));
        await scheduler.stop();
        await databaseService.cleanup();
        process.exit(0);
      });

      // Keep the process alive
      setInterval(() => {
        const status = scheduler.getStatus();
        console.log(chalk.gray(`Scheduler status: ${status.pendingTasks} pending, ${status.completedTasks} completed`));
      }, 300000); // Every 5 minutes

    } catch (error) {
      console.error(chalk.red('❌ Failed to start scheduler:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('scheduler:status')
  .description('Check scheduler service status')
  .action(async () => {
    try {
      console.log(chalk.blue('📊 Scheduler Status:'));
      console.log(chalk.gray('Note: This command requires the scheduler to be running'));
      // TODO: Implement status checking via API or file
    } catch (error) {
      console.error(chalk.red('❌ Failed to get scheduler status:'), (error as Error).message);
    }
  });

// Conversation management commands
program
  .command('conversation:analyze <contactId>')
  .description('Analyze conversation history for a specific contact')
  .action(async (contactId: string) => {
    try {
      await databaseService.initialize();

      console.log(chalk.blue(`📊 Analyzing conversation for contact ${contactId}...`));

      const contact = await databaseService.getContactById(contactId);
      if (!contact) {
        console.error(chalk.red(`Contact with ID ${contactId} not found`));
        return;
      }

      console.log(chalk.cyan(`Contact: ${contact.name} at ${contact.company || 'Unknown Company'}`));

      // Get conversation metrics
      const metrics = await conversationService.getConversationMetrics(contactId);
      console.log(chalk.cyan('\n📈 Conversation Metrics:'));
      console.log(chalk.gray(`   Total Interactions: ${metrics.totalInteractions}`));
      console.log(chalk.gray(`   Response Rate: ${metrics.responseRate.toFixed(1)}%`));
      console.log(chalk.gray(`   Positive Response Rate: ${metrics.positiveResponseRate.toFixed(1)}%`));
      console.log(chalk.gray(`   Engagement Score: ${metrics.engagementScore.toFixed(1)}/100`));

      // Generate summary
      const summary = await conversationService.generateConversationSummary(contactId);
      console.log(chalk.cyan('\n📋 Conversation Summary:'));
      console.log(chalk.gray(`   Summary: ${summary.summary}`));
      console.log(chalk.gray(`   Sentiment: ${summary.sentiment}`));

      if (summary.keyPoints.length > 0) {
        console.log(chalk.gray('   Key Points:'));
        summary.keyPoints.forEach(point => {
          console.log(chalk.gray(`     - ${point}`));
        });
      }

      console.log(chalk.green('\n✅ Analysis completed'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to analyze conversation:'), (error as Error).message);
    }
  });

program
  .command('conversation:followups')
  .description('Show all contacts that need follow-up')
  .action(async () => {
    try {
      await databaseService.initialize();

      console.log(chalk.blue('🚩 Follow-up Flags:'));

      const followUpFlags = conversationService.getFollowUpFlags();

      if (followUpFlags.length === 0) {
        console.log(chalk.yellow('No follow-up flags found.'));
        return;
      }

      console.log(chalk.cyan(`Total follow-up flags: ${followUpFlags.length}\n`));

      followUpFlags.forEach((flag, index) => {
        const priorityColor = flag.priority === 'high' ? chalk.red :
          flag.priority === 'medium' ? chalk.yellow : chalk.green;

        console.log(chalk.cyan(`${index + 1}. Contact ID: ${flag.contactId}`));
        console.log(chalk.gray(`   Reason: ${flag.reason}`));
        console.log(priorityColor(`   Priority: ${flag.priority.toUpperCase()}`));
        console.log(chalk.gray(`   Action: ${flag.suggestedAction}`));
        console.log(chalk.gray(`   Created: ${flag.createdDate.toLocaleString()}`));
        if (flag.dueDate) {
          console.log(chalk.gray(`   Due: ${flag.dueDate.toLocaleString()}`));
        }
        console.log();
      });

    } catch (error) {
      console.error(chalk.red('❌ Failed to get follow-up flags:'), (error as Error).message);
    }
  });

program
  .command('conversation:update-dates')
  .description('Update next action dates based on contact engagement')
  .action(async () => {
    try {
      await databaseService.initialize();

      console.log(chalk.blue('⏰ Updating next action dates...'));

      await conversationService.updateNextActionDates();

      console.log(chalk.green('✅ Next action dates updated successfully'));

    } catch (error) {
      console.error(chalk.red('❌ Failed to update next action dates:'), (error as Error).message);
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
