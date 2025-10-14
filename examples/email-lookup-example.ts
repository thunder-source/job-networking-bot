import dotenv from 'dotenv';
import { EmailService } from '../src/services/emailService.js';
import EmailLookupService from '../src/services/emailLookupService.js';
import databaseService from '../src/services/databaseService.js';

// Load environment variables
dotenv.config();

async function demonstrateEmailLookup() {
    console.log('🚀 Email Lookup Service Demo\n');

    try {
        // Initialize database
        await databaseService.initialize();

        // Configure email lookup service
        const emailLookupConfig = {
            hunterApiKey: process.env.HUNTER_API_KEY,
            rocketReachApiKey: process.env.ROCKETREACH_API_KEY
        };

        const emailLookupService = new EmailLookupService(emailLookupConfig);

        // Example 1: Find email using Hunter.io
        console.log('📧 Example 1: Finding email with Hunter.io');
        const hunterResult = await emailLookupService.findEmail(
            'John',
            'Doe',
            'google.com',
            { preferHunter: true, verifyEmail: true }
        );

        console.log('Hunter.io Result:', {
            email: hunterResult.email,
            confidence: hunterResult.confidence,
            source: hunterResult.source,
            verified: hunterResult.verified,
            metadata: hunterResult.metadata
        });

        // Example 2: Find email using RocketReach
        console.log('\n📧 Example 2: Finding email with RocketReach');
        const rocketResult = await emailLookupService.findEmail(
            'Jane',
            'Smith',
            'Microsoft',
            { preferHunter: false, verifyEmail: true }
        );

        console.log('RocketReach Result:', {
            email: rocketResult.email,
            confidence: rocketResult.confidence,
            source: rocketResult.source,
            verified: rocketResult.verified,
            metadata: rocketResult.metadata
        });

        // Example 3: Fallback pattern generation
        console.log('\n📧 Example 3: Fallback pattern generation');
        const fallbackResult = await emailLookupService.findEmail(
            'Bob',
            'Johnson',
            'startup.io',
            { enableFallback: true, verifyEmail: false }
        );

        console.log('Fallback Result:', {
            email: fallbackResult.email,
            confidence: fallbackResult.confidence,
            source: fallbackResult.source,
            verified: fallbackResult.verified,
            metadata: fallbackResult.metadata
        });

        // Example 4: Email verification
        console.log('\n✅ Example 4: Email verification');
        const testEmails = [
            'test@gmail.com',
            'invalid-email',
            'nonexistent@invalid-domain-12345.com'
        ];

        for (const email of testEmails) {
            const isValid = await emailLookupService.verifyEmail(email);
            console.log(`${email}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        }

        // Example 5: Integrated email service with lookup
        console.log('\n📬 Example 5: Integrated email service with lookup');

        const emailConfig = {
            provider: 'gmail' as const,
            credentials: {
                email: process.env.EMAIL_USER || 'your-email@gmail.com',
                password: process.env.EMAIL_PASS || 'your-app-password'
            },
            emailLookup: emailLookupConfig
        };

        const emailService = new EmailService(emailConfig);

        // Test email with lookup
        const emailData = {
            to: 'placeholder@example.com', // This will be replaced by lookup
            templateType: 'coldOutreach' as const,
            variables: {
                name: 'John Doe',
                company: 'Google',
                position: 'Software Engineer',
                technology: 'React',
                topic: 'frontend development',
                industry: 'technology',
                senderName: 'Your Name'
            },
            enableLookup: true,
            lookupData: {
                firstName: 'John',
                lastName: 'Doe',
                company: 'google.com'
            },
            lookupOptions: {
                verifyEmail: true,
                minConfidence: 70
            },
            minConfidence: 60,
            verifyBeforeSend: true,
            campaignId: 'demo-campaign'
        };

        // Note: This would actually send an email if credentials are valid
        console.log('Email data prepared with lookup:', {
            originalTo: emailData.to,
            lookupData: emailData.lookupData,
            verifyBeforeSend: emailData.verifyBeforeSend
        });

        // Example 6: Cache statistics
        console.log('\n📊 Example 6: Cache statistics');
        const cacheStats = emailLookupService.getCacheStats();
        console.log('Cache Stats:', cacheStats);

        // Example 7: Database integration
        console.log('\n💾 Example 7: Database integration');

        // Create a contact with email lookup data
        const contactData = {
            name: 'John Doe',
            email: hunterResult.email || 'john.doe@google.com',
            company: 'Google',
            position: 'Software Engineer',
            source: 'email_lookup' as any,
            status: 'pending' as any,
            tags: ['demo', 'email_lookup'],
            priority: 'medium' as any,
            responseRate: 0,
            conversationHistory: [],
            lastContactDate: new Date(),
            emailLookup: {
                foundEmail: hunterResult.email,
                confidence: hunterResult.confidence,
                source: hunterResult.source,
                method: hunterResult.method,
                verified: hunterResult.verified,
                lastVerified: new Date(),
                verificationMethod: 'api',
                lookupMetadata: hunterResult.metadata
            }
        };

        const contact = await databaseService.createContact(contactData);
        console.log('Contact created with email lookup data:', {
            id: contact._id,
            name: contact.name,
            email: contact.email,
            emailLookup: contact.emailLookup
        });

        // Example 8: Find contacts by email lookup source
        console.log('\n🔍 Example 8: Query contacts by email lookup source');
        const hunterContacts = await databaseService.getContacts({ 'emailLookup.source': 'hunter' });
        console.log(`Found ${hunterContacts.length} contacts with Hunter.io emails`);

        const unverifiedContacts = await databaseService.getContacts({
            $or: [
                { 'emailLookup.verified': { $ne: true } },
                { 'emailLookup.verified': { $exists: false } }
            ]
        });
        console.log(`Found ${unverifiedContacts.length} contacts with unverified emails`);

        console.log('\n✅ Email lookup demo completed successfully!');

    } catch (error) {
        console.error('❌ Error during email lookup demo:', error);
    } finally {
        // Cleanup
        await databaseService.cleanup();
    }
}

// Run the demo
demonstrateEmailLookup().catch(console.error);
