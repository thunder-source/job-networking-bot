# Email Lookup Service

The Email Lookup Service provides comprehensive functionality for finding and verifying email addresses using multiple APIs and fallback patterns. This service integrates with Hunter.io and RocketReach APIs, includes email verification, database caching, and intelligent fallback patterns.

## Features

- **Multi-API Integration**: Supports Hunter.io and RocketReach APIs
- **Email Verification**: Validates email addresses before sending
- **Database Caching**: Saves found emails to reduce API calls
- **Fallback Patterns**: Generates common email formats when APIs fail
- **Confidence Scoring**: Provides confidence levels for found emails
- **Rate Limiting**: Built-in rate limiting for API calls

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Email Lookup API Keys
HUNTER_API_KEY=your_hunter_io_api_key
ROCKETREACH_API_KEY=your_rocketreach_api_key

# Email Service Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 2. API Keys

#### Hunter.io
1. Sign up at [Hunter.io](https://hunter.io)
2. Get your API key from the dashboard
3. Free tier includes 50 searches per month

#### RocketReach
1. Sign up at [RocketReach](https://rocketreach.co)
2. Get your API key from the dashboard
3. Free tier includes limited searches

## Usage

### Basic Email Lookup

```typescript
import EmailLookupService from './src/services/emailLookupService.js';

const emailLookupService = new EmailLookupService({
    hunterApiKey: process.env.HUNTER_API_KEY,
    rocketReachApiKey: process.env.ROCKETREACH_API_KEY
});

// Find email address
const result = await emailLookupService.findEmail(
    'John',
    'Doe',
    'google.com',
    {
        preferHunter: true,
        verifyEmail: true,
        enableFallback: true
    }
);

console.log(result);
// {
//     email: 'john.doe@google.com',
//     confidence: 85,
//     source: 'hunter',
//     method: 'api',
//     verified: true,
//     metadata: { ... }
// }
```

### Email Verification

```typescript
// Verify email address
const isValid = await emailLookupService.verifyEmail('test@gmail.com');
console.log(isValid); // true or false
```

### Integrated Email Service

```typescript
import { EmailService } from './src/services/emailService.js';

const emailService = new EmailService({
    provider: 'gmail',
    credentials: {
        email: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASS
    },
    emailLookup: {
        hunterApiKey: process.env.HUNTER_API_KEY,
        rocketReachApiKey: process.env.ROCKETREACH_API_KEY
    }
});

// Send email with automatic lookup
const result = await emailService.sendEmailWithLookup({
    to: 'placeholder@example.com',
    templateType: 'coldOutreach',
    variables: {
        name: 'John Doe',
        company: 'Google',
        position: 'Software Engineer',
        // ... other variables
    },
    enableLookup: true,
    lookupData: {
        firstName: 'John',
        lastName: 'Doe',
        company: 'google.com'
    },
    minConfidence: 70,
    verifyBeforeSend: true
});
```

## API Reference

### EmailLookupService

#### Constructor

```typescript
new EmailLookupService(config: IEmailLookupConfig)
```

**Parameters:**
- `config.hunterApiKey` (optional): Hunter.io API key
- `config.rocketReachApiKey` (optional): RocketReach API key

#### Methods

##### findEmail()

```typescript
findEmail(
    firstName: string,
    lastName: string,
    company: string,
    options?: IEmailLookupOptions
): Promise<IEmailLookupResult>
```

**Parameters:**
- `firstName`: Person's first name
- `lastName`: Person's last name
- `company`: Company name or domain
- `options` (optional):
  - `preferHunter`: Prefer Hunter.io over RocketReach (default: true)
  - `enableFallback`: Enable fallback pattern generation (default: true)
  - `verifyEmail`: Verify found emails (default: true)
  - `timeout`: Request timeout in milliseconds

**Returns:** `IEmailLookupResult` with email, confidence, source, and metadata

##### verifyEmail()

```typescript
verifyEmail(email: string): Promise<boolean>
```

**Parameters:**
- `email`: Email address to verify

**Returns:** `boolean` indicating if email is valid and deliverable

### EmailService Integration

#### sendEmailWithLookup()

```typescript
sendEmailWithLookup(emailData: IEmailDataWithLookup): Promise<IEmailResult>
```

**Parameters:**
- `emailData`: Email data with lookup options:
  - `enableLookup`: Enable email lookup
  - `lookupData`: Lookup information (firstName, lastName, company)
  - `lookupOptions`: Lookup configuration
  - `minConfidence`: Minimum confidence threshold (default: 50)
  - `verifyBeforeSend`: Verify email before sending (default: true)

## Database Integration

The service automatically caches found emails in the database to reduce API calls. Email lookup data is stored in the `emailLookup` field of contacts:

```typescript
{
    foundEmail: 'john.doe@google.com',
    confidence: 85,
    source: 'hunter',
    method: 'api',
    verified: true,
    lastVerified: Date,
    verificationMethod: 'api',
    lookupMetadata: { ... }
}
```

### Database Methods

```typescript
// Find contacts by email lookup source
const hunterContacts = await Contact.findByEmailLookupSource('hunter');

// Find contacts with unverified emails
const unverifiedContacts = await Contact.findUnverifiedEmails();

// Update email lookup data
await contact.updateEmailLookup({
    foundEmail: 'new.email@company.com',
    confidence: 90,
    verified: true
});
```

## Fallback Patterns

When APIs fail to find an email, the service generates common email patterns:

1. `firstName.lastName@domain.com`
2. `firstNameLastName@domain.com`
3. `f.lastName@domain.com`
4. `firstName.l@domain.com`
5. `firstName@domain.com`
6. `lastName@domain.com`
7. Lowercase variations of the above

The service attempts to verify each pattern and returns the first valid one.

## Confidence Levels

- **90-100%**: High confidence (API verified)
- **70-89%**: Good confidence (API found, basic verification)
- **50-69%**: Medium confidence (Fallback pattern, verified)
- **30-49%**: Low confidence (Fallback pattern, unverified)
- **0-29%**: Very low confidence (Generated pattern, not verified)

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
    const result = await emailLookupService.findEmail('John', 'Doe', 'company.com');
    if (result.email) {
        console.log('Email found:', result.email);
    } else {
        console.log('No email found');
    }
} catch (error) {
    console.error('Lookup failed:', error.message);
}
```

## Rate Limiting

Both Hunter.io and RocketReach have rate limits:
- **Hunter.io**: 50 searches/month (free), 1,000/month (paid)
- **RocketReach**: Limited searches (free), unlimited (paid)

The service includes built-in rate limiting and will gracefully handle rate limit errors.

## Best Practices

1. **Cache Results**: Always cache found emails to reduce API calls
2. **Verify Emails**: Always verify emails before sending
3. **Use Fallbacks**: Enable fallback patterns for better coverage
4. **Monitor Confidence**: Only use emails with confidence > 70%
5. **Handle Errors**: Implement proper error handling for API failures

## Example Usage

See `examples/email-lookup-example.ts` for a complete demonstration of all features.

```bash
npm run email-lookup:example
```

## Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure API keys are valid and have sufficient credits
2. **Rate Limit Errors**: Implement proper rate limiting and caching
3. **DNS Validation Failures**: Some domains may have DNS issues
4. **Low Confidence Results**: Use higher confidence thresholds or manual verification

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
import { logger } from './src/utils/logger.js';

// Set log level to debug
logger.level = 'debug';
```

## License

This email lookup service is part of the Cold Email Bot project and follows the same MIT license.
