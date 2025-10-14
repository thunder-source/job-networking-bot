#!/usr/bin/env node

import databaseService from '../src/services/databaseService.js';
import { Contact, Template, Campaign } from '../src/models/index.js';
import chalk from 'chalk';
import { ContactSource, TemplateType, TemplateCategory, CampaignStatus, ExperienceLevel } from '../src/types/index.js';

async function runExample(): Promise<void> {
  try {
    console.log(chalk.blue('🚀 Starting database example...'));
    
    // Initialize database connection
    await databaseService.initialize();
    
    // Create a sample contact
    console.log(chalk.yellow('\n📝 Creating sample contact...'));
    const contact = await databaseService.createContact({
      name: 'John Doe',
      email: 'john.doe@example.com',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      company: 'Tech Corp',
      position: 'Senior Developer',
      status: 'pending' as any,
      source: ContactSource.LINKEDIN,
      tags: ['tech', 'senior', 'javascript'],
      industry: 'Technology',
      experience: ExperienceLevel.SENIOR
    });
    
    // Create a sample template
    console.log(chalk.yellow('\n📝 Creating sample template...'));
    const template = await databaseService.createTemplate({
      name: 'Initial Connection',
      type: TemplateType.CONNECTION,
      content: 'Hi {{name}}, I noticed your work at {{company}} and would love to connect!',
      subject: 'Connection Request from {{name}}',
      variables: [
        {
          name: 'name',
          description: 'Contact name',
          type: 'string' as any,
          required: true
        },
        {
          name: 'company',
          description: 'Company name',
          type: 'string' as any,
          required: true
        }
      ],
      category: TemplateCategory.NETWORKING,
      tags: ['connection', 'linkedin']
    });
    
    // Create a sample campaign
    console.log(chalk.yellow('\n📝 Creating sample campaign...'));
    const campaign = await databaseService.createCampaign({
      name: 'Tech Professionals Outreach',
      description: 'Reaching out to senior tech professionals',
      targetCriteria: {
        industries: ['Technology', 'Software'],
        experienceLevel: ExperienceLevel.SENIOR,
        contactSources: [ContactSource.LINKEDIN]
      },
      status: CampaignStatus.ACTIVE,
      settings: {
        maxMessagesPerDay: 20,
        maxMessagesPerHour: 10,
        delayBetweenMessages: 300000,
        personalizeMessages: true,
        followUpEnabled: true,
        followUpDelay: 7,
        maxFollowUps: 3
      },
      tags: ['tech', 'outreach']
    });
    
    // Add contact to campaign
    if (contact._id) {
      await campaign.addContact(contact._id.toString());
    }
    
    // Test template rendering
    console.log(chalk.yellow('\n🔧 Testing template rendering...'));
    const renderedContent = template.render({
      name: 'Jane Smith',
      company: 'Innovation Inc'
    });
    console.log(chalk.gray('Rendered template:'));
    console.log(chalk.gray(renderedContent));
    
    // Show statistics
    console.log(chalk.yellow('\n📊 Database Statistics:'));
    const contactStats = await databaseService.getContactStats();
    console.log(chalk.cyan('Contacts by status:'));
    contactStats.forEach(stat => {
      console.log(chalk.gray(`  ${stat._id}: ${stat.count}`));
    });
    
    // Search example
    console.log(chalk.yellow('\n🔍 Searching contacts...'));
    const searchResults = await databaseService.searchContacts('tech');
    console.log(chalk.gray(`Found ${searchResults.length} contacts matching 'tech'`));
    
    console.log(chalk.green('\n✅ Example completed successfully!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Example failed:'), (error as Error).message);
  } finally {
    // Cleanup
    await databaseService.cleanup();
  }
}

// Run the example
runExample();
