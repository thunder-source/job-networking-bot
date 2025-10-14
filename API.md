# API Documentation

## Service APIs

This document provides comprehensive documentation for all services and their APIs in the Cold Email Bot.

## Table of Contents

- [LinkedInService](#linkedinservice)
- [AIService](#aiservice)
- [EmailService](#emailservice)
- [TemplateService](#templateservice)
- [DatabaseService](#databaseservice)
- [RateLimiter](#ratelimiter)
- [SchedulerService](#schedulerservice)
- [EmailLookupService](#emaillookupservice)
- [Error Handling](#error-handling)
- [Common Types](#common-types)

## LinkedInService

### Overview

The LinkedInService handles all LinkedIn automation including login, profile scraping, connection requests, and search functionality.

### Constructor

```typescript
constructor(config?: LinkedInServiceConfig)
```

**Parameters:**
- `config` (optional): Configuration object for the service

**Configuration Options:**
```typescript
interface LinkedInServiceConfig {
  headless?: boolean;           // Run browser in headless mode (default: false)
  userDataDir?: string;         // Browser user data directory
  cookiesPath?: string;         // Path to save cookies
  timeout?: number;             // Page load timeout (default: 30000ms)
  retryAttempts?: number;       // Number of retry attempts (default: 3)
  limits?: LimitConfig;         // Rate limiting configuration
  timeSlot?: TimeSlot;          // Optimal time slot configuration
  enableLogging?: boolean;      // Enable detailed logging (default: true)
}
```

### Methods

#### login(credentials)

Authenticate with LinkedIn using email and password.

```typescript
async login(credentials: LinkedInCredentials): Promise<boolean>
```

**Parameters:**
- `credentials`: LinkedIn login credentials

**Returns:**
- `Promise<boolean>`: True if login successful, false otherwise

**Example:**
```typescript
const credentials: LinkedInCredentials = {
  email: 'your-email@example.com',
  password: 'your-password'
};

const success = await linkedinService.login(credentials);
if (success) {
  console.log('Successfully logged in to LinkedIn');
}
```

#### searchRecruiters(filters)

Search for recruiter profiles based on specified filters.

```typescript
async searchRecruiters(filters: SearchFilters): Promise<string[]>
```

**Parameters:**
- `filters`: Search criteria

**Returns:**
- `Promise<string[]>`: Array of LinkedIn profile URLs

**Example:**
```typescript
const filters: SearchFilters = {
  keywords: 'recruiter',
  location: 'San Francisco Bay Area',
  industry: 'Information Technology',
  maxResults: 20
};

const profileUrls = await linkedinService.searchRecruiters(filters);
console.log(`Found ${profileUrls.length} profiles`);
```

#### scrapeProfile(profileUrl)

Scrape detailed information from a LinkedIn profile.

```typescript
async scrapeProfile(profileUrl: string): Promise<RecruiterProfile | null>
```

**Parameters:**
- `profileUrl`: LinkedIn profile URL

**Returns:**
- `Promise<RecruiterProfile | null>`: Profile data or null if failed

**Example:**
```typescript
const profile = await linkedinService.scrapeProfile('https://linkedin.com/in/johndoe');
if (profile) {
  console.log(`Name: ${profile.name}`);
  console.log(`Company: ${profile.company}`);
  console.log(`Position: ${profile.headline}`);
}
```

#### sendConnectionRequest(profileUrl, message)

Send a connection request to a LinkedIn profile.

```typescript
async sendConnectionRequest(
  profileUrl: string, 
  message?: string
): Promise<ConnectionRequestResult>
```

**Parameters:**
- `profileUrl`: Target LinkedIn profile URL
- `message` (optional): Custom connection message

**Returns:**
- `Promise<ConnectionRequestResult>`: Result of the connection request

**Example:**
```typescript
const result = await linkedinService.sendConnectionRequest(
  'https://linkedin.com/in/johndoe',
  'Hi John! I noticed your work at TechCorp. Would love to connect!'
);

if (result.success) {
  console.log('Connection request sent successfully');
} else {
  console.error(`Failed: ${result.error}`);
}
```

#### sendBulkConnectionRequests(profiles)

Send multiple connection requests with rate limiting.

```typescript
async sendBulkConnectionRequests(
  profiles: Array<{url: string; message?: string}>
): Promise<ConnectionRequestResult[]>
```

**Parameters:**
- `profiles`: Array of profile objects with URL and optional message

**Returns:**
- `Promise<ConnectionRequestResult[]>`: Array of results for each request

#### getLimitsStatus()

Get current daily limits and usage.

```typescript
getLimitsStatus(): {current: any; remaining: any}
```

**Returns:**
- Object containing current usage and remaining limits

#### close()

Close browser and cleanup resources.

```typescript
async close(): Promise<void>
```

## AIService

### Overview

The AIService provides AI-powered message personalization using OpenAI's GPT models.

### Constructor

```typescript
constructor(apiKey?: string, model?: string)
```

**Parameters:**
- `apiKey` (optional): OpenAI API key (defaults to OPENAI_API_KEY env var)
- `model` (optional): GPT model to use (default: 'gpt-4-turbo')

### Methods

#### generatePersonalizedMessage()

Generate a personalized message using AI.

```typescript
async generatePersonalizedMessage(
  recruiterProfile: IRecruiterProfile,
  templateType: 'initial' | 'followup' | 'thankyou',
  userInfo: IUserInfo,
  options?: IMessageOptions
): Promise<string>
```

**Parameters:**
- `recruiterProfile`: Target recruiter's profile information
- `templateType`: Type of message to generate
- `userInfo`: Your information for personalization
- `options` (optional): Message generation options

**Returns:**
- `Promise<string>`: Generated personalized message

**Example:**
```typescript
const recruiterProfile: IRecruiterProfile = {
  name: 'Sarah Johnson',
  company: 'TechCorp',
  position: 'Senior Software Engineer',
  industry: 'Technology',
  skills: ['JavaScript', 'React', 'Node.js']
};

const userInfo: IUserInfo = {
  name: 'Alex Chen',
  targetRole: 'Software Engineer',
  skills: ['JavaScript', 'React', 'Node.js']
};

const message = await aiService.generatePersonalizedMessage(
  recruiterProfile,
  'initial',
  userInfo,
  { tone: 'professional', maxLength: 280 }
);
```

#### analyzeRecruiterProfile()

Analyze a recruiter profile to find talking points.

```typescript
async analyzeRecruiterProfile(
  recruiterProfile: IRecruiterProfile,
  userInfo: IUserInfo
): Promise<string[]>
```

**Parameters:**
- `recruiterProfile`: Target recruiter's profile
- `userInfo`: Your information

**Returns:**
- `Promise<string[]>`: Array of talking points

#### getDefaultTemplate()

Get default template by type.

```typescript
getDefaultTemplate(templateType: 'initial' | 'followup' | 'thankyou'): ITemplate
```

#### getToneOptions()

Get available tone options.

```typescript
getToneOptions(): ToneConfigs
```

## EmailService

### Overview

The EmailService handles email sending with templates, tracking, and rate limiting.

### Constructor

```typescript
constructor(config: IEmailConfig)
```

**Parameters:**
- `config`: Email service configuration

**Configuration Options:**
```typescript
interface IEmailConfig {
  provider: 'gmail' | 'outlook' | 'custom';
  credentials: IEmailCredentials;
  trackingBaseUrl?: string;
  unsubscribeBaseUrl?: string;
  rateLimit?: {
    maxEmailsPerHour: number;
    windowMs: number;
  };
  emailLookup?: {
    hunterApiKey?: string;
    rocketReachApiKey?: string;
  };
}
```

### Methods

#### sendEmail()

Send a single email using a template.

```typescript
async sendEmail(emailData: IEmailData): Promise<IEmailResult>
```

**Parameters:**
- `emailData`: Email data and template information

**Returns:**
- `Promise<IEmailResult>`: Send result with tracking information

**Example:**
```typescript
const emailData: IEmailData = {
  to: 'recipient@example.com',
  templateType: 'coldOutreach',
  variables: {
    name: 'Sarah Johnson',
    company: 'TechCorp',
    position: 'Senior Software Engineer',
    technology: 'React and Node.js',
    topic: 'scalable web applications',
    industry: 'technology',
    senderName: 'Alex Chen'
  },
  campaignId: 'campaign-001'
};

const result = await emailService.sendEmail(emailData);
console.log(result.success ? 'Email sent!' : 'Failed to send email');
```

#### sendBulkEmails()

Send multiple emails with rate limiting.

```typescript
async sendBulkEmails(
  emails: IEmailData[], 
  options?: IBulkEmailOptions
): Promise<IEmailResult[]>
```

**Parameters:**
- `emails`: Array of email data
- `options` (optional): Bulk sending options

**Returns:**
- `Promise<IEmailResult[]>`: Array of send results

#### sendEmailWithLookup()

Send email with automatic email lookup.

```typescript
async sendEmailWithLookup(emailData: IEmailDataWithLookup): Promise<IEmailResult>
```

**Parameters:**
- `emailData`: Email data with lookup information

**Returns:**
- `Promise<IEmailResult>`: Send result

#### trackEmailOpen()

Track email open event.

```typescript
async trackEmailOpen(trackingId: string): Promise<void>
```

#### handleUnsubscribe()

Handle unsubscribe request.

```typescript
async handleUnsubscribe(trackingId: string): Promise<void>
```

#### validateEmail()

Validate email address format.

```typescript
validateEmail(email: string): boolean
```

#### getTemplate()

Get email template by type.

```typescript
getTemplate(templateType: keyof typeof this.emailTemplates): IEmailTemplate
```

#### testConfiguration()

Test email configuration.

```typescript
async testConfiguration(): Promise<boolean>
```

## TemplateService

### Overview

The TemplateService manages message templates with CRUD operations and validation.

### Methods

#### createTemplate()

Create a new message template.

```typescript
async createTemplate(templateData: ITemplateData): Promise<ITemplate>
```

**Parameters:**
- `templateData`: Template creation data

**Returns:**
- `Promise<ITemplate>`: Created template

#### getTemplate()

Get template by ID.

```typescript
async getTemplate(templateId: string): Promise<ITemplate | null>
```

#### updateTemplate()

Update existing template.

```typescript
async updateTemplate(templateId: string, updates: Partial<ITemplate>): Promise<ITemplate>
```

#### deleteTemplate()

Delete template.

```typescript
async deleteTemplate(templateId: string): Promise<boolean>
```

#### searchTemplates()

Search templates by keywords.

```typescript
async searchTemplates(keywords: string): Promise<ITemplate[]>
```

#### getTemplatesByType()

Get templates by type.

```typescript
async getTemplatesByType(type: TemplateType): Promise<ITemplate[]>
```

#### testTemplate()

Test template with sample data.

```typescript
async testTemplate(templateId: string, variables: Record<string, any>): Promise<ITestResult>
```

## DatabaseService

### Overview

The DatabaseService handles all database operations and data management.

### Methods

#### connect()

Connect to MongoDB.

```typescript
async connect(): Promise<void>
```

#### disconnect()

Disconnect from MongoDB.

```typescript
async disconnect(): Promise<void>
```

#### createContact()

Create a new contact.

```typescript
async createContact(contactData: IContactData): Promise<IContact>
```

#### getContact()

Get contact by ID.

```typescript
async getContact(contactId: string): Promise<IContact | null>
```

#### updateContact()

Update contact information.

```typescript
async updateContact(contactId: string, updates: Partial<IContact>): Promise<IContact>
```

#### deleteContact()

Delete contact.

```typescript
async deleteContact(contactId: string): Promise<boolean>
```

#### searchContacts()

Search contacts with filters.

```typescript
async searchContacts(filters: IContactFilters): Promise<IContact[]>
```

#### createCampaign()

Create a new campaign.

```typescript
async createCampaign(campaignData: ICampaignData): Promise<ICampaign>
```

#### getCampaign()

Get campaign by ID.

```typescript
async getCampaign(campaignId: string): Promise<ICampaign | null>
```

#### updateCampaign()

Update campaign.

```typescript
async updateCampaign(campaignId: string, updates: Partial<ICampaign>): Promise<ICampaign>
```

## RateLimiter

### Overview

The RateLimiter manages rate limiting for LinkedIn actions and email sending.

### Methods

#### canSendConnectionRequest()

Check if connection request can be sent.

```typescript
canSendConnectionRequest(): boolean
```

#### recordConnectionRequest()

Record a sent connection request.

```typescript
recordConnectionRequest(): void
```

#### canSendMessage()

Check if message can be sent.

```typescript
canSendMessage(): boolean
```

#### recordMessage()

Record a sent message.

```typescript
recordMessage(): void
```

#### getRemainingLimits()

Get remaining daily limits.

```typescript
getRemainingLimits(): LimitStatus
```

#### resetDailyLimits()

Reset daily limits (called automatically at midnight).

```typescript
resetDailyLimits(): void
```

## SchedulerService

### Overview

The SchedulerService handles automated scheduling and follow-up management.

### Methods

#### scheduleFollowUp()

Schedule a follow-up email.

```typescript
async scheduleFollowUp(
  contactId: string,
  templateId: string,
  scheduleDate: Date,
  campaignId?: string
): Promise<string>
```

#### getScheduledEmails()

Get emails scheduled for a date range.

```typescript
async getScheduledEmails(startDate: Date, endDate: Date): Promise<IScheduledEmail[]>
```

#### processScheduledEmails()

Process all emails scheduled for execution.

```typescript
async processScheduledEmails(): Promise<IScheduledEmailResult[]>
```

#### cancelScheduledEmail()

Cancel a scheduled email.

```typescript
async cancelScheduledEmail(scheduleId: string): Promise<boolean>
```

## EmailLookupService

### Overview

The EmailLookupService finds and verifies email addresses using external APIs.

### Constructor

```typescript
constructor(config: IEmailLookupConfig)
```

### Methods

#### findEmail()

Find email address for a person.

```typescript
async findEmail(
  firstName: string,
  lastName: string,
  company: string,
  options?: IEmailLookupOptions
): Promise<IEmailLookupResult>
```

#### verifyEmail()

Verify email address deliverability.

```typescript
async verifyEmail(email: string): Promise<boolean>
```

#### getConfidenceScore()

Get confidence score for found email.

```typescript
getConfidenceScore(email: string, source: string): number
```

## Error Handling

### Error Types

The system uses structured error handling with specific error types:

```typescript
class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

class ValidationError extends ServiceError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class RateLimitError extends ServiceError {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429, { retryAfter });
  }
}

class ExternalAPIError extends ServiceError {
  constructor(message: string, apiName: string, details?: any) {
    super(message, 'EXTERNAL_API_ERROR', 502, { apiName, details });
  }
}
```

### Error Handling Patterns

#### Service-Level Error Handling

```typescript
try {
  const result = await someService.someMethod();
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    logger.warn('Validation error:', error.message);
    throw error;
  } else if (error instanceof RateLimitError) {
    logger.warn('Rate limit exceeded:', error.message);
    // Implement retry logic or queue for later
    throw error;
  } else {
    logger.error('Unexpected error:', error);
    throw new ServiceError('Internal server error', 'INTERNAL_ERROR', 500);
  }
}
```

#### Global Error Handler

```typescript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});
```

## Common Types

### Core Interfaces

```typescript
// LinkedIn Types
interface LinkedInCredentials {
  email: string;
  password: string;
}

interface SearchFilters {
  keywords?: string;
  location?: string;
  industry?: string;
  company?: string;
  maxResults?: number;
}

interface RecruiterProfile {
  name: string;
  headline: string;
  company: string;
  about: string;
  location?: string;
  profileUrl: string;
  connections?: string;
  experience?: string[];
}

// AI Service Types
interface IRecruiterProfile {
  name: string;
  company: string;
  position: string;
  industry?: string;
  skills?: string[];
  experience?: string;
  recentActivity?: string;
  education?: string;
  location?: string;
  linkedinUrl?: string;
  summary?: string;
  achievements?: string[];
  endorsements?: string[];
}

interface IUserInfo {
  name: string;
  targetRole: string;
  skills?: string[];
  experience?: string;
  education?: string;
  location?: string;
  currentCompany?: string;
  summary?: string;
  achievements?: string[];
}

interface IMessageOptions {
  tone?: 'professional' | 'friendly' | 'enthusiastic';
  maxLength?: number;
  minLength?: number;
  customPrompt?: string;
  includeEmojis?: boolean;
}

// Email Service Types
interface IEmailConfig {
  provider: 'gmail' | 'outlook' | 'custom';
  credentials: IEmailCredentials;
  trackingBaseUrl?: string;
  unsubscribeBaseUrl?: string;
  rateLimit?: {
    maxEmailsPerHour: number;
    windowMs: number;
  };
  emailLookup?: {
    hunterApiKey?: string;
    rocketReachApiKey?: string;
  };
}

interface IEmailCredentials {
  email: string;
  password: string;
  host?: string;
  port?: number;
  secure?: boolean;
}

interface IEmailData {
  to: string;
  from?: string;
  templateType: keyof typeof EmailService.prototype.emailTemplates;
  variables: Record<string, any>;
  campaignId?: string;
  priority?: 'high' | 'normal' | 'low';
}

interface IEmailResult {
  success: boolean;
  messageId?: string;
  trackingId?: string;
  error?: string;
  sentAt: Date;
  recipient: string;
  templateType: string;
}

// Database Types
interface IContact {
  _id?: string;
  name: string;
  email?: string;
  linkedinUrl: string;
  company: string;
  position: string;
  industry?: string;
  status: 'pending' | 'connected' | 'responded' | 'rejected';
  campaignId: string;
  connectionDate?: Date;
  lastContact?: Date;
  notes?: string;
  tags?: string[];
  emailLookup?: {
    foundEmail?: string;
    confidence?: number;
    source?: string;
    verified?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ICampaign {
  _id?: string;
  name: string;
  description?: string;
  targetCriteria: {
    keywords?: string[];
    location?: string;
    industry?: string;
    company?: string;
  };
  status: 'active' | 'paused' | 'completed';
  contacts: string[];
  templates: string[];
  statistics: {
    totalContacts: number;
    connectionsSent: number;
    connectionsAccepted: number;
    emailsSent: number;
    emailsOpened: number;
    responses: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface ITemplate {
  _id?: string;
  name: string;
  type: 'connection' | 'followup' | 'thankyou' | 'coldOutreach';
  content: string;
  variables: string[];
  category: string;
  tags?: string[];
  usageCount: number;
  successRate?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Response Types

```typescript
// Generic API Response
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Paginated Response
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Bulk Operation Response
interface BulkOperationResult<T> {
  success: boolean;
  results: T[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    errors: string[];
  };
}
```

## Usage Examples

### Complete Campaign Workflow

```typescript
import { LinkedInService, AIService, EmailService, DatabaseService } from './src/services';

async function runCampaign() {
  // Initialize services
  const linkedinService = new LinkedInService({ headless: true });
  const aiService = new AIService();
  const emailService = new EmailService({
    provider: 'gmail',
    credentials: {
      email: 'your-email@gmail.com',
      password: 'your-app-password'
    }
  });
  const dbService = new DatabaseService();

  try {
    // Connect to database
    await dbService.connect();

    // Login to LinkedIn
    const loginSuccess = await linkedinService.login({
      email: 'your-linkedin-email@example.com',
      password: 'your-linkedin-password'
    });

    if (!loginSuccess) {
      throw new Error('LinkedIn login failed');
    }

    // Search for contacts
    const profileUrls = await linkedinService.searchRecruiters({
      keywords: 'software engineer',
      location: 'San Francisco Bay Area',
      maxResults: 10
    });

    // Scrape profiles and save to database
    for (const url of profileUrls) {
      const profile = await linkedinService.scrapeProfile(url);
      if (profile) {
        const contact = await dbService.createContact({
          name: profile.name,
          linkedinUrl: profile.profileUrl,
          company: profile.company,
          position: profile.headline,
          status: 'pending'
        });

        // Generate personalized message
        const message = await aiService.generatePersonalizedMessage(
          profile,
          'initial',
          {
            name: 'Your Name',
            targetRole: 'Software Engineer',
            skills: ['JavaScript', 'React', 'Node.js']
          }
        );

        // Send connection request
        const result = await linkedinService.sendConnectionRequest(url, message);
        if (result.success) {
          await dbService.updateContact(contact._id, {
            status: 'connected',
            connectionDate: new Date()
          });
        }
      }
    }

    // Send follow-up emails
    const connectedContacts = await dbService.searchContacts({
      status: 'connected'
    });

    for (const contact of connectedContacts) {
      if (contact.email) {
        const emailResult = await emailService.sendEmail({
          to: contact.email,
          templateType: 'followUp',
          variables: {
            name: contact.name,
            company: contact.company,
            topic: 'software engineering opportunities'
          },
          campaignId: 'campaign-001'
        });

        if (emailResult.success) {
          await dbService.updateContact(contact._id, {
            lastContact: new Date()
          });
        }
      }
    }

  } finally {
    // Cleanup
    await linkedinService.close();
    await dbService.disconnect();
  }
}

// Run the campaign
runCampaign().catch(console.error);
```

This API documentation provides comprehensive coverage of all services and their methods, with examples and type definitions for easy integration and usage.
