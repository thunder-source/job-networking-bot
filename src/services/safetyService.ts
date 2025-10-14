import { logger } from '../utils/logger.js';
import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface SafetyConfig {
    rejectionRateThreshold: number; // Default: 30%
    maxActionsPerHour: number;
    maxActionsPerDay: number;
    lunchBreakEnabled: boolean;
    lunchBreakStart: string; // Format: "HH:MM"
    lunchBreakEnd: string;
    weekendReductionEnabled: boolean;
    weekendActivityMultiplier: number; // Default: 0.5 (50%)
    timezone: string;
    enableHumanBehavior: boolean;
    randomDelayMin: number; // milliseconds
    randomDelayMax: number;
    profileViewProbability: number; // 0-1, probability of viewing random profiles
    scrollProbability: number; // 0-1, probability of scrolling behavior
    alertEmail?: string;
    alertWebhook?: string;
}

export interface SafetyMetrics {
    totalActions: number;
    rejectedActions: number;
    rejectionRate: number;
    currentHourlyCount: number;
    currentDailyCount: number;
    lastActionTime: Date;
    jailDetected: boolean;
    jailReason?: string;
    captchaDetected: boolean;
    lastCaptchaTime?: Date;
    accountRestricted: boolean;
    restrictionReason?: string;
}

export interface SafetyAlert {
    type: 'warning' | 'critical' | 'info';
    message: string;
    timestamp: Date;
    data?: any;
    requiresAction: boolean;
}

export interface HumanBehaviorAction {
    type: 'profile_view' | 'scroll' | 'browse' | 'pause';
    duration: number;
    description: string;
}

export class SafetyService {
    private config: SafetyConfig;
    private metrics: SafetyMetrics;
    private alerts: SafetyAlert[] = [];
    private dataFilePath: string;
    private hourlyActionCounts: Map<string, number> = new Map();
    private dailyActionCounts: Map<string, number> = new Map();
    private isLunchBreak: boolean = false;
    private isWeekend: boolean = false;

    constructor(config: Partial<SafetyConfig> = {}) {
        this.config = {
            rejectionRateThreshold: 30,
            maxActionsPerHour: 20,
            maxActionsPerDay: 100,
            lunchBreakEnabled: true,
            lunchBreakStart: "12:00",
            lunchBreakEnd: "13:00",
            weekendReductionEnabled: true,
            weekendActivityMultiplier: 0.5,
            timezone: 'America/New_York',
            enableHumanBehavior: true,
            randomDelayMin: 2000,
            randomDelayMax: 8000,
            profileViewProbability: 0.3,
            scrollProbability: 0.4,
            ...config
        };

        this.dataFilePath = path.join(process.cwd(), 'safety-data.json');

        this.metrics = {
            totalActions: 0,
            rejectedActions: 0,
            rejectionRate: 0,
            currentHourlyCount: 0,
            currentDailyCount: 0,
            lastActionTime: new Date(),
            jailDetected: false,
            captchaDetected: false,
            accountRestricted: false
        };

        this.loadSafetyData();
        this.updateTimeBasedFlags();
        this.startPeriodicTasks();

        logger.info('SafetyService initialized', { config: this.config });
    }

    /**
     * Monitor for LinkedIn restrictions and warnings
     */
    async monitorRestrictions(page: Page): Promise<SafetyAlert[]> {
        const newAlerts: SafetyAlert[] = [];

        try {
            // Check for warning messages
            const warningElements = await page.$$eval(
                '[data-test-id="warning-message"], .warning-message, .alert-warning, .restriction-notice, [class*="warning"], [class*="restriction"]',
                elements => elements.map(el => el.textContent?.trim()).filter(text => text)
            );

            if (warningElements.length > 0) {
                const alert: SafetyAlert = {
                    type: 'critical',
                    message: `LinkedIn warning detected: ${warningElements[0]}`,
                    timestamp: new Date(),
                    data: { warnings: warningElements },
                    requiresAction: true
                };
                newAlerts.push(alert);
                this.metrics.jailDetected = true;
                this.metrics.jailReason = warningElements[0];
                logger.warn('LinkedIn warning detected', { warnings: warningElements });
            }

            // Check for rate limiting messages
            const rateLimitElements = await page.$$eval(
                '[data-test-id="rate-limit"], .rate-limit-message, [class*="rate-limit"], [class*="too-many"]',
                elements => elements.map(el => el.textContent?.trim()).filter(text => text)
            );

            if (rateLimitElements.length > 0) {
                const alert: SafetyAlert = {
                    type: 'warning',
                    message: `Rate limiting detected: ${rateLimitElements[0]}`,
                    timestamp: new Date(),
                    data: { rateLimits: rateLimitElements },
                    requiresAction: true
                };
                newAlerts.push(alert);
                logger.warn('Rate limiting detected', { rateLimits: rateLimitElements });
            }

            // Check for account restrictions
            const restrictionElements = await page.$$eval(
                '[data-test-id="account-restricted"], .account-restricted, [class*="restricted"], [class*="suspended"]',
                elements => elements.map(el => el.textContent?.trim()).filter(text => text)
            );

            if (restrictionElements.length > 0) {
                const alert: SafetyAlert = {
                    type: 'critical',
                    message: `Account restriction detected: ${restrictionElements[0]}`,
                    timestamp: new Date(),
                    data: { restrictions: restrictionElements },
                    requiresAction: true
                };
                newAlerts.push(alert);
                this.metrics.accountRestricted = true;
                this.metrics.restrictionReason = restrictionElements[0];
                logger.error('Account restriction detected', { restrictions: restrictionElements });
            }

            // Check URL for restriction indicators
            const currentUrl = page.url();
            if (currentUrl.includes('restricted') ||
                currentUrl.includes('suspended') ||
                currentUrl.includes('warning') ||
                currentUrl.includes('rate-limit')) {
                const alert: SafetyAlert = {
                    type: 'critical',
                    message: `Redirected to restriction page: ${currentUrl}`,
                    timestamp: new Date(),
                    data: { url: currentUrl },
                    requiresAction: true
                };
                newAlerts.push(alert);
                this.metrics.jailDetected = true;
                logger.error('Redirected to restriction page', { url: currentUrl });
            }

        } catch (error) {
            logger.error('Error monitoring restrictions', { error });
        }

        // Add new alerts to the list
        this.alerts.push(...newAlerts);
        return newAlerts;
    }

    /**
     * Detect CAPTCHA challenges
     */
    async detectCaptcha(page: Page): Promise<boolean> {
        try {
            const captchaSelectors = [
                'iframe[src*="captcha"]',
                '.captcha',
                '[data-test-id="captcha"]',
                '#captcha',
                '.recaptcha',
                '[class*="captcha"]',
                'iframe[title*="captcha"]'
            ];

            for (const selector of captchaSelectors) {
                const element = await page.$(selector);
                if (element) {
                    this.metrics.captchaDetected = true;
                    this.metrics.lastCaptchaTime = new Date();

                    const alert: SafetyAlert = {
                        type: 'warning',
                        message: 'CAPTCHA challenge detected',
                        timestamp: new Date(),
                        data: { selector, url: page.url() },
                        requiresAction: true
                    };
                    this.alerts.push(alert);

                    logger.warn('CAPTCHA detected', { selector, url: page.url() });
                    return true;
                }
            }

            // Check for CAPTCHA in page content
            const captchaText = await page.evaluate(() => {
                const text = document.body.textContent?.toLowerCase() || '';
                return text.includes('captcha') || text.includes('verify') || text.includes('robot');
            });

            if (captchaText) {
                this.metrics.captchaDetected = true;
                this.metrics.lastCaptchaTime = new Date();

                const alert: SafetyAlert = {
                    type: 'warning',
                    message: 'CAPTCHA-related text detected in page',
                    timestamp: new Date(),
                    data: { url: page.url() },
                    requiresAction: true
                };
                this.alerts.push(alert);

                logger.warn('CAPTCHA-related text detected', { url: page.url() });
                return true;
            }

            return false;

        } catch (error) {
            logger.error('Error detecting CAPTCHA', { error });
            return false;
        }
    }

    /**
     * Track rejection rates and slow down if >30%
     */
    recordAction(success: boolean): void {
        this.metrics.totalActions++;

        if (!success) {
            this.metrics.rejectedActions++;
        }

        // Calculate rejection rate
        this.metrics.rejectionRate = (this.metrics.rejectedActions / this.metrics.totalActions) * 100;
        this.metrics.lastActionTime = new Date();

        // Update hourly and daily counts
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

        this.hourlyActionCounts.set(hourKey, (this.hourlyActionCounts.get(hourKey) || 0) + 1);
        this.dailyActionCounts.set(dayKey, (this.dailyActionCounts.get(dayKey) || 0) + 1);

        this.metrics.currentHourlyCount = this.hourlyActionCounts.get(hourKey) || 0;
        this.metrics.currentDailyCount = this.dailyActionCounts.get(dayKey) || 0;

        // Check if rejection rate exceeds threshold
        if (this.metrics.rejectionRate > this.config.rejectionRateThreshold) {
            const alert: SafetyAlert = {
                type: 'critical',
                message: `Rejection rate ${this.metrics.rejectionRate.toFixed(1)}% exceeds threshold of ${this.config.rejectionRateThreshold}%`,
                timestamp: new Date(),
                data: {
                    rejectionRate: this.metrics.rejectionRate,
                    threshold: this.config.rejectionRateThreshold,
                    totalActions: this.metrics.totalActions,
                    rejectedActions: this.metrics.rejectedActions
                },
                requiresAction: true
            };
            this.alerts.push(alert);
            logger.warn('High rejection rate detected', {
                rate: this.metrics.rejectionRate,
                threshold: this.config.rejectionRateThreshold
            });
        }

        this.saveSafetyData();
    }

    /**
     * Check if actions should be slowed down due to high rejection rate
     */
    shouldSlowDown(): boolean {
        return this.metrics.rejectionRate > this.config.rejectionRateThreshold;
    }

    /**
     * Get recommended delay based on rejection rate
     */
    getRecommendedDelay(): number {
        if (this.metrics.rejectionRate <= this.config.rejectionRateThreshold) {
            return this.getRandomDelay();
        }

        // Increase delay based on rejection rate
        const baseDelay = this.getRandomDelay();
        const multiplier = 1 + (this.metrics.rejectionRate / 100);
        return Math.floor(baseDelay * multiplier);
    }

    /**
     * Implement human behavior simulation
     */
    async simulateHumanBehavior(page: Page): Promise<HumanBehaviorAction[]> {
        if (!this.config.enableHumanBehavior) {
            return [];
        }

        const actions: HumanBehaviorAction[] = [];

        try {
            // Random profile views between actions (30% probability)
            if (Math.random() < this.config.profileViewProbability) {
                const profileAction = await this.simulateProfileView(page);
                if (profileAction) {
                    actions.push(profileAction);
                }
            }

            // Occasional scrolling and browsing (40% probability)
            if (Math.random() < this.config.scrollProbability) {
                const scrollAction = await this.simulateScrolling(page);
                if (scrollAction) {
                    actions.push(scrollAction);
                }
            }

            // Random pause (20% probability)
            if (Math.random() < 0.2) {
                const pauseAction = await this.simulateRandomPause();
                actions.push(pauseAction);
            }

        } catch (error) {
            logger.error('Error simulating human behavior', { error });
        }

        return actions;
    }

    /**
     * Simulate viewing random profiles
     */
    private async simulateProfileView(page: Page): Promise<HumanBehaviorAction | null> {
        try {
            // Look for profile links on the current page
            const profileLinks = await page.$$eval(
                'a[href*="/in/"]:not([href*="/search/"])',
                links => links.map(link => link.getAttribute('href')).filter(href => href)
            );

            if (profileLinks.length > 0) {
                const randomProfile = profileLinks[Math.floor(Math.random() * profileLinks.length)];
                const fullUrl = randomProfile!.startsWith('http') ? randomProfile : `https://www.linkedin.com${randomProfile}`;

                await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
                await this.randomDelay(3000, 8000);

                logger.info('Simulated profile view', { url: fullUrl });

                return {
                    type: 'profile_view',
                    duration: 5000,
                    description: `Viewed random profile: ${fullUrl}`
                };
            }

        } catch (error) {
            logger.error('Error simulating profile view', { error });
        }

        return null;
    }

    /**
     * Simulate scrolling behavior
     */
    private async simulateScrolling(page: Page): Promise<HumanBehaviorAction> {
        const scrollSteps = Math.floor(Math.random() * 5) + 3; // 3-7 scroll steps
        const scrollDuration = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds

        for (let i = 0; i < scrollSteps; i++) {
            const scrollAmount = Math.floor(Math.random() * 500) + 200;
            await page.evaluate((amount) => {
                window.scrollBy(0, amount);
            }, scrollAmount);

            await this.randomDelay(500, 1500);
        }

        logger.debug('Simulated scrolling behavior', { steps: scrollSteps, duration: scrollDuration });

        return {
            type: 'scroll',
            duration: scrollDuration,
            description: `Scrolled ${scrollSteps} times with random intervals`
        };
    }

    /**
     * Simulate random pause
     */
    private async simulateRandomPause(): Promise<HumanBehaviorAction> {
        const pauseDuration = Math.floor(Math.random() * 10000) + 5000; // 5-15 seconds
        await this.randomDelay(pauseDuration, pauseDuration);

        logger.debug('Simulated random pause', { duration: pauseDuration });

        return {
            type: 'pause',
            duration: pauseDuration,
            description: `Random pause for ${pauseDuration}ms`
        };
    }

    /**
     * Check if it's lunch break time (12-1 PM)
     */
    isLunchBreakTime(): boolean {
        if (!this.config.lunchBreakEnabled) {
            return false;
        }

        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', {
            hour12: false,
            timeZone: this.config.timezone
        });

        return currentTime >= this.config.lunchBreakStart &&
            currentTime <= this.config.lunchBreakEnd;
    }

    /**
     * Check if it's weekend and apply 50% activity reduction
     */
    isWeekendTime(): boolean {
        if (!this.config.weekendReductionEnabled) {
            return false;
        }

        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        return dayOfWeek === 0 || dayOfWeek === 6;
    }

    /**
     * Get activity multiplier based on time restrictions
     */
    getActivityMultiplier(): number {
        let multiplier = 1.0;

        if (this.isLunchBreakTime()) {
            multiplier = 0; // No activity during lunch break
        }

        if (this.isWeekendTime()) {
            multiplier *= this.config.weekendActivityMultiplier;
        }

        return multiplier;
    }

    /**
     * Check if action should be performed now
     */
    canPerformAction(): { allowed: boolean; reason?: string; waitTime?: number } {
        // Check lunch break
        if (this.isLunchBreakTime()) {
            return {
                allowed: false,
                reason: 'Lunch break (12-1 PM)',
                waitTime: this.getTimeUntilLunchBreakEnd()
            };
        }

        // Check weekend reduction
        if (this.isWeekendTime()) {
            const multiplier = this.getActivityMultiplier();
            if (Math.random() > multiplier) {
                return {
                    allowed: false,
                    reason: `Weekend activity reduction (${(multiplier * 100).toFixed(0)}% chance)`,
                    waitTime: this.getRandomDelay(30000, 120000) // 30s - 2min wait
                };
            }
        }

        // Check hourly limits
        if (this.metrics.currentHourlyCount >= this.config.maxActionsPerHour) {
            return {
                allowed: false,
                reason: 'Hourly action limit reached',
                waitTime: this.getTimeUntilNextHour()
            };
        }

        // Check daily limits
        if (this.metrics.currentDailyCount >= this.config.maxActionsPerDay) {
            return {
                allowed: false,
                reason: 'Daily action limit reached',
                waitTime: this.getTimeUntilNextDay()
            };
        }

        // Check rejection rate
        if (this.shouldSlowDown()) {
            return {
                allowed: true,
                reason: `High rejection rate (${this.metrics.rejectionRate.toFixed(1)}%), will use increased delay`
            };
        }

        return { allowed: true };
    }

    /**
     * Get random delay between actions
     */
    private getRandomDelay(min?: number, max?: number): number {
        const minDelay = min || this.config.randomDelayMin;
        const maxDelay = max || this.config.randomDelayMax;
        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    }

    /**
     * Wait for a random delay
     */
    async randomDelay(min?: number, max?: number): Promise<void> {
        const delay = this.getRandomDelay(min, max);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Alert user if account appears restricted
     */
    async alertUserIfRestricted(): Promise<void> {
        const criticalAlerts = this.alerts.filter(alert =>
            alert.type === 'critical' && alert.requiresAction
        );

        if (criticalAlerts.length > 0) {
            const latestAlert = criticalAlerts[criticalAlerts.length - 1];

            logger.error('CRITICAL SAFETY ALERT', {
                message: latestAlert.message,
                timestamp: latestAlert.timestamp,
                data: latestAlert.data,
                totalCriticalAlerts: criticalAlerts.length
            });

            // Here you could implement email/webhook notifications
            if (this.config.alertEmail) {
                // TODO: Implement email alert
                logger.info('Email alert would be sent', { email: this.config.alertEmail });
            }

            if (this.config.alertWebhook) {
                // TODO: Implement webhook alert
                logger.info('Webhook alert would be sent', { webhook: this.config.alertWebhook });
            }
        }
    }

    /**
     * Get current safety metrics
     */
    getMetrics(): SafetyMetrics {
        return { ...this.metrics };
    }

    /**
     * Get all alerts
     */
    getAlerts(): SafetyAlert[] {
        return [...this.alerts];
    }

    /**
     * Get recent alerts (last 24 hours)
     */
    getRecentAlerts(): SafetyAlert[] {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return this.alerts.filter(alert => alert.timestamp > oneDayAgo);
    }

    /**
     * Clear old alerts (older than 7 days)
     */
    clearOldAlerts(): void {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => alert.timestamp > oneWeekAgo);
    }

    /**
     * Update time-based flags
     */
    private updateTimeBasedFlags(): void {
        this.isLunchBreak = this.isLunchBreakTime();
        this.isWeekend = this.isWeekendTime();
    }

    /**
     * Start periodic tasks
     */
    private startPeriodicTasks(): void {
        // Update time-based flags every minute
        setInterval(() => {
            this.updateTimeBasedFlags();
        }, 60000);

        // Clear old alerts daily
        setInterval(() => {
            this.clearOldAlerts();
        }, 24 * 60 * 60 * 1000);

        // Save data every 5 minutes
        setInterval(() => {
            this.saveSafetyData();
        }, 5 * 60 * 1000);
    }

    /**
     * Load safety data from file
     */
    private loadSafetyData(): void {
        try {
            if (fs.existsSync(this.dataFilePath)) {
                const data = JSON.parse(fs.readFileSync(this.dataFilePath, 'utf8'));
                this.metrics = { ...this.metrics, ...data.metrics };
                this.alerts = data.alerts?.map((alert: any) => ({
                    ...alert,
                    timestamp: new Date(alert.timestamp)
                })) || [];
                this.hourlyActionCounts = new Map(data.hourlyActionCounts || []);
                this.dailyActionCounts = new Map(data.dailyActionCounts || []);

                logger.info('Safety data loaded', {
                    totalActions: this.metrics.totalActions,
                    alertsCount: this.alerts.length
                });
            }
        } catch (error) {
            logger.error('Error loading safety data', { error });
        }
    }

    /**
     * Save safety data to file
     */
    private saveSafetyData(): void {
        try {
            const data = {
                metrics: this.metrics,
                alerts: this.alerts,
                hourlyActionCounts: Array.from(this.hourlyActionCounts.entries()),
                dailyActionCounts: Array.from(this.dailyActionCounts.entries()),
                lastSaved: new Date().toISOString()
            };

            fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Error saving safety data', { error });
        }
    }

    /**
     * Get time until lunch break ends
     */
    private getTimeUntilLunchBreakEnd(): number {
        const now = new Date();
        const [endHour, endMinute] = this.config.lunchBreakEnd.split(':').map(Number);

        const endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);

        if (endTime <= now) {
            endTime.setDate(endTime.getDate() + 1);
        }

        return endTime.getTime() - now.getTime();
    }

    /**
     * Get time until next hour
     */
    private getTimeUntilNextHour(): number {
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        return nextHour.getTime() - now.getTime();
    }

    /**
     * Get time until next day
     */
    private getTimeUntilNextDay(): number {
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        return nextDay.getTime() - now.getTime();
    }

    /**
     * Reset metrics (useful for testing or manual reset)
     */
    resetMetrics(): void {
        this.metrics = {
            totalActions: 0,
            rejectedActions: 0,
            rejectionRate: 0,
            currentHourlyCount: 0,
            currentDailyCount: 0,
            lastActionTime: new Date(),
            jailDetected: false,
            captchaDetected: false,
            accountRestricted: false
        };

        this.hourlyActionCounts.clear();
        this.dailyActionCounts.clear();

        logger.info('Safety metrics reset');
        this.saveSafetyData();
    }
}

// Export singleton instance
export const safetyService = new SafetyService();
