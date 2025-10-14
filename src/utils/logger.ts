import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export class Logger {
    private logDir: string;
    private logFile: string;

    constructor(logDir: string = 'logs', logFileName: string = 'linkedin.log') {
        this.logDir = logDir;
        this.logFile = path.join(logDir, logFileName);
        this.ensureLogDirectory();
    }

    private ensureLogDirectory(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
        return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
    }

    private writeToFile(message: string): void {
        try {
            fs.appendFileSync(this.logFile, message);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    private log(level: LogLevel, message: string, data?: any): void {
        const formattedMessage = this.formatMessage(level, message, data);

        // Write to file
        this.writeToFile(formattedMessage);

        // Also log to console with colors
        const consoleMessage = this.formatMessage(level, message, data).trim();
        switch (level) {
            case LogLevel.DEBUG:
                console.log(`\x1b[36m${consoleMessage}\x1b[0m`); // Cyan
                break;
            case LogLevel.INFO:
                console.log(`\x1b[32m${consoleMessage}\x1b[0m`); // Green
                break;
            case LogLevel.WARN:
                console.log(`\x1b[33m${consoleMessage}\x1b[0m`); // Yellow
                break;
            case LogLevel.ERROR:
                console.log(`\x1b[31m${consoleMessage}\x1b[0m`); // Red
                break;
        }
    }

    debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, data?: any): void {
        this.log(LogLevel.ERROR, message, data);
    }

    // Special method for LinkedIn actions
    linkedinAction(action: string, profileUrl: string, success: boolean, details?: any): void {
        const message = `LinkedIn Action: ${action} | Profile: ${profileUrl} | Success: ${success}`;
        const level = success ? LogLevel.INFO : LogLevel.ERROR;
        this.log(level, message, details);
    }
}

// Export singleton instance
export const logger = new Logger();
