import { EmailService, IEmailConfig, IEmailData, IEmailTemplate } from '../src/services/emailService.js';
import { logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateEmailService() {
    try {
        console.log('📧 Email Service Demo - SMTP Integration & Templates\n');
        console.log('='.repeat(70));

        // 1. Initialize email service with different providers
        console.log('\n🔧 INITIALIZING EMAIL SERVICE:');
        console.log('-'.repeat(40));

        // Gmail configuration
        const gmailConfig: IEmailConfig = {
            provider: 'gmail',
            credentials: {
                email: process.env.GMAIL_EMAIL || 'your-email@gmail.com',
                password: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
            },
            trackingBaseUrl: 'https://your-domain.com/track',
            unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe',
            rateLimit: {
                maxEmailsPerHour: 50,
                windowMs: 60 * 60 * 1000 // 1 hour
            }
        };

        // Outlook configuration
        const outlookConfig: IEmailConfig = {
            provider: 'outlook',
            credentials: {
                email: process.env.OUTLOOK_EMAIL || 'your-email@outlook.com',
                password: process.env.OUTLOOK_PASSWORD || 'your-password'
            },
            trackingBaseUrl: 'https://your-domain.com/track',
            unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe',
            rateLimit: {
                maxEmailsPerHour: 30,
                windowMs: 60 * 60 * 1000
            }
        };

        // Custom SMTP configuration
        const customConfig: IEmailConfig = {
            provider: 'custom',
            credentials: {
                email: process.env.SMTP_EMAIL || 'your-email@yourdomain.com',
                password: process.env.SMTP_PASSWORD || 'your-password',
                host: process.env.SMTP_HOST || 'smtp.yourdomain.com',
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true'
            },
            trackingBaseUrl: 'https://your-domain.com/track',
            unsubscribeBaseUrl: 'https://your-domain.com/unsubscribe',
            rateLimit: {
                maxEmailsPerHour: 100,
                windowMs: 60 * 60 * 1000
            }
        };

        // Initialize with Gmail (you can change this)
        const emailService = new EmailService(gmailConfig);

        // Test configuration
        console.log('Testing email configuration...');
        const configValid = await emailService.testConfiguration();
        console.log(`Configuration valid: ${configValid ? '✅ Yes' : '❌ No'}`);

        if (!configValid) {
            console.log('\n⚠️  Email configuration is invalid. Please check your credentials.');
            console.log('Make sure to set the following environment variables:');
            console.log('- GMAIL_EMAIL and GMAIL_APP_PASSWORD for Gmail');
            console.log('- OUTLOOK_EMAIL and OUTLOOK_PASSWORD for Outlook');
            console.log('- SMTP_EMAIL, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT for custom SMTP');
            return;
        }

        // 2. Demonstrate email templates
        console.log('\n📋 AVAILABLE EMAIL TEMPLATES:');
        console.log('-'.repeat(40));

        const templates = ['coldOutreach', 'followUp', 'thankYou'] as const;
        templates.forEach(templateType => {
            const template = emailService.getTemplate(templateType);
            console.log(`\n${templateType.toUpperCase()}:`);
            console.log(`  Subject: ${template.subject}`);
            console.log(`  Preview: ${template.text.substring(0, 100)}...`);
        });

        // 3. Send single email
        console.log('\n📤 SENDING SINGLE EMAIL:');
        console.log('-'.repeat(40));

        const singleEmailData: IEmailData = {
            to: 'test@example.com',
            from: process.env.GMAIL_EMAIL || 'your-email@gmail.com',
            templateType: 'coldOutreach',
            variables: {
                name: 'Sarah Johnson',
                company: 'TechCorp',
                position: 'Senior Software Engineer',
                technology: 'React and Node.js',
                topic: 'scalable web applications',
                industry: 'technology',
                senderName: 'Alex Chen'
            },
            campaignId: 'demo-campaign-001'
        };

        console.log('Sending cold outreach email...');
        const singleResult = await emailService.sendEmail(singleEmailData);

        console.log(`Email sent: ${singleResult.success ? '✅ Success' : '❌ Failed'}`);
        if (singleResult.success) {
            console.log(`  Message ID: ${singleResult.messageId}`);
            console.log(`  Tracking ID: ${singleResult.trackingId}`);
        } else {
            console.log(`  Error: ${singleResult.error}`);
        }

        // 4. Send follow-up email
        console.log('\n📤 SENDING FOLLOW-UP EMAIL:');
        console.log('-'.repeat(40));

        const followUpData: IEmailData = {
            to: 'test@example.com',
            templateType: 'followUp',
            variables: {
                name: 'Sarah Johnson',
                topic: 'scalable web applications',
                industry: 'technology',
                company: 'TechCorp',
                specificTopic: 'microservices architecture',
                senderName: 'Alex Chen'
            },
            campaignId: 'demo-campaign-001'
        };

        console.log('Sending follow-up email...');
        const followUpResult = await emailService.sendEmail(followUpData);

        console.log(`Follow-up sent: ${followUpResult.success ? '✅ Success' : '❌ Failed'}`);
        if (followUpResult.success) {
            console.log(`  Message ID: ${followUpResult.messageId}`);
            console.log(`  Tracking ID: ${followUpResult.trackingId}`);
        }

        // 5. Send thank you email
        console.log('\n📤 SENDING THANK YOU EMAIL:');
        console.log('-'.repeat(40));

        const thankYouData: IEmailData = {
            to: 'test@example.com',
            templateType: 'thankYou',
            variables: {
                name: 'Sarah Johnson',
                topic: 'scalable web applications',
                specificInsight: 'microservices architecture patterns',
                project: 'our new platform',
                senderName: 'Alex Chen'
            },
            campaignId: 'demo-campaign-001'
        };

        console.log('Sending thank you email...');
        const thankYouResult = await emailService.sendEmail(thankYouData);

        console.log(`Thank you sent: ${thankYouResult.success ? '✅ Success' : '❌ Failed'}`);
        if (thankYouResult.success) {
            console.log(`  Message ID: ${thankYouResult.messageId}`);
            console.log(`  Tracking ID: ${thankYouResult.trackingId}`);
        }

        // 6. Demonstrate bulk email sending
        console.log('\n📤 SENDING BULK EMAILS:');
        console.log('-'.repeat(40));

        const bulkEmails: IEmailData[] = [
            {
                to: 'recipient1@example.com',
                templateType: 'coldOutreach',
                variables: {
                    name: 'John Doe',
                    company: 'StartupXYZ',
                    position: 'CTO',
                    technology: 'Python and AI',
                    topic: 'machine learning applications',
                    industry: 'AI/ML',
                    senderName: 'Alex Chen'
                },
                campaignId: 'bulk-campaign-001'
            },
            {
                to: 'recipient2@example.com',
                templateType: 'coldOutreach',
                variables: {
                    name: 'Jane Smith',
                    company: 'BigCorp',
                    position: 'Engineering Manager',
                    technology: 'Java and Spring',
                    topic: 'enterprise applications',
                    industry: 'enterprise software',
                    senderName: 'Alex Chen'
                },
                campaignId: 'bulk-campaign-001'
            },
            {
                to: 'recipient3@example.com',
                templateType: 'coldOutreach',
                variables: {
                    name: 'Mike Wilson',
                    company: 'CloudTech',
                    position: 'DevOps Engineer',
                    technology: 'AWS and Kubernetes',
                    topic: 'cloud infrastructure',
                    industry: 'cloud computing',
                    senderName: 'Alex Chen'
                },
                campaignId: 'bulk-campaign-001'
            }
        ];

        console.log(`Sending ${bulkEmails.length} bulk emails...`);
        const bulkResults = await emailService.sendBulkEmails(bulkEmails, {
            delayBetweenEmails: 2000 // 2 seconds between emails
        });

        const successCount = bulkResults.filter(r => r.success).length;
        const failureCount = bulkResults.filter(r => !r.success).length;

        console.log(`Bulk email results: ${successCount} successful, ${failureCount} failed`);

        // 7. Demonstrate email validation
        console.log('\n✅ EMAIL VALIDATION:');
        console.log('-'.repeat(40));

        const testEmails = [
            'valid@example.com',
            'invalid-email',
            'another.valid@domain.co.uk',
            'not-an-email',
            'test+tag@example.org'
        ];

        testEmails.forEach(email => {
            const isValid = emailService.validateEmail(email);
            console.log(`${email}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        });

        // 8. Demonstrate custom template
        console.log('\n🎨 CUSTOM TEMPLATE:');
        console.log('-'.repeat(40));

        const customTemplate: IEmailTemplate = {
            name: 'customTemplate',
            subject: 'Custom: {{subject}}',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>{{subject}}</title>
                </head>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #2c3e50;">{{title}}</h1>
                    <p>{{message}}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <strong>Custom Content:</strong> {{customContent}}
                    </div>
                    <p>Best regards,<br>{{senderName}}</p>
                    <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #666;">
                        <a href="{{unsubscribeUrl}}">Unsubscribe</a>
                    </div>
                    <img src="{{trackingPixel}}" width="1" height="1" style="display: none;" alt="" />
                </body>
                </html>
            `,
            text: `{{title}}\n\n{{message}}\n\nCustom Content: {{customContent}}\n\nBest regards,\n{{senderName}}`
        };

        emailService.addCustomTemplate(customTemplate);

        const customEmailData: IEmailData = {
            to: 'test@example.com',
            templateType: 'customTemplate' as any,
            variables: {
                subject: 'Custom Email Test',
                title: 'Hello from Custom Template!',
                message: 'This is a custom email template demonstration.',
                customContent: 'This is custom content that can be personalized.',
                senderName: 'Alex Chen'
            },
            campaignId: 'custom-template-test'
        };

        console.log('Sending custom template email...');
        const customResult = await emailService.sendEmail(customEmailData);
        console.log(`Custom email sent: ${customResult.success ? '✅ Success' : '❌ Failed'}`);

        // 9. Demonstrate tracking
        console.log('\n📊 EMAIL TRACKING:');
        console.log('-'.repeat(40));

        if (singleResult.trackingId) {
            console.log('Simulating email open tracking...');
            await emailService.trackEmailOpen(singleResult.trackingId);

            console.log('Simulating unsubscribe handling...');
            await emailService.handleUnsubscribe(singleResult.trackingId);
        }

        // 10. Get email statistics
        console.log('\n📈 EMAIL STATISTICS:');
        console.log('-'.repeat(40));

        const stats = await emailService.getEmailStats('demo-campaign-001');
        console.log('Email Statistics:');
        console.log(`  Total Sent: ${stats.totalSent}`);
        console.log(`  Total Opened: ${stats.totalOpened}`);
        console.log(`  Total Unsubscribed: ${stats.totalUnsubscribed}`);
        console.log(`  Open Rate: ${(stats.openRate * 100).toFixed(2)}%`);
        console.log(`  Unsubscribe Rate: ${(stats.unsubscribeRate * 100).toFixed(2)}%`);

        // 11. Demonstrate rate limiting
        console.log('\n⏱️  RATE LIMITING:');
        console.log('-'.repeat(40));

        console.log('Testing rate limiting...');
        const rateLimitEmails: IEmailData[] = Array(5).fill(null).map((_, i) => ({
            to: `test${i}@example.com`,
            templateType: 'coldOutreach' as const,
            variables: {
                name: `User ${i}`,
                company: 'TestCorp',
                position: 'Developer',
                technology: 'JavaScript',
                topic: 'web development',
                industry: 'tech',
                senderName: 'Alex Chen'
            },
            campaignId: 'rate-limit-test'
        }));

        console.log(`Sending ${rateLimitEmails.length} emails quickly to test rate limiting...`);
        const rateLimitResults = await emailService.sendBulkEmails(rateLimitEmails, {
            delayBetweenEmails: 100 // Very short delay to trigger rate limiting
        });

        const rateLimitSuccess = rateLimitResults.filter(r => r.success).length;
        const rateLimitFailures = rateLimitResults.filter(r => !r.success).length;

        console.log(`Rate limit test results: ${rateLimitSuccess} successful, ${rateLimitFailures} failed`);

        console.log('\n✅ Email Service demo completed successfully!');

    } catch (error) {
        logger.error('Email Service demo failed:', error);
        console.error('Demo failed:', error);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateEmailService();
}

export { demonstrateEmailService };
