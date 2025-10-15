#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import command creators (only the working ones for now)
import { createLinkedInCommand } from './commands/linkedin.js';
import { createConfigCommand } from './commands/config.js';
import { createSearchCommand } from './commands/search.js';
import { createStartCommand } from './commands/start.js';
import { createTemplatesCommand } from './commands/templates.js';

const program = new Command();

program
    .name('cold-email-bot')
    .description('A comprehensive CLI tool for LinkedIn networking automation and cold email campaigns')
    .version('1.0.0');

// Add working commands
program.addCommand(createLinkedInCommand());
program.addCommand(createConfigCommand());
program.addCommand(createSearchCommand());
program.addCommand(createStartCommand());
program.addCommand(createTemplatesCommand());

// Global options
program
    .option('--verbose', 'Enable verbose logging')
    .option('--debug', 'Enable debug mode')
    .option('--config <path>', 'Path to config file');

// Error handling
program.on('command:*', (operands) => {
    console.error(chalk.red(`Unknown command: ${operands[0]}`));
    console.log(chalk.yellow('Run "cold-email-bot --help" to see available commands.'));
    process.exit(1);
});

// Parse command line arguments
program.parse();

export default program;
