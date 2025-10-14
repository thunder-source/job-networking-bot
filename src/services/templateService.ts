import { logger } from '../utils/logger.js';
import databaseService from './databaseService.js';
import type {
    ITemplate,
    ITemplateVariable,
    CreateTemplateData
} from '../types/index.js';
import {
    TemplateType,
    TemplateCategory,
    VariableType
} from '../types/index.js';
import type { ITemplateDocument } from '../models/Template.js';

// Template Service for managing message templates with CRUD operations
export class TemplateService {
    private readonly maxTemplateLength: number = 300;
    private readonly minTemplateLength: number = 50;

    constructor() {
        // Initialize default templates if none exist
        this.initializeDefaultTemplates();
    }

    /**
     * Create a new template
     * @param templateData - Template data to create
     * @returns Promise<ITemplateDocument> - Created template
     */
    async createTemplate(templateData: CreateTemplateData): Promise<ITemplateDocument> {
        try {
            // Validate template data
            const validationErrors = this.validateTemplateData(templateData);
            if (validationErrors.length > 0) {
                throw new Error(`Template validation failed: ${validationErrors.join(', ')}`);
            }

            // Extract variables from content
            const extractedVariables = this.extractVariablesFromContent(templateData.content);

            // Merge extracted variables with provided variables
            const mergedVariables = this.mergeVariables(extractedVariables, templateData.variables || []);

            const templateWithVariables = {
                ...templateData,
                variables: mergedVariables,
                settings: {
                    maxLength: this.maxTemplateLength,
                    minLength: this.minTemplateLength,
                    allowHtml: false,
                    allowMarkdown: true,
                    ...templateData.settings
                }
            };

            const template = await databaseService.createTemplate(templateWithVariables);

            logger.info(`Template created: ${template.name} (ID: ${template._id})`);
            return template;

        } catch (error) {
            logger.error('Error creating template:', error);
            throw error;
        }
    }

    /**
     * Get template by ID
     * @param id - Template ID
     * @returns Promise<ITemplateDocument | null> - Template or null if not found
     */
    async getTemplateById(id: string): Promise<ITemplateDocument | null> {
        try {
            const template = await databaseService.getTemplateById(id);
            if (template) {
                logger.info(`Template retrieved: ${template.name}`);
            }
            return template;
        } catch (error) {
            logger.error('Error getting template by ID:', error);
            throw error;
        }
    }

    /**
     * Get templates by type
     * @param type - Template type
     * @returns Promise<ITemplateDocument[]> - Array of templates
     */
    async getTemplatesByType(type: TemplateType): Promise<ITemplateDocument[]> {
        try {
            const templates = await databaseService.getTemplates({ type, isActive: true });
            logger.info(`Retrieved ${templates.length} templates of type: ${type}`);
            return templates;
        } catch (error) {
            logger.error('Error getting templates by type:', error);
            throw error;
        }
    }

    /**
     * Get templates by category
     * @param category - Template category
     * @returns Promise<ITemplateDocument[]> - Array of templates
     */
    async getTemplatesByCategory(category: TemplateCategory): Promise<ITemplateDocument[]> {
        try {
            const templates = await databaseService.getTemplates({ category, isActive: true });
            logger.info(`Retrieved ${templates.length} templates in category: ${category}`);
            return templates;
        } catch (error) {
            logger.error('Error getting templates by category:', error);
            throw error;
        }
    }

    /**
     * Get templates by scenario (combination of type and category)
     * @param scenario - Scenario configuration
     * @returns Promise<ITemplateDocument[]> - Array of templates
     */
    async getTemplatesByScenario(scenario: IScenario): Promise<ITemplateDocument[]> {
        try {
            const filter: any = { isActive: true };

            if (scenario.type) filter.type = scenario.type;
            if (scenario.category) filter.category = scenario.category;
            if (scenario.tags && scenario.tags.length > 0) {
                filter.tags = { $in: scenario.tags };
            }
            if (scenario.platform) filter.tags = { ...filter.tags, $in: [scenario.platform] };

            const templates = await databaseService.getTemplates(filter);
            logger.info(`Retrieved ${templates.length} templates for scenario: ${JSON.stringify(scenario)}`);
            return templates;
        } catch (error) {
            logger.error('Error getting templates by scenario:', error);
            throw error;
        }
    }

    /**
     * Update an existing template
     * @param id - Template ID
     * @param updateData - Data to update
     * @returns Promise<ITemplateDocument | null> - Updated template
     */
    async updateTemplate(id: string, updateData: Partial<CreateTemplateData>): Promise<ITemplateDocument | null> {
        try {
            // Validate update data if content is being updated
            if (updateData.content) {
                const validationErrors = this.validateTemplateContent(updateData.content);
                if (validationErrors.length > 0) {
                    throw new Error(`Template content validation failed: ${validationErrors.join(', ')}`);
                }

                // Extract variables from updated content
                const extractedVariables = this.extractVariablesFromContent(updateData.content);
                updateData.variables = this.mergeVariables(extractedVariables, updateData.variables || []);
            }

            const template = await databaseService.updateTemplate(id, updateData);
            if (template) {
                logger.info(`Template updated: ${template.name}`);
            }
            return template;
        } catch (error) {
            logger.error('Error updating template:', error);
            throw error;
        }
    }

    /**
     * Delete a template
     * @param id - Template ID
     * @returns Promise<void>
     */
    async deleteTemplate(id: string): Promise<void> {
        try {
            await databaseService.deleteTemplate(id);
            logger.info(`Template deleted: ${id}`);
        } catch (error) {
            logger.error('Error deleting template:', error);
            throw error;
        }
    }

    /**
     * Test template with sample data
     * @param templateId - Template ID
     * @param sampleData - Sample data for testing
     * @returns Promise<ITemplateTestResult> - Test result
     */
    async testTemplate(templateId: string, sampleData: Record<string, any> = {}): Promise<ITemplateTestResult> {
        try {
            const template = await this.getTemplateById(templateId);
            if (!template) {
                throw new Error(`Template not found: ${templateId}`);
            }

            // Generate sample data if not provided
            const testData = sampleData || this.generateSampleData(template);

            // Validate variables
            const validationErrors = template.validateVariables(testData);

            // Render template
            let renderedContent: string;
            let renderError: string | null = null;

            try {
                renderedContent = template.render(testData);
            } catch (error) {
                renderError = error instanceof Error ? error.message : 'Unknown render error';
                renderedContent = '';
            }

            // Check character limits
            const lengthCheck = this.checkCharacterLimits(renderedContent, template.settings);

            const result: ITemplateTestResult = {
                templateId,
                templateName: template.name,
                success: validationErrors.length === 0 && !renderError,
                renderedContent,
                characterCount: renderedContent.length,
                validationErrors,
                renderError,
                lengthCheck,
                testData,
                timestamp: new Date()
            };

            logger.info(`Template test completed: ${template.name} - ${result.success ? 'SUCCESS' : 'FAILED'}`);
            return result;

        } catch (error) {
            logger.error('Error testing template:', error);
            throw error;
        }
    }

    /**
     * Test template by content string
     * @param content - Template content
     * @param variables - Template variables
     * @param sampleData - Sample data for testing
     * @returns ITemplateTestResult - Test result
     */
    testTemplateContent(
        content: string,
        variables: ITemplateVariable[] = [],
        sampleData: Record<string, any> = {}
    ): ITemplateTestResult {
        try {
            // Extract variables from content if not provided
            const extractedVariables = variables.length > 0 ? variables : this.extractVariablesFromContent(content);

            // Generate sample data if not provided
            const testData = Object.keys(sampleData).length > 0 ? sampleData : this.generateSampleDataFromVariables(extractedVariables);

            // Validate variables
            const validationErrors = this.validateVariablesWithContent(content, extractedVariables, testData);

            // Render template
            let renderedContent: string;
            let renderError: string | null = null;

            try {
                renderedContent = this.renderTemplateContent(content, extractedVariables, testData);
            } catch (error) {
                renderError = error instanceof Error ? error.message : 'Unknown render error';
                renderedContent = '';
            }

            // Check character limits
            const lengthCheck = this.checkCharacterLimits(renderedContent, {
                maxLength: this.maxTemplateLength,
                minLength: this.minTemplateLength,
                allowHtml: false,
                allowMarkdown: true
            });

            const result: ITemplateTestResult = {
                templateId: 'inline-test',
                templateName: 'Inline Template Test',
                success: validationErrors.length === 0 && !renderError,
                renderedContent,
                characterCount: renderedContent.length,
                validationErrors,
                renderError,
                lengthCheck,
                testData,
                timestamp: new Date()
            };

            logger.info(`Template content test completed - ${result.success ? 'SUCCESS' : 'FAILED'}`);
            return result;

        } catch (error) {
            logger.error('Error testing template content:', error);
            throw error;
        }
    }

    /**
     * Search templates
     * @param query - Search query
     * @returns Promise<ITemplateDocument[]> - Array of matching templates
     */
    async searchTemplates(query: string): Promise<ITemplateDocument[]> {
        try {
            const templates = await databaseService.searchTemplates(query);
            logger.info(`Found ${templates.length} templates matching query: "${query}"`);
            return templates;
        } catch (error) {
            logger.error('Error searching templates:', error);
            throw error;
        }
    }

    /**
     * Get most used templates
     * @param limit - Maximum number of templates to return
     * @returns Promise<ITemplateDocument[]> - Array of most used templates
     */
    async getMostUsedTemplates(limit: number = 10): Promise<ITemplateDocument[]> {
        try {
            const templates = await databaseService.getTemplates({ isActive: true });
            const sortedTemplates = templates
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, limit);

            logger.info(`Retrieved ${sortedTemplates.length} most used templates`);
            return sortedTemplates;
        } catch (error) {
            logger.error('Error getting most used templates:', error);
            throw error;
        }
    }

    /**
     * Duplicate a template
     * @param templateId - Original template ID
     * @param newName - Name for the duplicated template
     * @returns Promise<ITemplateDocument> - Duplicated template
     */
    async duplicateTemplate(templateId: string, newName: string): Promise<ITemplateDocument> {
        try {
            const originalTemplate = await this.getTemplateById(templateId);
            if (!originalTemplate) {
                throw new Error(`Template not found: ${templateId}`);
            }

            const duplicateData: CreateTemplateData = {
                name: newName,
                type: originalTemplate.type,
                content: originalTemplate.content,
                variables: originalTemplate.variables,
                subject: originalTemplate.subject,
                description: originalTemplate.description ? `${originalTemplate.description} (Copy)` : undefined,
                category: originalTemplate.category,
                isActive: true,
                isPublic: false,
                settings: originalTemplate.settings,
                tags: [...originalTemplate.tags],
                author: originalTemplate.author,
                usageCount: 0,
                version: 1,
                previousVersions: []
            };

            const duplicatedTemplate = await this.createTemplate(duplicateData);
            logger.info(`Template duplicated: ${originalTemplate.name} -> ${newName}`);
            return duplicatedTemplate;

        } catch (error) {
            logger.error('Error duplicating template:', error);
            throw error;
        }
    }

    /**
     * Initialize default templates if none exist
     */
    private async initializeDefaultTemplates(): Promise<void> {
        try {
            const existingTemplates = await databaseService.getTemplates();
            if (existingTemplates.length > 0) {
                return; // Default templates already exist
            }

            const defaultTemplates = this.getDefaultTemplates();

            for (const templateData of defaultTemplates) {
                try {
                    await this.createTemplate(templateData);
                } catch (error) {
                    logger.warn(`Failed to create default template ${templateData.name}:`, error);
                }
            }

            logger.info('Default templates initialized');

        } catch (error) {
            logger.error('Error initializing default templates:', error);
        }
    }

    /**
     * Get default templates
     */
    private getDefaultTemplates(): CreateTemplateData[] {
        return [
            {
                name: 'LinkedIn Initial Connection',
                type: TemplateType.CONNECTION,
                content: 'Hi {{name}}! I noticed your work at {{company}} as {{position}}. I\'m impressed by your expertise in {{skill}} and would love to connect to learn more about your experience.',
                variables: [
                    { name: 'name', description: 'Recipient\'s name', type: VariableType.STRING, required: true },
                    { name: 'company', description: 'Company name', type: VariableType.STRING, required: true },
                    { name: 'position', description: 'Job position', type: VariableType.STRING, required: true },
                    { name: 'skill', description: 'Relevant skill or expertise', type: VariableType.STRING, required: true }
                ],
                category: TemplateCategory.NETWORKING,
                description: 'Professional initial connection request for LinkedIn',
                tags: ['linkedin', 'connection', 'networking'],
                isActive: true,
                isPublic: true,
                usageCount: 0,
                version: 1,
                previousVersions: [],
                settings: {
                    maxLength: this.maxTemplateLength,
                    minLength: this.minTemplateLength,
                    allowHtml: false,
                    allowMarkdown: true
                }
            },
            {
                name: 'LinkedIn Follow-up Message',
                type: TemplateType.FOLLOW_UP,
                content: 'Hi {{name}}, I hope you\'re doing well! I wanted to follow up on my previous message about {{topic}}. Would you be open to a brief conversation about {{opportunity}}?',
                variables: [
                    { name: 'name', description: 'Recipient\'s name', type: VariableType.STRING, required: true },
                    { name: 'topic', description: 'Previous conversation topic', type: VariableType.STRING, required: true },
                    { name: 'opportunity', description: 'Opportunity or discussion point', type: VariableType.STRING, required: true }
                ],
                category: TemplateCategory.FOLLOW_UP,
                description: 'Professional follow-up message for LinkedIn',
                tags: ['linkedin', 'follow-up', 'networking'],
                isActive: true,
                isPublic: true,
                usageCount: 0,
                version: 1,
                previousVersions: [],
                settings: {
                    maxLength: this.maxTemplateLength,
                    minLength: this.minTemplateLength,
                    allowHtml: false,
                    allowMarkdown: true
                }
            },
            {
                name: 'LinkedIn Thank You Message',
                type: TemplateType.THANKYOU,
                content: 'Thank you for connecting, {{name}}! I really appreciate you taking the time to share insights about {{insight}}. Looking forward to staying in touch!',
                variables: [
                    { name: 'name', description: 'Recipient\'s name', type: VariableType.STRING, required: true },
                    { name: 'insight', description: 'Insight or information shared', type: VariableType.STRING, required: true }
                ],
                category: TemplateCategory.THANK_YOU,
                description: 'Thank you message for LinkedIn connections',
                tags: ['linkedin', 'thank-you', 'networking'],
                isActive: true,
                isPublic: true,
                usageCount: 0,
                version: 1,
                previousVersions: [],
                settings: {
                    maxLength: this.maxTemplateLength,
                    minLength: this.minTemplateLength,
                    allowHtml: false,
                    allowMarkdown: true
                }
            }
        ];
    }

    /**
     * Validate template data
     */
    private validateTemplateData(templateData: CreateTemplateData): string[] {
        const errors: string[] = [];

        if (!templateData.name || templateData.name.trim().length === 0) {
            errors.push('Template name is required');
        }

        if (!templateData.content || templateData.content.trim().length === 0) {
            errors.push('Template content is required');
        } else {
            errors.push(...this.validateTemplateContent(templateData.content));
        }

        if (!templateData.type) {
            errors.push('Template type is required');
        }

        return errors;
    }

    /**
     * Validate template content
     */
    private validateTemplateContent(content: string): string[] {
        const errors: string[] = [];

        if (content.length > this.maxTemplateLength) {
            errors.push(`Content exceeds maximum length of ${this.maxTemplateLength} characters`);
        }

        if (content.length < this.minTemplateLength) {
            errors.push(`Content is below minimum length of ${this.minTemplateLength} characters`);
        }

        // Check for unclosed variable brackets
        const openBrackets = (content.match(/\{\{/g) || []).length;
        const closeBrackets = (content.match(/\}\}/g) || []).length;
        if (openBrackets !== closeBrackets) {
            errors.push('Unclosed variable brackets detected');
        }

        return errors;
    }

    /**
     * Extract variables from template content
     */
    private extractVariablesFromContent(content: string): ITemplateVariable[] {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = new Map<string, ITemplateVariable>();
        let match;

        while ((match = variableRegex.exec(content)) !== null) {
            const variableName = match[1].trim();
            if (!variables.has(variableName)) {
                variables.set(variableName, {
                    name: variableName,
                    description: `Variable: ${variableName}`,
                    type: 'STRING' as VariableType,
                    required: true
                });
            }
        }

        return Array.from(variables.values());
    }

    /**
     * Merge extracted variables with provided variables
     */
    private mergeVariables(extracted: ITemplateVariable[], provided: ITemplateVariable[]): ITemplateVariable[] {
        const variableMap = new Map<string, ITemplateVariable>();

        // Add extracted variables first
        extracted.forEach(variable => {
            variableMap.set(variable.name, variable);
        });

        // Override with provided variables
        provided.forEach(variable => {
            variableMap.set(variable.name, variable);
        });

        return Array.from(variableMap.values());
    }

    /**
     * Generate sample data for template testing
     */
    private generateSampleData(template: ITemplateDocument): Record<string, any> {
        const sampleData: Record<string, any> = {};

        template.variables.forEach(variable => {
            sampleData[variable.name] = this.generateSampleValue(variable);
        });

        return sampleData;
    }

    /**
     * Generate sample data from variables array
     */
    private generateSampleDataFromVariables(variables: ITemplateVariable[]): Record<string, any> {
        const sampleData: Record<string, any> = {};

        variables.forEach(variable => {
            sampleData[variable.name] = this.generateSampleValue(variable);
        });

        return sampleData;
    }

    /**
     * Generate sample value for a variable
     */
    private generateSampleValue(variable: ITemplateVariable): any {
        if (variable.defaultValue !== undefined) {
            return variable.defaultValue;
        }

        switch (variable.type) {
            case VariableType.STRING:
                return `Sample ${variable.name}`;
            case VariableType.NUMBER:
                return 123;
            case VariableType.DATE:
                return new Date().toISOString().split('T')[0];
            case VariableType.BOOLEAN:
                return true;
            case VariableType.ARRAY:
                return ['Sample', 'Data'];
            default:
                return `Sample ${variable.name}`;
        }
    }

    /**
     * Check character limits
     */
    private checkCharacterLimits(content: string, settings: any): ILengthCheck {
        return {
            isValid: content.length >= (settings.minLength || this.minTemplateLength) &&
                content.length <= (settings.maxLength || this.maxTemplateLength),
            characterCount: content.length,
            minLength: settings.minLength || this.minTemplateLength,
            maxLength: settings.maxLength || this.maxTemplateLength,
            isOverLimit: content.length > (settings.maxLength || this.maxTemplateLength),
            isUnderLimit: content.length < (settings.minLength || this.minTemplateLength)
        };
    }

    /**
     * Validate variables with content
     */
    private validateVariablesWithContent(content: string, variables: ITemplateVariable[], testData: Record<string, any>): string[] {
        const errors: string[] = [];

        variables.forEach(variable => {
            const value = testData[variable.name];

            if (variable.required && (!value || value === '')) {
                errors.push(`Required variable '${variable.name}' is missing`);
                return;
            }

            if (value !== undefined && value !== null && value !== '') {
                // Basic type validation
                switch (variable.type) {
                    case VariableType.STRING:
                        if (typeof value !== 'string') {
                            errors.push(`Variable '${variable.name}' must be a string`);
                        }
                        break;
                    case VariableType.NUMBER:
                        if (typeof value !== 'number' || isNaN(value)) {
                            errors.push(`Variable '${variable.name}' must be a number`);
                        }
                        break;
                    case VariableType.DATE:
                        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
                            errors.push(`Variable '${variable.name}' must be a valid date`);
                        }
                        break;
                    case VariableType.BOOLEAN:
                        if (typeof value !== 'boolean') {
                            errors.push(`Variable '${variable.name}' must be a boolean`);
                        }
                        break;
                    case VariableType.ARRAY:
                        if (!Array.isArray(value)) {
                            errors.push(`Variable '${variable.name}' must be an array`);
                        }
                        break;
                }
            }
        });

        return errors;
    }

    /**
     * Render template content
     */
    private renderTemplateContent(content: string, variables: ITemplateVariable[], data: Record<string, any>): string {
        let renderedContent = content;

        variables.forEach(variable => {
            const placeholder = `{{${variable.name}}}`;
            const value = data[variable.name] || variable.defaultValue || '';

            if (variable.required && !data[variable.name]) {
                throw new Error(`Required variable '${variable.name}' is missing`);
            }

            renderedContent = renderedContent.replace(new RegExp(placeholder, 'g'), String(value));
        });

        return renderedContent;
    }
}

// Interface definitions
export interface IScenario {
    type?: TemplateType;
    category?: TemplateCategory;
    tags?: string[];
    platform?: string;
    industry?: string;
}

export interface ITemplateTestResult {
    templateId: string;
    templateName: string;
    success: boolean;
    renderedContent: string;
    characterCount: number;
    validationErrors: string[];
    renderError: string | null;
    lengthCheck: ILengthCheck;
    testData: Record<string, any>;
    timestamp: Date;
}

export interface ILengthCheck {
    isValid: boolean;
    characterCount: number;
    minLength: number;
    maxLength: number;
    isOverLimit: boolean;
    isUnderLimit: boolean;
}

export default TemplateService;
