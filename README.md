# Job Networking Bot

A Node.js CLI tool for job networking automation that helps you connect with professional networks, search for job opportunities, and manage applications.

## Features

- 🔗 **Connect** to networking platforms (LinkedIn, Indeed, etc.)
- 🔍 **Search** for job opportunities with customizable filters
- 📝 **Apply** to job postings automatically or manually
- 👥 **Network** management for professional contacts
- 🎨 **Beautiful CLI** with colored output and progress indicators
- 🗄️ **MongoDB Integration** with Mongoose for data persistence
- 📊 **Advanced Analytics** with campaign tracking and statistics
- 📧 **Template System** with variable substitution and validation
- 🔷 **TypeScript Support** with full type safety and IntelliSense

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd job-networking-bot
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual API keys and configuration
```

4. Set up MongoDB (if not already running):
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install MongoDB locally
# Follow instructions at https://docs.mongodb.com/manual/installation/
```

## Usage

### Development Mode

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run the compiled application
npm start
```

### Basic Commands

```bash
# Show help
npm start -- --help

# Connect to networking platforms
npm start -- connect --platform linkedin

# Search for jobs
npm start -- search --keywords "javascript developer" --location "remote"

# Apply to jobs
npm start -- apply --job-id 12345
npm start -- apply --auto

# Manage network
npm start -- network --add contact@example.com
npm start -- network --list

# Database management
npm start -- db:init          # Initialize database connection
npm start -- db:health        # Check database health
npm start -- db:stats         # Show database statistics
```

### Global Options

- `-v, --verbose`: Enable verbose logging
- `--config <path>`: Specify config file path (default: ".env")

## Project Structure

```
job-networking-bot/
├── src/
│   ├── commands/     # CLI command implementations
│   ├── services/     # External API services
│   ├── models/       # Data models
│   ├── utils/        # Utility functions
│   └── config/       # Configuration files
├── index.js          # Main CLI entry point
├── package.json      # Project configuration
├── .env.example      # Environment variables template
└── .gitignore        # Git ignore rules
```

## Configuration

Copy `.env.example` to `.env` and configure the following:

- **LinkedIn API**: Client ID, Client Secret, Redirect URI
- **Indeed API**: Publisher ID, API Key
- **Email Settings**: SMTP configuration for notifications
- **Database**: Connection string (if using local database)
- **Application Settings**: Rate limits, file paths, etc.

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Run specific command
node index.js <command> [options]
```

## Dependencies

- **commander**: CLI framework
- **inquirer**: Interactive prompts
- **chalk**: Terminal string styling
- **ora**: Elegant terminal spinners
- **dotenv**: Environment variable loading
- **mongoose**: MongoDB object modeling
- **openai**: OpenAI API client for AI-powered message personalization
- **playwright**: Browser automation for LinkedIn scraping

### Development Dependencies

- **typescript**: TypeScript compiler
- **@types/node**: Node.js type definitions
- **@types/inquirer**: Inquirer type definitions
- **ts-node**: TypeScript execution for Node.js
- **nodemon**: Development server with auto-reload
- **rimraf**: Cross-platform rm -rf utility
- **eslint**: JavaScript/TypeScript linter

## Data Models

### Contact
- Personal information (name, email, LinkedIn URL)
- Professional details (company, position, industry)
- Status tracking (pending, connected, responded)
- Conversation history and notes
- Tags and source tracking

### Template
- Message templates with variable substitution
- Support for different types (connection, follow-up, thank you)
- Variable validation and type checking
- Usage tracking and versioning

### Campaign
- Target criteria and filtering
- Performance statistics and analytics
- Contact management and tracking
- Automated scheduling and rate limiting

## LinkedIn Automation

The bot includes a powerful LinkedIn automation service built with Playwright that can:

- **Login with 2FA Support**: Handles manual 2FA code entry
- **Session Persistence**: Saves cookies to avoid repeated logins
- **Recruiter Search**: Search for recruiters with advanced filters
- **Profile Scraping**: Extract detailed profile information
- **Human-like Behavior**: Random delays and stealth measures
- **Error Handling**: Robust error handling for network issues and rate limits

### LinkedIn Service Features

#### Login & Authentication
- Automatic login with email/password
- 2FA support with manual code entry
- Session persistence using cookies
- Stealth mode to avoid detection

#### Search Capabilities
- Search by keywords, location, industry, company
- Configurable result limits
- Advanced filtering options
- Automatic pagination handling

#### Profile Scraping
- Extract name, headline, company, about section
- Get location and connection count
- Scrape work experience
- Handle profile variations and edge cases

#### Safety Features
- Random delays (2-5 seconds) between actions
- Rate limiting and error recovery
- Stealth browser configuration
- Comprehensive error handling

### Usage Example

```typescript
import { LinkedInService, LinkedInCredentials, SearchFilters } from './src/services/linkedinService.js';

const linkedinService = new LinkedInService({
  headless: false, // Set to true for production
  timeout: 30000
});

// Login
const credentials: LinkedInCredentials = {
  email: 'your-email@example.com',
  password: 'your-password'
};

await linkedinService.login(credentials);

// Search for recruiters
const searchFilters: SearchFilters = {
  keywords: 'recruiter',
  location: 'United States',
  industry: 'Information Technology and Services',
  maxResults: 10
};

const recruiterUrls = await linkedinService.searchRecruiters(searchFilters);

// Scrape profiles
const profiles = await linkedinService.scrapeProfiles(recruiterUrls);

// Clean up
await linkedinService.close();
```

### Running LinkedIn Examples

```bash
# Run the LinkedIn automation example
npm run linkedin:example

# Or run directly with ts-node
npx ts-node examples/linkedin-example.ts
```

## AI-Powered Message Personalization

The bot includes an advanced AI service powered by OpenAI that can generate personalized messages for networking:

### AI Service Features

- **OpenAI Integration**: Uses GPT-4-turbo or GPT-3.5-turbo for intelligent message generation
- **Template System**: Built-in templates for initial connection, follow-up, and thank you messages
- **Variable Substitution**: Dynamic placeholders like {name}, {company}, {position}, {commonality}
- **Profile Analysis**: Automatically analyzes recruiter profiles to find talking points
- **Tone Control**: Professional, friendly, or enthusiastic message tones
- **Length Validation**: Ensures messages stay within LinkedIn's 200-300 character limit
- **Retry Logic**: Built-in error handling and retry mechanisms

### AI Service Usage

```typescript
import { AIService, IRecruiterProfile, IUserInfo } from './src/services/aiService.js';

// Initialize AI service
const aiService = new AIService();

// Define recruiter profile
const recruiterProfile: IRecruiterProfile = {
  name: 'Sarah Johnson',
  company: 'TechCorp',
  position: 'Senior Software Engineer',
  industry: 'Technology',
  skills: ['JavaScript', 'React', 'Node.js'],
  experience: '5 years',
  recentActivity: 'Recently posted about machine learning trends'
};

// Define your information
const userInfo: IUserInfo = {
  name: 'Alex Chen',
  targetRole: 'Software Engineer',
  skills: ['JavaScript', 'React', 'Node.js'],
  experience: '3 years'
};

// Generate personalized message
const message = await aiService.generatePersonalizedMessage(
  recruiterProfile,
  'initial',
  userInfo,
  { tone: 'professional', maxLength: 280 }
);

console.log(message);
// Output: "Hi Sarah! I noticed your work at TechCorp in Senior Software Engineer. 
// I'm impressed by your expertise in JavaScript and React, and would love to 
// connect to learn more about your experience with machine learning projects."
```

### Message Templates

The service includes three default templates:

#### Initial Connection
```
Hi {name}! I noticed your work at {company} in {position}. 
I'm impressed by {commonality} and would love to connect 
to learn more about your experience.
```

#### Follow-up Message
```
Hi {name}, I hope you're doing well! I wanted to follow up 
on my previous message about {commonality}. Would you be 
open to a brief conversation about {position} opportunities?
```

#### Thank You Message
```
Thank you for connecting, {name}! I really appreciate you 
taking the time to share insights about {commonality} at 
{company}. Looking forward to staying in touch!
```

### Profile Analysis

The service can analyze recruiter profiles to find relevant talking points:

```typescript
const talkingPoints = await aiService.analyzeRecruiterProfile(
  recruiterProfile, 
  userInfo
);

// Returns array of talking points like:
// [
//   "Shared expertise in JavaScript and React",
//   "Interest in machine learning and emerging technologies",
//   "Experience with scalable web applications"
// ]
```

### Tone Options

- **Professional**: Formal and business-focused
- **Friendly**: Warm and approachable  
- **Enthusiastic**: Energetic and passionate

### Running AI Examples

```bash
# Run the AI service example
npm run ai:example

# Or run directly with ts-node
npx ts-node examples/ai-example.ts
```

## Template Management Service

The bot includes a comprehensive template management service for creating, testing, and managing message templates:

### Template Service Features

- **CRUD Operations**: Create, read, update, and delete templates
- **Template Testing**: Test templates with sample data before use
- **Variable Validation**: Automatic validation of template variables and character limits
- **Database Integration**: Full MongoDB integration for template persistence
- **Scenario Categorization**: Organize templates by type, category, and tags
- **Template Versioning**: Track template changes and maintain version history
- **Search & Filtering**: Find templates by keywords, type, or category

### Template Service Usage

```typescript
import { TemplateService } from './src/services/templateService.js';

// Initialize template service
const templateService = new TemplateService();

// Create a new template
const template = await templateService.createTemplate({
  name: 'Software Engineer Outreach',
  type: TemplateType.CONNECTION,
  content: 'Hi {{name}}! I noticed your work with {{technology}} at {{company}}.',
  variables: [
    { name: 'name', type: VariableType.STRING, required: true },
    { name: 'technology', type: VariableType.STRING, required: true },
    { name: 'company', type: VariableType.STRING, required: true }
  ],
  category: TemplateCategory.NETWORKING,
  tags: ['linkedin', 'software', 'engineering']
});

// Test template with sample data
const testResult = await templateService.testTemplate(template._id, {
  name: 'Sarah Johnson',
  technology: 'React and Node.js',
  company: 'TechCorp'
});

console.log(testResult.renderedContent);
// Output: "Hi Sarah Johnson! I noticed your work with React and Node.js at TechCorp."
```

### Template Operations

#### Create Template
```typescript
const template = await templateService.createTemplate({
  name: 'Template Name',
  type: TemplateType.CONNECTION,
  content: 'Message with {{variable}} placeholders',
  variables: [
    { name: 'variable', type: VariableType.STRING, required: true }
  ],
  category: TemplateCategory.NETWORKING
});
```

#### Test Template
```typescript
const result = await templateService.testTemplate(templateId, {
  variable: 'sample value'
});

console.log(result.success); // true/false
console.log(result.renderedContent); // rendered message
console.log(result.validationErrors); // array of errors
console.log(result.characterCount); // character count
```

#### Search Templates
```typescript
const templates = await templateService.searchTemplates('software');
const byType = await templateService.getTemplatesByType(TemplateType.CONNECTION);
const byCategory = await templateService.getTemplatesByCategory(TemplateCategory.NETWORKING);
```

#### Get Templates by Scenario
```typescript
const scenario: IScenario = {
  type: TemplateType.CONNECTION,
  category: TemplateCategory.NETWORKING,
  tags: ['linkedin'],
  platform: 'linkedin'
};

const templates = await templateService.getTemplatesByScenario(scenario);
```

### Template Validation

The service automatically validates:
- **Character Limits**: Ensures messages stay within LinkedIn's limits (200-300 chars)
- **Required Variables**: Checks that all required variables are provided
- **Variable Types**: Validates variable types (string, number, date, boolean, array)
- **Template Syntax**: Ensures proper variable bracket syntax `{{variable}}`

### Default Templates

The service includes three default templates:
- **LinkedIn Initial Connection**: Professional first contact message
- **LinkedIn Follow-up Message**: Polite follow-up for previous conversations  
- **LinkedIn Thank You Message**: Appreciation message after connecting

### Running Template Examples

```bash
# Run the template service example
npm run template:example

# Or run directly with ts-node
npx ts-node examples/template-example.ts
```

## Email Service

The bot includes a comprehensive email service with Nodemailer integration for sending professional emails:

### Email Service Features

- **SMTP Integration**: Support for Gmail, Outlook, and custom SMTP servers
- **HTML Templates**: Professional email templates with responsive design
- **Email Tracking**: Open rate tracking using tracking pixels
- **Unsubscribe Handling**: Built-in unsubscribe link management
- **Rate Limiting**: Respects ESP limits to avoid being flagged as spam
- **Email Validation**: Validates email addresses before sending
- **Bulk Sending**: Send multiple emails with rate limiting and delays
- **Template System**: Pre-built templates for cold outreach, follow-up, and thank you emails

### Email Service Usage

```typescript
import { EmailService, IEmailConfig, IEmailData } from './src/services/emailService.js';

// Configure email service
const emailConfig: IEmailConfig = {
  provider: 'gmail',
  credentials: {
    email: 'your-email@gmail.com',
    password: 'your-app-password'
  },
  trackingBaseUrl: 'https://your-domain.com/track',
  unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe',
  rateLimit: {
    maxEmailsPerHour: 50,
    windowMs: 60 * 60 * 1000
  }
};

// Initialize email service
const emailService = new EmailService(emailConfig);

// Send single email
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

### Email Templates

The service includes three professional email templates:

#### Cold Outreach Email
- Professional first contact message
- Personalized with company, position, and technology details
- Includes tracking pixel and unsubscribe link

#### Follow-up Email
- Polite follow-up for previous conversations
- Maintains professional tone while being persistent
- Includes relevant industry insights

#### Thank You Email
- Appreciation message after connecting
- Acknowledges specific insights shared
- Maintains relationship for future collaboration

### SMTP Configuration

#### Gmail Setup
```typescript
const gmailConfig: IEmailConfig = {
  provider: 'gmail',
  credentials: {
    email: 'your-email@gmail.com',
    password: 'your-app-password' // Use App Password, not regular password
  }
};
```

#### Outlook Setup
```typescript
const outlookConfig: IEmailConfig = {
  provider: 'outlook',
  credentials: {
    email: 'your-email@outlook.com',
    password: 'your-password'
  }
};
```

#### Custom SMTP Setup
```typescript
const customConfig: IEmailConfig = {
  provider: 'custom',
  credentials: {
    email: 'your-email@yourdomain.com',
    password: 'your-password',
    host: 'smtp.yourdomain.com',
    port: 587,
    secure: false
  }
};
```

### Email Tracking

The service includes comprehensive tracking features:

```typescript
// Track email opens
await emailService.trackEmailOpen(trackingId);

// Handle unsubscribes
await emailService.handleUnsubscribe(trackingId);

// Get email statistics
const stats = await emailService.getEmailStats('campaign-001');
console.log(`Open rate: ${(stats.openRate * 100).toFixed(2)}%`);
```

### Bulk Email Sending

```typescript
const bulkEmails: IEmailData[] = [
  {
    to: 'recipient1@example.com',
    templateType: 'coldOutreach',
    variables: { /* ... */ }
  },
  {
    to: 'recipient2@example.com',
    templateType: 'coldOutreach',
    variables: { /* ... */ }
  }
];

const results = await emailService.sendBulkEmails(bulkEmails, {
  delayBetweenEmails: 2000, // 2 seconds between emails
  maxConcurrent: 5
});
```

### Rate Limiting

The service includes built-in rate limiting to respect ESP limits:

- **Gmail**: 50 emails per hour (configurable)
- **Outlook**: 30 emails per hour (configurable)
- **Custom SMTP**: 100 emails per hour (configurable)
- **Automatic delays** between bulk emails
- **Per-email rate limiting** to avoid spam detection

### Email Validation

```typescript
// Validate email addresses
const isValid = emailService.validateEmail('test@example.com');
console.log(isValid); // true/false
```

### Running Email Examples

```bash
# Run the email service example
npm run email:example

# Or run directly with ts-node
npx ts-node examples/email-example.ts
```

### Environment Variables

Create a `.env` file with your API credentials:

```env
# LinkedIn credentials
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password

# OpenAI API key for AI message personalization
OPENAI_API_KEY=your-openai-api-key

# Email service credentials
GMAIL_EMAIL=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
OUTLOOK_EMAIL=your-email@outlook.com
OUTLOOK_PASSWORD=your-password
SMTP_EMAIL=your-email@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false

# Database connection (optional)
MONGODB_URI=mongodb://localhost:27017/job-networking-bot
```

### Important Notes

⚠️ **Use Responsibly**: This tool is for educational and legitimate networking purposes only. Always respect LinkedIn's Terms of Service and rate limits.

⚠️ **2FA Required**: The service supports manual 2FA code entry. You'll need to enter the code when prompted.

⚠️ **Rate Limiting**: The service includes built-in delays and error handling, but be mindful of LinkedIn's rate limits.

## Examples

Run the database example to see the models in action:
```bash
# Using ts-node (development)
npx ts-node --esm examples/database-example.ts

# Using compiled JavaScript
npm run build
node examples/database-example.js
```

Run the LinkedIn automation example:
```bash
# Using ts-node (development)
npm run linkedin:example

# Using compiled JavaScript
npm run build
node dist/examples/linkedin-example.js
```

Run the AI service example:
```bash
# Using ts-node (development)
npm run ai:example

# Using compiled JavaScript
npm run build
node dist/examples/ai-example.js
```

Run the template service example:
```bash
# Using ts-node (development)
npm run template:example

# Using compiled JavaScript
npm run build
node dist/examples/template-example.js
```

Run the email service example:
```bash
# Using ts-node (development)
npm run email:example

# Using compiled JavaScript
npm run build
node dist/examples/email-example.js
```

## License

MIT
