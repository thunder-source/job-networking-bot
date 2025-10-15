import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { TemplateService } from '../services/templateService.js';
import { Template } from '../models/index.js';
import { TemplateType } from '../types/index.js';

export function createTemplatesCommand(): Command {
    const templatesCommand = new Command('templates')
        .description('Manage message templates (list, add, edit, delete)')
        .action(() => {
            console.log(chalk.blue('Use subcommands to manage templates:'));
            console.log(chalk.gray('  list    - List all templates'));
            console.log(chalk.gray('  add     - Add a new template'));
            console.log(chalk.gray('  edit    - Edit an existing template'));
            console.log(chalk.gray('  delete  - Delete a template'));
            console.log(chalk.gray('  show    - Show template details'));
        });

    // List templates subcommand
    templatesCommand
        .command('list')
        .description('List all message templates')
        .option('--type <type>', 'Filter by template type (initial, followup, thankyou)')
        .option('--format <format>', 'Output format (table, json)', 'table')
        .action(async (options) => {
            const spinner = ora('Loading templates...').start();

            try {
                const templateService = new TemplateService();
                let templates = await templateService.getTemplatesByType(TemplateType.CONNECTION);

                if (options.type) {
                    templates = templates.filter(t => t.type === options.type);
                }

                if (templates.length === 0) {
                    spinner.warn('No templates found');
                    return;
                }

                spinner.succeed(chalk.green(`Found ${templates.length} template(s)`));

                if (options.format === 'json') {
                    console.log(JSON.stringify(templates, null, 2));
                } else {
                    console.log(chalk.blue('\n📝 Message Templates:'));
                    templates.forEach((template, index) => {
                        console.log(chalk.yellow(`\n${index + 1}. ${template.name}`));
                        console.log(chalk.gray(`   Type: ${template.type}`));
                        console.log(chalk.gray(`   Subject: ${template.subject || 'N/A'}`));
                        console.log(chalk.gray(`   Content: ${template.content.substring(0, 100)}...`));
                        console.log(chalk.gray(`   Variables: ${template.variables.join(', ')}`));
                        console.log(chalk.gray(`   Created: ${template.createdAt.toLocaleDateString()}`));
                    });
                }

            } catch (error) {
                spinner.fail(chalk.red(`Failed to load templates: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Add template subcommand
    templatesCommand
        .command('add')
        .description('Add a new message template')
        .option('-n, --name <name>', 'Template name')
        .option('-t, --type <type>', 'Template type (initial, followup, thankyou)', 'initial')
        .option('-s, --subject <subject>', 'Email subject line')
        .option('-c, --content <content>', 'Template content')
        .option('-f, --file <file>', 'Load template from file')
        .option('--interactive', 'Create template interactively')
        .action(async (options) => {
            const spinner = ora('Creating template...').start();

            try {
                const templateService = new TemplateService();
                let templateData: any = {};

                if (options.interactive) {
                    // Interactive template creation
                    const inquirer = await import('inquirer');

                    const answers = await inquirer.default.prompt([
                        {
                            type: 'input',
                            name: 'name',
                            message: 'Template name:',
                            validate: (input: string) => input.length > 0 || 'Name is required'
                        },
                        {
                            type: 'list',
                            name: 'type',
                            message: 'Template type:',
                            choices: ['initial', 'followup', 'thankyou']
                        },
                        {
                            type: 'input',
                            name: 'subject',
                            message: 'Email subject (optional):',
                        },
                        {
                            type: 'editor',
                            name: 'content',
                            message: 'Template content (use {name}, {company}, etc. for variables):',
                            validate: (input: string) => input.length > 0 || 'Content is required'
                        }
                    ]);

                    templateData = answers;
                } else if (options.file) {
                    // Load from file
                    const fs = await import('fs');
                    const fileContent = await fs.promises.readFile(options.file, 'utf8');
                    const fileData = JSON.parse(fileContent);
                    templateData = fileData;
                } else {
                    // Use command line options
                    if (!options.name || !options.content) {
                        spinner.fail('Name and content are required. Use --interactive for guided creation.');
                        return;
                    }

                    templateData = {
                        name: options.name,
                        type: options.type,
                        subject: options.subject,
                        content: options.content
                    };
                }

                // Extract variables from content
                const variableRegex = /\{(\w+)\}/g;
                const variables = [...new Set(Array.from(templateData.content.matchAll(variableRegex), m => m[1]))];

                const template = new Template({
                    name: templateData.name,
                    type: templateData.type,
                    subject: templateData.subject,
                    content: templateData.content,
                    variables
                });

                const savedTemplate = await templateService.createTemplate(template);
                spinner.succeed(chalk.green(`Template "${savedTemplate.name}" created successfully`));

                console.log(chalk.blue('\n📝 Template Details:'));
                console.log(chalk.gray(`Name: ${savedTemplate.name}`));
                console.log(chalk.gray(`Type: ${savedTemplate.type}`));
                console.log(chalk.gray(`Subject: ${savedTemplate.subject || 'N/A'}`));
                console.log(chalk.gray(`Variables: ${savedTemplate.variables.join(', ')}`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to create template: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Edit template subcommand
    templatesCommand
        .command('edit')
        .description('Edit an existing template')
        .option('-n, --name <name>', 'Template name to edit')
        .option('--id <id>', 'Template ID to edit')
        .option('--interactive', 'Edit template interactively')
        .action(async (options) => {
            const spinner = ora('Loading template...').start();

            try {
                const templateService = new TemplateService();
                let template;

                if (options.id) {
                    template = await templateService.getTemplateById(options.id);
                } else if (options.name) {
                    const searchResults = await templateService.searchTemplates(options.name);
                    template = searchResults.find(t => t.name === options.name) || null;
                } else {
                    spinner.fail('Please provide either --name or --id');
                    return;
                }

                if (!template) {
                    spinner.fail('Template not found');
                    return;
                }

                spinner.succeed(chalk.green(`Found template: ${template.name}`));

                if (options.interactive) {
                    // Interactive editing
                    const inquirer = await import('inquirer');

                    const answers = await inquirer.default.prompt([
                        {
                            type: 'input',
                            name: 'name',
                            message: 'Template name:',
                            default: template.name
                        },
                        {
                            type: 'list',
                            name: 'type',
                            message: 'Template type:',
                            choices: ['initial', 'followup', 'thankyou'],
                            default: template.type
                        },
                        {
                            type: 'input',
                            name: 'subject',
                            message: 'Email subject:',
                            default: template.subject || ''
                        },
                        {
                            type: 'editor',
                            name: 'content',
                            message: 'Template content:',
                            default: template.content
                        }
                    ]);

                    // Update template
                    template.name = answers.name;
                    template.type = answers.type;
                    template.subject = answers.subject;
                    template.content = answers.content;

                    // Extract variables
                    const variableRegex = /\{(\w+)\}/g;
                    template.variables = [...new Set(Array.from(answers.content.matchAll(variableRegex), m => m[1]))];

                    await templateService.createTemplate(template);
                    console.log(chalk.green(`Template "${template.name}" updated successfully`));
                } else {
                    console.log(chalk.blue('\n📝 Current Template:'));
                    console.log(chalk.gray(`Name: ${template.name}`));
                    console.log(chalk.gray(`Type: ${template.type}`));
                    console.log(chalk.gray(`Subject: ${template.subject || 'N/A'}`));
                    console.log(chalk.gray(`Content: ${template.content}`));
                    console.log(chalk.gray(`Variables: ${template.variables.join(', ')}`));
                    console.log(chalk.yellow('\nUse --interactive to edit this template'));
                }

            } catch (error) {
                spinner.fail(chalk.red(`Failed to edit template: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Delete template subcommand
    templatesCommand
        .command('delete')
        .description('Delete a template')
        .option('-n, --name <name>', 'Template name to delete')
        .option('--id <id>', 'Template ID to delete')
        .option('--force', 'Skip confirmation prompt')
        .action(async (options) => {
            const spinner = ora('Loading template...').start();

            try {
                const templateService = new TemplateService();
                let template;

                if (options.id) {
                    template = await templateService.getTemplateById(options.id);
                } else if (options.name) {
                    const searchResults = await templateService.searchTemplates(options.name);
                    template = searchResults.find(t => t.name === options.name) || null;
                } else {
                    spinner.fail('Please provide either --name or --id');
                    return;
                }

                if (!template) {
                    spinner.fail('Template not found');
                    return;
                }

                spinner.succeed(chalk.green(`Found template: ${template.name}`));

                if (!options.force) {
                    const inquirer = await import('inquirer');
                    const { confirm } = await inquirer.default.prompt([
                        {
                            type: 'confirm',
                            name: 'confirm',
                            message: `Are you sure you want to delete template "${template.name}"?`,
                            default: false
                        }
                    ]);

                    if (!confirm) {
                        console.log(chalk.yellow('Template deletion cancelled'));
                        return;
                    }
                }

                await templateService.deleteTemplate(template._id);
                console.log(chalk.green(`Template "${template.name}" deleted successfully`));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    // Show template subcommand
    templatesCommand
        .command('show')
        .description('Show detailed template information')
        .option('-n, --name <name>', 'Template name to show')
        .option('--id <id>', 'Template ID to show')
        .action(async (options) => {
            const spinner = ora('Loading template...').start();

            try {
                const templateService = new TemplateService();
                let template;

                if (options.id) {
                    template = await templateService.getTemplateById(options.id);
                } else if (options.name) {
                    const searchResults = await templateService.searchTemplates(options.name);
                    template = searchResults.find(t => t.name === options.name) || null;
                } else {
                    spinner.fail('Please provide either --name or --id');
                    return;
                }

                if (!template) {
                    spinner.fail('Template not found');
                    return;
                }

                spinner.succeed(chalk.green(`Found template: ${template.name}`));

                console.log(chalk.blue('\n📝 Template Details:'));
                console.log(chalk.yellow(`Name: ${template.name}`));
                console.log(chalk.gray(`Type: ${template.type}`));
                console.log(chalk.gray(`Subject: ${template.subject || 'N/A'}`));
                console.log(chalk.gray(`Variables: ${template.variables.join(', ')}`));
                console.log(chalk.gray(`Created: ${template.createdAt.toLocaleDateString()}`));
                console.log(chalk.gray(`Updated: ${template.updatedAt.toLocaleDateString()}`));

                console.log(chalk.yellow('\nContent:'));
                console.log(chalk.gray(template.content));

            } catch (error) {
                spinner.fail(chalk.red(`Failed to load template: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

    return templatesCommand;
}
