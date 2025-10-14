import { TemplateService, IScenario } from '../src/services/templateService.js';
import databaseService from '../src/services/databaseService.js';
import { logger } from '../src/utils/logger.js';
import { TemplateType, TemplateCategory, VariableType } from '../src/types/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateTemplateService() {
    try {
        // Initialize database connection
        await databaseService.initialize();

        // Initialize template service
        const templateService = new TemplateService();

        console.log('📝 Template Service Demo - CRUD Operations & Testing\n');
        console.log('='.repeat(70));

        // 1. Create a new template
        console.log('\n🔧 CREATING NEW TEMPLATE:');
        console.log('-'.repeat(40));

        const newTemplate = await templateService.createTemplate({
            name: 'Software Engineer Outreach',
            type: TemplateType.CONNECTION,
            content: 'Hi {{name}}! I saw your profile and noticed your impressive work with {{technology}} at {{company}}. I\'m also passionate about {{technology}} and would love to connect and share experiences.',
            variables: [
                {
                    name: 'name',
                    description: 'Recipient\'s name',
                    type: VariableType.STRING,
                    required: true
                },
                {
                    name: 'technology',
                    description: 'Technology or skill',
                    type: VariableType.STRING,
                    required: true
                },
                {
                    name: 'company',
                    description: 'Company name',
                    type: VariableType.STRING,
                    required: true
                }
            ],
            category: TemplateCategory.NETWORKING,
            description: 'Personalized outreach for software engineers',
            tags: ['software', 'engineering', 'linkedin'],
            isActive: true,
            isPublic: false,
            author: 'Demo User',
            usageCount: 0,
            version: 1,
            previousVersions: [],
            settings: {
                maxLength: 300,
                minLength: 50,
                allowHtml: false,
                allowMarkdown: true
            }
        });

        console.log(`✅ Template created: ${newTemplate.name} (ID: ${newTemplate._id})`);

        // 2. Test the template with sample data
        console.log('\n🧪 TESTING TEMPLATE:');
        console.log('-'.repeat(40));

        const testResult = await templateService.testTemplate(newTemplate._id!.toString(), {
            name: 'Sarah Johnson',
            technology: 'React and Node.js',
            company: 'TechCorp'
        });

        console.log(`Test Result: ${testResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Rendered Message (${testResult.characterCount} chars):`);
        console.log(`"${testResult.renderedContent}"`);

        if (testResult.validationErrors.length > 0) {
            console.log('\nValidation Errors:');
            testResult.validationErrors.forEach(error => console.log(`  - ${error}`));
        }

        if (testResult.renderError) {
            console.log(`\nRender Error: ${testResult.renderError}`);
        }

        console.log(`\nLength Check: ${testResult.lengthCheck.isValid ? '✅ Valid' : '❌ Invalid'}`);
        if (testResult.lengthCheck.isOverLimit) {
            console.log(`⚠️  Over limit by ${testResult.characterCount - testResult.lengthCheck.maxLength} characters`);
        }
        if (testResult.lengthCheck.isUnderLimit) {
            console.log(`⚠️  Under limit by ${testResult.lengthCheck.minLength - testResult.characterCount} characters`);
        }

        // 3. Test template content directly
        console.log('\n🔍 TESTING TEMPLATE CONTENT:');
        console.log('-'.repeat(40));

        const contentTestResult = templateService.testTemplateContent(
            'Hello {{name}}, I noticed your work with {{technology}} at {{company}}. Would love to connect!',
            [
                { name: 'name', type: VariableType.STRING, required: true },
                { name: 'technology', type: VariableType.STRING, required: true },
                { name: 'company', type: VariableType.STRING, required: true }
            ],
            {
                name: 'Alex Chen',
                technology: 'Python and Machine Learning',
                company: 'DataCorp'
            }
        );

        console.log(`Content Test Result: ${contentTestResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Rendered Content (${contentTestResult.characterCount} chars):`);
        console.log(`"${contentTestResult.renderedContent}"`);

        // 4. Update the template
        console.log('\n📝 UPDATING TEMPLATE:');
        console.log('-'.repeat(40));

        const updatedTemplate = await templateService.updateTemplate(newTemplate._id!.toString(), {
            content: 'Hi {{name}}! I was impressed by your work with {{technology}} at {{company}}. As someone who also works with {{technology}}, I\'d love to connect and share insights about {{industry}} trends.',
            variables: [
                {
                    name: 'name',
                    description: 'Recipient\'s name',
                    type: VariableType.STRING,
                    required: true
                },
                {
                    name: 'technology',
                    description: 'Technology or skill',
                    type: VariableType.STRING,
                    required: true
                },
                {
                    name: 'company',
                    description: 'Company name',
                    type: VariableType.STRING,
                    required: true
                },
                {
                    name: 'industry',
                    description: 'Industry or sector',
                    type: VariableType.STRING,
                    required: true
                }
            ]
        });

        if (updatedTemplate) {
            console.log(`✅ Template updated: ${updatedTemplate.name}`);
            console.log(`New version: ${updatedTemplate.version}`);
        }

        // 5. Test updated template
        console.log('\n🧪 TESTING UPDATED TEMPLATE:');
        console.log('-'.repeat(40));

        const updatedTestResult = await templateService.testTemplate(updatedTemplate!._id!.toString(), {
            name: 'Mike Rodriguez',
            technology: 'AWS and DevOps',
            company: 'CloudTech',
            industry: 'cloud computing'
        });

        console.log(`Updated Test Result: ${updatedTestResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Rendered Message (${updatedTestResult.characterCount} chars):`);
        console.log(`"${updatedTestResult.renderedContent}"`);

        // 6. Search templates
        console.log('\n🔍 SEARCHING TEMPLATES:');
        console.log('-'.repeat(40));

        const searchResults = await templateService.searchTemplates('software');
        console.log(`Found ${searchResults.length} templates matching "software":`);
        searchResults.forEach(template => {
            console.log(`  - ${template.name} (${template.type})`);
        });

        // 7. Get templates by scenario
        console.log('\n📊 GETTING TEMPLATES BY SCENARIO:');
        console.log('-'.repeat(40));

        const scenario: IScenario = {
            type: TemplateType.CONNECTION,
            category: TemplateCategory.NETWORKING,
            tags: ['linkedin'],
            platform: 'linkedin'
        };

        const scenarioTemplates = await templateService.getTemplatesByScenario(scenario);
        console.log(`Found ${scenarioTemplates.length} templates for scenario:`, scenario);
        scenarioTemplates.forEach(template => {
            console.log(`  - ${template.name} (${template.category})`);
        });

        // 8. Get templates by type
        console.log('\n📋 GETTING TEMPLATES BY TYPE:');
        console.log('-'.repeat(40));

        const connectionTemplates = await templateService.getTemplatesByType(TemplateType.CONNECTION);
        console.log(`Found ${connectionTemplates.length} connection templates:`);
        connectionTemplates.forEach(template => {
            console.log(`  - ${template.name} (Usage: ${template.usageCount})`);
        });

        // 9. Get templates by category
        console.log('\n🏷️  GETTING TEMPLATES BY CATEGORY:');
        console.log('-'.repeat(40));

        const networkingTemplates = await templateService.getTemplatesByCategory(TemplateCategory.NETWORKING);
        console.log(`Found ${networkingTemplates.length} networking templates:`);
        networkingTemplates.forEach(template => {
            console.log(`  - ${template.name} (Tags: ${template.tags.join(', ')})`);
        });

        // 10. Get most used templates
        console.log('\n⭐ MOST USED TEMPLATES:');
        console.log('-'.repeat(40));

        const mostUsedTemplates = await templateService.getMostUsedTemplates(5);
        console.log('Top 5 most used templates:');
        mostUsedTemplates.forEach((template, index) => {
            console.log(`  ${index + 1}. ${template.name} (${template.usageCount} uses)`);
        });

        // 11. Duplicate template
        console.log('\n📋 DUPLICATING TEMPLATE:');
        console.log('-'.repeat(40));

        const duplicatedTemplate = await templateService.duplicateTemplate(
            newTemplate._id!.toString(),
            'Software Engineer Outreach - Copy'
        );

        console.log(`✅ Template duplicated: ${duplicatedTemplate.name} (ID: ${duplicatedTemplate._id})`);

        // 12. Test validation with invalid data
        console.log('\n❌ TESTING VALIDATION WITH INVALID DATA:');
        console.log('-'.repeat(40));

        const invalidTestResult = await templateService.testTemplate(newTemplate._id!.toString(), {
            name: 'Sarah Johnson',
            // Missing required 'technology' and 'company' fields
        });

        console.log(`Invalid Test Result: ${invalidTestResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        if (invalidTestResult.validationErrors.length > 0) {
            console.log('Validation Errors:');
            invalidTestResult.validationErrors.forEach(error => console.log(`  - ${error}`));
        }

        // 13. Test character limit validation
        console.log('\n📏 TESTING CHARACTER LIMIT VALIDATION:');
        console.log('-'.repeat(40));

        const longContent = 'Hi {{name}}! '.repeat(50); // Very long content
        const lengthTestResult = templateService.testTemplateContent(longContent, [
            { name: 'name', type: VariableType.STRING, required: true }
        ], { name: 'Test User' });

        console.log(`Length Test Result: ${lengthTestResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`Character Count: ${lengthTestResult.characterCount}`);
        console.log(`Length Check: ${lengthTestResult.lengthCheck.isValid ? '✅ Valid' : '❌ Invalid'}`);
        if (lengthTestResult.lengthCheck.isOverLimit) {
            console.log(`⚠️  Over limit by ${lengthTestResult.lengthCheck.characterCount - lengthTestResult.lengthCheck.maxLength} characters`);
        }

        // 14. Clean up - delete test templates
        console.log('\n🧹 CLEANING UP:');
        console.log('-'.repeat(40));

        await templateService.deleteTemplate(newTemplate._id!.toString());
        await templateService.deleteTemplate(duplicatedTemplate._id!.toString());
        console.log('✅ Test templates deleted');

        console.log('\n✅ Template Service demo completed successfully!');

    } catch (error) {
        logger.error('Template Service demo failed:', error);
        console.error('Demo failed:', error);
    } finally {
        // Clean up database connection
        await databaseService.cleanup();
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateTemplateService();
}

export { demonstrateTemplateService };
