import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export interface DailyLimits {
    date: string; // YYYY-MM-DD format
    connectionRequests: number;
    messages: number;
    profileViews: number;
    lastReset: string; // ISO timestamp
}

export interface LimitConfig {
    maxConnectionRequests: number;
    maxMessages: number;
    maxProfileViews: number;
    resetTime: string; // HH:MM format (24-hour)
    timezone: string; // IANA timezone
}

export class LimitTracker {
    private limitsFile: string;
    private config: LimitConfig;
    private currentLimits: DailyLimits | null = null;

    constructor(config: LimitConfig, limitsFile: string = 'linkedin-limits.json') {
        this.config = config;
        this.limitsFile = limitsFile;
        this.loadLimits();
    }

    private loadLimits(): void {
        try {
            if (fs.existsSync(this.limitsFile)) {
                const data = fs.readFileSync(this.limitsFile, 'utf8');
                const limits = JSON.parse(data);

                // Check if limits are for today
                const today = new Date().toISOString().split('T')[0];
                if (limits.date === today) {
                    this.currentLimits = limits;
                    logger.debug('Loaded existing limits for today', { limits });
                } else {
                    logger.info('Limits are from a different day, resetting', {
                        storedDate: limits.date,
                        today
                    });
                    this.resetLimits();
                }
            } else {
                this.resetLimits();
            }
        } catch (error) {
            logger.error('Failed to load limits, resetting', { error });
            this.resetLimits();
        }
    }

    private resetLimits(): void {
        const today = new Date().toISOString().split('T')[0];
        this.currentLimits = {
            date: today,
            connectionRequests: 0,
            messages: 0,
            profileViews: 0,
            lastReset: new Date().toISOString()
        };
        this.saveLimits();
        logger.info('Daily limits reset', { limits: this.currentLimits });
    }

    private saveLimits(): void {
        try {
            fs.writeFileSync(this.limitsFile, JSON.stringify(this.currentLimits, null, 2));
        } catch (error) {
            logger.error('Failed to save limits', { error });
        }
    }

    private checkIfResetNeeded(): void {
        if (!this.currentLimits) return;

        const now = new Date();
        const lastReset = new Date(this.currentLimits.lastReset);
        const today = now.toISOString().split('T')[0];

        // Reset if it's a new day
        if (this.currentLimits.date !== today) {
            logger.info('New day detected, resetting limits');
            this.resetLimits();
            return;
        }

        // Check if it's time for daily reset (based on configured reset time)
        const resetTime = this.config.resetTime.split(':');
        const resetHour = parseInt(resetTime[0]);
        const resetMinute = parseInt(resetTime[1]);

        const resetDateTime = new Date(now);
        resetDateTime.setHours(resetHour, resetMinute, 0, 0);

        // If we've passed the reset time today and last reset was before today's reset time
        if (now > resetDateTime && lastReset < resetDateTime) {
            logger.info('Reset time reached, resetting limits');
            this.resetLimits();
        }
    }

    canSendConnectionRequest(): boolean {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return false;

        const canSend = this.currentLimits.connectionRequests < this.config.maxConnectionRequests;
        logger.debug('Connection request limit check', {
            current: this.currentLimits.connectionRequests,
            max: this.config.maxConnectionRequests,
            canSend
        });
        return canSend;
    }

    canSendMessage(): boolean {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return false;

        const canSend = this.currentLimits.messages < this.config.maxMessages;
        logger.debug('Message limit check', {
            current: this.currentLimits.messages,
            max: this.config.maxMessages,
            canSend
        });
        return canSend;
    }

    canViewProfile(): boolean {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return false;

        const canView = this.currentLimits.profileViews < this.config.maxProfileViews;
        logger.debug('Profile view limit check', {
            current: this.currentLimits.profileViews,
            max: this.config.maxProfileViews,
            canView
        });
        return canView;
    }

    recordConnectionRequest(): void {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return;

        this.currentLimits.connectionRequests++;
        this.saveLimits();
        logger.info('Recorded connection request', {
            total: this.currentLimits.connectionRequests
        });
    }

    recordMessage(): void {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return;

        this.currentLimits.messages++;
        this.saveLimits();
        logger.info('Recorded message', {
            total: this.currentLimits.messages
        });
    }

    recordProfileView(): void {
        this.checkIfResetNeeded();
        if (!this.currentLimits) return;

        this.currentLimits.profileViews++;
        this.saveLimits();
        logger.info('Recorded profile view', {
            total: this.currentLimits.profileViews
        });
    }

    getCurrentLimits(): DailyLimits | null {
        this.checkIfResetNeeded();
        return this.currentLimits;
    }

    getRemainingLimits(): { connectionRequests: number; messages: number; profileViews: number } {
        this.checkIfResetNeeded();
        if (!this.currentLimits) {
            return { connectionRequests: 0, messages: 0, profileViews: 0 };
        }

        return {
            connectionRequests: Math.max(0, this.config.maxConnectionRequests - this.currentLimits.connectionRequests),
            messages: Math.max(0, this.config.maxMessages - this.currentLimits.messages),
            profileViews: Math.max(0, this.config.maxProfileViews - this.currentLimits.profileViews)
        };
    }
}
