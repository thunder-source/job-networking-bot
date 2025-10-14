import databaseConnection from '../config/database.js';
import { Contact, Template, Campaign } from '../models/index.js';
import type { IContactDocument, ITemplateDocument, ICampaignDocument } from '../models/index.js';
import chalk from 'chalk';
import type { IHealthCheck, CreateContactData, CreateTemplateData, CreateCampaignData } from '../types/index.js';

class DatabaseService {
  public isConnected: boolean = false;

  async initialize(): Promise<void> {
    try {
      await databaseConnection.connect();
      this.isConnected = true;
      console.log(chalk.green('✅ Database service initialized'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize database service:'), (error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<IHealthCheck> {
    return await databaseConnection.healthCheck();
  }

  // Contact operations
  async createContact(contactData: Partial<CreateContactData>): Promise<IContactDocument> {
    try {
      const contact = new Contact(contactData);
      await contact.save();
      console.log(chalk.green(`✅ Contact created: ${contact.name}`));
      return contact;
    } catch (error) {
      console.error(chalk.red('❌ Error creating contact:'), (error as Error).message);
      throw error;
    }
  }

  async getContacts(filter: any = {}): Promise<IContactDocument[]> {
    try {
      return await Contact.find(filter).populate('campaigns');
    } catch (error) {
      console.error(chalk.red('❌ Error fetching contacts:'), (error as Error).message);
      throw error;
    }
  }

  async getContactById(id: string): Promise<IContactDocument | null> {
    try {
      return await Contact.findById(id).populate('campaigns');
    } catch (error) {
      console.error(chalk.red('❌ Error fetching contact:'), (error as Error).message);
      throw error;
    }
  }

  async updateContact(id: string, updateData: Partial<CreateContactData>): Promise<IContactDocument | null> {
    try {
      const contact = await Contact.findByIdAndUpdate(id, updateData, { new: true });
      if (contact) {
        console.log(chalk.green(`✅ Contact updated: ${contact.name}`));
      }
      return contact;
    } catch (error) {
      console.error(chalk.red('❌ Error updating contact:'), (error as Error).message);
      throw error;
    }
  }

  async deleteContact(id: string): Promise<void> {
    try {
      await Contact.findByIdAndDelete(id);
      console.log(chalk.green('✅ Contact deleted'));
    } catch (error) {
      console.error(chalk.red('❌ Error deleting contact:'), (error as Error).message);
      throw error;
    }
  }

  // Template operations
  async createTemplate(templateData: Partial<CreateTemplateData>): Promise<ITemplateDocument> {
    try {
      const template = new Template(templateData);
      await template.save();
      console.log(chalk.green(`✅ Template created: ${template.name}`));
      return template;
    } catch (error) {
      console.error(chalk.red('❌ Error creating template:'), (error as Error).message);
      throw error;
    }
  }

  async getTemplates(filter: any = {}): Promise<ITemplateDocument[]> {
    try {
      return await Template.find(filter);
    } catch (error) {
      console.error(chalk.red('❌ Error fetching templates:'), (error as Error).message);
      throw error;
    }
  }

  async getTemplateById(id: string): Promise<ITemplateDocument | null> {
    try {
      return await Template.findById(id);
    } catch (error) {
      console.error(chalk.red('❌ Error fetching template:'), (error as Error).message);
      throw error;
    }
  }

  async updateTemplate(id: string, updateData: Partial<CreateTemplateData>): Promise<ITemplateDocument | null> {
    try {
      const template = await Template.findByIdAndUpdate(id, updateData, { new: true });
      if (template) {
        console.log(chalk.green(`✅ Template updated: ${template.name}`));
      }
      return template;
    } catch (error) {
      console.error(chalk.red('❌ Error updating template:'), (error as Error).message);
      throw error;
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await Template.findByIdAndDelete(id);
      console.log(chalk.green('✅ Template deleted'));
    } catch (error) {
      console.error(chalk.red('❌ Error deleting template:'), (error as Error).message);
      throw error;
    }
  }

  // Campaign operations
  async createCampaign(campaignData: Partial<CreateCampaignData>): Promise<ICampaignDocument> {
    try {
      const campaign = new Campaign(campaignData);
      await campaign.save();
      console.log(chalk.green(`✅ Campaign created: ${campaign.name}`));
      return campaign;
    } catch (error) {
      console.error(chalk.red('❌ Error creating campaign:'), (error as Error).message);
      throw error;
    }
  }

  async getCampaigns(filter: any = {}): Promise<ICampaignDocument[]> {
    try {
      return await Campaign.find(filter).populate('contacts').populate('templates.template');
    } catch (error) {
      console.error(chalk.red('❌ Error fetching campaigns:'), (error as Error).message);
      throw error;
    }
  }

  async getCampaignById(id: string): Promise<ICampaignDocument | null> {
    try {
      return await Campaign.findById(id).populate('contacts').populate('templates.template');
    } catch (error) {
      console.error(chalk.red('❌ Error fetching campaign:'), (error as Error).message);
      throw error;
    }
  }

  async updateCampaign(id: string, updateData: Partial<CreateCampaignData>): Promise<ICampaignDocument | null> {
    try {
      const campaign = await Campaign.findByIdAndUpdate(id, updateData, { new: true });
      if (campaign) {
        console.log(chalk.green(`✅ Campaign updated: ${campaign.name}`));
      }
      return campaign;
    } catch (error) {
      console.error(chalk.red('❌ Error updating campaign:'), (error as Error).message);
      throw error;
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    try {
      await Campaign.findByIdAndDelete(id);
      console.log(chalk.green('✅ Campaign deleted'));
    } catch (error) {
      console.error(chalk.red('❌ Error deleting campaign:'), (error as Error).message);
      throw error;
    }
  }

  // Statistics operations
  async getContactStats(): Promise<Array<{ _id: string; count: number }>> {
    try {
      return await Contact.getStats();
    } catch (error) {
      console.error(chalk.red('❌ Error fetching contact stats:'), (error as Error).message);
      throw error;
    }
  }

  async getCampaignStats(): Promise<Array<{ _id: string; count: number; totalContacts: number; totalMessages: number; totalResponses: number }>> {
    try {
      return await Campaign.getStats();
    } catch (error) {
      console.error(chalk.red('❌ Error fetching campaign stats:'), (error as Error).message);
      throw error;
    }
  }

  async getTemplateStats(): Promise<Array<{ _id: string; count: number; totalUsage: number }>> {
    try {
      return await Template.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalUsage: { $sum: '$usageCount' }
          }
        }
      ]);
    } catch (error) {
      console.error(chalk.red('❌ Error fetching template stats:'), (error as Error).message);
      throw error;
    }
  }

  // Search operations
  async searchContacts(query: string): Promise<IContactDocument[]> {
    try {
      return await Contact.find({
        $or: [
          { name: new RegExp(query, 'i') },
          { email: new RegExp(query, 'i') },
          { company: new RegExp(query, 'i') },
          { position: new RegExp(query, 'i') }
        ]
      });
    } catch (error) {
      console.error(chalk.red('❌ Error searching contacts:'), (error as Error).message);
      throw error;
    }
  }

  async searchTemplates(query: string): Promise<ITemplateDocument[]> {
    try {
      return await Template.search(query);
    } catch (error) {
      console.error(chalk.red('❌ Error searching templates:'), (error as Error).message);
      throw error;
    }
  }

  // Cleanup operations
  async cleanup(): Promise<void> {
    try {
      await databaseConnection.disconnect();
      this.isConnected = false;
      console.log(chalk.green('✅ Database service cleaned up'));
    } catch (error) {
      console.error(chalk.red('❌ Error cleaning up database service:'), (error as Error).message);
      throw error;
    }
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

export default databaseService;
