import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export function createConfigCommand(): Command {
    const configCommand = new Command('config')
        .description('Set up API keys and preferences')
        .action(() => {
            console.log(chalk.blue('Use subcommands to manage configuration:'));
            console.log(chalk.gray('  set     - Set configuration values'));
            console.log(chalk.gray('  get     - Get configuration values'));
            console.log(chalk.gray('  list    - List all configuration'));
            console.log(chalk.gray('  reset   - Reset configuration to defaults'));
            console.log(chalk.gray('  validate - Validate current configuration'));
        });

    // Set config subcommand
    configCommand
        .command('set')
        .description('Set configuration values')
        .option('-k, --key <key>', 'Configuration key to set')
        .option('-v, --value <value>', 'Value to set')
        .option('--interactive', 'Set configuration interactively')
        .action(async (options) => {
            const spinner = ora('Updating configuration...').start();

            try {
                const configPath = path.join(process.cwd(), '.env');
                let envContent = '';

                // Load existing .env file if it exists
                if (fs.existsSync(configPath)) {
                    envContent = await fs.promises.readFile(configPath, 'utf8');
                }

                if (options.interactive) {
                    // Interactive configuration
                    const inquirer = await import('inquirer');

                    const configQuestions = [
                        {
                            type: 'password',
                            name: 'LINKEDIN_EMAIL',
                            message: 'LinkedIn email address:',
                            default: process.env.LINKEDIN_EMAIL || ''
                        },
                        {
                            type: 'password',
                            name: 'LINKEDIN_PASSWORD',
                            message: 'LinkedIn password:',
                            default: process.env.LINKEDIN_PASSWORD || ''
                        },
                        {
                            type: 'password',
                            name: 'OPENAI_API_KEY',
                            message: 'OpenAI API key:',
                            default: process.env.OPENAI_API_KEY || ''
                        },
                        {
                            type: 'input',
                            name: 'USER_NAME',
                            message: 'Your name (for personalization):',
                            default: process.env.USER_NAME || ''
                        },
                        {
                            type: 'input',
                            name: 'TARGET_ROLE',
                            message: 'Target role (e.g., Software Engineer):',
                            default: process.env.TARGET_ROLE || ''
                        },
                        {
                            type: 'input',
                            name: 'USER_SKILLS',
                            message: 'Your skills (comma-separated):',
                            default: process.env.USER_SKILLS || ''
                        },
                        {
                            type: 'input',
                            name: 'USER_EXPERIENCE',
                            message: 'Your experience (e.g., 5+ years):',
                            default: process.env.USER_EXPERIENCE || ''
                        },
                        {
                            type: 'input',
                            name: 'SMTP_HOST',
                            message: 'SMTP host for email sending:',
                            default: process.env.SMTP_HOST || ''
                        },
                        {
                            type: 'input',
                            name: 'SMTP_PORT',
                            message: 'SMTP port:',
                            default: process.env.SMTP_PORT || '587'
                        },
                        {
                            type: 'input',
                            name: 'SMTP_USER',
                            message: 'SMTP username:',
                            default: process.env.SMTP_USER || ''
                        },
                        {
                            type: 'password',
                            name: 'SMTP_PASS',
                            message: 'SMTP password:',
                            default: process.env.SMTP_PASS || ''
                        },
                        {
                            type: 'input',
                            name: 'FROM_EMAIL',
                            message: 'From email address:',
                            default: process.env.FROM_EMAIL || ''
                        }
                    ];

                    const answers = await inquirer.default.prompt(configQuestions);

                    // Update .env content
                    for (const [key, value] of Object.entries(answers)) {
                        if (value) {
                            const regex = new RegExp(`^${key}=.*$`, 'm');
                            const newLine = `${key}=${value}`;

                            if (regex.test(envContent)) {
                                envContent = envContent.replace(regex, newLine);
                            } else {
                                envContent += `\n${newLine}`;
                            }
                        }
                    }

                } else {
                    // Set specific key-value pair
                    if (!options.key || !options.value) {
                        spinner.fail('Please provide both --key and --value, or use --interactive');
                        return;
                    }

                    const regex = new RegExp(`^${options.key}=.*$`, 'm');
                    const newLine = `${options.key}=${options.value}`;

                    if (regex.test(envContent)) {
                        envContent = envContent.replace(regex, newLine);
                    } else {
                        envContent += `\n${newLine}`;
                    }
                }

                // Write updated .env file
                await fs.promises.writeFile(configPath, envContent.trim());

                // Reload environment variables
                dotenv.config();

                spinner.succeed(chalk.green('Configuration updated successfully'));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Get config subcommand
    configCommand
        .command('get')
        .description('Get configuration values')
        .option('-k, --key <key>', 'Configuration key to get')
        .option('--all', 'Show all configuration values')
        .action(async (options) => {
            try {
                if (options.all) {
                    // Show all configuration
                    console.log(chalk.blue('\n📋 Current Configuration:'));

                    const configKeys = [
                        'LINKEDIN_EMAIL',
                        'LINKEDIN_PASSWORD',
                        'OPENAI_API_KEY',
                        'USER_NAME',
                        'TARGET_ROLE',
                        'USER_SKILLS',
                        'USER_EXPERIENCE',
                        'SMTP_HOST',
                        'SMTP_PORT',
                        'SMTP_USER',
                        'SMTP_PASS',
                        'FROM_EMAIL'
                    ];

                    configKeys.forEach(key => {
                        const value = process.env[key];
                        if (value) {
                            // Mask sensitive values
                            const displayValue = ['LINKEDIN_PASSWORD', 'SMTP_PASS', 'OPENAI_API_KEY'].includes(key)
                                ? '*'.repeat(8)
                                : value;
                            console.log(chalk.gray(`${key}: ${displayValue}`));
                        } else {
                            console.log(chalk.red(`${key}: Not set`));
                        }
                    });

                } else if (options.key) {
                    // Show specific key
                    const value = process.env[options.key];
                    if (value) {
                        // Mask sensitive values
                        const displayValue = ['LINKEDIN_PASSWORD', 'SMTP_PASS', 'OPENAI_API_KEY'].includes(options.key)
                            ? '*'.repeat(8)
                            : value;
                        console.log(chalk.blue(`${options.key}: ${displayValue}`));
                    } else {
                        console.log(chalk.red(`${options.key}: Not set`));
                    }
                } else {
                    console.log(chalk.yellow('Please provide --key or --all'));
                }

            } catch (error) {
                console.log(chalk.red(`Failed to get configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // List config subcommand
    configCommand
        .command('list')
        .description('List all configuration with status')
        .action(async () => {
            try {
                console.log(chalk.blue('\n📋 Configuration Status:'));

                const configItems = [
                    { key: 'LINKEDIN_EMAIL', name: 'LinkedIn Email', required: true },
                    { key: 'LINKEDIN_PASSWORD', name: 'LinkedIn Password', required: true },
                    { key: 'OPENAI_API_KEY', name: 'OpenAI API Key', required: true },
                    { key: 'USER_NAME', name: 'Your Name', required: false },
                    { key: 'TARGET_ROLE', name: 'Target Role', required: false },
                    { key: 'USER_SKILLS', name: 'Your Skills', required: false },
                    { key: 'USER_EXPERIENCE', name: 'Your Experience', required: false },
                    { key: 'SMTP_HOST', name: 'SMTP Host', required: false },
                    { key: 'SMTP_PORT', name: 'SMTP Port', required: false },
                    { key: 'SMTP_USER', name: 'SMTP Username', required: false },
                    { key: 'SMTP_PASS', name: 'SMTP Password', required: false },
                    { key: 'FROM_EMAIL', name: 'From Email', required: false }
                ];

                configItems.forEach(item => {
                    const value = process.env[item.key];
                    const status = value ? chalk.green('✓ Set') : chalk.red('✗ Not set');
                    const required = item.required ? chalk.red('(Required)') : chalk.gray('(Optional)');

                    console.log(chalk.gray(`${item.name}: ${status} ${required}`));
                });

            } catch (error) {
                console.log(chalk.red(`Failed to list configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Reset config subcommand
    configCommand
        .command('reset')
        .description('Reset configuration to defaults')
        .option('--force', 'Skip confirmation prompt')
        .action(async (options) => {
            const spinner = ora('Resetting configuration...').start();

            try {
                if (!options.force) {
                    const inquirer = await import('inquirer');
                    const { confirm } = await inquirer.default.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: 'Are you sure you want to reset all configuration? This will remove all API keys and settings.',
                            default: false
                        }
                    ]);

                    if (!confirm) {
                        console.log(chalk.yellow('Configuration reset cancelled'));
                        return;
                    }
                }

                const configPath = path.join(process.cwd(), '.env');

                // Create default .env file
                const defaultConfig = `# Cold Email Bot Configuration
# LinkedIn Credentials
LINKEDIN_EMAIL=
LINKEDIN_PASSWORD=

# OpenAI API
OPENAI_API_KEY=

# User Information
USER_NAME=
TARGET_ROLE=
USER_SKILLS=
USER_EXPERIENCE=

# Email Configuration
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=
`;

                await fs.promises.writeFile(configPath, defaultConfig);

                // Reload environment variables
                dotenv.config();

                spinner.succeed(chalk.green('Configuration reset to defaults'));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Validate config subcommand
    configCommand
        .command('validate')
        .description('Validate current configuration')
        .action(async () => {
            const spinner = ora('Validating configuration...').start();

            try {
                const requiredKeys = [
                    'LINKEDIN_EMAIL',
                    'LINKEDIN_PASSWORD',
                    'OPENAI_API_KEY'
                ];

                const optionalKeys = [
                    'USER_NAME',
                    'TARGET_ROLE',
                    'USER_SKILLS',
                    'USER_EXPERIENCE',
                    'SMTP_HOST',
                    'SMTP_PORT',
                    'SMTP_USER',
                    'SMTP_PASS',
                    'FROM_EMAIL'
                ];

                let isValid = true;
                const issues = [];

                // Check required keys
                requiredKeys.forEach(key => {
                    if (!process.env[key]) {
                        isValid = false;
                        issues.push(`Missing required configuration: ${key}`);
                    }
                });

                // Check optional keys
                optionalKeys.forEach(key => {
                    if (!process.env[key]) {
                        issues.push(`Missing optional configuration: ${key}`);
                    }
                });

                // Check email configuration completeness
                const emailKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL'];
                const emailConfigured = emailKeys.every(key => process.env[key]);
                const partialEmail = emailKeys.some(key => process.env[key]);

                if (partialEmail && !emailConfigured) {
                    issues.push('Email configuration is incomplete. All SMTP settings are required for email functionality.');
                }

                if (isValid) {
                    spinner.succeed(chalk.green('Configuration is valid'));
                } else {
                    spinner.fail(chalk.red('Configuration has issues'));
                }

                if (issues.length > 0) {
                    console.log(chalk.yellow('\n⚠️  Configuration Issues:'));
                    issues.forEach(issue => {
                        console.log(chalk.gray(`  • ${issue}`));
                    });
                }

                console.log(chalk.blue('\n📋 Configuration Summary:'));
                console.log(chalk.gray(`Required settings: ${requiredKeys.filter(key => process.env[key]).length}/${requiredKeys.length}`));
                console.log(chalk.gray(`Optional settings: ${optionalKeys.filter(key => process.env[key]).length}/${optionalKeys.length}`));
                console.log(chalk.gray(`Email configured: ${emailConfigured ? 'Yes' : 'No'}`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to validate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    return configCommand;
}
