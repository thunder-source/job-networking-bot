import { logger } from './logger.js';

export interface TimeSlot {
    startHour: number;
    endHour: number;
    timezone: string;
}

export class SmartTiming {
    private timeSlot: TimeSlot;

    constructor(timeSlot: TimeSlot = { startHour: 9, endHour: 18, timezone: 'America/New_York' }) {
        this.timeSlot = timeSlot;
    }

    /**
     * Check if current time is within the allowed time slot
     */
    isWithinTimeSlot(): boolean {
        const now = new Date();
        const currentHour = now.getHours();

        const isWithin = currentHour >= this.timeSlot.startHour && currentHour < this.timeSlot.endHour;

        logger.debug('Time slot check', {
            currentHour,
            startHour: this.timeSlot.startHour,
            endHour: this.timeSlot.endHour,
            isWithin,
            timezone: this.timeSlot.timezone
        });

        return isWithin;
    }

    /**
     * Get a random delay until the next allowed time slot
     */
    getDelayUntilNextTimeSlot(): number {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        if (this.isWithinTimeSlot()) {
            // We're within the time slot, return a random delay (1-30 minutes)
            return Math.floor(Math.random() * 30 + 1) * 60 * 1000;
        }

        // Calculate delay until next time slot
        const nextStart = new Date(now);
        nextStart.setHours(this.timeSlot.startHour, 0, 0, 0);

        // If we're past today's time slot, move to tomorrow
        if (currentHour >= this.timeSlot.endHour) {
            nextStart.setDate(nextStart.getDate() + 1);
        }

        const delayMs = nextStart.getTime() - now.getTime();

        logger.info('Scheduling action for next time slot', {
            currentTime: now.toISOString(),
            nextStart: nextStart.toISOString(),
            delayHours: Math.round(delayMs / (1000 * 60 * 60) * 100) / 100
        });

        return delayMs;
    }

    /**
     * Get a random time within the allowed time slot for today
     */
    getRandomTimeInSlot(): Date {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const startTime = new Date(today);
        startTime.setHours(this.timeSlot.startHour, 0, 0, 0);

        const endTime = new Date(today);
        endTime.setHours(this.timeSlot.endHour, 0, 0, 0);

        const randomTime = new Date(
            startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime())
        );

        logger.debug('Generated random time in slot', {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            randomTime: randomTime.toISOString()
        });

        return randomTime;
    }

    /**
     * Wait until the next appropriate time to perform an action
     */
    async waitForOptimalTime(): Promise<void> {
        if (this.isWithinTimeSlot()) {
            // We're in the time slot, add a small random delay
            const delay = Math.floor(Math.random() * 5 + 1) * 60 * 1000; // 1-5 minutes
            logger.info('Within time slot, waiting random delay', { delayMinutes: delay / 60000 });
            await new Promise(resolve => setTimeout(resolve, delay));
        } else {
            // Wait until next time slot
            const delay = this.getDelayUntilNextTimeSlot();
            logger.info('Outside time slot, waiting until next allowed time', {
                delayHours: Math.round(delay / (1000 * 60 * 60) * 100) / 100
            });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    /**
     * Get human-readable time until next action
     */
    getTimeUntilNextAction(): string {
        if (this.isWithinTimeSlot()) {
            return 'Now (within time slot)';
        }

        const delay = this.getDelayUntilNextTimeSlot();
        const hours = Math.floor(delay / (1000 * 60 * 60));
        const minutes = Math.floor((delay % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    /**
     * Check if we should perform an action now (considering time slot and random chance)
     */
    shouldPerformActionNow(): boolean {
        if (!this.isWithinTimeSlot()) {
            return false;
        }

        // Add some randomness - 70% chance to perform action when in time slot
        const randomChance = Math.random();
        const shouldPerform = randomChance < 0.7;

        logger.debug('Action timing decision', {
            inTimeSlot: true,
            randomChance,
            shouldPerform
        });

        return shouldPerform;
    }
}
