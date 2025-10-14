import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// Account types and limits
export enum AccountType {
    NEW = 'new',           // 0-30 days old
    ESTABLISHED = 'established', // 30-365 days old
    PREMIUM = 'premium'    // 365+ days old or premium subscription
}

export enum ActionType {
    CONNECTION_REQUEST = 'connection_request',
    MESSAGE = 'message',
    PROFILE_VIEW = 'profile_view',
    SEARCH = 'search'
}

export interface AccountProfile {
    accountId: string;
    accountType: AccountType;
    accountAge: number; // days
    isPremium: boolean;
    createdAt: Date;
    lastActivity: Date;
    totalConnections: number;
    totalMessages: number;
    totalProfileViews: number;
    successRate: number;
    rejectionRate: number;
    suspiciousActivityScore: number;
    cooldownUntil?: Date;
    weeklyUsage: number;
    monthlyUsage: number;
}

export interface RateLimitConfig {
    // Daily limits by account type
    dailyLimits: {
        [AccountType.NEW]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
        [AccountType.ESTABLISHED]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
        [AccountType.PREMIUM]: {
            connections: { min: number; max: number };
            messages: { min: number; max: number };
            profileViews: { min: number; max: number };
        };
    };
    // Weekly and monthly caps
    weeklyCap: number;
    monthlyCap: number;
    // Delay ranges (in milliseconds)
    delayRanges: {
        min: number;
        max: number;
    };
    // Suspicious activity thresholds
    suspiciousActivityThresholds: {
        rapidActions: number; // actions per minute
        highRejectionRate: number; // percentage
        unusualPatterns: number; // score threshold
    };
    // Cooldown periods (in minutes)
    cooldownPeriods: {
        warning: number;
        critical: number;
        suspension: number;
    };
    // Success rate adjustments
    successRateAdjustments: {
        highSuccess: number; // increase limits by this percentage
        lowSuccess: number;  // decrease limits by this percentage
        threshold: number;   // success rate threshold
    };
}

export interface ActionRecord {
    actionType: ActionType;
    timestamp: Date;
    success: boolean;
    rejectionReason?: string;
    delayUsed: number;
    accountId: string;
}

export interface RateLimitResult {
    allowed: boolean;
    delay: number;
    reason?: string;
    cooldownUntil?: Date;
    adjustedLimits?: {
        connections: number;
        messages: number;
        profileViews: number;
    };
}

export class AdaptiveRateLimiter {
    private config: RateLimitConfig;
    private profiles: Map<string, AccountProfile> = new Map();
    private actionHistory: ActionRecord[] = [];
    private dataFile: string;
    private isInitialized: boolean = false;

    constructor(config?: Partial<RateLimitConfig>, dataFile: string = 'rate-limiter-data.json') {
        this.dataFile = dataFile;
        this.config = {
            dailyLimits: {
                [AccountType.NEW]: {
                    connections: { min: 5, max: 10 },
                    messages: { min: 3, max: 5 },
                    profileViews: { min: 20, max: 30 }
                },
                [AccountType.ESTABLISHED]: {
                    connections: { min: 20, max: 30 },
                    messages: { min: 10, max: 15 },
                    profileViews: { min: 50, max: 80 }
                },
                [AccountType.PREMIUM]: {
                    connections: { min: 80, max: 100 },
                    messages: { min: 30, max: 50 },
                    profileViews: { min: 200, max: 300 }
                }
            },
            weeklyCap: 500,
            monthlyCap: 2000,
            delayRanges: {
                min: 30000, // 30 seconds
                max: 90000  // 90 seconds
            },
            suspiciousActivityThresholds: {
                rapidActions: 5, // 5 actions per minute
                highRejectionRate: 0.3, // 30% rejection rate
                unusualPatterns: 0.7 // 70% suspicious score
            },
            cooldownPeriods: {
                warning: 30,    // 30 minutes
                critical: 120,  // 2 hours
                suspension: 1440 // 24 hours
            },
            successRateAdjustments: {
                highSuccess: 0.1, // 10% increase
                lowSuccess: -0.2, // 20% decrease
                threshold: 0.6     // 60% success rate threshold
            },
            ...config
        };
    }

    /**
     * Initialize the rate limiter and load existing data
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            await this.loadData();
            this.isInitialized = true;
            logger.info('AdaptiveRateLimiter initialized', {
                profilesCount: this.profiles.size,
                actionHistoryCount: this.actionHistory.length
            });
        } catch (error) {
            logger.error('Failed to initialize AdaptiveRateLimiter', { error });
            throw error;
        }
    }

    /**
     * Register a new account profile
     */
    async registerAccount(accountId: string, accountType: AccountType, isPremium: boolean = false): Promise<void> {
        const now = new Date();
        const profile: AccountProfile = {
            accountId,
            accountType,
            accountAge: 0,
            isPremium: isPremium || accountType === AccountType.PREMIUM,
            createdAt: now,
            lastActivity: now,
            totalConnections: 0,
            totalMessages: 0,
            totalProfileViews: 0,
            successRate: 1.0, // Start optimistic
            rejectionRate: 0.0,
            suspiciousActivityScore: 0.0,
            weeklyUsage: 0,
            monthlyUsage: 0
        };

        this.profiles.set(accountId, profile);
        await this.saveData();
        logger.info('Account registered', { accountId, accountType, isPremium });
    }

    /**
     * Check if an action is allowed and get delay/cooldown information
     */
    async checkAction(
        accountId: string,
        actionType: ActionType,
        forceCheck: boolean = false
    ): Promise<RateLimitResult> {
        await this.initialize();

        const profile = this.profiles.get(accountId);
        if (!profile) {
            return {
                allowed: false,
                delay: 0,
                reason: 'Account not registered'
            };
        }

        // Update account age
        this.updateAccountAge(profile);

        // Check if account is in cooldown
        if (profile.cooldownUntil && new Date() < profile.cooldownUntil) {
            return {
                allowed: false,
                delay: 0,
                reason: 'Account in cooldown period',
                cooldownUntil: profile.cooldownUntil
            };
        }

        // Check suspicious activity
        const suspiciousCheck = this.checkSuspiciousActivity(profile);
        if (suspiciousCheck.isSuspicious) {
            await this.triggerCooldown(profile, suspiciousCheck.severity);
            return {
                allowed: false,
                delay: 0,
                reason: `Suspicious activity detected: ${suspiciousCheck.reason}`,
                cooldownUntil: profile.cooldownUntil
            };
        }

        // Get current limits for this account
        const limits = this.getCurrentLimits(profile);

        // Check daily limits
        const dailyCheck = this.checkDailyLimits(profile, actionType, limits);
        if (!dailyCheck.allowed) {
            return {
                allowed: false,
                delay: dailyCheck.delay,
                reason: dailyCheck.reason
            };
        }

        // Check weekly/monthly caps
        const capCheck = this.checkCaps(profile);
        if (!capCheck.allowed) {
            return {
                allowed: false,
                delay: capCheck.delay,
                reason: capCheck.reason
            };
        }

        // Calculate adaptive delay
        const delay = this.calculateAdaptiveDelay(profile, actionType);

        return {
            allowed: true,
            delay,
            adjustedLimits: limits
        };
    }

    /**
     * Record an action and update account statistics
     */
    async recordAction(
        accountId: string,
        actionType: ActionType,
        success: boolean,
        rejectionReason?: string
    ): Promise<void> {
        await this.initialize();

        const profile = this.profiles.get(accountId);
        if (!profile) return;

        const now = new Date();
        const delay = this.calculateAdaptiveDelay(profile, actionType);

        // Record the action
        const actionRecord: ActionRecord = {
            actionType,
            timestamp: now,
            success,
            rejectionReason,
            delayUsed: delay,
            accountId
        };

        this.actionHistory.push(actionRecord);

        // Update profile statistics
        this.updateProfileStats(profile, actionType, success);

        // Update weekly/monthly usage
        this.updateUsageCounters(profile);

        // Clean old action history (keep last 1000 records)
        if (this.actionHistory.length > 1000) {
            this.actionHistory = this.actionHistory.slice(-1000);
        }

        await this.saveData();

        logger.info('Action recorded', {
            accountId,
            actionType,
            success,
            delay,
            rejectionReason
        });
    }

    /**
     * Get account profile information
     */
    getAccountProfile(accountId: string): AccountProfile | null {
        return this.profiles.get(accountId) || null;
    }

    /**
     * Get current limits for an account
     */
    getCurrentLimits(profile: AccountProfile): { connections: number; messages: number; profileViews: number } {
        const baseLimits = this.config.dailyLimits[profile.accountType];

        // Apply success rate adjustments
        const successRateAdjustment = this.calculateSuccessRateAdjustment(profile);

        return {
            connections: Math.max(1, Math.floor(baseLimits.connections.max * (1 + successRateAdjustment))),
            messages: Math.max(1, Math.floor(baseLimits.messages.max * (1 + successRateAdjustment))),
            profileViews: Math.max(1, Math.floor(baseLimits.profileViews.max * (1 + successRateAdjustment)))
        };
    }

    /**
     * Get action history for analysis
     */
    getActionHistory(accountId?: string, limit: number = 100): ActionRecord[] {
        let history = this.actionHistory;

        if (accountId) {
            history = history.filter(record => record.accountId === accountId);
        }

        return history.slice(-limit);
    }

    /**
     * Force reset account limits (for testing or manual intervention)
     */
    async resetAccountLimits(accountId: string): Promise<void> {
        const profile = this.profiles.get(accountId);
        if (!profile) return;

        profile.cooldownUntil = undefined;
        profile.suspiciousActivityScore = 0;
        profile.weeklyUsage = 0;
        profile.monthlyUsage = 0;

        await this.saveData();
        logger.info('Account limits reset', { accountId });
    }

    /**
     * Update account age based on creation date
     */
    private updateAccountAge(profile: AccountProfile): void {
        const now = new Date();
        const ageInDays = Math.floor((now.getTime() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24));

        if (ageInDays !== profile.accountAge) {
            profile.accountAge = ageInDays;

            // Update account type based on age
            if (ageInDays < 30) {
                profile.accountType = AccountType.NEW;
            } else if (ageInDays < 365) {
                profile.accountType = AccountType.ESTABLISHED;
            } else {
                profile.accountType = AccountType.PREMIUM;
            }
        }
    }

    /**
     * Check for suspicious activity patterns
     */
    private checkSuspiciousActivity(profile: AccountProfile): { isSuspicious: boolean; reason?: string; severity: 'warning' | 'critical' | 'suspension' } {
        const recentActions = this.getRecentActions(profile.accountId, 5); // Last 5 actions
        const now = new Date();

        // Check for rapid actions (too many in short time)
        const oneMinuteAgo = new Date(now.getTime() - 60000);
        const recentMinuteActions = recentActions.filter(action => action.timestamp > oneMinuteAgo);

        if (recentMinuteActions.length >= this.config.suspiciousActivityThresholds.rapidActions) {
            return {
                isSuspicious: true,
                reason: 'Too many actions in short time period',
                severity: 'warning'
            };
        }

        // Check rejection rate
        if (profile.rejectionRate > this.config.suspiciousActivityThresholds.highRejectionRate) {
            return {
                isSuspicious: true,
                reason: 'High rejection rate detected',
                severity: 'critical'
            };
        }

        // Check suspicious activity score
        if (profile.suspiciousActivityScore > this.config.suspiciousActivityThresholds.unusualPatterns) {
            return {
                isSuspicious: true,
                reason: 'Unusual activity patterns detected',
                severity: 'suspension'
            };
        }

        return { isSuspicious: false, severity: 'warning' };
    }

    /**
     * Trigger cooldown period based on severity
     */
    private async triggerCooldown(profile: AccountProfile, severity: 'warning' | 'critical' | 'suspension'): Promise<void> {
        const cooldownMinutes = this.config.cooldownPeriods[severity];
        const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);

        profile.cooldownUntil = cooldownUntil;
        profile.suspiciousActivityScore = Math.min(1.0, profile.suspiciousActivityScore + 0.1);

        logger.warn('Cooldown triggered', {
            accountId: profile.accountId,
            severity,
            cooldownMinutes,
            cooldownUntil
        });
    }

    /**
     * Check daily limits for specific action type
     */
    private checkDailyLimits(
        profile: AccountProfile,
        actionType: ActionType,
        limits: { connections: number; messages: number; profileViews: number }
    ): { allowed: boolean; delay: number; reason?: string } {
        const today = new Date().toISOString().split('T')[0];
        const todayActions = this.getActionsForDate(profile.accountId, today);

        let currentCount = 0;
        let maxCount = 0;

        switch (actionType) {
            case ActionType.CONNECTION_REQUEST:
                currentCount = todayActions.filter(a => a.actionType === ActionType.CONNECTION_REQUEST).length;
                maxCount = limits.connections;
                break;
            case ActionType.MESSAGE:
                currentCount = todayActions.filter(a => a.actionType === ActionType.MESSAGE).length;
                maxCount = limits.messages;
                break;
            case ActionType.PROFILE_VIEW:
                currentCount = todayActions.filter(a => a.actionType === ActionType.PROFILE_VIEW).length;
                maxCount = limits.profileViews;
                break;
            default:
                return { allowed: true, delay: 0 };
        }

        if (currentCount >= maxCount) {
            return {
                allowed: false,
                delay: this.calculateDelayUntilReset(),
                reason: `Daily limit reached for ${actionType}`
            };
        }

        return { allowed: true, delay: 0 };
    }

    /**
     * Check weekly and monthly caps
     */
    private checkCaps(profile: AccountProfile): { allowed: boolean; delay: number; reason?: string } {
        if (profile.weeklyUsage >= this.config.weeklyCap) {
            return {
                allowed: false,
                delay: this.calculateDelayUntilWeeklyReset(),
                reason: 'Weekly cap reached'
            };
        }

        if (profile.monthlyUsage >= this.config.monthlyCap) {
            return {
                allowed: false,
                delay: this.calculateDelayUntilMonthlyReset(),
                reason: 'Monthly cap reached'
            };
        }

        return { allowed: true, delay: 0 };
    }

    /**
     * Calculate adaptive delay based on account profile and action type
     */
    private calculateAdaptiveDelay(profile: AccountProfile, actionType: ActionType): number {
        const baseDelay = this.config.delayRanges.min +
            Math.random() * (this.config.delayRanges.max - this.config.delayRanges.min);

        // Adjust delay based on account type (newer accounts need longer delays)
        let multiplier = 1.0;
        switch (profile.accountType) {
            case AccountType.NEW:
                multiplier = 1.5;
                break;
            case AccountType.ESTABLISHED:
                multiplier = 1.0;
                break;
            case AccountType.PREMIUM:
                multiplier = 0.8;
                break;
        }

        // Adjust based on success rate (higher success = shorter delays)
        const successRateAdjustment = profile.successRate > 0.8 ? 0.8 : 1.0;

        // Adjust based on suspicious activity score
        const suspiciousAdjustment = 1.0 + (profile.suspiciousActivityScore * 0.5);

        return Math.floor(baseDelay * multiplier * successRateAdjustment * suspiciousAdjustment);
    }

    /**
     * Calculate success rate adjustment for limits
     */
    private calculateSuccessRateAdjustment(profile: AccountProfile): number {
        if (profile.successRate >= this.config.successRateAdjustments.threshold) {
            return this.config.successRateAdjustments.highSuccess;
        } else if (profile.successRate < 0.3) {
            return this.config.successRateAdjustments.lowSuccess;
        }
        return 0;
    }

    /**
     * Update profile statistics after an action
     */
    private updateProfileStats(profile: AccountProfile, actionType: ActionType, success: boolean): void {
        profile.lastActivity = new Date();

        // Update counters
        switch (actionType) {
            case ActionType.CONNECTION_REQUEST:
                profile.totalConnections++;
                break;
            case ActionType.MESSAGE:
                profile.totalMessages++;
                break;
            case ActionType.PROFILE_VIEW:
                profile.totalProfileViews++;
                break;
        }

        // Update success/rejection rates
        const recentActions = this.getRecentActions(profile.accountId, 50);
        const recentSuccesses = recentActions.filter(a => a.success).length;
        const recentRejections = recentActions.filter(a => !a.success).length;
        const totalRecent = recentActions.length;

        if (totalRecent > 0) {
            profile.successRate = recentSuccesses / totalRecent;
            profile.rejectionRate = recentRejections / totalRecent;
        }

        // Update suspicious activity score
        this.updateSuspiciousActivityScore(profile);
    }

    /**
     * Update suspicious activity score based on recent patterns
     */
    private updateSuspiciousActivityScore(profile: AccountProfile): void {
        const recentActions = this.getRecentActions(profile.accountId, 20);
        let score = 0;

        // Check for patterns that might be suspicious
        if (recentActions.length > 10) {
            // Check for too many actions in short time
            const timeSpan = recentActions[recentActions.length - 1].timestamp.getTime() - recentActions[0].timestamp.getTime();
            const actionsPerMinute = (recentActions.length / (timeSpan / 60000));

            if (actionsPerMinute > 2) {
                score += 0.2;
            }

            // Check for repetitive patterns
            const actionTypes = recentActions.map(a => a.actionType);
            const uniqueTypes = new Set(actionTypes).size;
            if (uniqueTypes < 2 && recentActions.length > 5) {
                score += 0.3;
            }

            // Check for high failure rate
            if (profile.rejectionRate > 0.5) {
                score += 0.4;
            }
        }

        profile.suspiciousActivityScore = Math.min(1.0, score);
    }

    /**
     * Update weekly and monthly usage counters
     */
    private updateUsageCounters(profile: AccountProfile): void {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Reset weekly counter if needed
        if (profile.lastActivity < weekAgo) {
            profile.weeklyUsage = 0;
        }

        // Reset monthly counter if needed
        if (profile.lastActivity < monthAgo) {
            profile.monthlyUsage = 0;
        }

        // Increment counters
        profile.weeklyUsage++;
        profile.monthlyUsage++;
    }

    /**
     * Get recent actions for an account
     */
    private getRecentActions(accountId: string, count: number): ActionRecord[] {
        return this.actionHistory
            .filter(action => action.accountId === accountId)
            .slice(-count);
    }

    /**
     * Get actions for a specific date
     */
    private getActionsForDate(accountId: string, date: string): ActionRecord[] {
        return this.actionHistory.filter(action => {
            const actionDate = action.timestamp.toISOString().split('T')[0];
            return action.accountId === accountId && actionDate === date;
        });
    }

    /**
     * Calculate delay until daily reset
     */
    private calculateDelayUntilReset(): number {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime() - now.getTime();
    }

    /**
     * Calculate delay until weekly reset
     */
    private calculateDelayUntilWeeklyReset(): number {
        const now = new Date();
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(0, 0, 0, 0);
        return nextWeek.getTime() - now.getTime();
    }

    /**
     * Calculate delay until monthly reset
     */
    private calculateDelayUntilMonthlyReset(): number {
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth.getTime() - now.getTime();
    }

    /**
     * Load data from file
     */
    private async loadData(): Promise<void> {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));

                // Load profiles
                if (data.profiles) {
                    for (const [accountId, profileData] of Object.entries(data.profiles)) {
                        const profile = profileData as any;
                        this.profiles.set(accountId, {
                            ...profile,
                            createdAt: new Date(profile.createdAt),
                            lastActivity: new Date(profile.lastActivity),
                            cooldownUntil: profile.cooldownUntil ? new Date(profile.cooldownUntil) : undefined
                        });
                    }
                }

                // Load action history
                if (data.actionHistory) {
                    this.actionHistory = data.actionHistory.map((action: any) => ({
                        ...action,
                        timestamp: new Date(action.timestamp)
                    }));
                }
            }
        } catch (error) {
            logger.error('Failed to load rate limiter data', { error });
            // Continue with empty data
        }
    }

    /**
     * Save data to file
     */
    private async saveData(): Promise<void> {
        try {
            const data = {
                profiles: Object.fromEntries(this.profiles),
                actionHistory: this.actionHistory,
                lastSaved: new Date().toISOString()
            };

            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.error('Failed to save rate limiter data', { error });
        }
    }
}
