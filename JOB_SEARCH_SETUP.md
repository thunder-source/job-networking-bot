
# Front-End Developer Job Search Campaign Setup

## 1. Environment Setup
First, make sure your .env file is configured with:
- LinkedIn credentials
- OpenAI API key for personalization
- Email service credentials
- MongoDB connection string

## 2. Load Templates
Load the job search templates:
```bash
cold-email-bot templates import --file templates/frontend-job-search-templates.json
```

## 3. Create Campaign
```bash
cold-email-bot start --campaign "Front-End Developer Job Search" --keywords "HR Manager Technical Recruiter" --location "Remote" --max-contacts 100
```

## 4. Search for Contacts
# Search for HR professionals
cold-email-bot search --keywords "HR Manager Talent Acquisition" --location "San Francisco Bay Area" --max-results 50 --output hr-professionals.json

# Search for technical hiring managers
cold-email-bot search --keywords "Engineering Manager Tech Lead" --location "Remote" --max-results 50 --output technical-managers.json

# Search for senior developers
cold-email-bot search --keywords "Senior Developer Lead Developer" --location "New York" --max-results 50 --output senior-developers.json

## 5. Send Connection Requests (Start Small!)
```bash
# Start with a small batch to test
cold-email-bot connect --campaign "Front-End Developer Job Search" --max-requests 5 --dry-run

# If successful, run without dry-run
cold-email-bot connect --campaign "Front-End Developer Job Search" --max-requests 10
```

## 6. Follow Up with Emails
```bash
cold-email-bot followup --campaign "Front-End Developer Job Search" --type followup --max-emails 5
```

## 7. Monitor Progress
```bash
cold-email-bot dashboard --refresh 30
cold-email-bot stats --campaign "Front-End Developer Job Search"
```

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
