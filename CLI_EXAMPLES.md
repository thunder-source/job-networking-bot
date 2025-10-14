# CLI Usage Examples

This document provides comprehensive examples of how to use the Cold Email Bot CLI tool for various networking and email campaign scenarios.

## Table of Contents

- [Getting Started](#getting-started)
- [Campaign Management](#campaign-management)
- [LinkedIn Automation](#linkedin-automation)
- [Email Campaigns](#email-campaigns)
- [Contact Management](#contact-management)
- [Template Management](#template-management)
- [Configuration](#configuration)
- [System Monitoring](#system-monitoring)
- [Testing](#testing)
- [Advanced Workflows](#advanced-workflows)

## Getting Started

### Basic Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Copy environment template
cp env.example .env

# Edit configuration
nano .env

# Test configuration
cold-email-bot test --all
```

### First Campaign

```bash
# Start your first campaign
cold-email-bot start \
  --campaign "My First Campaign" \
  --keywords "software engineer" \
  --location "San Francisco Bay Area" \
  --max-contacts 10 \
  --dry-run

# Run the actual campaign
cold-email-bot start \
  --campaign "My First Campaign" \
  --keywords "software engineer" \
  --location "San Francisco Bay Area" \
  --max-contacts 10
```

## Campaign Management

### Creating Campaigns

```bash
# Basic campaign creation
cold-email-bot start --campaign "Tech Recruiters Q1" --keywords "recruiter"

# Advanced campaign with multiple filters
cold-email-bot start \
  --campaign "Senior Developers" \
  --keywords "senior software engineer,lead developer,tech lead" \
  --location "United States" \
  --industry "Information Technology" \
  --max-contacts 50

# Campaign with specific company targeting
cold-email-bot start \
  --campaign "FAANG Outreach" \
  --keywords "software engineer" \
  --location "San Francisco Bay Area" \
  --company "Google,Facebook,Apple,Netflix,Amazon" \
  --max-contacts 30
```

### Campaign Monitoring

```bash
# View dashboard
cold-email-bot dashboard

# View with auto-refresh
cold-email-bot dashboard --refresh 30

# Export dashboard data
cold-email-bot dashboard --export dashboard-data.json

# View campaign statistics
cold-email-bot stats --campaign "Tech Recruiters Q1"

# View all campaigns
cold-email-bot stats --all
```

## LinkedIn Automation

### Profile Search and Scraping

```bash
# Basic recruiter search
cold-email-bot search --keywords "recruiter" --max-results 20

# Advanced search with filters
cold-email-bot search \
  --keywords "technical recruiter" \
  --location "San Francisco Bay Area" \
  --industry "Information Technology" \
  --max-results 50 \
  --output recruiters.json

# Search with company filter
cold-email-bot search \
  --keywords "software engineer" \
  --location "Remote" \
  --company "Google" \
  --max-results 30 \
  --headless
```

### Connection Requests

```bash
# Send connection requests from campaign
cold-email-bot connect --campaign "Tech Recruiters Q1" --max-requests 10

# Send with custom message
cold-email-bot connect \
  --campaign "Tech Recruiters Q1" \
  --message "Hi! I noticed your work in tech recruiting. Would love to connect!" \
  --max-requests 5

# Send to specific URLs
cold-email-bot connect \
  --urls "https://linkedin.com/in/johndoe" "https://linkedin.com/in/janedoe" \
  --message "Hi! Would love to connect and learn about opportunities."

# Dry run to test
cold-email-bot connect --campaign "Tech Recruiters Q1" --max-requests 10 --dry-run

# Send from file
cold-email-bot connect \
  --file contacts.txt \
  --max-requests 15 \
  --message "Hi! I'd love to connect and discuss opportunities."
```

### Bulk Operations

```bash
# Process multiple profiles with rate limiting
cold-email-bot connect \
  --campaign "Bulk Outreach" \
  --max-requests 20 \
  --delay 30000

# Send connections with AI-generated messages
cold-email-bot connect \
  --campaign "AI Personalization Test" \
  --max-requests 10 \
  --ai-personalization
```

## Email Campaigns

### Follow-up Emails

```bash
# Send follow-up emails
cold-email-bot followup --campaign "Tech Recruiters Q1" --type followup --max-emails 5

# Send thank you emails
cold-email-bot followup --campaign "Tech Recruiters Q1" --type thankyou --max-emails 10

# Process all scheduled emails
cold-email-bot followup --type followup --max-emails 20

# Dry run for email testing
cold-email-bot followup --campaign "Tech Recruiters Q1" --type followup --max-emails 5 --dry-run
```

### Email Lookup Integration

```bash
# Search with email lookup enabled
cold-email-bot search \
  --keywords "product manager" \
  --enable-email-lookup \
  --output contacts-with-emails.json

# Send emails with automatic lookup
cold-email-bot followup \
  --campaign "Email Test" \
  --type coldOutreach \
  --verify-emails \
  --min-confidence 70
```

## Contact Management

### Listing Contacts

```bash
# List all contacts
cold-email-bot contacts list

# List by status
cold-email-bot contacts list --status connected

# List by campaign
cold-email-bot contacts list --campaign "Tech Recruiters Q1"

# List with filters
cold-email-bot contacts list \
  --status connected \
  --company "Google" \
  --limit 20
```

### Contact Operations

```bash
# Export contacts to CSV
cold-email-bot contacts export \
  --format csv \
  --output contacts.csv \
  --campaign "Tech Recruiters Q1"

# Export to JSON
cold-email-bot contacts export \
  --format json \
  --output contacts.json \
  --status connected

# Update contact information
cold-email-bot contacts update \
  --filter "company:Google" \
  --field status \
  --value contacted

# Bulk update
cold-email-bot contacts update \
  --filter "campaign:Tech Recruiters Q1" \
  --field lastContact \
  --value "$(date -Iseconds)"
```

### Contact Lookup

```bash
# Look up email for specific contact
cold-email-bot contacts lookup \
  --name "John Doe" \
  --company "Google" \
  --verify

# Bulk email lookup
cold-email-bot contacts lookup \
  --campaign "Tech Recruiters Q1" \
  --min-confidence 80
```

## Template Management

### Creating Templates

```bash
# Create connection template
cold-email-bot templates add \
  --name "Software Engineer Outreach" \
  --type connection \
  --content "Hi {{name}}! I noticed your work with {{technology}} at {{company}}. Would love to connect about opportunities!"

# Create follow-up template
cold-email-bot templates add \
  --name "Follow-up Message" \
  --type followup \
  --content "Hi {{name}}, I hope you're doing well! I wanted to follow up on my previous message about {{topic}}."

# Create email template
cold-email-bot templates add \
  --name "Cold Outreach Email" \
  --type coldOutreach \
  --content "Hi {{name}},\n\nI hope this email finds you well. I came across your profile and was impressed by your work at {{company}}.\n\nBest regards,\n{{senderName}}"
```

### Template Operations

```bash
# List all templates
cold-email-bot templates list

# List by type
cold-email-bot templates list --type connection

# Search templates
cold-email-bot templates search --keywords "software engineer"

# Show template details
cold-email-bot templates show --id template123

# Test template
cold-email-bot templates test \
  --id template123 \
  --variables '{"name":"John Doe","company":"Google","technology":"React"}'

# Edit template
cold-email-bot templates edit \
  --id template123 \
  --content "Updated template content with {{variables}}"

# Delete template
cold-email-bot templates delete --id template123
```

## Configuration

### Setting Configuration

```bash
# Set API keys
cold-email-bot config set --key OPENAI_API_KEY --value "sk-..."

# Set LinkedIn credentials
cold-email-bot config set --key LINKEDIN_EMAIL --value "your-email@domain.com"

# Set email configuration
cold-email-bot config set --key EMAIL_USER --value "your-email@gmail.com"

# Set rate limits
cold-email-bot config set --key LINKEDIN_MAX_CONNECTIONS_PER_DAY --value "15"
```

### Configuration Management

```bash
# List all configuration
cold-email-bot config list

# Get specific value
cold-email-bot config get --key OPENAI_API_KEY

# Validate configuration
cold-email-bot config validate

# Reset to defaults
cold-email-bot config reset

# Export configuration
cold-email-bot config export --output config.json

# Import configuration
cold-email-bot config import --file config.json
```

## System Monitoring

### System Status

```bash
# Check system status
cold-email-bot system status

# Monitor processes
cold-email-bot system monitor

# Check database health
cold-email-bot system db-health

# View system logs
cold-email-bot system logs --lines 100

# Check rate limits
cold-email-bot system limits
```

### Performance Monitoring

```bash
# Monitor memory usage
cold-email-bot system monitor --memory

# Check disk space
cold-email-bot system monitor --disk

# View active connections
cold-email-bot system connections

# Check API status
cold-email-bot system apis
```

## Testing

### Service Testing

```bash
# Test all services
cold-email-bot test --all

# Test specific services
cold-email-bot test --linkedin --ai --email

# Test database connection
cold-email-bot test --database

# Test email configuration
cold-email-bot test --email

# Test LinkedIn login
cold-email-bot test --linkedin

# Test AI message generation
cold-email-bot test --ai
```

### Integration Testing

```bash
# Test complete workflow
cold-email-bot test --workflow

# Test with mock data
cold-email-bot test --mock

# Test rate limiting
cold-email-bot test --rate-limits

# Test error handling
cold-email-bot test --errors
```

## Advanced Workflows

### Complete Campaign Workflow

```bash
#!/bin/bash
# Complete automated campaign workflow

echo "Starting complete campaign workflow..."

# 1. Create campaign
cold-email-bot start \
  --campaign "Q1 Tech Outreach" \
  --keywords "software engineer,developer" \
  --location "San Francisco Bay Area" \
  --max-contacts 50 \
  --headless

# 2. Wait for profile scraping to complete
echo "Waiting for profile scraping to complete..."
sleep 300

# 3. Send connection requests
cold-email-bot connect \
  --campaign "Q1 Tech Outreach" \
  --max-requests 20 \
  --delay 60000

# 4. Wait for connections to be accepted
echo "Waiting for connections to be accepted..."
sleep 86400 # Wait 24 hours

# 5. Send follow-up emails
cold-email-bot followup \
  --campaign "Q1 Tech Outreach" \
  --type followup \
  --max-emails 10

# 6. Generate report
cold-email-bot stats --campaign "Q1 Tech Outreach" --export q1-report.json

echo "Campaign workflow completed!"
```

### Multi-Campaign Management

```bash
#!/bin/bash
# Manage multiple campaigns

CAMPAIGNS=("Tech Recruiters" "Product Managers" "Designers" "Marketing")

for campaign in "${CAMPAIGNS[@]}"; do
  echo "Processing campaign: $campaign"
  
  # Start campaign
  cold-email-bot start \
    --campaign "$campaign" \
    --keywords "$campaign" \
    --max-contacts 25 \
    --headless
  
  # Wait between campaigns
  sleep 3600 # 1 hour between campaigns
done

# Process all connections
for campaign in "${CAMPAIGNS[@]}"; do
  echo "Sending connections for: $campaign"
  
  cold-email-bot connect \
    --campaign "$campaign" \
    --max-requests 10 \
    --delay 30000
  
  sleep 1800 # 30 minutes between connection batches
done
```

### Automated Follow-up Sequences

```bash
#!/bin/bash
# Automated follow-up sequence

CAMPAIGN="Q1 Tech Outreach"

# Day 1: Initial connections
cold-email-bot connect --campaign "$CAMPAIGN" --max-requests 20

# Day 3: First follow-up
sleep 172800 # 2 days
cold-email-bot followup --campaign "$CAMPAIGN" --type followup --max-emails 15

# Day 7: Second follow-up
sleep 345600 # 4 more days
cold-email-bot followup --campaign "$CAMPAIGN" --type followup --max-emails 10

# Day 14: Final follow-up
sleep 604800 # 7 more days
cold-email-bot followup --campaign "$CAMPAIGN" --type followup --max-emails 5

# Generate final report
cold-email-bot stats --campaign "$CAMPAIGN" --export final-report.json
```

### Email Campaign with Lookup

```bash
#!/bin/bash
# Email campaign with automatic email lookup

# 1. Search contacts with email lookup
cold-email-bot search \
  --keywords "product manager" \
  --location "United States" \
  --enable-email-lookup \
  --output pm-contacts.json

# 2. Send cold outreach emails
cold-email-bot followup \
  --source pm-contacts.json \
  --type coldOutreach \
  --verify-emails \
  --min-confidence 80 \
  --max-emails 20

# 3. Schedule follow-ups
cold-email-bot followup \
  --campaign "PM Outreach" \
  --type followup \
  --schedule "3d,7d,14d" \
  --max-emails 30
```

### Template A/B Testing

```bash
#!/bin/bash
# A/B test different templates

# Create test templates
cold-email-bot templates add \
  --name "Template A - Professional" \
  --type connection \
  --content "Hi {{name}}, I noticed your work at {{company}}. I'm impressed by your expertise in {{technology}} and would love to connect."

cold-email-bot templates add \
  --name "Template B - Casual" \
  --type connection \
  --content "Hey {{name}}! Saw your work at {{company}} - really cool stuff with {{technology}}! Would love to connect and chat."

# Test both templates
cold-email-bot connect \
  --campaign "Template A Test" \
  --template "Template A - Professional" \
  --max-requests 15

cold-email-bot connect \
  --campaign "Template B Test" \
  --template "Template B - Casual" \
  --max-requests 15

# Compare results
cold-email-bot stats --campaign "Template A Test" --export template-a-results.json
cold-email-bot stats --campaign "Template B Test" --export template-b-results.json
```

## Troubleshooting

### Common Issues

```bash
# Check configuration
cold-email-bot config validate

# Test services
cold-email-bot test --all

# View logs
cold-email-bot system logs

# Check rate limits
cold-email-bot system limits

# Reset rate limits (use with caution)
cold-email-bot system reset-limits

# Clear browser cache
cold-email-bot system clear-cache
```

### Debug Mode

```bash
# Run with debug logging
DEBUG_MODE=true cold-email-bot start --campaign "Debug Test" --keywords "test"

# Verbose output
cold-email-bot start --campaign "Debug Test" --keywords "test" --verbose

# Dry run for testing
cold-email-bot connect --campaign "Debug Test" --max-requests 1 --dry-run --verbose
```

This comprehensive CLI examples guide covers all major use cases and provides practical examples for getting the most out of the Cold Email Bot.
