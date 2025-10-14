import { LinkedInService, LinkedInCredentials, SearchFilters } from '../src/services/linkedinService.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function linkedinAutomationExample() {
    const linkedinService = new LinkedInService({
        headless: false, // Set to true for production
        timeout: 30000
    });

    try {
        // Login credentials (you should set these in your .env file)
        const credentials: LinkedInCredentials = {
            email: process.env.LINKEDIN_EMAIL || 'your-email@example.com',
            password: process.env.LINKEDIN_PASSWORD || 'your-password'
        };

        console.log('Starting LinkedIn automation...');

        // Login to LinkedIn
        console.log('Logging in to LinkedIn...');
        const loginSuccess = await linkedinService.login(credentials);

        if (!loginSuccess) {
            console.error('Failed to login to LinkedIn');
            return;
        }

        // Search for recruiters with filters
        const searchFilters: SearchFilters = {
            keywords: 'recruiter',
            location: 'United States',
            industry: 'Information Technology and Services',
            company: 'Google',
            maxResults: 10
        };

        console.log('Searching for recruiters...');
        const recruiterUrls = await linkedinService.searchRecruiters(searchFilters);

        if (recruiterUrls.length === 0) {
            console.log('No recruiters found with the specified filters');
            return;
        }

        console.log(`Found ${recruiterUrls.length} recruiter profiles`);

        // Scrape profiles
        console.log('Scraping recruiter profiles...');
        const profiles = await linkedinService.scrapeProfiles(recruiterUrls);

        // Display results
        console.log('\n=== SCRAPED PROFILES ===');
        profiles.forEach((profile, index) => {
            console.log(`\n${index + 1}. ${profile.name}`);
            console.log(`   Headline: ${profile.headline}`);
            console.log(`   Company: ${profile.company}`);
            console.log(`   Location: ${profile.location || 'Not specified'}`);
            console.log(`   Connections: ${profile.connections || 'Not specified'}`);
            console.log(`   Profile URL: ${profile.profileUrl}`);
            if (profile.about) {
                console.log(`   About: ${profile.about.substring(0, 100)}...`);
            }
            if (profile.experience && profile.experience.length > 0) {
                console.log(`   Experience: ${profile.experience.slice(0, 3).join(', ')}`);
            }
        });

        console.log(`\nSuccessfully scraped ${profiles.length} profiles`);

        // Example: Send connection requests
        console.log('\n=== SENDING CONNECTION REQUESTS ===');
        const connectionMessage = "Hi! I'd love to connect and learn more about opportunities in your field.";

        // Check limits before sending
        const limits = linkedinService.getLimitsStatus();
        console.log(`Daily limits: ${JSON.stringify(limits.remaining)}`);

        // Check jail status
        const jailStatus = await linkedinService.getJailStatus();
        if (jailStatus.isJailed) {
            console.log(`⚠️  Account is restricted: ${jailStatus.reason}`);
            if (!jailStatus.canContinue) {
                console.log('Stopping due to account restrictions');
                return;
            }
        }

        // Send connection requests to first 3 profiles as example
        const profilesToConnect = profiles.slice(0, 3).map(profile => ({
            url: profile.profileUrl,
            message: connectionMessage
        }));

        console.log(`Sending connection requests to ${profilesToConnect.length} profiles...`);
        const connectionResults = await linkedinService.sendBulkConnectionRequests(profilesToConnect);

        const successCount = connectionResults.filter(r => r.success).length;
        console.log(`\nConnection requests completed: ${successCount}/${connectionResults.length} successful`);

        connectionResults.forEach((result, index) => {
            if (result.success) {
                console.log(`✓ ${index + 1}. ${result.profileUrl} - ${result.message}`);
            } else {
                console.log(`✗ ${index + 1}. ${result.profileUrl} - ${result.error}`);
            }
        });

    } catch (error) {
        console.error('Error during LinkedIn automation:', error);
    } finally {
        // Always close the browser
        await linkedinService.close();
    }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
    linkedinAutomationExample().catch(console.error);
}

export { linkedinAutomationExample };
