import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import logger from '../utils/winstonLogger.js';
import debugMode from '../utils/debugMode.js';
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
    profileTimeout?: number; // Separate timeout for profile scraping
    loginTimeout?: number; // Separate timeout for login operations
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
            timeout: 60000, // Increased from 30s to 60s
            profileTimeout: 90000, // 90s for profile scraping (most intensive)
            loginTimeout: 45000, // 45s for login operations
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
        const context = debugMode.createContext('linkedin-browser-init');

        try {
            context.log('debug', 'Starting browser initialization');

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

            context.log('debug', 'Browser initialization completed successfully');
            context.complete({ success: true });

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
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
            const cookiesData = JSON.stringify(cookies, null, 2);

            // Ensure directory exists
            const cookiesDir = path.dirname(this.config.cookiesPath!);
            await fs.promises.mkdir(cookiesDir, { recursive: true });

            await fs.promises.writeFile(this.config.cookiesPath!, cookiesData);

            if (this.config.enableLogging) {
                logger.info('Cookies saved successfully', {
                    count: cookies.length,
                    path: this.config.cookiesPath
                });
            }
        } catch (error) {
            const errorMsg = `Failed to save cookies: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.warn(errorMsg);
            logger.error('Cookie save failed', { error: errorMsg });
        }
    }

    /**
     * Load cookies from file for session persistence
     */
    private async loadCookies(): Promise<boolean> {
        if (!fs.existsSync(this.config.cookiesPath!)) {
            if (this.config.enableLogging) {
                logger.info('No cookies file found, will need to login', {
                    path: this.config.cookiesPath
                });
            }
            return false;
        }

        try {
            const cookiesData = await fs.promises.readFile(this.config.cookiesPath!, 'utf8');
            const cookies = JSON.parse(cookiesData);

            // Validate cookies structure
            if (!Array.isArray(cookies) || cookies.length === 0) {
                logger.warn('Invalid cookies file format or empty cookies');
                return false;
            }

            // Filter out expired cookies
            const validCookies = cookies.filter(cookie => {
                if (!cookie.expires) return true; // Session cookies
                return new Date(cookie.expires * 1000) > new Date();
            });

            if (validCookies.length === 0) {
                logger.warn('All cookies have expired');
                return false;
            }

            // Add cookies to the browser context if page is available
            if (this.page && this.browser) {
                await this.page.context().addCookies(validCookies);
            }

            if (this.config.enableLogging) {
                logger.info('Cookies loaded successfully', {
                    total: cookies.length,
                    valid: validCookies.length,
                    expired: cookies.length - validCookies.length
                });
            }

            return true;
        } catch (error) {
            const errorMsg = `Failed to load cookies: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.warn(errorMsg);
            logger.error('Cookie load failed', { error: errorMsg });
            return false;
        }
    }

    /**
     * Check if user is already logged in
     */
    private async checkLoginStatus(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Try multiple URLs to check login status
            const urlsToTry = [
                'https://www.linkedin.com/feed/',
                'https://www.linkedin.com/in/me/',
                'https://www.linkedin.com/mynetwork/'
            ];

            for (const url of urlsToTry) {
                try {
                    await this.page.goto(url, {
                        waitUntil: 'domcontentloaded',
                        timeout: 10000
                    });

                    // Wait a moment for page to load
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check for login indicators
                    const isLoggedIn = await this.page.evaluate(() => {
                        // Check for elements that indicate we're logged in
                        const loggedInIndicators = [
                            document.querySelector('[data-generated-suggestion-target]'),
                            document.querySelector('.global-nav'),
                            document.querySelector('[data-test-id="main-nav"]'),
                            document.querySelector('.feed-container'),
                            document.querySelector('.profile-photo')
                        ];

                        // Check for elements that indicate we're NOT logged in
                        const notLoggedInIndicators = [
                            document.querySelector('[data-test-id="sign-in-form"]'),
                            document.querySelector('.login-form'),
                            document.querySelector('input[name="session_key"]'),
                            document.querySelector('input[name="session_password"]')
                        ];

                        const hasLoggedInIndicator = loggedInIndicators.some(el => el !== null);
                        const hasNotLoggedInIndicator = notLoggedInIndicators.some(el => el !== null);

                        return hasLoggedInIndicator && !hasNotLoggedInIndicator;
                    });

                    if (isLoggedIn) {
                        return true;
                    }
                } catch (error) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Login to LinkedIn with 2FA support
     */
    async login(credentials: LinkedInCredentials): Promise<boolean> {
        const context = debugMode.createContext('linkedin-login');

        try {
            context.log('debug', 'Starting LinkedIn login process');

            if (!this.browser) {
                await this.initializeBrowser();
            }

            if (!this.page) {
                throw new Error('Page not initialized');
            }
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

            // Navigate to login page with retry logic
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    await this.page.goto('https://www.linkedin.com/login', {
                        waitUntil: 'networkidle',
                        timeout: this.config.loginTimeout || this.config.timeout
                    });
                    break; // Success, exit retry loop
                } catch (error) {
                    retryCount++;
                    if (retryCount >= maxRetries) {
                        throw new Error(`Failed to connect to LinkedIn after ${maxRetries} attempts. This might be due to network issues or LinkedIn blocking the connection. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }

                    context.log('warn', `Connection attempt ${retryCount} failed, retrying...`, { error: error instanceof Error ? error.message : 'Unknown error' });
                    await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // Exponential backoff
                }
            }

            await this.randomDelay();

            // Wait for page to be ready and check what's actually on the page
            await this.page.waitForLoadState('domcontentloaded');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Debug: log the current page content
            const pageContent = await this.page.content();
            console.log('Page loaded, looking for login form...');

            // Try multiple selectors for username field
            const usernameSelectors = [
                '#username',
                'input[name="session_key"]',
                'input[type="email"]',
                'input[placeholder*="Email"]',
                'input[placeholder*="email"]',
                'input[aria-label*="Email"]',
                '.login__form input[type="text"]'
            ];

            let usernameField = null;
            for (const selector of usernameSelectors) {
                try {
                    usernameField = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (usernameField) {
                        console.log(`Found username field with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // Continue to next selector
                    continue;
                }
            }

            if (!usernameField) {
                // Take a screenshot for debugging
                await this.page.screenshot({ path: 'linkedin-login-debug.png' });
                throw new Error('Username field not found on login page. Check linkedin-login-debug.png for debugging.');
            }

            // Find which selector worked and use it to fill the field
            let workingSelector = null;
            for (const selector of usernameSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 1000 });
                    workingSelector = selector;
                    break;
                } catch {
                    continue;
                }
            }

            if (workingSelector) {
                await this.page.fill(workingSelector, credentials.email);
            } else {
                throw new Error('Could not find a working selector for username field');
            }
            await this.randomDelay();

            // Try multiple selectors for password field
            const passwordSelectors = [
                '#password',
                'input[name="session_password"]',
                'input[type="password"]',
                'input[placeholder*="Password"]',
                'input[placeholder*="password"]',
                'input[aria-label*="Password"]'
            ];

            let passwordField = null;
            for (const selector of passwordSelectors) {
                try {
                    passwordField = await this.page.waitForSelector(selector, { timeout: 5000 });
                    if (passwordField) {
                        console.log(`Found password field with selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }

            if (!passwordField) {
                throw new Error('Password field not found on login page');
            }

            // Find which selector worked and use it to fill the field
            let workingPasswordSelector = null;
            for (const selector of passwordSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 1000 });
                    workingPasswordSelector = selector;
                    break;
                } catch {
                    continue;
                }
            }

            if (workingPasswordSelector) {
                await this.page.fill(workingPasswordSelector, credentials.password);
            } else {
                throw new Error('Could not find a working selector for password field');
            }
            await this.randomDelay();

            // Click login button with better selector handling
            const loginButton = await this.page.waitForSelector('button[type="submit"], button[data-litms-control-urn*="login-submit"], .login__form_action_container button', { timeout: 10000 });
            if (!loginButton) {
                throw new Error('Login button not found on login page');
            }
            await loginButton.click();
            await this.randomDelay();

            // Wait for page to load with more flexible approach
            try {
                await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
            } catch (error) {
                context.log('warn', 'DOM content loaded timeout, continuing anyway');
            }

            // Give page a moment to fully load
            await this.randomDelay();

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

            // Check if login was successful with multiple attempts
            let loginSuccess = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!loginSuccess && attempts < maxAttempts) {
                attempts++;
                context.log('debug', `Checking login status, attempt ${attempts}/${maxAttempts}`);

                try {
                    loginSuccess = await this.checkLoginStatus();
                    if (loginSuccess) {
                        break;
                    } else {
                        context.log('warn', `Login check failed, attempt ${attempts}/${maxAttempts}`);
                        if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
                        }
                    }
                } catch (error) {
                    context.log('warn', `Login check error on attempt ${attempts}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }
            }

            if (loginSuccess) {
                this.isLoggedIn = true;
                await this.saveCookies();
                console.log('Successfully logged in to LinkedIn');
                context.log('info', 'Login successful');
                context.complete({ success: true });
                return true;
            } else {
                // Try to get more information about what went wrong
                const currentUrl = await this.page.url();
                const pageTitle = await this.page.title();
                context.log('error', 'Login failed after multiple attempts', {
                    currentUrl,
                    pageTitle,
                    attempts
                });
                throw new Error(`Login failed after ${maxAttempts} attempts. Current URL: ${currentUrl}, Page Title: ${pageTitle}. Please check your credentials and try again.`);
            }

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
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

            // Try with networkidle first, fallback to domcontentloaded if it times out
            try {
                await this.page.goto(profileUrl, {
                    waitUntil: 'networkidle',
                    timeout: this.config.profileTimeout || this.config.timeout
                });
            } catch (networkIdleError) {
                console.log(`Networkidle timeout for ${profileUrl}, trying domcontentloaded...`);
                try {
                    await this.page.goto(profileUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 // Shorter timeout for fallback
                    });
                    // Wait a bit more for dynamic content
                    await this.page.waitForTimeout(3000);
                } catch (domError) {
                    console.log(`DOM content loaded timeout for ${profileUrl}, trying basic load...`);
                    await this.page.goto(profileUrl, {
                        waitUntil: 'load',
                        timeout: 15000 // Even shorter timeout for basic load
                    });
                    await this.page.waitForTimeout(5000);
                }
            }

            await this.randomDelay();

            // Extract profile information using text-based approach
            const profileData = await this.page.evaluate(() => {
                const bodyText = document.body.textContent || '';

                // Extract name - look for the pattern after navigation elements
                let name = '';
                // Look for name pattern after "Try Premium" or before job titles
                const nameMatch = bodyText.match(/(?:Try Premium for ₹\d+)([^·\n]*?)([A-Z][a-z]+ [A-Z][a-z]+)(?=Corporate|Senior|Lead|Manager|Director|Specialist|Recruiter|Talent|HR|Human|Resources|Developer|Engineer|Designer|Analyst|Consultant|Coordinator|Executive|Officer|Assistant|Associate|Head|Chief|VP|Vice|President|CEO|CTO|CFO|COO|Founder|Owner|Freelancer|Contractor|Student|Graduate|Intern|Trainee|Apprentice|Volunteer|Self-employed|Unemployed|Retired|Looking|Available|Open|Seeking|Searching|Job|Work|Career|Professional|Business|Entrepreneur|Startup)/);
                if (nameMatch && nameMatch[2]) {
                    name = nameMatch[2].trim();
                } else {
                    // Fallback: look for any name pattern, but exclude common navigation terms
                    const fallbackMatch = bodyText.match(/([A-Z][a-z]+ [A-Z][a-z]+)(?=Corporate|Senior|Lead|Manager|Director|Specialist|Recruiter|Talent|HR|Human|Resources|Developer|Engineer|Designer|Analyst|Consultant|Coordinator|Executive|Officer|Assistant|Associate|Head|Chief|VP|Vice|President|CEO|CTO|CFO|COO|Founder|Owner|Freelancer|Contractor|Student|Graduate|Intern|Trainee|Apprentice|Volunteer|Self-employed|Unemployed|Retired|Looking|Available|Open|Seeking|Searching|Job|Work|Career|Professional|Business|Entrepreneur|Startup)/);
                    if (fallbackMatch && !['My Network', 'Skip Main', 'For Business', 'Try Premium'].includes(fallbackMatch[1])) {
                        name = fallbackMatch[1].trim();
                    }
                }

                // Extract headline - look for job title patterns
                let headline = '';
                const headlineMatch = bodyText.match(/(Corporate|Senior|Lead|Manager|Director|Specialist|Recruiter|Talent|HR|Human|Resources|Developer|Engineer|Designer|Analyst|Consultant|Coordinator|Executive|Officer|Assistant|Associate|Head|Chief|VP|Vice|President|CEO|CTO|CFO|COO|Founder|Owner|Freelancer|Contractor|Student|Graduate|Intern|Trainee|Apprentice|Volunteer|Self-employed|Unemployed|Retired|Looking|Available|Open|Seeking|Searching|Job|Work|Career|Professional|Business|Entrepreneur|Startup)[^·\n]*/);
                if (headlineMatch) {
                    headline = headlineMatch[0].trim();
                }

                // Extract company - look for company names after the headline
                let company = '';
                const companyMatch = bodyText.match(/(?:at|@|·)\s*([A-Z][^·\n]*?)(?:\s*·|\s*\||\s*$|\s*\n)/);
                if (companyMatch) {
                    company = companyMatch[1].trim();
                }

                // Extract location - look for location patterns like "Bhopal, Madhya Pradesh, India"
                let location = '';
                const locationMatch = bodyText.match(/([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/);
                if (locationMatch) {
                    location = locationMatch[1].trim();
                }

                // Extract connections - look for connection count like "500+connections"
                let connections = '';
                const connectionsMatch = bodyText.match(/(\d+)\+?\s*connections?/i);
                if (connectionsMatch) {
                    connections = connectionsMatch[1] + '+ connections';
                }

                // Extract about section - look for "About" section
                let about = '';
                const aboutMatch = bodyText.match(/About[^·\n]*(?:I am|I'm|I have|I work|I specialize|I focus|I help|I provide|I offer|I create|I build|I develop|I design|I manage|I lead|I coordinate|I organize|I plan|I execute|I implement|I deliver|I achieve|I accomplish|I succeed|I excel|I thrive|I grow|I learn|I improve|I enhance|I optimize|I streamline|I automate|I innovate)[^·\n]*/i);
                if (aboutMatch) {
                    about = aboutMatch[0].trim();
                }

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

            // Enhanced validation with better error reporting
            console.log('Extracted profile data:', {
                name: profileData.name,
                headline: profileData.headline,
                company: profileData.company,
                location: profileData.location,
                hasAbout: !!profileData.about,
                experienceCount: profileData.experience.length,
                connections: profileData.connections
            });

            // More flexible validation - accept profile if we have at least name OR headline
            if (!profileData.name || profileData.name.length < 2) {
                if (!profileData.headline || profileData.headline.length < 2) {
                    console.warn(`Failed to extract meaningful data from ${profileUrl}`);
                    return null;
                } else {
                    // If we have headline but no name, try to extract name from headline or use a fallback
                    console.warn(`No name found, but headline available: ${profileData.headline}`);
                    profileData.name = profileData.headline.split(' at ')[0] || profileData.headline.split(' | ')[0] || 'Unknown';
                }
            }

            console.log(`Successfully scraped profile: ${profileData.name}`);
            return profileData;

        } catch (error) {
            console.error(`Failed to scrape profile ${profileUrl}:`, error);

            // If it's a timeout error, try to recover the page
            if (error instanceof Error && error.message.includes('Timeout')) {
                console.log('Attempting page recovery due to timeout...');
                try {
                    // Try to reload the page
                    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
                    await this.page.waitForTimeout(2000);
                    console.log('Page recovered successfully');
                } catch (recoveryError) {
                    console.warn('Page recovery failed:', recoveryError);
                }
            }

            return null;
        }
    }

    /**
     * Check if the current page is responsive
     */
    private async isPageResponsive(): Promise<boolean> {
        if (!this.page) return false;

        try {
            // Try to get the page title as a quick responsiveness test
            await this.page.title();
            return true;
        } catch (error) {
            console.warn('Page appears unresponsive:', error);
            return false;
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

            // Retry logic for individual profile scraping
            let profile = null;
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries && !profile) {
                try {
                    if (retryCount > 0) {
                        console.log(`Retrying profile ${i + 1}/${profileUrls.length} (attempt ${retryCount + 1}/${maxRetries + 1})`);
                        // Longer delay on retry
                        await new Promise(resolve => setTimeout(resolve, 10000));
                    } else {
                        console.log(`Scraping profile ${i + 1}/${profileUrls.length}`);
                    }

                    // Check if page is responsive before attempting to scrape
                    const isResponsive = await this.isPageResponsive();
                    if (!isResponsive) {
                        console.log('Page appears unresponsive, attempting to recover...');
                        try {
                            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
                            await this.page.waitForTimeout(3000);
                        } catch (reloadError) {
                            console.warn('Failed to reload page:', reloadError);
                        }
                    }

                    profile = await this.scrapeProfile(url);

                    if (profile) {
                        profiles.push(profile);
                        console.log(`✅ Successfully scraped profile: ${profile.name}`);
                        break;
                    } else if (retryCount < maxRetries) {
                        console.log(`⚠️  No data extracted, retrying...`);
                    }

                } catch (error) {
                    retryCount++;
                    const errorMsg = `Failed to scrape ${url} (attempt ${retryCount}/${maxRetries + 1}): ${error instanceof Error ? error.message : 'Unknown error'}`;

                    if (retryCount <= maxRetries) {
                        console.warn(`⚠️  ${errorMsg} - retrying...`);
                        // Progressive delay on retries
                        await new Promise(resolve => setTimeout(resolve, 15000 * retryCount));
                    } else {
                        console.error(`❌ ${errorMsg} - giving up`);
                        errors.push(errorMsg);
                    }
                }
            }

            // Add delay between profiles to avoid rate limiting
            if (i < profileUrls.length - 1) {
                await this.randomDelay();
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

                // Save cookies every 5 requests to maintain session
                if ((i + 1) % 5 === 0) {
                    await this.refreshCookies();
                }
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
            // Save cookies before closing if we're logged in
            if (this.isLoggedIn && this.context) {
                await this.saveCookies();
                console.log('Session cookies saved before closing');
            }

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
            logger.error('Error during service close', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }

    /**
     * Get current login status
     */
    isLoggedInStatus(): boolean {
        return this.isLoggedIn;
    }

    /**
     * Manually save cookies (useful for long-running operations)
     */
    async refreshCookies(): Promise<void> {
        if (this.isLoggedIn && this.context) {
            await this.saveCookies();
            console.log('Cookies refreshed manually');
        }
    }

    /**
     * Check if cookies file exists and is valid
     */
    hasValidCookies(): boolean {
        if (!fs.existsSync(this.config.cookiesPath!)) {
            return false;
        }

        try {
            const cookiesData = fs.readFileSync(this.config.cookiesPath!, 'utf8');
            const cookies = JSON.parse(cookiesData);

            if (!Array.isArray(cookies) || cookies.length === 0) {
                return false;
            }

            // Check if we have any valid (non-expired) cookies
            const validCookies = cookies.filter(cookie => {
                if (!cookie.expires) return true; // Session cookies
                return new Date(cookie.expires * 1000) > new Date();
            });

            return validCookies.length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear stored cookies (useful for forcing re-login)
     */
    async clearCookies(): Promise<void> {
        try {
            if (fs.existsSync(this.config.cookiesPath!)) {
                await fs.promises.unlink(this.config.cookiesPath!);
                console.log('Stored cookies cleared');
                logger.info('Cookies cleared manually');
            }
        } catch (error) {
            console.warn('Failed to clear cookies:', error);
            logger.error('Failed to clear cookies', { error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }
}
