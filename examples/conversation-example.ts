import conversationService, {
    ConversationService,
    ConversationIntent,
    PositiveSignalType,
    ActionType
} from '../src/services/conversationService.js';
import databaseService from '../src/services/databaseService.js';
import { ContactStatus, ContactSource, ConversationType, ConversationDirection, Priority } from '../src/types/index.js';
import chalk from 'chalk';

/**
 * Example demonstrating the Conversation Service functionality
 * This example shows how to track interactions, analyze responses, and manage follow-ups
 */

async function runConversationExample() {
    console.log(chalk.blue.bold('\n🚀 Conversation Service Example\n'));

    try {
        // Initialize database
        await databaseService.initialize();

        // Create a sample contact for demonstration
        const contactData = {
            name: 'John Smith',
            email: 'john.smith@techcorp.com',
            company: 'TechCorp Inc.',
            position: 'Senior Developer',
            status: ContactStatus.PENDING,
            source: ContactSource.LINKEDIN,
            lastContactDate: new Date(),
            conversationHistory: [],
            tags: ['tech', 'developer'],
            priority: Priority.HIGH,
            responseRate: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        console.log(chalk.yellow('📝 Creating sample contact...'));
        const contact = await databaseService.createContact(contactData);
        console.log(chalk.green(`✅ Created contact: ${contact.name} (ID: ${contact._id})\n`));

        // Example 1: Track an initial connection message
        console.log(chalk.blue.bold('📨 Example 1: Tracking Initial Connection Message'));

        const initialMessage = {
            type: ConversationType.LINKEDIN_MESSAGE,
            direction: ConversationDirection.SENT,
            content: "Hi John! I noticed your impressive work on machine learning projects at TechCorp. I'm a fellow developer working on similar technologies and would love to connect to share insights and learn from your experience.",
            subject: "Connection Request"
        };

        const analysis1 = await conversationService.trackInteraction(contact._id.toString(), initialMessage);

        console.log(chalk.cyan('📊 Analysis Results:'));
        console.log(`   Intent: ${chalk.bold(analysis1.intent)}`);
        console.log(`   Sentiment: ${chalk.bold(analysis1.sentiment)}`);
        console.log(`   Follow-up needed: ${chalk.bold(analysis1.followUpNeeded ? 'Yes' : 'No')}`);
        console.log(`   Urgency: ${chalk.bold(analysis1.urgency)}`);
        console.log(`   Confidence: ${chalk.bold((analysis1.confidence * 100).toFixed(1))}%`);

        if (analysis1.positiveSignals.length > 0) {
            console.log(chalk.green('   Positive Signals:'));
            analysis1.positiveSignals.forEach(signal => {
                console.log(`     - ${signal.type}: "${signal.text}" (${(signal.confidence * 100).toFixed(1)}%)`);
            });
        }

        if (analysis1.actionItems.length > 0) {
            console.log(chalk.yellow('   Action Items:'));
            analysis1.actionItems.forEach(item => {
                console.log(`     - ${item.type}: ${item.description} (Priority: ${item.priority})`);
            });
        }
        console.log();

        // Example 2: Track a positive response
        console.log(chalk.blue.bold('📨 Example 2: Tracking Positive Response'));

        const positiveResponse = {
            type: ConversationType.LINKEDIN_MESSAGE,
            direction: ConversationDirection.RECEIVED,
            content: "Hi! Thanks for reaching out. I'd definitely be interested in connecting and sharing insights about ML projects. I'm particularly excited about the recent developments in transformer architectures. Would you be available for a quick call this week to discuss our experiences?",
            subject: "Re: Connection Request"
        };

        const analysis2 = await conversationService.trackInteraction(contact._id.toString(), positiveResponse);

        console.log(chalk.cyan('📊 Analysis Results:'));
        console.log(`   Intent: ${chalk.bold(analysis2.intent)}`);
        console.log(`   Sentiment: ${chalk.bold(analysis2.sentiment)}`);
        console.log(`   Follow-up needed: ${chalk.bold(analysis2.followUpNeeded ? 'Yes' : 'No')}`);
        console.log(`   Urgency: ${chalk.bold(analysis2.urgency)}`);

        if (analysis2.positiveSignals.length > 0) {
            console.log(chalk.green('   Positive Signals Detected:'));
            analysis2.positiveSignals.forEach(signal => {
                console.log(`     - ${signal.type}: "${signal.text}" (${(signal.confidence * 100).toFixed(1)}%)`);
            });
        }

        if (analysis2.actionItems.length > 0) {
            console.log(chalk.yellow('   Action Items:'));
            analysis2.actionItems.forEach(item => {
                console.log(`     - ${item.type}: ${item.description} (Priority: ${item.priority})`);
                if (item.dueDate) {
                    console.log(`       Due: ${item.dueDate.toLocaleString()}`);
                }
            });
        }
        console.log();

        // Example 3: Track a job opportunity response
        console.log(chalk.blue.bold('📨 Example 3: Tracking Job Opportunity Response'));

        const jobResponse = {
            type: ConversationType.EMAIL,
            direction: ConversationDirection.RECEIVED,
            content: "Thanks for sharing your portfolio! We're actually looking for a Senior ML Engineer at TechCorp. Your experience with transformer architectures is exactly what we need. Would you be interested in applying? I can refer you directly to our hiring manager.",
            subject: "Job Opportunity - Senior ML Engineer"
        };

        const analysis3 = await conversationService.trackInteraction(contact._id.toString(), jobResponse);

        console.log(chalk.cyan('📊 Analysis Results:'));
        console.log(`   Intent: ${chalk.bold(analysis3.intent)}`);
        console.log(`   Sentiment: ${chalk.bold(analysis3.sentiment)}`);
        console.log(`   Follow-up needed: ${chalk.bold(analysis3.followUpNeeded ? 'Yes' : 'No')}`);
        console.log(`   Urgency: ${chalk.bold(analysis3.urgency)}`);

        if (analysis3.positiveSignals.length > 0) {
            console.log(chalk.green('   Positive Signals Detected:'));
            analysis3.positiveSignals.forEach(signal => {
                console.log(`     - ${signal.type}: "${signal.text}" (${(signal.confidence * 100).toFixed(1)}%)`);
            });
        }

        if (analysis3.actionItems.length > 0) {
            console.log(chalk.yellow('   Action Items:'));
            analysis3.actionItems.forEach(item => {
                console.log(`     - ${item.type}: ${item.description} (Priority: ${item.priority})`);
                if (item.dueDate) {
                    console.log(`       Due: ${item.dueDate.toLocaleString()}`);
                }
            });
        }
        console.log();

        // Example 4: Generate conversation summary
        console.log(chalk.blue.bold('📋 Example 4: Generating Conversation Summary'));

        const summary = await conversationService.generateConversationSummary(contact._id.toString());

        console.log(chalk.cyan('📊 Conversation Summary:'));
        console.log(`   Summary: ${summary.summary}`);
        console.log(`   Sentiment: ${chalk.bold(summary.sentiment)}`);
        console.log(`   Key Points:`);
        summary.keyPoints.forEach(point => {
            console.log(`     - ${point}`);
        });
        console.log(`   Next Actions:`);
        summary.nextActions.forEach(action => {
            console.log(`     - ${action}`);
        });
        console.log();

        // Example 5: Get conversation metrics
        console.log(chalk.blue.bold('📈 Example 5: Conversation Metrics'));

        const metrics = await conversationService.getConversationMetrics(contact._id.toString());

        console.log(chalk.cyan('📊 Metrics:'));
        console.log(`   Total Interactions: ${metrics.totalInteractions}`);
        console.log(`   Response Rate: ${chalk.bold(metrics.responseRate.toFixed(1))}%`);
        console.log(`   Positive Response Rate: ${chalk.bold(metrics.positiveResponseRate.toFixed(1))}%`);
        console.log(`   Average Response Time: ${chalk.bold((metrics.averageResponseTime / (1000 * 60 * 60)).toFixed(1))} hours`);
        console.log(`   Engagement Score: ${chalk.bold(metrics.engagementScore.toFixed(1))}/100`);
        console.log(`   Conversation Length: ${metrics.conversationLength} characters`);
        console.log();

        // Example 6: Get follow-up flags
        console.log(chalk.blue.bold('🚩 Example 6: Follow-up Flags'));

        const followUpFlags = conversationService.getFollowUpFlags();

        if (followUpFlags.length > 0) {
            console.log(chalk.cyan('📊 Follow-up Flags:'));
            followUpFlags.forEach((flag, index) => {
                console.log(`   ${index + 1}. Contact: ${flag.contactId}`);
                console.log(`      Reason: ${flag.reason}`);
                console.log(`      Priority: ${chalk.bold(flag.priority)}`);
                console.log(`      Action: ${flag.suggestedAction}`);
                console.log(`      Created: ${flag.createdDate.toLocaleString()}`);
                if (flag.dueDate) {
                    console.log(`      Due: ${flag.dueDate.toLocaleString()}`);
                }
                console.log();
            });
        } else {
            console.log(chalk.yellow('   No follow-up flags found.'));
        }

        // Example 7: Update next action dates
        console.log(chalk.blue.bold('⏰ Example 7: Updating Next Action Dates'));

        await conversationService.updateNextActionDates();
        console.log(chalk.green('✅ Next action dates updated based on contact engagement\n'));

        // Example 8: Track negative response
        console.log(chalk.blue.bold('📨 Example 8: Tracking Negative Response'));

        const negativeResponse = {
            type: ConversationType.EMAIL,
            direction: ConversationDirection.RECEIVED,
            content: "Thank you for reaching out, but I'm not currently interested in new opportunities. I'm happy with my current role at TechCorp. Please remove me from your mailing list.",
            subject: "Re: Job Opportunity"
        };

        const analysis4 = await conversationService.trackInteraction(contact._id.toString(), negativeResponse);

        console.log(chalk.cyan('📊 Analysis Results:'));
        console.log(`   Intent: ${chalk.bold(analysis4.intent)}`);
        console.log(`   Sentiment: ${chalk.bold(analysis4.sentiment)}`);
        console.log(`   Follow-up needed: ${chalk.bold(analysis4.followUpNeeded ? 'Yes' : 'No')}`);

        if (analysis4.negativeSignals.length > 0) {
            console.log(chalk.red('   Negative Signals Detected:'));
            analysis4.negativeSignals.forEach(signal => {
                console.log(`     - ${signal.type}: "${signal.text}" (${(signal.confidence * 100).toFixed(1)}%)`);
            });
        }

        if (analysis4.actionItems.length > 0) {
            console.log(chalk.yellow('   Action Items:'));
            analysis4.actionItems.forEach(item => {
                console.log(`     - ${item.type}: ${item.description} (Priority: ${item.priority})`);
            });
        }
        console.log();

        // Final status check
        console.log(chalk.blue.bold('📊 Final Contact Status'));
        const finalContact = await databaseService.getContactById(contact._id.toString());
        if (finalContact) {
            console.log(chalk.cyan(`   Name: ${finalContact.name}`));
            console.log(chalk.cyan(`   Status: ${chalk.bold(finalContact.status)}`));
            console.log(chalk.cyan(`   Response Rate: ${chalk.bold(finalContact.responseRate.toFixed(1))}%`));
            console.log(chalk.cyan(`   Total Conversations: ${finalContact.conversationHistory.length}`));
            console.log(chalk.cyan(`   Last Contact: ${finalContact.lastContactDate.toLocaleString()}`));
        }

        console.log(chalk.green.bold('\n✅ Conversation Service Example Completed Successfully!\n'));

    } catch (error) {
        console.error(chalk.red.bold('❌ Error running conversation example:'), error);
        throw error;
    } finally {
        // Cleanup
        await databaseService.cleanup();
    }
}

// Advanced usage examples
async function demonstrateAdvancedFeatures() {
    console.log(chalk.blue.bold('\n🔧 Advanced Features Demo\n'));

    try {
        await databaseService.initialize();

        // Create multiple contacts for batch processing
        const contacts = [
            {
                name: 'Alice Johnson',
                email: 'alice.johnson@startup.com',
                company: 'TechStartup',
                position: 'CTO',
                status: ContactStatus.PENDING,
                source: ContactSource.LINKEDIN,
                lastContactDate: new Date(),
                conversationHistory: [],
                tags: ['startup', 'cto'],
                priority: Priority.HIGH,
                responseRate: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'Bob Wilson',
                email: 'bob.wilson@bigcorp.com',
                company: 'BigCorp',
                position: 'Engineering Manager',
                status: ContactStatus.PENDING,
                source: ContactSource.EMAIL,
                lastContactDate: new Date(),
                conversationHistory: [],
                tags: ['enterprise', 'manager'],
                priority: Priority.MEDIUM,
                responseRate: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        console.log(chalk.yellow('📝 Creating multiple contacts...'));
        const createdContacts = [];
        for (const contactData of contacts) {
            const contact = await databaseService.createContact(contactData);
            createdContacts.push(contact);
            console.log(chalk.green(`✅ Created: ${contact.name}`));
        }

        // Batch process conversations
        console.log(chalk.blue.bold('\n🔄 Batch Processing Conversations'));

        const conversations = [
            {
                contactId: createdContacts[0]._id.toString(),
                message: {
                    type: ConversationType.LINKEDIN_MESSAGE,
                    direction: ConversationDirection.RECEIVED,
                    content: "Hi! I'm interested in learning more about your startup. Are you hiring for any senior engineering roles?",
                    subject: "Engineering Opportunities"
                }
            },
            {
                contactId: createdContacts[1]._id.toString(),
                message: {
                    type: ConversationType.EMAIL,
                    direction: ConversationDirection.RECEIVED,
                    content: "Thanks for the connection request. I'd love to schedule a call to discuss potential collaboration opportunities between our companies.",
                    subject: "Collaboration Discussion"
                }
            }
        ];

        for (const conversation of conversations) {
            console.log(chalk.cyan(`Processing conversation for contact ${conversation.contactId}...`));
            const analysis = await conversationService.trackInteraction(
                conversation.contactId,
                conversation.message
            );
            console.log(`   Intent: ${analysis.intent}, Sentiment: ${analysis.sentiment}`);
        }

        // Get all follow-up flags
        console.log(chalk.blue.bold('\n🚩 All Follow-up Flags'));
        const allFlags = conversationService.getFollowUpFlags();
        console.log(chalk.cyan(`Total follow-up flags: ${allFlags.length}`));

        allFlags.forEach((flag, index) => {
            console.log(`   ${index + 1}. Priority: ${flag.priority} - ${flag.suggestedAction}`);
        });

        // Demonstrate resolving flags
        if (allFlags.length > 0) {
            console.log(chalk.blue.bold('\n✅ Resolving Follow-up Flags'));
            const firstFlag = allFlags[0];
            const contactId = firstFlag.contactId;
            const flags = conversationService['followUpFlags'].get(contactId);
            if (flags) {
                const flagIndex = flags.findIndex(f => f === firstFlag);
                conversationService.resolveFollowUpFlag(contactId, flagIndex);
                console.log(chalk.green(`Resolved follow-up flag for contact ${contactId}`));
            }
        }

        console.log(chalk.green.bold('\n✅ Advanced Features Demo Completed!\n'));

    } catch (error) {
        console.error(chalk.red.bold('❌ Error in advanced features demo:'), error);
        throw error;
    } finally {
        await databaseService.cleanup();
    }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(chalk.blue.bold('🎯 Conversation Service Examples\n'));

    runConversationExample()
        .then(() => demonstrateAdvancedFeatures())
        .catch(error => {
            console.error(chalk.red.bold('❌ Example failed:'), error);
            process.exit(1);
        });
}

export { runConversationExample, demonstrateAdvancedFeatures };
