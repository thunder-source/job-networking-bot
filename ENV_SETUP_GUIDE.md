# Environment Setup Guide

## Quick Setup

To get your Cold Email Bot running, you need to create a `.env` file in the root directory with your configuration.

### Step 1: Create .env File

Copy the following content into a new file named `.env` in your project root:

```env
# Cold Email Bot Configuration

# ============================================
# REQUIRED SETTINGS
# ============================================

# LinkedIn Credentials
LINKEDIN_EMAIL=your_linkedin_email@example.com
LINKEDIN_PASSWORD=your_linkedin_password

# OpenAI API Key (for AI-powered message personalization)
OPENAI_API_KEY=sk-your-openai-api-key-here

# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/cold-email-bot

# ============================================
# OPTIONAL SETTINGS (for personalization)
# ============================================

# Your Information (used for personalizing messages)
USER_NAME=Your Name
TARGET_ROLE=Front-End Developer
USER_SKILLS=React, TypeScript, JavaScript, CSS, HTML
USER_EXPERIENCE=5+ years

# ============================================
# EMAIL CONFIGURATION (optional, for sending emails)
# ============================================

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
FROM_EMAIL=your_email@gmail.com

# ============================================
# SAFETY SETTINGS (recommended defaults)
# ============================================

# Daily Limits
MAX_DAILY_CONNECTIONS=20
MAX_DAILY_MESSAGES=50
MAX_DAILY_PROFILE_VIEWS=100

# Delays (in milliseconds)
MIN_DELAY_BETWEEN_ACTIONS=5000
MAX_DELAY_BETWEEN_ACTIONS=15000
```

### Step 2: Fill in Your Information

1. **LinkedIn Credentials**: Your LinkedIn email and password
2. **OpenAI API Key**: Get one from https://platform.openai.com/api-keys
3. **MongoDB URI**: If you have MongoDB running locally, keep the default. Otherwise, use your MongoDB connection string.
4. **Your Information**: Fill in your name, target role, skills, and experience for message personalization
5. **Email Configuration** (optional): Only needed if you want to send follow-up emails

### Step 3: Validate Your Configuration

After creating the `.env` file, you can validate it by running:

```bash
npm run start config list
```

This will show you which settings are configured and which are missing.

### Step 4: Next Steps

Once your `.env` file is set up, you can:

1. **Test your configuration**: `npm run start test --all`
2. **Search for contacts**: `npm run start search --keywords "HR Manager" --max-results 20`
3. **Start connecting**: `npm run start connect --max-requests 5 --dry-run`

## Troubleshooting

If you encounter any issues:

- Make sure the `.env` file is in the root directory of the project
- Check that there are no spaces around the `=` signs
- Make sure your API keys are valid
- For Gmail SMTP, you'll need to use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password

## Note

The configuration command (`npm run start config set --interactive`) is currently being fixed. For now, please manually create and edit the `.env` file as described above.

