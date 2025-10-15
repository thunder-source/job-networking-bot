#!/usr/bin/env node

/**
 * Front-End Developer Job Search Campaign Setup
 * This script helps set up targeted campaigns for reaching HR and hiring managers
 */

import fs from 'fs';
import path from 'path';

// Campaign configuration
const campaignConfig = {
  name: "Front-End Developer Job Search Q4 2024",
  description: "Targeted outreach to HR professionals and hiring managers",
  maxContactsPerDay: 15,
  maxEmailsPerDay: 10,

  // Target criteria
  targetKeywords: [
    "HR Manager",
    "Talent Acquisition",
    "Technical Recruiter",
    "Hiring Manager",
    "Front End Developer",
    "React Developer",
    "JavaScript Developer",
    "Engineering Manager",
    "Tech Lead"
  ],

  targetLocations: [
    "Remote",
    "Delhi",
    "Mumbai",
    "Bangalore",
    "Hyderabad",
    "Pune",
    "Chennai",
    "Kolkata"
  ],

  targetCompanies: [
    "Google", "Microsoft", "Apple", "Amazon", "Meta", "Netflix", "Tesla", "IBM", "Walmart", "JP Morgan", "JPMorgan Chase", "Goldman Sachs", "Morgan Stanley", "Barclays", "Citigroup", "Deutsche Bank", "HSBC", "UBS", "Credit Suisse", "BNP Paribas", "Societe Generale", "Natixis", "Crédit Agricole", "Banco Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA", "Santander", "BBVA",
    "Uber", "Airbnb", "Stripe", "Shopify", "Spotify", "Salesforce"
  ]
};

// LinkedIn search queries for different target types
const searchQueries = {
  hrProfessionals: [
    "HR Manager AND (Front End OR React OR JavaScript)",
    "Talent Acquisition AND (Software OR Technology OR Engineering)",
    "Technical Recruiter AND (Frontend OR Front-end OR React)",
    "Hiring Manager AND (Engineering OR Development)"
  ],

  technicalLeads: [
    "Engineering Manager AND (Front End OR React OR JavaScript)",
    "Tech Lead AND (Frontend OR Front-end OR React)",
    "Senior Developer AND (React OR JavaScript OR TypeScript)",
    "Lead Developer AND (Front End OR React)"
  ],

  startupFounders: [
    "Founder AND (Tech OR Software OR Startup)",
    "CTO AND (Frontend OR React OR JavaScript)",
    "Co-founder AND (Technology OR Software)"
  ]
};

// Email templates for different scenarios
const emailTemplates = {
  hrConnection: `Hi {{name}},

I'm a passionate Front-End Developer with expertise in React, JavaScript, and modern web technologies. I noticed you work in talent acquisition at {{company}} and would love to connect to learn more about opportunities in your organization.

I'm particularly interested in how your team is building innovative user experiences and would appreciate any insights about your current hiring needs.

Best regards,
Praidtya Manjhi`,

  technicalLeadConnection: `Hello {{name}},

I came across your profile and was impressed by your work as {{position}} at {{company}}. As a Front-End Developer with strong experience in React, TypeScript, and modern JavaScript frameworks, I'd love to connect and share insights about front-end development trends.

I'm always interested in learning from industry leaders like yourself and would welcome the opportunity to discuss potential opportunities at {{company}}.

Best regards,
Praidtya Manjhi`,

  coldEmail: `Subject: Front-End Developer Eager to Contribute to {{company}}'s Success

Dear {{name}},

I hope this email finds you well. My name is Praidtya Manjhi, and I'm a passionate Front-End Developer with expertise in React, JavaScript, TypeScript, and modern web development practices.

I've been following {{company}}'s innovative work and am impressed by your commitment to creating exceptional user experiences. With my background in building responsive, performant web applications, I believe I could make a valuable contribution to your development team.

Here's what I bring to the table:
• Strong proficiency in React, JavaScript, and TypeScript
• Experience with modern CSS frameworks and responsive design  
• Understanding of web performance optimization and accessibility
• Collaborative mindset and passion for clean, maintainable code

I would love the opportunity to discuss how my skills and enthusiasm could benefit {{company}}. Would you be available for a brief conversation this week?

Thank you for your time and consideration.

Best regards,
Praidtya Manjhi
[Your Contact Information]`
};

// LinkedIn connection message templates
const connectionMessages = {
  hr: "Hi {{name}}, I'm a Front-End Developer passionate about creating exceptional user experiences. Would love to connect and learn about opportunities at {{company}}!",

  technical: "Hello {{name}}, I'm a React/JavaScript developer interested in connecting with fellow tech professionals. Would love to share insights about front-end development!",

  general: "Hi {{name}}, I'm a Front-End Developer looking to expand my professional network. Would love to connect and learn from your experience!"
};

// Best practices and tips
const bestPractices = {
  timing: {
    bestDays: ["Tuesday", "Wednesday", "Thursday"],
    bestHours: "9 AM - 11 AM and 2 PM - 4 PM",
    timezone: "Target's local timezone"
  },

  messaging: {
    personalization: "Always mention something specific about their company or role",
    length: "Keep connection messages under 300 characters",
    callToAction: "End with a clear, low-pressure ask"
  },

  safety: {
    dailyLimits: "Max 15 connection requests per day",
    emailLimits: "Max 10 cold emails per day",
    delays: "2-5 minutes between actions",
    monitoring: "Track response rates and adjust accordingly"
  }
};

// Generate campaign commands
function generateCampaignCommands() {
  const commands = [];

  // Search for HR professionals
  commands.push(`# Search for HR professionals
cold-email-bot search --keywords "HR Manager Talent Acquisition" --location "San Francisco Bay Area" --max-results 50 --output hr-professionals.json`);

  // Search for technical hiring managers  
  commands.push(`# Search for technical hiring managers
cold-email-bot search --keywords "Engineering Manager Tech Lead" --location "Remote" --max-results 50 --output technical-managers.json`);

  // Search for senior developers
  commands.push(`# Search for senior developers
cold-email-bot search --keywords "Senior Developer Lead Developer" --location "New York" --max-results 50 --output senior-developers.json`);

  return commands.join('\n\n');
}

// Generate setup instructions
function generateSetupInstructions() {
  return `
# Front-End Developer Job Search Campaign Setup

## 1. Environment Setup
First, make sure your .env file is configured with:
- LinkedIn credentials
- OpenAI API key for personalization
- Email service credentials
- MongoDB connection string

## 2. Load Templates
Load the job search templates:
\`\`\`bash
cold-email-bot templates import --file templates/frontend-job-search-templates.json
\`\`\`

## 3. Create Campaign
\`\`\`bash
cold-email-bot start --campaign "Front-End Developer Job Search" --keywords "HR Manager Technical Recruiter" --location "Remote" --max-contacts 100
\`\`\`

## 4. Search for Contacts
${generateCampaignCommands()}

## 5. Send Connection Requests (Start Small!)
\`\`\`bash
# Start with a small batch to test
cold-email-bot connect --campaign "Front-End Developer Job Search" --max-requests 5 --dry-run

# If successful, run without dry-run
cold-email-bot connect --campaign "Front-End Developer Job Search" --max-requests 10
\`\`\`

## 6. Follow Up with Emails
\`\`\`bash
cold-email-bot followup --campaign "Front-End Developer Job Search" --type followup --max-emails 5
\`\`\`

## 7. Monitor Progress
\`\`\`bash
cold-email-bot dashboard --refresh 30
cold-email-bot stats --campaign "Front-End Developer Job Search"
\`\`\`

## Best Practices:
- Start small (5-10 connections per day)
- Always use --dry-run first to test
- Personalize messages using AI
- Track response rates and adjust
- Be patient - results take time
- Respect LinkedIn's terms of service

## Safety Tips:
- Never exceed daily limits
- Use realistic delays between actions
- Monitor for any LinkedIn warnings
- Keep messages professional and relevant
`;
}

// Save the setup instructions
function saveSetupInstructions() {
  const instructions = generateSetupInstructions();
  fs.writeFileSync('JOB_SEARCH_SETUP.md', instructions);
  console.log('✅ Setup instructions saved to JOB_SEARCH_SETUP.md');
}

// Save campaign configuration
function saveCampaignConfig() {
  const config = {
    campaign: campaignConfig,
    searchQueries,
    emailTemplates,
    connectionMessages,
    bestPractices
  };

  fs.writeFileSync('job-search-config.json', JSON.stringify(config, null, 2));
  console.log('✅ Campaign configuration saved to job-search-config.json');
}

// Main execution
console.log('🚀 Setting up Front-End Developer Job Search Campaign...\n');

saveSetupInstructions();
saveCampaignConfig();

console.log('\n📋 Next Steps:');
console.log('1. Review JOB_SEARCH_SETUP.md for detailed instructions');
console.log('2. Configure your .env file with API keys');
console.log('3. Start with a small test campaign (--dry-run)');
console.log('4. Monitor results and adjust strategy');
console.log('\n💡 Pro Tip: Start small and scale up based on results!');
console.log('\n🎯 Good luck with your job search, Praidtya!');
