# Cold Email Bot

A comprehensive Node.js CLI tool for automated LinkedIn networking and cold email campaigns. This bot helps you streamline professional networking by automating connection requests, email outreach, and relationship management.

## 🚀 Features

### Core Functionality
- **🔗 LinkedIn Automation**: Automated connection requests with personalized messages
- **📧 Email Campaigns**: Cold email outreach with professional templates
- **🤖 AI-Powered Personalization**: OpenAI integration for intelligent message generation
- **📊 Campaign Management**: Track and analyze your networking campaigns
- **🎯 Contact Management**: Organize and manage professional contacts
- **📈 Analytics & Reporting**: Comprehensive statistics and performance tracking

### Advanced Features
- **🛡️ Rate Limiting & Safety**: Built-in LinkedIn rate limiting and jail detection
- **📝 Template System**: Customizable message templates with variable substitution
- **🔍 Email Lookup**: Find email addresses using Hunter.io and RocketReach APIs
- **📅 Smart Scheduling**: Optimal timing for LinkedIn actions and email sending
- **🔄 Follow-up Automation**: Automated follow-up sequences
- **💾 Database Integration**: MongoDB for data persistence and backup
- **📱 CLI Dashboard**: Real-time monitoring and control interface

## 🏗️ Architecture

The Cold Email Bot is built with a modular architecture using TypeScript and Node.js:

```
cold-email-bot/
├── src/
│   ├── commands/          # CLI command implementations
│   ├── services/          # Core business logic services
│   ├── models/           # MongoDB data models
│   ├── config/           # Configuration management
│   ├── utils/            # Utility functions and helpers
│   └── types/            # TypeScript type definitions
├── examples/             # Example usage scripts
├── docs/                 # Documentation
└── dist/                 # Compiled JavaScript output
```

### Key Services
- **LinkedInService**: LinkedIn automation with Playwright
- **AIService**: OpenAI-powered message personalization
- **EmailService**: Email sending with templates and tracking
- **TemplateService**: Message template management
- **DatabaseService**: MongoDB operations and data management
- **RateLimiter**: LinkedIn and email rate limiting
- **SchedulerService**: Automated follow-up scheduling

## 📦 Installation

### Prerequisites
- Node.js 14+ 
- MongoDB (local or cloud)
- LinkedIn account with 2FA enabled
- OpenAI API key
- Email service credentials (Gmail, Outlook, or SMTP)

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/cold-email-bot.git
cd cold-email-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp env.example .env
# Edit .env with your actual API keys and configuration
```

4. **Set up MongoDB:**
```bash
# Option 1: Using Docker (Recommended)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Option 2: Local installation
# Follow instructions at https://docs.mongodb.com/manual/installation/

# Option 3: MongoDB Atlas (Cloud)
# Create account at https://cloud.mongodb.com
```

5. **Build the project:**
```bash
npm run build
```

6. **Test your configuration:**
```bash
npm start test --all
```

## 🚀 Usage

### Development Mode

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run the compiled application
npm start
```

### CLI Commands

#### Campaign Management
```bash
# Start a new campaign
cold-email-bot start --campaign "Tech Recruiters Q1" --keywords "recruiter" --location "San Francisco" --max-contacts 50

# Search for contacts
cold-email-bot search --keywords "software engineer" --location "Remote" --max-results 20 --output contacts.json

# Send connection requests
cold-email-bot connect --campaign "Tech Recruiters Q1" --max-requests 10 --dry-run
```

#### Email Campaigns
```bash
# Send follow-up emails
cold-email-bot followup --campaign "Tech Recruiters Q1" --type followup --max-emails 5

# Process scheduled emails
cold-email-bot followup --type thankyou --max-emails 10
```

#### Contact Management
```bash
# List all contacts
cold-email-bot contacts list --status connected --campaign "Tech Recruiters Q1"

# Export contacts
cold-email-bot contacts export --format csv --output contacts.csv

# Update contact information
cold-email-bot contacts update --filter "company:Google" --field status --value contacted
```

#### Template Management
```bash
# List all templates
cold-email-bot templates list --type connection

# Create new template
cold-email-bot templates add --name "Software Engineer Outreach" --type connection --content "Hi {{name}}..."

# Test template
cold-email-bot templates test --id template123 --variables '{"name":"John","company":"Google"}'
```

#### Configuration
```bash
# Set API keys
cold-email-bot config set --key OPENAI_API_KEY --value your-api-key

# Validate configuration
cold-email-bot config validate

# List all settings
cold-email-bot config list
```

#### System Monitoring
```bash
# Show dashboard
cold-email-bot dashboard --refresh 30

# System status
cold-email-bot system status

# Database health
cold-email-bot system db-health

# Process monitoring
cold-email-bot system monitor
```

#### Testing
```bash
# Test all services
cold-email-bot test --all

# Test specific services
cold-email-bot test --linkedin --ai --email

# Test database connection
cold-email-bot test --database
```

### Global Options

- `-v, --verbose`: Enable verbose logging
- `--config <path>`: Specify config file path (default: ".env")
- `--dry-run`: Simulate actions without executing them
- `--headless`: Run browser in headless mode

## ⚙️ Configuration

### Environment Variables

Create a `.env` file from the template:

```bash
cp env.example .env
```

#### Required Configuration

```env
# Database
MONGODB_URI=mongodb://localhost:27017/cold-email-bot

# LinkedIn Credentials
LINKEDIN_EMAIL=your-email@domain.com
LINKEDIN_PASSWORD=your-password

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# Email Service
EMAIL_FROM=your-email@domain.com
EMAIL_PROVIDER=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Email Lookup APIs (Optional)
HUNTER_API_KEY=your-hunter-io-api-key
ROCKETREACH_API_KEY=your-rocketreach-api-key
```

#### Advanced Configuration

```env
# Rate Limiting
LINKEDIN_MAX_CONNECTIONS_PER_DAY=20
LINKEDIN_MAX_MESSAGES_PER_DAY=10
EMAIL_MAX_PER_HOUR=50

# Safety & Monitoring
ERROR_EMAIL_ENABLED=true
ERROR_EMAIL_RECIPIENTS=admin@domain.com
BACKUP_ENABLED=true
DEBUG_MODE=false

# Timing
OPTIMAL_START_HOUR=9
OPTIMAL_END_HOUR=18
TIMEZONE=America/New_York
```

### API Keys Setup

#### 1. OpenAI API Key
1. Visit [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to your `.env` file

#### 2. Email Service Setup

**Gmail:**
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `EMAIL_PASS`

**Outlook:**
1. Use your regular password
2. Set `EMAIL_PROVIDER=outlook`

#### 3. Email Lookup APIs (Optional)

**Hunter.io:**
1. Sign up at [Hunter.io](https://hunter.io)
2. Get your API key from dashboard
3. Add to `HUNTER_API_KEY`

**RocketReach:**
1. Sign up at [RocketReach](https://rocketreach.co)
2. Get your API key from settings
3. Add to `ROCKETREACH_API_KEY`

## 📚 Examples

### Basic Campaign Workflow

1. **Start a LinkedIn campaign:**
```bash
cold-email-bot start --campaign "Software Engineers" --keywords "software engineer" --location "San Francisco Bay Area" --max-contacts 30
```

2. **Send connection requests:**
```bash
cold-email-bot connect --campaign "Software Engineers" --max-requests 10
```

3. **Send follow-up emails:**
```bash
cold-email-bot followup --campaign "Software Engineers" --type followup --max-emails 5
```

4. **Monitor progress:**
```bash
cold-email-bot dashboard
```

### Advanced Examples

#### Custom Template Campaign
```bash
# Create custom template
cold-email-bot templates add --name "React Developer Outreach" --type connection --content "Hi {{name}}, I noticed your React work at {{company}}. Would love to connect about opportunities!"

# Use template in campaign
cold-email-bot connect --campaign "React Developers" --template "React Developer Outreach" --max-requests 15
```

#### Email Lookup Integration
```bash
# Search contacts with email lookup
cold-email-bot search --keywords "product manager" --enable-email-lookup --output contacts.json

# Send emails to found contacts
cold-email-bot followup --source contacts.json --type coldOutreach --verify-emails
```

#### Automated Follow-up Sequence
```bash
# Schedule multiple follow-ups
cold-email-bot followup --campaign "Q1 Outreach" --schedule "3d,7d,14d" --type followup
```

## 🛡️ Best Practices

### LinkedIn Safety
- **Start Small**: Begin with 5-10 connection requests per day
- **Use Dry Run**: Always test with `--dry-run` first
- **Respect Limits**: Never exceed daily limits
- **Monitor Activity**: Check dashboard regularly
- **Human-like Behavior**: Use built-in delays and randomization

### Email Best Practices
- **Personalize Messages**: Use AI-generated personalized content
- **Verify Emails**: Always verify email addresses before sending
- **Respect Unsubscribes**: Honor unsubscribe requests immediately
- **Monitor Deliverability**: Track open rates and bounces
- **Follow CAN-SPAM**: Include unsubscribe links and sender info

### Campaign Management
- **Segment Contacts**: Use different campaigns for different audiences
- **Track Performance**: Monitor connection rates and response rates
- **A/B Test Templates**: Test different message templates
- **Regular Cleanup**: Remove inactive contacts and update statuses
- **Backup Data**: Enable automatic database backups

## 🔧 Development

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📦 Dependencies

### Core Dependencies
- **commander**: CLI framework and command parsing
- **inquirer**: Interactive prompts for user input
- **chalk**: Terminal string styling and colors
- **ora**: Elegant terminal spinners and progress indicators
- **dotenv**: Environment variable loading
- **mongoose**: MongoDB object modeling and database operations
- **openai**: OpenAI API client for AI-powered message personalization
- **playwright**: Browser automation for LinkedIn scraping
- **nodemailer**: Email sending functionality
- **validator**: Email validation utilities
- **winston**: Advanced logging system

### Development Dependencies
- **typescript**: TypeScript compiler and type checking
- **@types/node**: Node.js type definitions
- **@types/inquirer**: Inquirer type definitions
- **ts-node**: TypeScript execution for Node.js
- **nodemon**: Development server with auto-reload
- **rimraf**: Cross-platform file removal utility
- **eslint**: JavaScript/TypeScript code linting

## 📊 Data Models

### Contact Model
```typescript
interface Contact {
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
}
```

### Template Model
```typescript
interface Template {
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

### Campaign Model
```typescript
interface Campaign {
  name: string;
  description?: string;
  targetCriteria: {
    keywords?: string[];
    location?: string;
    industry?: string;
    company?: string;
  };
  status: 'active' | 'paused' | 'completed';
  contacts: string[]; // Contact IDs
  templates: string[]; // Template IDs
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
```

## 🚨 Important Notes

### Legal and Ethical Usage
⚠️ **Use Responsibly**: This tool is for educational and legitimate networking purposes only. Always respect LinkedIn's Terms of Service and rate limits.

⚠️ **Rate Limiting**: The service includes built-in delays and error handling, but be mindful of LinkedIn's rate limits.

⚠️ **2FA Required**: The service supports manual 2FA code entry. You'll need to enter the code when prompted.

### Support and Troubleshooting

#### Common Issues
1. **LinkedIn Login Issues**: Ensure 2FA is enabled and use manual code entry
2. **Rate Limiting**: Reduce daily limits and increase delays between actions
3. **Email Delivery**: Check spam folders and verify email credentials
4. **Database Connection**: Ensure MongoDB is running and accessible

#### Getting Help
- Check the [documentation](docs/)
- Review [examples](examples/)
- Open an issue on GitHub
- Check logs in the `logs/` directory

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone and setup
git clone https://github.com/yourusername/cold-email-bot.git
cd cold-email-bot
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for AI-powered message personalization
- [Playwright](https://playwright.dev) for browser automation
- [MongoDB](https://mongodb.com) for data persistence
- [Commander.js](https://github.com/tj/commander.js) for CLI framework

