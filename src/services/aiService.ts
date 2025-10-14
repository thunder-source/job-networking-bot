import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

/**
 * AI Service for message personalization using OpenAI API
 * 
 * This service provides AI-powered message generation for LinkedIn networking
 * and cold email campaigns. It uses OpenAI's GPT models to create personalized
 * messages based on recruiter profiles and user information.
 * 
 * @class AIService
 * @example
 * ```typescript
 * const aiService = new AIService();
 * const message = await aiService.generatePersonalizedMessage(
 *   recruiterProfile,
 *   'initial',
 *   userInfo,
 *   { tone: 'professional', maxLength: 280 }
 * );
 * ```
 */
export class AIService {
    private openai: OpenAI;
    private readonly model: string;
    private readonly maxRetries: number = 3;

    // Default templates for different message types
    private readonly defaultTemplates = {
        initial: {
            name: 'Initial Connection',
            content: `Hi {name}! I noticed your work at {company} in {position}. I'm impressed by {commonality} and would love to connect to learn more about your experience.`,
            variables: ['name', 'company', 'position', 'commonality']
        },
        followup: {
            name: 'Follow-up Message',
            content: `Hi {name}, I hope you're doing well! I wanted to follow up on my previous message about {commonality}. Would you be open to a brief conversation about {position} opportunities?`,
            variables: ['name', 'commonality', 'position']
        },
        thankyou: {
            name: 'Thank You Message',
            content: `Thank you for connecting, {name}! I really appreciate you taking the time to share insights about {commonality} at {company}. Looking forward to staying in touch!`,
            variables: ['name', 'commonality', 'company']
        }
    };

    // Tone configurations
    private readonly toneConfigs = {
        professional: {
            description: 'Formal and business-focused',
            keywords: ['professional', 'formal', 'business', 'respectful', 'courteous']
        },
        friendly: {
            description: 'Warm and approachable',
            keywords: ['friendly', 'warm', 'approachable', 'personable', 'conversational']
        },
        enthusiastic: {
            description: 'Energetic and passionate',
            keywords: ['enthusiastic', 'excited', 'passionate', 'energetic', 'motivated']
        }
    };

    /**
     * Creates an instance of AIService
     * 
     * @param {string} [apiKey] - OpenAI API key. If not provided, will use OPENAI_API_KEY environment variable
     * @param {string} [model='gpt-4-turbo'] - OpenAI model to use for message generation
     * @throws {Error} When OpenAI API key is not provided or invalid
     * @example
     * ```typescript
     * // Using environment variable
     * const aiService = new AIService();
     * 
     * // Using explicit API key
     * const aiService = new AIService('sk-...', 'gpt-3.5-turbo');
     * ```
     */
    constructor(apiKey?: string, model: string = 'gpt-4-turbo') {
        const key = apiKey || process.env.OPENAI_API_KEY;

        if (!key) {
            throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to constructor.');
        }

        this.openai = new OpenAI({ apiKey: key });
        this.model = model;
    }

    /**
     * Generate a personalized message using OpenAI
     * 
     * Creates a personalized message based on the recruiter's profile and user information.
     * The message is generated using AI to find commonalities and create engaging content.
     * 
     * @param {IRecruiterProfile} recruiterProfile - Profile information about the target recruiter
     * @param {('initial'|'followup'|'thankyou')} templateType - Type of message template to use
     * @param {IUserInfo} userInfo - Your information for personalization
     * @param {IMessageOptions} [options={}] - Additional options for message generation
     * @returns {Promise<string>} Generated personalized message
     * @throws {Error} When message generation fails after retries
     * @example
     * ```typescript
     * const message = await aiService.generatePersonalizedMessage(
     *   {
     *     name: 'Sarah Johnson',
     *     company: 'TechCorp',
     *     position: 'Senior Software Engineer',
     *     skills: ['JavaScript', 'React']
     *   },
     *   'initial',
     *   {
     *     name: 'Alex Chen',
     *     targetRole: 'Software Engineer',
     *     skills: ['JavaScript', 'React']
     *   },
     *   { tone: 'professional', maxLength: 280 }
     * );
     * ```
     */
    async generatePersonalizedMessage(
        recruiterProfile: IRecruiterProfile,
        templateType: keyof typeof this.defaultTemplates,
        userInfo: IUserInfo,
        options: IMessageOptions = {}
    ): Promise<string> {
        try {
            const template = this.defaultTemplates[templateType];
            const tone = options.tone || 'professional';
            const maxLength = options.maxLength || 300;
            const minLength = options.minLength || 200;

            // Analyze recruiter profile for talking points
            const talkingPoints = await this.analyzeRecruiterProfile(recruiterProfile, userInfo);

            // Generate personalized message
            const prompt = this.buildPrompt(template, recruiterProfile, userInfo, talkingPoints, tone, maxLength);

            const response = await this.callOpenAI(prompt);

            // Validate and adjust message length
            const message = this.validateAndAdjustLength(response, minLength, maxLength);

            logger.info(`Generated ${templateType} message for ${recruiterProfile.name} (${message.length} chars)`);
            return message;

        } catch (error) {
            logger.error('Error generating personalized message:', error);
            throw new Error(`Failed to generate personalized message: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Analyze recruiter profile to find talking points and commonalities
     * 
     * Uses AI to analyze a recruiter's profile and identify potential talking points
     * and commonalities that can be used for personalized messaging.
     * 
     * @param {IRecruiterProfile} recruiterProfile - Profile information about the target recruiter
     * @param {IUserInfo} userInfo - Your information for comparison
     * @returns {Promise<string[]>} Array of talking points and commonalities
     * @throws {Error} When profile analysis fails
     * @example
     * ```typescript
     * const talkingPoints = await aiService.analyzeRecruiterProfile(recruiterProfile, userInfo);
     * // Returns: ["Shared expertise in JavaScript and React", "Interest in machine learning", ...]
     * ```
     */
    async analyzeRecruiterProfile(
        recruiterProfile: IRecruiterProfile,
        userInfo: IUserInfo
    ): Promise<string[]> {
        try {
            const prompt = this.buildAnalysisPrompt(recruiterProfile, userInfo);
            const response = await this.callOpenAI(prompt);

            // Parse the response to extract talking points
            const talkingPoints = this.parseTalkingPoints(response);

            logger.info(`Found ${talkingPoints.length} talking points for ${recruiterProfile.name}`);
            return talkingPoints;

        } catch (error) {
            logger.error('Error analyzing recruiter profile:', error);
            // Return fallback talking points
            return this.getFallbackTalkingPoints(recruiterProfile, userInfo);
        }
    }

    /**
     * Get default template by type
     * @param templateType - Type of template
     * @returns Template object
     */
    getDefaultTemplate(templateType: keyof typeof this.defaultTemplates) {
        return this.defaultTemplates[templateType];
    }

    /**
     * Get all available tone options
     * @returns Object with tone configurations
     */
    getToneOptions() {
        return this.toneConfigs;
    }

    /**
     * Validate message length and adjust if necessary
     * @param message - Message to validate
     * @param minLength - Minimum character length
     * @param maxLength - Maximum character length
     * @returns Adjusted message
     */
    private validateAndAdjustLength(message: string, minLength: number, maxLength: number): string {
        if (message.length <= maxLength && message.length >= minLength) {
            return message;
        }

        if (message.length > maxLength) {
            // Truncate message intelligently
            const truncated = message.substring(0, maxLength - 3);
            const lastSpace = truncated.lastIndexOf(' ');

            if (lastSpace > minLength) {
                return truncated.substring(0, lastSpace) + '...';
            } else {
                return truncated + '...';
            }
        }

        // If too short, try to expand intelligently
        if (message.length < minLength) {
            const padding = minLength - message.length;
            if (padding <= 20) {
                return message + '. Thank you for your time.';
            }
        }

        return message;
    }

    /**
     * Build the prompt for OpenAI
     */
    private buildPrompt(
        template: any,
        recruiterProfile: IRecruiterProfile,
        userInfo: IUserInfo,
        talkingPoints: string[],
        tone: string,
        maxLength: number
    ): string {
        const toneConfig = this.toneConfigs[tone as keyof typeof this.toneConfigs];

        return `You are a professional networking expert. Generate a personalized LinkedIn connection message with the following requirements:

TEMPLATE STRUCTURE: ${template.content}

RECRUITER INFORMATION:
- Name: ${recruiterProfile.name}
- Company: ${recruiterProfile.company}
- Position: ${recruiterProfile.position}
- Industry: ${recruiterProfile.industry || 'Not specified'}
- Experience: ${recruiterProfile.experience || 'Not specified'}
- Skills: ${recruiterProfile.skills?.join(', ') || 'Not specified'}
- Recent Activity: ${recruiterProfile.recentActivity || 'Not specified'}

USER INFORMATION:
- Name: ${userInfo.name}
- Target Role: ${userInfo.targetRole}
- Skills: ${userInfo.skills?.join(', ') || 'Not specified'}
- Experience: ${userInfo.experience || 'Not specified'}

TALKING POINTS: ${talkingPoints.join(', ')}

TONE REQUIREMENTS:
- Style: ${toneConfig.description}
- Keywords to incorporate: ${toneConfig.keywords.join(', ')}
- Character limit: ${maxLength} characters maximum
- Must be between 200-300 characters

INSTRUCTIONS:
1. Use the template structure as a guide but personalize it significantly
2. Incorporate relevant talking points naturally
3. Maintain the specified tone throughout
4. Keep the message concise but meaningful
5. Ensure it feels genuine and not template-like
6. Focus on value proposition and mutual benefit
7. End with a clear call-to-action

Generate only the final message, no explanations or additional text.`;
    }

    /**
     * Build prompt for profile analysis
     */
    private buildAnalysisPrompt(
        recruiterProfile: IRecruiterProfile,
        userInfo: IUserInfo
    ): string {
        return `Analyze the following recruiter profile and user information to identify potential talking points and commonalities for networking:

RECRUITER PROFILE:
- Name: ${recruiterProfile.name}
- Company: ${recruiterProfile.company}
- Position: ${recruiterProfile.position}
- Industry: ${recruiterProfile.industry || 'Not specified'}
- Skills: ${recruiterProfile.skills?.join(', ') || 'Not specified'}
- Experience: ${recruiterProfile.experience || 'Not specified'}
- Recent Activity: ${recruiterProfile.recentActivity || 'Not specified'}
- Education: ${recruiterProfile.education || 'Not specified'}
- Location: ${recruiterProfile.location || 'Not specified'}

USER PROFILE:
- Target Role: ${userInfo.targetRole}
- Skills: ${userInfo.skills?.join(', ') || 'Not specified'}
- Experience: ${userInfo.experience || 'Not specified'}
- Education: ${userInfo.education || 'Not specified'}
- Location: ${userInfo.location || 'Not specified'}

Please identify 3-5 specific talking points that could create a genuine connection. Consider:
1. Shared skills or technologies
2. Common industry experience
3. Similar career paths or transitions
4. Mutual connections or companies
5. Recent achievements or projects
6. Educational background
7. Geographic connections

Format your response as a numbered list of specific, actionable talking points. Each point should be 1-2 sentences and highlight a genuine connection opportunity.`;
    }

    /**
     * Parse talking points from AI response
     */
    private parseTalkingPoints(response: string): string[] {
        const lines = response.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return lines
            .filter(line => /^\d+\./.test(line))
            .map(line => line.replace(/^\d+\.\s*/, ''))
            .slice(0, 5); // Limit to 5 talking points
    }

    /**
     * Get fallback talking points when AI analysis fails
     */
    private getFallbackTalkingPoints(
        recruiterProfile: IRecruiterProfile,
        userInfo: IUserInfo
    ): string[] {
        const points: string[] = [];

        // Check for shared skills
        if (recruiterProfile.skills && userInfo.skills) {
            const sharedSkills = recruiterProfile.skills.filter(skill =>
                userInfo.skills?.some(userSkill =>
                    userSkill.toLowerCase().includes(skill.toLowerCase()) ||
                    skill.toLowerCase().includes(userSkill.toLowerCase())
                )
            );
            if (sharedSkills.length > 0) {
                points.push(`Shared expertise in ${sharedSkills[0]}`);
            }
        }

        // Check for same industry
        if (recruiterProfile.industry && userInfo.targetRole) {
            points.push(`Interest in ${recruiterProfile.industry} industry`);
        }

        // Check for company connection
        if (recruiterProfile.company) {
            points.push(`Experience with ${recruiterProfile.company} and similar companies`);
        }

        // Default talking points
        if (points.length === 0) {
            points.push(
                `Professional networking in ${recruiterProfile.industry || 'tech'} industry`,
                `Career growth and development opportunities`,
                `Industry insights and best practices`
            );
        }

        return points.slice(0, 3);
    }

    /**
     * Call OpenAI API with retry logic
     */
    private async callOpenAI(prompt: string): Promise<string> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a professional networking expert who creates personalized, engaging messages for LinkedIn connections.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 150,
                    temperature: 0.7,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                });

                const response = completion.choices[0]?.message?.content?.trim();

                if (!response) {
                    throw new Error('Empty response from OpenAI');
                }

                return response;

            } catch (error) {
                lastError = error as Error;
                logger.warn(`OpenAI API attempt ${attempt} failed:`, error);

                if (attempt < this.maxRetries) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`OpenAI API failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    }
}

/**
 * Interface definitions for AI Service
 */

/**
 * Represents a recruiter's profile information for AI analysis
 * @interface IRecruiterProfile
 */
export interface IRecruiterProfile {
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

/**
 * Represents user information for AI personalization
 * @interface IUserInfo
 */
export interface IUserInfo {
    /** User's full name */
    name: string;
    /** Target role or position the user is seeking */
    targetRole: string;
    /** Array of user's skills and technologies */
    skills?: string[];
    /** Years of experience or experience description */
    experience?: string;
    /** Educational background */
    education?: string;
    /** User's location */
    location?: string;
    /** Current company or employer */
    currentCompany?: string;
    /** Professional summary or bio */
    summary?: string;
    /** Notable achievements or accomplishments */
    achievements?: string[];
}

/**
 * Options for AI message generation
 * @interface IMessageOptions
 */
export interface IMessageOptions {
    /** Tone of the message */
    tone?: 'professional' | 'friendly' | 'enthusiastic';
    /** Maximum character length for the message */
    maxLength?: number;
    /** Minimum character length for the message */
    minLength?: number;
    /** Custom prompt to override default generation */
    customPrompt?: string;
    /** Whether to include emojis in the message */
    includeEmojis?: boolean;
}

/**
 * Template structure for message generation
 * @interface ITemplate
 */
export interface ITemplate {
    /** Template name */
    name: string;
    /** Template content with placeholders */
    content: string;
    /** Array of variable names used in the template */
    variables: string[];
}

/**
 * Represents a talking point for networking
 * @interface ITalkingPoint
 */
export interface ITalkingPoint {
    /** Type of talking point */
    type: 'skill' | 'experience' | 'education' | 'company' | 'location' | 'achievement';
    /** Description of the talking point */
    description: string;
    /** Relevance level for networking */
    relevance: 'high' | 'medium' | 'low';
}

export default AIService;
