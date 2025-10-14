# Conversation Service Documentation

The Conversation Service is a comprehensive system for tracking, analyzing, and managing all interactions with contacts in your networking campaigns. It provides AI-powered analysis, automatic follow-up management, and intelligent conversation insights.

## Features

### 🔍 **Interaction Tracking**
- Track all conversations (emails, LinkedIn messages, phone calls, meetings)
- Store conversation history with timestamps and metadata
- Support for attachments and subject lines
- Automatic contact status updates

### 🧠 **AI-Powered Analysis**
- Sentiment analysis of responses
- Intent detection (interested, not interested, meeting request, etc.)
- Positive and negative signal detection
- Conversation summarization with key insights

### 📊 **Response Parsing**
- Pattern-based signal detection
- Confidence scoring for analysis results
- Context extraction from conversations
- Automatic categorization of responses

### 🚩 **Follow-up Management**
- Automatic flagging of contacts needing follow-up
- Priority-based follow-up scheduling
- Suggested actions based on conversation analysis
- Manual follow-up tracking and resolution

### 📈 **Conversation Metrics**
- Response rate calculations
- Engagement scoring
- Average response time tracking
- Positive response rate analysis

### ⏰ **Automatic Scheduling**
- Next action date calculation
- Engagement-based timing adjustments
- Urgency-based prioritization
- Automatic date updates

## Installation & Setup

The Conversation Service is automatically available when you import the main package:

```typescript
import conversationService from './src/services/conversationService.js';
```

### Prerequisites

- Database service initialized
- AI service configured (optional, falls back to pattern matching)
- Contact records in the database

## Basic Usage

### Tracking an Interaction

```typescript
import { ConversationType, ConversationDirection } from './src/types/index.js';

// Track a new interaction
const analysis = await conversationService.trackInteraction(contactId, {
    type: ConversationType.EMAIL,
    direction: ConversationDirection.RECEIVED,
    content: "Hi! I'm interested in learning more about the opportunity. When can we schedule a call?",
    subject: "Re: Job Opportunity",
    attachments: ['resume.pdf']
});

console.log('Intent:', analysis.intent);
console.log('Sentiment:', analysis.sentiment);
console.log('Follow-up needed:', analysis.followUpNeeded);
```

### Analyzing Conversations

```typescript
// Analyze existing conversation content
const analysis = await conversationService.analyzeConversation(contactId, messageContent);

// Get conversation metrics
const metrics = await conversationService.getConversationMetrics(contactId);
console.log('Response Rate:', metrics.responseRate);
console.log('Engagement Score:', metrics.engagementScore);
```

### Managing Follow-ups

```typescript
// Get all follow-up flags
const flags = conversationService.getFollowUpFlags();

// Resolve a follow-up flag
conversationService.resolveFollowUpFlag(contactId, flagIndex);

// Update next action dates
await conversationService.updateNextActionDates();
```

### Generating Summaries

```typescript
// Generate AI-powered conversation summary
const summary = await conversationService.generateConversationSummary(contactId);
console.log('Summary:', summary.summary);
console.log('Key Points:', summary.keyPoints);
console.log('Next Actions:', summary.nextActions);
```

## Advanced Features

### Custom Signal Detection

The service includes built-in patterns for detecting positive and negative signals:

**Positive Signals:**
- Interest expressed: "interested", "definitely interested", "would love to"
- Meeting requests: "schedule a call", "set up a meeting", "coffee"
- Referral offers: "refer", "referral", "know someone"
- Job opportunities: "position", "job", "opening", "hiring"

**Negative Signals:**
- Not interested: "not interested", "not a good fit", "pass"
- Busy: "busy", "swamped", "no time"

### Intent Detection

The service automatically detects conversation intents:

- `INTERESTED`: Contact shows interest in opportunities
- `NOT_INTERESTED`: Contact declines or shows disinterest
- `NEEDS_INFO`: Contact requests more information
- `WANTS_MEETING`: Contact requests a meeting or call
- `REFERRAL_REQUEST`: Contact offers or requests referrals
- `JOB_APPLICATION`: Contact is interested in specific job opportunities
- `NETWORKING`: General networking conversation
- `FOLLOW_UP`: Follow-up conversation
- `UNKNOWN`: Intent cannot be determined

### Action Item Generation

Based on conversation analysis, the service automatically generates action items:

- `SEND_FOLLOW_UP`: Send follow-up message
- `SCHEDULE_MEETING`: Schedule requested meeting
- `SEND_INFO`: Send requested information
- `CONNECT_ON_LINKEDIN`: Connect on LinkedIn
- `SEND_REFERRAL`: Provide referral information
- `UPDATE_STATUS`: Update contact status
- `ADD_NOTE`: Add notes to contact
- `MANUAL_REVIEW`: Flag for manual review

### Urgency Calculation

The service calculates urgency based on signals and intent:

- **High**: Meeting requests, job applications
- **Medium**: Interested responses, positive signals
- **Low**: General networking, neutral responses

## API Reference

### Classes

#### `ConversationService`

Main service class for conversation management.

**Constructor:**
```typescript
constructor(aiService?: AIService)
```

**Methods:**

##### `trackInteraction(contactId, interactionData): Promise<IConversationAnalysis>`

Track a new interaction with a contact.

**Parameters:**
- `contactId: string` - Contact ID
- `interactionData: object` - Interaction details
  - `type: ConversationType` - Type of conversation
  - `direction: ConversationDirection` - Direction (sent/received)
  - `content: string` - Message content
  - `subject?: string` - Message subject
  - `attachments?: string[]` - Attachment paths/URLs

**Returns:** `Promise<IConversationAnalysis>`

##### `analyzeConversation(contactId, content): Promise<IConversationAnalysis>`

Analyze conversation content using AI and pattern matching.

**Parameters:**
- `contactId: string` - Contact ID
- `content: string` - Conversation content to analyze

**Returns:** `Promise<IConversationAnalysis>`

##### `generateConversationSummary(contactId): Promise<IConversationSummary>`

Generate AI-powered conversation summary.

**Parameters:**
- `contactId: string` - Contact ID

**Returns:** `Promise<IConversationSummary>`

##### `getConversationMetrics(contactId): Promise<IConversationMetrics>`

Get conversation metrics for a contact.

**Parameters:**
- `contactId: string` - Contact ID

**Returns:** `Promise<IConversationMetrics>`

##### `getFollowUpFlags(): IFollowUpFlag[]`

Get all unresolved follow-up flags.

**Returns:** `IFollowUpFlag[]`

##### `resolveFollowUpFlag(contactId, flagIndex): void`

Mark a follow-up flag as resolved.

**Parameters:**
- `contactId: string` - Contact ID
- `flagIndex: number` - Index of flag to resolve

##### `updateNextActionDates(): Promise<void>`

Update next action dates based on contact engagement.

### Interfaces

#### `IConversationAnalysis`

Analysis results for a conversation.

```typescript
interface IConversationAnalysis {
    sentiment: 'positive' | 'negative' | 'neutral';
    intent: ConversationIntent;
    positiveSignals: IPositiveSignal[];
    negativeSignals: INegativeSignal[];
    actionItems: IActionItem[];
    followUpNeeded: boolean;
    urgency: 'low' | 'medium' | 'high';
    nextActionDate?: Date;
    summary?: string;
    confidence: number;
}
```

#### `IConversationSummary`

AI-generated conversation summary.

```typescript
interface IConversationSummary {
    contactId: string;
    summary: string;
    keyPoints: string[];
    nextActions: string[];
    sentiment: string;
    lastUpdated: Date;
}
```

#### `IConversationMetrics`

Conversation statistics and metrics.

```typescript
interface IConversationMetrics {
    totalInteractions: number;
    responseRate: number;
    averageResponseTime: number;
    positiveResponseRate: number;
    lastInteractionDate: Date;
    conversationLength: number;
    engagementScore: number;
}
```

#### `IFollowUpFlag`

Follow-up flag information.

```typescript
interface IFollowUpFlag {
    contactId: string;
    reason: FollowUpReason;
    priority: 'low' | 'medium' | 'high';
    suggestedAction: string;
    createdDate: Date;
    dueDate?: Date;
    resolved: boolean;
}
```

## CLI Commands

The conversation service includes several CLI commands:

### Analyze Conversation
```bash
node index.js conversation:analyze <contactId>
```

Analyzes conversation history for a specific contact and displays metrics and summary.

### View Follow-ups
```bash
node index.js conversation:followups
```

Shows all contacts that need follow-up with priority and suggested actions.

### Update Action Dates
```bash
node index.js conversation:update-dates
```

Updates next action dates based on contact engagement patterns.

## Examples

### Complete Workflow Example

```typescript
import conversationService from './src/services/conversationService.js';
import { ConversationType, ConversationDirection } from './src/types/index.js';

async function handleIncomingEmail(contactId: string, emailContent: string) {
    // Track the incoming email
    const analysis = await conversationService.trackInteraction(contactId, {
        type: ConversationType.EMAIL,
        direction: ConversationDirection.RECEIVED,
        content: emailContent,
        subject: 'Re: Job Opportunity'
    });

    console.log(`Intent: ${analysis.intent}`);
    console.log(`Sentiment: ${analysis.sentiment}`);
    console.log(`Follow-up needed: ${analysis.followUpNeeded}`);

    // Check for positive signals
    if (analysis.positiveSignals.length > 0) {
        console.log('Positive signals detected:');
        analysis.positiveSignals.forEach(signal => {
            console.log(`- ${signal.type}: "${signal.text}"`);
        });
    }

    // Process action items
    if (analysis.actionItems.length > 0) {
        console.log('Action items:');
        analysis.actionItems.forEach(item => {
            console.log(`- ${item.type}: ${item.description} (Priority: ${item.priority})`);
        });
    }

    // Generate summary if needed
    if (analysis.followUpNeeded) {
        const summary = await conversationService.generateConversationSummary(contactId);
        console.log('Conversation summary:', summary.summary);
    }

    return analysis;
}
```

### Batch Processing Example

```typescript
async function processMultipleConversations(conversations: Array<{contactId: string, content: string}>) {
    const results = [];
    
    for (const conversation of conversations) {
        try {
            const analysis = await conversationService.analyzeConversation(
                conversation.contactId, 
                conversation.content
            );
            
            results.push({
                contactId: conversation.contactId,
                intent: analysis.intent,
                sentiment: analysis.sentiment,
                followUpNeeded: analysis.followUpNeeded
            });
        } catch (error) {
            console.error(`Error processing conversation for ${conversation.contactId}:`, error);
        }
    }
    
    return results;
}
```

## Configuration

### AI Service Integration

The conversation service can be configured to use an AI service for enhanced analysis:

```typescript
import { AIService } from './src/services/aiService.js';

const aiService = new AIService(process.env.OPENAI_API_KEY);
const conversationService = new ConversationService(aiService);
```

### Pattern Customization

You can extend the signal detection patterns by modifying the service:

```typescript
// Add custom positive patterns
conversationService['positivePatterns'].custom = [
    /your custom pattern/i,
    /another pattern/i
];

// Add custom negative patterns
conversationService['negativePatterns'].custom = [
    /rejection pattern/i,
    /negative response/i
];
```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
    const analysis = await conversationService.trackInteraction(contactId, interactionData);
    // Process analysis results
} catch (error) {
    if (error.message.includes('Contact with ID')) {
        console.error('Contact not found:', contactId);
    } else {
        console.error('Analysis failed:', error.message);
    }
}
```

## Performance Considerations

- **Caching**: Analysis results are not cached by default. Consider implementing caching for high-volume scenarios.
- **Batch Processing**: For multiple conversations, use batch processing to improve performance.
- **AI Service Limits**: Be aware of AI service rate limits and implement appropriate delays.

## Troubleshooting

### Common Issues

1. **Contact Not Found**: Ensure the contact exists in the database before tracking interactions.
2. **AI Service Errors**: The service falls back to pattern matching if AI analysis fails.
3. **Missing Dependencies**: Ensure all required services (database, AI) are properly initialized.

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
import { logger } from './src/utils/logger.js';

// Enable debug logging
logger.level = 'debug';
```

## Contributing

When extending the conversation service:

1. Add new signal patterns to the appropriate pattern objects
2. Extend the intent detection logic for new conversation types
3. Add new action types for different follow-up scenarios
4. Update the CLI commands for new functionality
5. Add comprehensive tests for new features

## License

This service is part of the Cold Email Bot project and follows the same licensing terms.
