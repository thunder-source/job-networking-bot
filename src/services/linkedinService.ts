import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import { LimitTracker, LimitConfig } from './limitTracker.js';
import { SmartTiming, TimeSlot } from '../utils/timing.js';

export interface LinkedInCredentials {
    email: string;
    password: string;
}

export interface SearchFilters {
    location?: string;
    industry?: string;
    company?: string;
    keywords?: string;
    maxResults?: number;
}

export interface RecruiterProfile {
    name: string;
    headline: string;
    company: string;
    about: string;
    location?: string;
    profileUrl: string;
    connections?: string;
    experience?: string[];
}

export interface LinkedInServiceConfig {
    headless?: boolean;
    userDataDir?: string;
    cookiesPath?: string;
    timeout?: number;
    retryAttempts?: number;
    limits?: LimitConfig;
    timeSlot?: TimeSlot;
    enableLogging?: boolean;
}

export interface ConnectionRequestResult {
    success: boolean;
    message?: string;
    error?: string;
    profileUrl: string;
    timestamp: string;
}

export interface JailDetectionResult {
    isJailed: boolean;
    reason?: string;
    restrictions?: string[];
    canContinue: boolean;
}

export class LinkedInService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private config: LinkedInServiceConfig;
    private isLoggedIn: boolean = false;
    private limitTracker: LimitTracker;
    private smartTiming: SmartTiming;

    constructor(config: LinkedInServiceConfig = {}) {
        this.config = {
            headless: false, // Set to true for production
            userDataDir: path.join(process.cwd(), 'linkedin-data'),
            cookiesPath: path.join(process.cwd(), 'linkedin-cookies.json'),
            timeout: 30000,
            retryAttempts: 3,
            enableLogging: true,
            limits: {
                maxConnectionRequests: 20,
                maxMessages: 10,
                maxProfileViews: 50,
                resetTime: '00:00',
                timezone: 'America/New_York'
            },
            timeSlot: {
                startHour: 9,
                endHour: 18,
                timezone: 'America/New_York'
            },
            ...config
        };

        // Initialize limit tracker and smart timing
        this.limitTracker = new LimitTracker(this.config.limits!);
        this.smartTiming = new SmartTiming(this.config.timeSlot!);

        if (this.config.enableLogging) {
            logger.info('LinkedInService initialized', { config: this.config });
        }
    }

    /**
     * Initialize the browser and context
     */
    private async initializeBrowser(): Promise<void> {
        try {
            this.browser = await chromium.launch({
                headless: this.config.headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.context = await this.browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'en-US',
                timezoneId: 'America/New_York'
            });

            this.page = await this.context.newPage();

            // Set additional stealth measures
            await this.page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });

        } catch (error) {
            throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Generate random delay between 2-5 seconds
     */
    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Save cookies to file for session persistence
     */
    private async saveCookies(): Promise<void> {
        if (!this.context) return;

        try {
            const cookies = await this.context.cookies();
            await fs.promises.writeFile(
                this.config.cookiesPath!,
                JSON.stringify(cookies, null, 2)
            );
        } catch (error) {
            console.warn('Failed to save cookies:', error);
        }
    }

    /**
     * Load cookies from file for session persistence
     */
    private async loadCookies(): Promise<boolean> {
        if (!this.context || !fs.existsSync(this.config.cookiesPath!)) {
            return false;
        }

        try {
            const cookiesData = await fs.promises.readFile(this.config.cookiesPath!, 'utf8');
            const cookies = JSON.parse(cookiesData);
            await this.context.addCookies(cookies);
            return true;
        } catch (error) {
            console.warn('Failed to load cookies:', error);
            return false;
        }
    }

    /**
     * Check if user is already logged in
     */
    private async checkLoginStatus(): Promise<boolean> {
        if (!this.page) return false;

        try {
            await this.page.goto('https://www.linkedin.com/feed/', {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });

            // Check for login indicators
            const isLoggedIn = await this.page.evaluate(() => {
                return !document.querySelector('[data-test-id="sign-in-form"]') &&
                    !document.querySelector('.login-form') &&
                    document.querySelector('[data-generated-suggestion-target]') !== null;
            });

            return isLoggedIn;
        } catch (error) {
            return false;
        }
    }

    /**
     * Login to LinkedIn with 2FA support
     */
    async login(credentials: LinkedInCredentials): Promise<boolean> {
        if (!this.browser) {
            await this.initializeBrowser();
        }

        if (!this.page) {
            throw new Error('Page not initialized');
        }

        try {
            // Try to load existing session first
            const cookiesLoaded = await this.loadCookies();
            if (cookiesLoaded) {
                const isLoggedIn = await this.checkLoginStatus();
                if (isLoggedIn) {
                    this.isLoggedIn = true;
                    console.log('Successfully loaded existing session');
                    return true;
                }
            }

            // Navigate to login page
            await this.page.goto('https://www.linkedin.com/login', {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });

            await this.randomDelay();

            // Fill in email
            await this.page.fill('#username', credentials.email);
            await this.randomDelay();

            // Fill in password
            await this.page.fill('#password', credentials.password);
            await this.randomDelay();

            // Click login button
            await this.page.click('button[type="submit"]');
            await this.randomDelay();

            // Wait for page to load and check for 2FA
            await this.page.waitForLoadState('networkidle', { timeout: this.config.timeout });

            // Check if 2FA is required
            const is2FARequired = await this.page.evaluate(() => {
                return document.querySelector('input[name="pin"]') !== null ||
                    document.querySelector('input[placeholder*="code"]') !== null ||
                    document.querySelector('input[placeholder*="verification"]') !== null;
            });

            if (is2FARequired) {
                console.log('2FA required. Please check your phone/email for the verification code.');
                console.log('Waiting for you to manually enter the 2FA code...');

                // Wait for user to manually enter 2FA code
                await this.page.waitForFunction(() => {
                    return !document.querySelector('input[name="pin"]') &&
                        !document.querySelector('input[placeholder*="code"]') &&
                        !document.querySelector('input[placeholder*="verification"]');
                }, { timeout: 300000 }); // 5 minutes timeout for manual 2FA entry

                await this.randomDelay();
            }

            // Check if login was successful
            const loginSuccess = await this.checkLoginStatus();

            if (loginSuccess) {
                this.isLoggedIn = true;
                await this.saveCookies();
                console.log('Successfully logged in to LinkedIn');
                return true;
            } else {
                throw new Error('Login failed - please check your credentials');
            }

        } catch (error) {
            throw new Error(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Search for recruiters with filters
     */
    async searchRecruiters(filters: SearchFilters): Promise<string[]> {
        if (!this.isLoggedIn || !this.page) {
            throw new Error('Not logged in. Please login first.');
        }

        try {
            const maxResults = filters.maxResults || 50;
            const profileUrls: string[] = [];

            // Build search URL
            let searchUrl = 'https://www.linkedin.com/search/results/people/?';
            const params = new URLSearchParams();

            params.append('keywords', filters.keywords || 'recruiter');
            if (filters.location) params.append('geoUrn', `["${filters.location}"]`);
            if (filters.industry) params.append('industry', filters.industry);
            if (filters.company) params.append('currentCompany', `["${filters.company}"]`);

            searchUrl += params.toString();

            console.log(`Searching for recruiters: ${searchUrl}`);
            await this.page.goto(searchUrl, {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });

            await this.randomDelay();

            // Scroll and collect profile URLs
            let collected = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 10;

            while (collected < maxResults && scrollAttempts < maxScrollAttempts) {
                // Extract profile URLs from current page
                const urls = await this.page.evaluate(() => {
                    const profileElements = document.querySelectorAll('a[href*="/in/"]');
                    const urls: string[] = [];

                    profileElements.forEach(element => {
                        const href = element.getAttribute('href');
                        if (href && href.includes('/in/') && !href.includes('/search/')) {
                            const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
                            if (!urls.includes(fullUrl)) {
                                urls.push(fullUrl);
                            }
                        }
                    });

                    return urls;
                });

                // Add new URLs to our collection
                urls.forEach(url => {
                    if (!profileUrls.includes(url) && collected < maxResults) {
                        profileUrls.push(url);
                        collected++;
                    }
                });

                // Scroll down to load more results
                await this.page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });

                await this.randomDelay();
                scrollAttempts++;
            }

            console.log(`Found ${profileUrls.length} recruiter profiles`);
            return profileUrls;

        } catch (error) {
            throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Scrape recruiter profile information
     */
    async scrapeProfile(profileUrl: string): Promise<RecruiterProfile | null> {
        if (!this.isLoggedIn || !this.page) {
            throw new Error('Not logged in. Please login first.');
        }

        try {
            console.log(`Scraping profile: ${profileUrl}`);

            await this.page.goto(profileUrl, {
                waitUntil: 'networkidle',
                timeout: this.config.timeout
            });

            await this.randomDelay();

            // Extract profile information
            const profileData = await this.page.evaluate(() => {
                const getTextContent = (selector: string): string => {
                    const element = document.querySelector(selector);
                    return element ? element.textContent?.trim() || '' : '';
                };

                const name = getTextContent('h1.text-heading-xlarge') ||
                    getTextContent('.pv-text-details__left-panel h1') ||
                    getTextContent('[data-generated-suggestion-target] h1');

                const headline = getTextContent('.text-body-medium.break-words') ||
                    getTextContent('.pv-text-details__left-panel .text-body-medium') ||
                    getTextContent('[data-generated-suggestion-target] .text-body-medium');

                const company = getTextContent('.pv-text-details__left-panel .pv-text-details__left-panel--with-top-margin .text-body-small') ||
                    getTextContent('[data-generated-suggestion-target] .text-body-small');

                const about = getTextContent('#about') ||
                    getTextContent('.pv-about-section .pv-about__summary-text') ||
                    getTextContent('[data-generated-suggestion-target] .pv-about__summary-text');

                const location = getTextContent('.pv-text-details__left-panel .text-body-small.inline.t-black--light.break-words') ||
                    getTextContent('[data-generated-suggestion-target] .text-body-small');

                const connections = getTextContent('.pv-top-card--list-bullet .pv-top-card--list-bullet .t-bold') ||
                    getTextContent('[data-generated-suggestion-target] .t-bold');

                // Extract experience
                const experienceElements = document.querySelectorAll('.pv-entity__summary-info h3, .pv-entity__summary-info .pv-entity__secondary-title');
                const experience: string[] = [];
                experienceElements.forEach(element => {
                    const text = element.textContent?.trim();
                    if (text) experience.push(text);
                });

                return {
                    name,
                    headline,
                    company,
                    about,
                    location,
                    connections,
                    experience,
                    profileUrl: window.location.href
                };
            });

            // Validate that we got meaningful data
            if (!profileData.name || profileData.name.length < 2) {
                console.warn(`Failed to extract meaningful data from ${profileUrl}`);
                return null;
            }

            console.log(`Successfully scraped profile: ${profileData.name}`);
            return profileData;

        } catch (error) {
            console.error(`Failed to scrape profile ${profileUrl}:`, error);
            return null;
        }
    }

    /**
     * Scrape multiple profiles with error handling and rate limiting
     */
    async scrapeProfiles(profileUrls: string[]): Promise<RecruiterProfile[]> {
        const profiles: RecruiterProfile[] = [];
        const errors: string[] = [];

        for (let i = 0; i < profileUrls.length; i++) {
            const url = profileUrls[i];

            try {
                console.log(`Scraping profile ${i + 1}/${profileUrls.length}`);

                const profile = await this.scrapeProfile(url);
                if (profile) {
                    profiles.push(profile);
                }

                // Add delay between profiles to avoid rate limiting
                if (i < profileUrls.length - 1) {
                    await this.randomDelay();
                }

            } catch (error) {
                const errorMsg = `Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error(errorMsg);
                errors.push(errorMsg);

                // If we hit too many errors, take a longer break
                if (errors.length > 5) {
                    console.log('Too many errors, taking a longer break...');
                    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 second break
                }
            }
        }

        if (errors.length > 0) {
            console.warn(`Encountered ${errors.length} errors during scraping:`, errors);
        }

        return profiles;
    }

    /**
     * Detect if LinkedIn has restricted the account (jail detection)
     */
    private async detectJailStatus(): Promise<JailDetectionResult> {
        if (!this.page) {
            return { isJailed: false, canContinue: true };
        }

        try {
            // Check for common jail indicators
            const jailIndicators = await this.page.evaluate(() => {
                const indicators = {
                    isJailed: false,
                    reason: '',
                    restrictions: [] as string[]
                };

                // Check for warning messages
                const warningSelectors = [
                    '[data-test-id="warning-message"]',
                    '.warning-message',
                    '.alert-warning',
                    '.restriction-notice',
                    '[class*="warning"]',
                    '[class*="restriction"]'
                ];

                for (const selector of warningSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent) {
                        indicators.isJailed = true;
                        indicators.reason = element.textContent.trim();
                        indicators.restrictions.push('Warning message detected');
                        break;
                    }
                }

                // Check for rate limiting messages
                const rateLimitSelectors = [
                    '[data-test-id="rate-limit"]',
                    '.rate-limit-message',
                    '[class*="rate-limit"]',
                    '[class*="too-many"]'
                ];

                for (const selector of rateLimitSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent) {
                        indicators.isJailed = true;
                        indicators.reason = element.textContent.trim();
                        indicators.restrictions.push('Rate limiting detected');
                        break;
                    }
                }

                // Check for account restrictions
                const restrictionSelectors = [
                    '[data-test-id="account-restricted"]',
                    '.account-restricted',
                    '[class*="restricted"]',
                    '[class*="suspended"]'
                ];

                for (const selector of restrictionSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent) {
                        indicators.isJailed = true;
                        indicators.reason = element.textContent.trim();
                        indicators.restrictions.push('Account restriction detected');
                        break;
                    }
                }

                // Check if we're redirected to a restriction page
                const currentUrl = window.location.href;
                if (currentUrl.includes('restricted') ||
                    currentUrl.includes('suspended') ||
                    currentUrl.includes('warning') ||
                    currentUrl.includes('rate-limit')) {
                    indicators.isJailed = true;
                    indicators.reason = 'Redirected to restriction page';
                    indicators.restrictions.push('Page redirect detected');
                }

                return indicators;
            });

            const canContinue = !jailIndicators.isJailed ||
                (jailIndicators.restrictions.includes('Rate limiting detected') &&
                    jailIndicators.restrictions.length === 1);

            if (jailIndicators.isJailed) {
                logger.warn('LinkedIn jail detected', jailIndicators);
            }

            return {
                isJailed: jailIndicators.isJailed,
                reason: jailIndicators.reason,
                restrictions: jailIndicators.restrictions,
                canContinue
            };

        } catch (error) {
            logger.error('Error detecting jail status', { error });
            return { isJailed: false, canContinue: true };
        }
    }

    /**
     * Send a connection request to a LinkedIn profile
     */
    async sendConnectionRequest(profileUrl: string, message?: string): Promise<ConnectionRequestResult> {
        if (!this.isLoggedIn || !this.page) {
            throw new Error('Not logged in. Please login first.');
        }

        // Check daily limits
        if (!this.limitTracker.canSendConnectionRequest()) {
            const remaining = this.limitTracker.getRemainingLimits();
            const error = `Daily connection request limit reached. Remaining: ${remaining.connectionRequests}`;
            logger.warn('Connection request blocked by daily limit', { remaining });
            return {
                success: false,
                error,
                profileUrl,
                timestamp: new Date().toISOString()
            };
        }

        // Check jail status
        const jailStatus = await this.detectJailStatus();
        if (jailStatus.isJailed && !jailStatus.canContinue) {
            const error = `LinkedIn jail detected: ${jailStatus.reason}`;
            logger.error('Connection request blocked by jail detection', { jailStatus });
            return {
                success: false,
                error,
                profileUrl,
                timestamp: new Date().toISOString()
            };
        }

        // Check timing
        if (!this.smartTiming.shouldPerformActionNow()) {
            const waitTime = this.smartTiming.getTimeUntilNextAction();
            logger.info('Connection request delayed due to timing', { waitTime });
            await this.smartTiming.waitForOptimalTime();
        }

        const maxRetries = this.config.retryAttempts || 3;
        let lastError: string = '';

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info('Sending connection request', {
                    profileUrl,
                    attempt,
                    maxRetries,
                    hasMessage: !!message
                });

                // Navigate to profile
                await this.page.goto(profileUrl, {
                    waitUntil: 'networkidle',
                    timeout: this.config.timeout
                });

                await this.randomDelay();

                // Look for connect button
                const connectButton = await this.page.waitForSelector(
                    'button[aria-label*="Connect"], button[data-control-name*="connect"], .pvs-profile-actions__action button',
                    { timeout: 10000 }
                ).catch(() => null);

                if (!connectButton) {
                    throw new Error('Connect button not found');
                }

                // Click connect button
                await connectButton.click();
                await this.randomDelay();

                // Handle connection modal
                const addNoteButton = await this.page.waitForSelector(
                    'button[aria-label*="Add a note"], button[data-control-name*="add_note"]',
                    { timeout: 5000 }
                ).catch(() => null);

                if (addNoteButton && message) {
                    await addNoteButton.click();
                    await this.randomDelay();

                    // Add custom message
                    const messageInput = await this.page.waitForSelector(
                        'textarea[name="message"], textarea[placeholder*="message"]',
                        { timeout: 5000 }
                    );

                    if (messageInput) {
                        await messageInput.fill(message);
                        await this.randomDelay();
                    }
                }

                // Send the connection request
                const sendButton = await this.page.waitForSelector(
                    'button[aria-label*="Send"], button[data-control-name*="send"]',
                    { timeout: 5000 }
                );

                if (sendButton) {
                    await sendButton.click();
                    await this.randomDelay();
                }

                // Record the successful connection request
                this.limitTracker.recordConnectionRequest();

                logger.linkedinAction('CONNECTION_REQUEST', profileUrl, true, {
                    message: message || 'No message',
                    attempt
                });

                return {
                    success: true,
                    message: message || 'Connection request sent successfully',
                    profileUrl,
                    timestamp: new Date().toISOString()
                };

            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                logger.error('Connection request failed', {
                    profileUrl,
                    attempt,
                    error: lastError
                });

                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    logger.info('Retrying connection request', {
                        profileUrl,
                        attempt,
                        delayMs: delay
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        logger.linkedinAction('CONNECTION_REQUEST', profileUrl, false, {
            error: lastError,
            attempts: maxRetries
        });

        return {
            success: false,
            error: `Failed after ${maxRetries} attempts: ${lastError}`,
            profileUrl,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Send multiple connection requests with smart timing and limits
     */
    async sendBulkConnectionRequests(
        profiles: Array<{ url: string; message?: string }>
    ): Promise<ConnectionRequestResult[]> {
        const results: ConnectionRequestResult[] = [];
        const remaining = this.limitTracker.getRemainingLimits();

        logger.info('Starting bulk connection requests', {
            totalProfiles: profiles.length,
            remainingRequests: remaining.connectionRequests
        });

        for (let i = 0; i < profiles.length && i < remaining.connectionRequests; i++) {
            const profile = profiles[i];

            // Check if we can still send requests
            if (!this.limitTracker.canSendConnectionRequest()) {
                logger.warn('Daily limit reached, stopping bulk requests', {
                    processed: i,
                    total: profiles.length
                });
                break;
            }

            // Check jail status before each request
            const jailStatus = await this.detectJailStatus();
            if (jailStatus.isJailed && !jailStatus.canContinue) {
                logger.error('Stopping bulk requests due to jail detection', { jailStatus });
                break;
            }

            logger.info('Processing connection request', {
                current: i + 1,
                total: profiles.length,
                profileUrl: profile.url
            });

            const result = await this.sendConnectionRequest(profile.url, profile.message);
            results.push(result);

            // Add delay between requests
            if (i < profiles.length - 1) {
                const delay = Math.floor(Math.random() * 30000) + 60000; // 1-1.5 minutes
                logger.info('Waiting before next request', { delayMs: delay });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        const successCount = results.filter(r => r.success).length;
        logger.info('Bulk connection requests completed', {
            total: results.length,
            successful: successCount,
            failed: results.length - successCount
        });

        return results;
    }

    /**
     * Get current daily limits status
     */
    getLimitsStatus(): { current: any; remaining: any } {
        return {
            current: this.limitTracker.getCurrentLimits(),
            remaining: this.limitTracker.getRemainingLimits()
        };
    }

    /**
     * Check if we're in jail and get status
     */
    async getJailStatus(): Promise<JailDetectionResult> {
        return await this.detectJailStatus();
    }

    /**
     * Close browser and cleanup
     */
    async close(): Promise<void> {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }

            if (this.context) {
                await this.context.close();
                this.context = null;
            }

            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }

            this.isLoggedIn = false;
            console.log('LinkedIn service closed');
        } catch (error) {
            console.error('Error closing browser:', error);
        }
    }

    /**
     * Get current login status
     */
    isLoggedInStatus(): boolean {
        return this.isLoggedIn;
    }
}
