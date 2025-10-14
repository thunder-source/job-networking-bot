import { AIService, IRecruiterProfile, IUserInfo, IMessageOptions } from '../src/services/aiService.js';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateAIService() {
    try {
        // Initialize AI service
        const aiService = new AIService();

        // Sample recruiter profile
        const recruiterProfile: IRecruiterProfile = {
            name: 'Sarah Johnson',
            company: 'TechCorp',
            position: 'Senior Software Engineer',
            industry: 'Technology',
            skills: ['JavaScript', 'React', 'Node.js', 'AWS', 'Python'],
            experience: '5 years',
            recentActivity: 'Recently posted about machine learning trends',
            education: 'Computer Science, Stanford University',
            location: 'San Francisco, CA',
            linkedinUrl: 'https://linkedin.com/in/sarah-johnson',
            summary: 'Passionate about building scalable web applications and mentoring junior developers',
            achievements: ['Led team of 8 developers', 'Reduced app load time by 40%'],
            endorsements: ['Leadership', 'Technical Skills', 'Team Building']
        };

        // Sample user info
        const userInfo: IUserInfo = {
            name: 'Alex Chen',
            targetRole: 'Software Engineer',
            skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Docker'],
            experience: '3 years',
            education: 'Computer Science, UC Berkeley',
            location: 'San Francisco, CA',
            currentCompany: 'StartupXYZ',
            summary: 'Full-stack developer with passion for clean code and user experience',
            achievements: ['Built microservices architecture', 'Improved user engagement by 25%']
        };

        console.log('🤖 AI Service Demo - Message Personalization\n');
        console.log('='.repeat(60));

        // Demonstrate different message types
        const messageTypes: Array<keyof typeof aiService['defaultTemplates']> = ['initial', 'followup', 'thankyou'];
        const tones: Array<keyof typeof aiService['toneConfigs']> = ['professional', 'friendly', 'enthusiastic'];

        for (const messageType of messageTypes) {
            console.log(`\n📝 ${messageType.toUpperCase()} MESSAGES:`);
            console.log('-'.repeat(40));

            for (const tone of tones) {
                const options: IMessageOptions = {
                    tone,
                    maxLength: 280,
                    minLength: 200
                };

                try {
                    const message = await aiService.generatePersonalizedMessage(
                        recruiterProfile,
                        messageType,
                        userInfo,
                        options
                    );

                    console.log(`\n${tone.toUpperCase()} tone (${message.length} chars):`);
                    console.log(`"${message}"`);

                } catch (error) {
                    console.error(`Error generating ${tone} ${messageType} message:`, error);
                }
            }
        }

        // Demonstrate profile analysis
        console.log('\n\n🔍 PROFILE ANALYSIS:');
        console.log('='.repeat(60));

        try {
            const talkingPoints = await aiService.analyzeRecruiterProfile(recruiterProfile, userInfo);

            console.log('\nTalking Points Found:');
            talkingPoints.forEach((point, index) => {
                console.log(`${index + 1}. ${point}`);
            });

        } catch (error) {
            console.error('Error analyzing profile:', error);
        }

        // Demonstrate template system
        console.log('\n\n📋 TEMPLATE SYSTEM:');
        console.log('='.repeat(60));

        const templates = ['initial', 'followup', 'thankyou'] as const;
        templates.forEach(templateType => {
            const template = aiService.getDefaultTemplate(templateType);
            console.log(`\n${template.name}:`);
            console.log(`Variables: ${template.variables.join(', ')}`);
            console.log(`Template: "${template.content}"`);
        });

        // Demonstrate tone options
        console.log('\n\n🎭 TONE OPTIONS:');
        console.log('='.repeat(60));

        const toneOptions = aiService.getToneOptions();
        Object.entries(toneOptions).forEach(([tone, config]) => {
            console.log(`\n${tone.toUpperCase()}:`);
            console.log(`  Description: ${config.description}`);
            console.log(`  Keywords: ${config.keywords.join(', ')}`);
        });

        console.log('\n✅ AI Service demo completed successfully!');

    } catch (error) {
        logger.error('AI Service demo failed:', error);
        console.error('Demo failed:', error);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateAIService();
}

export { demonstrateAIService };
