import { logger } from '../utils/logger.js';
import databaseService from './databaseService.js';
import { AIService } from './aiService.js';
import type {
    IContact,
    IConversationHistory
} from '../types/index.js';
import {
    ContactStatus,
    ConversationType,
    ConversationDirection
} from '../types/index.js';
import type { IContactDocument } from '../models/Contact.js';
import type { ObjectId } from 'mongoose';

// Extended interfaces for conversation analysis
export interface IConversationAnalysis {
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

export interface IConversationSummary {
    contactId: string;
    summary: string;
    keyPoints: string[];
    nextActions: string[];
    sentiment: string;
    lastUpdated: Date;
}

export interface IPositiveSignal {
    type: PositiveSignalType;
    text: string;
    confidence: number;
    context?: string;
}

export interface INegativeSignal {
    type: NegativeSignalType;
    text: string;
    confidence: number;
    context?: string;
}

export interface IActionItem {
    type: ActionType;
    description: string;
    priority: 'low' | 'medium' | 'high';
    dueDate?: Date;
    completed: boolean;
}

export interface IConversationMetrics {
    totalInteractions: number;
    responseRate: number;
    averageResponseTime: number;
    positiveResponseRate: number;
    lastInteractionDate: Date;
    conversationLength: number;
    engagementScore: number;
}

export interface IFollowUpFlag {
    contactId: string;
    reason: FollowUpReason;
    priority: 'low' | 'medium' | 'high';
    suggestedAction: string;
    createdDate: Date;
    dueDate?: Date;
    resolved: boolean;
}

// Enums for conversation analysis
export enum ConversationIntent {
    INTERESTED = 'interested',
    NOT_INTERESTED = 'not_interested',
    NEEDS_INFO = 'needs_info',
    WANTS_MEETING = 'wants_meeting',
    REFERRAL_REQUEST = 'referral_request',
    JOB_APPLICATION = 'job_application',
    NETWORKING = 'networking',
    FOLLOW_UP = 'follow_up',
    UNKNOWN = 'unknown'
}

export enum PositiveSignalType {
    INTEREST_EXPRESSED = 'interest_expressed',
    MEETING_REQUEST = 'meeting_request',
    REFERRAL_OFFER = 'referral_offer',
    JOB_OPPORTUNITY = 'job_opportunity',
    POSITIVE_RESPONSE = 'positive_response',
    ENGAGEMENT = 'engagement',
    THANK_YOU = 'thank_you',
    CONNECTION_ACCEPTED = 'connection_accepted'
}

export enum NegativeSignalType {
    NOT_INTERESTED = 'not_interested',
    BUSY = 'busy',
    NO_RESPONSE = 'no_response',
    REJECTION = 'rejection',
    UNSUBSCRIBE = 'unsubscribe',
    SPAM_REPORT = 'spam_report'
}

export enum ActionType {
    SEND_FOLLOW_UP = 'send_follow_up',
    SCHEDULE_MEETING = 'schedule_meeting',
    SEND_INFO = 'send_info',
    CONNECT_ON_LINKEDIN = 'connect_on_linkedin',
    SEND_REFERRAL = 'send_referral',
    UPDATE_STATUS = 'update_status',
    ADD_NOTE = 'add_note',
    MANUAL_REVIEW = 'manual_review'
}

export enum FollowUpReason {
    NO_RESPONSE = 'no_response',
    POSITIVE_SIGNAL = 'positive_signal',
    NEGATIVE_SIGNAL = 'negative_signal',
    INCOMPLETE_CONVERSATION = 'incomplete_conversation',
    MEETING_REQUEST = 'meeting_request',
    INFO_NEEDED = 'info_needed',
    REFERRAL_REQUEST = 'referral_request',
    STATUS_UPDATE = 'status_update'
}

/**
 * Conversation Service - Tracks and analyzes all interactions with contacts
 * Provides AI-powered conversation analysis, positive signal detection, and automated follow-up management
 */
export class ConversationService {
    private aiService: AIService;
    private followUpFlags: Map<string, IFollowUpFlag[]> = new Map();

    // Positive signal patterns for detection
    private positivePatterns = {
        interest: [
            /interested/i,
            /definitely interested/i,
            /would love to/i,
            /sounds great/i,
            /I'm interested/i,
            /tell me more/i,
            /more information/i,
            /happy to/i,
            /would be great/i,
            /excited about/i
        ],
        meeting: [
            /schedule a call/i,
            /set up a meeting/i,
            /coffee/i,
            /lunch/i,
            /call/i,
            /meeting/i,
            /chat/i,
            /discuss/i,
            /when are you available/i,
            /what time works/i
        ],
        referral: [
            /refer/i,
            /referral/i,
            /know someone/i,
            /connect you with/i,
            /introduce you/i,
            /network/i,
            /contact/i
        ],
        job: [
            /position/i,
            /job/i,
            /opening/i,
            /hiring/i,
            /apply/i,
            /resume/i,
            /interview/i,
            /opportunity/i
        ]
    };

    // Negative signal patterns
    private negativePatterns = {
        notInterested: [
            /not interested/i,
            /not a good fit/i,
            /not right/i,
            /pass/i,
            /decline/i,
            /not looking/i,
            /no thanks/i,
            /unsubscribe/i
        ],
        busy: [
            /busy/i,
            /swamped/i,
            /overwhelmed/i,
            /no time/i,
            /later/i,
            /some other time/i,
            /not now/i
        ]
    };

    constructor(aiService?: AIService) {
        this.aiService = aiService || new AIService();
    }

    /**
     * Track a new interaction with a contact
     */
    async trackInteraction(
        contactId: string,
        interactionData: {
            type: ConversationType;
            direction: ConversationDirection;
            content: string;
            subject?: string;
            attachments?: string[];
        }
    ): Promise<IConversationAnalysis> {
        try {
            logger.info(`Tracking interaction for contact ${contactId}`);

            // Add conversation to contact history
            const contact = await databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact with ID ${contactId} not found`);
            }

            const conversationEntry: Partial<IConversationHistory> = {
                date: new Date(),
                type: interactionData.type,
                direction: interactionData.direction,
                content: interactionData.content,
                subject: interactionData.subject,
                attachments: interactionData.attachments
            };

            await contact.addConversation(conversationEntry);

            // Analyze the conversation
            const analysis = await this.analyzeConversation(contactId, interactionData.content);

            // Update contact status based on analysis
            await this.updateContactStatus(contactId, analysis);

            // Check for follow-up needs
            await this.checkFollowUpNeeds(contactId, analysis);

            // Generate conversation summary if needed
            if (this.shouldGenerateSummary(contact)) {
                await this.generateConversationSummary(contactId);
            }

            logger.info(`Interaction tracked and analyzed for contact ${contactId}`);
            return analysis;

        } catch (error) {
            logger.error('Error tracking interaction:', error);
            throw error;
        }
    }

    /**
     * Analyze conversation content using AI and pattern matching
     */
    async analyzeConversation(contactId: string, content: string): Promise<IConversationAnalysis> {
        try {
            // Get contact for context
            const contact = await databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact with ID ${contactId} not found`);
            }

            // Pattern-based analysis
            const positiveSignals = this.detectPositiveSignals(content);
            const negativeSignals = this.detectNegativeSignals(content);
            const intent = this.detectIntent(content, positiveSignals, negativeSignals);

            // AI-powered sentiment analysis
            const sentiment = await this.analyzeSentiment(content, contact);

            // Determine follow-up needs
            const followUpNeeded = this.determineFollowUpNeeded(intent, positiveSignals, negativeSignals);

            // Calculate urgency
            const urgency = this.calculateUrgency(intent, positiveSignals, negativeSignals);

            // Generate action items
            const actionItems = this.generateActionItems(intent, positiveSignals, negativeSignals);

            // Calculate next action date
            const nextActionDate = this.calculateNextActionDate(intent, urgency, contact);

            const analysis: IConversationAnalysis = {
                sentiment,
                intent,
                positiveSignals,
                negativeSignals,
                actionItems,
                followUpNeeded,
                urgency,
                nextActionDate,
                confidence: this.calculateConfidence(positiveSignals, negativeSignals)
            };

            return analysis;

        } catch (error) {
            logger.error('Error analyzing conversation:', error);
            throw error;
        }
    }

    /**
     * Detect positive signals in conversation content
     */
    private detectPositiveSignals(content: string): IPositiveSignal[] {
        const signals: IPositiveSignal[] = [];

        // Check for interest signals
        this.positivePatterns.interest.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: PositiveSignalType.INTEREST_EXPRESSED,
                    text: matches[0],
                    confidence: 0.8,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        // Check for meeting requests
        this.positivePatterns.meeting.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: PositiveSignalType.MEETING_REQUEST,
                    text: matches[0],
                    confidence: 0.9,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        // Check for referral offers
        this.positivePatterns.referral.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: PositiveSignalType.REFERRAL_OFFER,
                    text: matches[0],
                    confidence: 0.7,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        // Check for job opportunities
        this.positivePatterns.job.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: PositiveSignalType.JOB_OPPORTUNITY,
                    text: matches[0],
                    confidence: 0.8,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        return signals;
    }

    /**
     * Detect negative signals in conversation content
     */
    private detectNegativeSignals(content: string): INegativeSignal[] {
        const signals: INegativeSignal[] = [];

        // Check for not interested signals
        this.negativePatterns.notInterested.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: NegativeSignalType.NOT_INTERESTED,
                    text: matches[0],
                    confidence: 0.9,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        // Check for busy signals
        this.negativePatterns.busy.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                signals.push({
                    type: NegativeSignalType.BUSY,
                    text: matches[0],
                    confidence: 0.7,
                    context: this.extractContext(content, matches[0])
                });
            }
        });

        return signals;
    }

    /**
     * Detect conversation intent based on signals
     */
    private detectIntent(
        content: string,
        positiveSignals: IPositiveSignal[],
        negativeSignals: INegativeSignal[]
    ): ConversationIntent {
        // High confidence decisions based on signals
        if (positiveSignals.some(s => s.type === PositiveSignalType.MEETING_REQUEST)) {
            return ConversationIntent.WANTS_MEETING;
        }

        if (positiveSignals.some(s => s.type === PositiveSignalType.REFERRAL_OFFER)) {
            return ConversationIntent.REFERRAL_REQUEST;
        }

        if (positiveSignals.some(s => s.type === PositiveSignalType.JOB_OPPORTUNITY)) {
            return ConversationIntent.JOB_APPLICATION;
        }

        if (negativeSignals.some(s => s.type === NegativeSignalType.NOT_INTERESTED)) {
            return ConversationIntent.NOT_INTERESTED;
        }

        if (positiveSignals.some(s => s.type === PositiveSignalType.INTEREST_EXPRESSED)) {
            return ConversationIntent.INTERESTED;
        }

        if (negativeSignals.some(s => s.type === NegativeSignalType.BUSY)) {
            return ConversationIntent.FOLLOW_UP;
        }

        // Check for information requests
        if (/more information|tell me more|details|info/i.test(content)) {
            return ConversationIntent.NEEDS_INFO;
        }

        return ConversationIntent.UNKNOWN;
    }

    /**
     * Analyze sentiment using AI service
     */
    private async analyzeSentiment(content: string, contact: IContactDocument): Promise<'positive' | 'negative' | 'neutral'> {
        try {
            // Use AI service for sentiment analysis
            const prompt = `Analyze the sentiment of this message from a professional networking context:

Message: "${content}"

Contact: ${contact.name} at ${contact.company || 'Unknown Company'}

Classify the sentiment as:
- positive: Shows interest, enthusiasm, willingness to engage
- negative: Shows disinterest, rejection, or negative response
- neutral: Factual information, questions, or neutral response

Respond with only: positive, negative, or neutral`;

            const response = await this.callAIService(prompt);
            const sentiment = response.trim().toLowerCase();

            if (['positive', 'negative', 'neutral'].includes(sentiment)) {
                return sentiment as 'positive' | 'negative' | 'neutral';
            }

            return 'neutral';
        } catch (error) {
            logger.warn('AI sentiment analysis failed, using fallback:', error);
            return 'neutral';
        }
    }

    /**
     * Determine if follow-up is needed
     */
    private determineFollowUpNeeded(
        intent: ConversationIntent,
        positiveSignals: IPositiveSignal[],
        negativeSignals: INegativeSignal[]
    ): boolean {
        // Always follow up for positive signals
        if (positiveSignals.length > 0) {
            return true;
        }

        // Follow up for certain intents
        if ([
            ConversationIntent.INTERESTED,
            ConversationIntent.WANTS_MEETING,
            ConversationIntent.NEEDS_INFO,
            ConversationIntent.REFERRAL_REQUEST,
            ConversationIntent.JOB_APPLICATION
        ].includes(intent)) {
            return true;
        }

        // Don't follow up for negative signals
        if (negativeSignals.some(s => s.type === NegativeSignalType.NOT_INTERESTED)) {
            return false;
        }

        return false;
    }

    /**
     * Calculate urgency based on signals and intent
     */
    private calculateUrgency(
        intent: ConversationIntent,
        positiveSignals: IPositiveSignal[],
        negativeSignals: INegativeSignal[]
    ): 'low' | 'medium' | 'high' {
        // High urgency for meeting requests and job opportunities
        if ([
            ConversationIntent.WANTS_MEETING,
            ConversationIntent.JOB_APPLICATION
        ].includes(intent)) {
            return 'high';
        }

        // Medium urgency for interested responses
        if (intent === ConversationIntent.INTERESTED || positiveSignals.length > 0) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Generate action items based on analysis
     */
    private generateActionItems(
        intent: ConversationIntent,
        positiveSignals: IPositiveSignal[],
        negativeSignals: INegativeSignal[]
    ): IActionItem[] {
        const actionItems: IActionItem[] = [];

        switch (intent) {
            case ConversationIntent.WANTS_MEETING:
                actionItems.push({
                    type: ActionType.SCHEDULE_MEETING,
                    description: 'Schedule a meeting or call with the contact',
                    priority: 'high',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    completed: false
                });
                break;

            case ConversationIntent.JOB_APPLICATION:
                actionItems.push({
                    type: ActionType.SEND_INFO,
                    description: 'Send job application information and resume',
                    priority: 'high',
                    dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
                    completed: false
                });
                break;

            case ConversationIntent.REFERRAL_REQUEST:
                actionItems.push({
                    type: ActionType.SEND_REFERRAL,
                    description: 'Provide referral information or make introduction',
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
                    completed: false
                });
                break;

            case ConversationIntent.INTERESTED:
                actionItems.push({
                    type: ActionType.SEND_FOLLOW_UP,
                    description: 'Send follow-up message with more information',
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
                    completed: false
                });
                break;

            case ConversationIntent.NEEDS_INFO:
                actionItems.push({
                    type: ActionType.SEND_INFO,
                    description: 'Send requested information',
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
                    completed: false
                });
                break;

            case ConversationIntent.NOT_INTERESTED:
                actionItems.push({
                    type: ActionType.UPDATE_STATUS,
                    description: 'Update contact status to not interested',
                    priority: 'low',
                    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
                    completed: false
                });
                break;
        }

        // Add manual review for complex cases
        if (positiveSignals.length > 2 || negativeSignals.length > 0) {
            actionItems.push({
                type: ActionType.MANUAL_REVIEW,
                description: 'Review conversation for manual follow-up',
                priority: 'medium',
                dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                completed: false
            });
        }

        return actionItems;
    }

    /**
     * Calculate next action date based on urgency and contact history
     */
    private calculateNextActionDate(
        intent: ConversationIntent,
        urgency: 'low' | 'medium' | 'high',
        contact: IContactDocument
    ): Date {
        const now = new Date();

        // Base delays by urgency
        const baseDelays = {
            high: 12 * 60 * 60 * 1000, // 12 hours
            medium: 2 * 24 * 60 * 60 * 1000, // 2 days
            low: 7 * 24 * 60 * 60 * 1000 // 1 week
        };

        let delay = baseDelays[urgency];

        // Adjust based on contact's response rate
        if (contact.responseRate > 50) {
            delay *= 0.8; // Faster follow-up for responsive contacts
        } else if (contact.responseRate < 20) {
            delay *= 1.5; // Slower follow-up for unresponsive contacts
        }

        // Adjust for specific intents
        switch (intent) {
            case ConversationIntent.WANTS_MEETING:
                delay = Math.min(delay, 24 * 60 * 60 * 1000); // Max 24 hours
                break;
            case ConversationIntent.JOB_APPLICATION:
                delay = Math.min(delay, 12 * 60 * 60 * 1000); // Max 12 hours
                break;
        }

        return new Date(now.getTime() + delay);
    }

    /**
     * Calculate confidence score for the analysis
     */
    private calculateConfidence(
        positiveSignals: IPositiveSignal[],
        negativeSignals: INegativeSignal[]
    ): number {
        const totalSignals = positiveSignals.length + negativeSignals.length;
        if (totalSignals === 0) return 0.5;

        const avgPositiveConfidence = positiveSignals.length > 0
            ? positiveSignals.reduce((sum, s) => sum + s.confidence, 0) / positiveSignals.length
            : 0;

        const avgNegativeConfidence = negativeSignals.length > 0
            ? negativeSignals.reduce((sum, s) => sum + s.confidence, 0) / negativeSignals.length
            : 0;

        return Math.max(avgPositiveConfidence, avgNegativeConfidence);
    }

    /**
     * Update contact status based on conversation analysis
     */
    async updateContactStatus(contactId: string, analysis: IConversationAnalysis): Promise<void> {
        try {
            const contact = await databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact with ID ${contactId} not found`);
            }

            let newStatus: ContactStatus | null = null;

            switch (analysis.intent) {
                case ConversationIntent.INTERESTED:
                case ConversationIntent.WANTS_MEETING:
                case ConversationIntent.JOB_APPLICATION:
                    newStatus = ContactStatus.RESPONDED;
                    break;

                case ConversationIntent.NOT_INTERESTED:
                    newStatus = ContactStatus.NOT_INTERESTED;
                    break;

                case ConversationIntent.NETWORKING:
                    newStatus = ContactStatus.CONNECTED;
                    break;
            }

            if (newStatus && newStatus !== contact.status) {
                await contact.updateStatus(newStatus);
                logger.info(`Updated contact ${contactId} status to ${newStatus}`);
            }

            // Update response rate
            const totalInteractions = contact.conversationHistory.length;
            const responses = contact.conversationHistory.filter(c =>
                c.direction === ConversationDirection.RECEIVED
            ).length;

            const responseRate = totalInteractions > 0 ? (responses / totalInteractions) * 100 : 0;

            if (Math.abs(responseRate - contact.responseRate) > 5) { // Only update if significant change
                await databaseService.updateContact(contactId, {
                    responseRate,
                    lastResponseDate: new Date()
                });
            }

        } catch (error) {
            logger.error('Error updating contact status:', error);
            throw error;
        }
    }

    /**
     * Check if follow-up is needed and create flags
     */
    async checkFollowUpNeeds(contactId: string, analysis: IConversationAnalysis): Promise<void> {
        try {
            if (!analysis.followUpNeeded) return;

            const contact = await databaseService.getContactById(contactId);
            if (!contact) return;

            // Determine follow-up reason
            let reason: FollowUpReason;
            let suggestedAction: string;

            if (analysis.positiveSignals.length > 0) {
                reason = FollowUpReason.POSITIVE_SIGNAL;
                suggestedAction = 'Follow up on positive response';
            } else if (analysis.intent === ConversationIntent.WANTS_MEETING) {
                reason = FollowUpReason.MEETING_REQUEST;
                suggestedAction = 'Schedule requested meeting';
            } else if (analysis.intent === ConversationIntent.NEEDS_INFO) {
                reason = FollowUpReason.INFO_NEEDED;
                suggestedAction = 'Send requested information';
            } else {
                reason = FollowUpReason.INCOMPLETE_CONVERSATION;
                suggestedAction = 'Continue conversation';
            }

            // Create follow-up flag
            const flag: IFollowUpFlag = {
                contactId,
                reason,
                priority: analysis.urgency,
                suggestedAction,
                createdDate: new Date(),
                dueDate: analysis.nextActionDate,
                resolved: false
            };

            // Store flag (in a real implementation, this would be stored in database)
            if (!this.followUpFlags.has(contactId)) {
                this.followUpFlags.set(contactId, []);
            }
            this.followUpFlags.get(contactId)!.push(flag);

            logger.info(`Created follow-up flag for contact ${contactId}: ${suggestedAction}`);

        } catch (error) {
            logger.error('Error checking follow-up needs:', error);
            throw error;
        }
    }

    /**
     * Generate AI-powered conversation summary
     */
    async generateConversationSummary(contactId: string): Promise<IConversationSummary> {
        try {
            const contact = await databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact with ID ${contactId} not found`);
            }

            const conversations = contact.conversationHistory.slice(-5); // Last 5 conversations
            const conversationText = conversations.map(c =>
                `${c.direction}: ${c.content}`
            ).join('\n\n');

            const prompt = `Analyze this conversation history and create a comprehensive summary:

Contact: ${contact.name} at ${contact.company || 'Unknown Company'}

Conversation History:
${conversationText}

Please provide:
1. A 2-3 sentence summary of the conversation
2. 3-5 key points from the interaction
3. Suggested next actions
4. Overall sentiment assessment

Format your response as JSON:
{
  "summary": "Brief summary here",
  "keyPoints": ["point1", "point2", "point3"],
  "nextActions": ["action1", "action2", "action3"],
  "sentiment": "positive/negative/neutral"
}`;

            const response = await this.callAIService(prompt);

            try {
                const parsed = JSON.parse(response);
                const summary: IConversationSummary = {
                    contactId,
                    summary: parsed.summary || 'No summary available',
                    keyPoints: parsed.keyPoints || [],
                    nextActions: parsed.nextActions || [],
                    sentiment: parsed.sentiment || 'neutral',
                    lastUpdated: new Date()
                };

                logger.info(`Generated conversation summary for contact ${contactId}`);
                return summary;

            } catch (parseError) {
                logger.warn('Failed to parse AI response, using fallback summary');
                return this.createFallbackSummary(contactId, contact);
            }

        } catch (error) {
            logger.error('Error generating conversation summary:', error);
            throw error;
        }
    }

    /**
     * Get all contacts that need follow-up
     */
    getFollowUpFlags(): IFollowUpFlag[] {
        const allFlags: IFollowUpFlag[] = [];
        for (const flags of this.followUpFlags.values()) {
            allFlags.push(...flags.filter(f => !f.resolved));
        }
        return allFlags.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    /**
     * Mark a follow-up flag as resolved
     */
    resolveFollowUpFlag(contactId: string, flagIndex: number): void {
        const flags = this.followUpFlags.get(contactId);
        if (flags && flags[flagIndex]) {
            flags[flagIndex].resolved = true;
            logger.info(`Resolved follow-up flag for contact ${contactId}`);
        }
    }

    /**
     * Get conversation metrics for a contact
     */
    async getConversationMetrics(contactId: string): Promise<IConversationMetrics> {
        try {
            const contact = await databaseService.getContactById(contactId);
            if (!contact) {
                throw new Error(`Contact with ID ${contactId} not found`);
            }

            const conversations = contact.conversationHistory;
            const totalInteractions = conversations.length;

            const responses = conversations.filter(c =>
                c.direction === ConversationDirection.RECEIVED
            );

            const responseRate = totalInteractions > 0 ? (responses.length / totalInteractions) * 100 : 0;

            // Calculate average response time
            let totalResponseTime = 0;
            let responseCount = 0;

            for (let i = 1; i < conversations.length; i++) {
                const current = conversations[i];
                const previous = conversations[i - 1];

                if (current.direction === ConversationDirection.RECEIVED &&
                    previous.direction === ConversationDirection.SENT) {
                    const responseTime = current.date.getTime() - previous.date.getTime();
                    totalResponseTime += responseTime;
                    responseCount++;
                }
            }

            const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

            // Calculate positive response rate (simplified)
            const positiveResponses = responses.filter(r =>
                this.detectPositiveSignals(r.content).length > 0
            ).length;

            const positiveResponseRate = responses.length > 0 ?
                (positiveResponses / responses.length) * 100 : 0;

            // Calculate engagement score
            const engagementScore = Math.min(100,
                (responseRate * 0.4) +
                (positiveResponseRate * 0.4) +
                (Math.min(100, totalInteractions * 10) * 0.2)
            );

            return {
                totalInteractions,
                responseRate,
                averageResponseTime,
                positiveResponseRate,
                lastInteractionDate: conversations[conversations.length - 1]?.date || new Date(),
                conversationLength: conversations.reduce((sum, c) => sum + c.content.length, 0),
                engagementScore
            };

        } catch (error) {
            logger.error('Error getting conversation metrics:', error);
            throw error;
        }
    }

    /**
     * Update next action dates automatically based on contact behavior
     */
    async updateNextActionDates(): Promise<void> {
        try {
            const flags = this.getFollowUpFlags();
            const now = new Date();

            for (const flag of flags) {
                if (flag.dueDate && flag.dueDate < now) {
                    const contact = await databaseService.getContactById(flag.contactId);
                    if (!contact) continue;

                    const metrics = await this.getConversationMetrics(flag.contactId);

                    // Adjust due date based on engagement
                    let newDueDate: Date;

                    if (metrics.engagementScore > 70) {
                        // High engagement - follow up sooner
                        newDueDate = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours
                    } else if (metrics.engagementScore > 40) {
                        // Medium engagement - normal follow up
                        newDueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
                    } else {
                        // Low engagement - longer delay
                        newDueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
                    }

                    flag.dueDate = newDueDate;
                    logger.info(`Updated next action date for contact ${flag.contactId} to ${newDueDate}`);
                }
            }

        } catch (error) {
            logger.error('Error updating next action dates:', error);
            throw error;
        }
    }

    // Helper methods

    private extractContext(content: string, match: string): string {
        const index = content.indexOf(match);
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + match.length + 50);
        return content.substring(start, end);
    }

    private shouldGenerateSummary(contact: IContactDocument): boolean {
        // Generate summary if there are 3+ conversations or significant interactions
        return contact.conversationHistory.length >= 3 ||
            contact.conversationHistory.some(c => c.content.length > 200);
    }

    private createFallbackSummary(contactId: string, contact: IContactDocument): IConversationSummary {
        const conversations = contact.conversationHistory;
        const lastConversation = conversations[conversations.length - 1];

        return {
            contactId,
            summary: `Conversation with ${contact.name} at ${contact.company || 'Unknown Company'}. Total interactions: ${conversations.length}`,
            keyPoints: [
                `Last interaction: ${lastConversation?.type || 'Unknown'}`,
                `Contact status: ${contact.status}`,
                `Response rate: ${contact.responseRate}%`
            ],
            nextActions: [
                'Review conversation history',
                'Determine appropriate follow-up',
                'Update contact status if needed'
            ],
            sentiment: 'neutral',
            lastUpdated: new Date()
        };
    }

    private async callAIService(prompt: string): Promise<string> {
        // This would use the AI service to analyze content
        // For now, return a placeholder response
        return '{"summary": "AI analysis not available", "keyPoints": [], "nextActions": [], "sentiment": "neutral"}';
    }
}

// Create singleton instance
const conversationService = new ConversationService();

export default conversationService;
