import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';

// Custom format for log messages
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;

        if (stack) {
            logMessage += `\n${stack}`;
        }

        if (Object.keys(meta).length > 0) {
            logMessage += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
        }

        return logMessage;
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        let logMessage = `${timestamp} ${level}: ${message}`;
        if (stack) {
            logMessage += `\n${stack}`;
        }
        return logMessage;
    })
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Daily rotate file transport for errors
const errorFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat
});

// Daily rotate file transport for actions
const actionFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'actions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '50m',
    maxFiles: '30d',
    format: logFormat
});

// Daily rotate file transport for analytics
const analyticsFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'analytics-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '30m',
    maxFiles: '90d',
    format: logFormat
});

// Daily rotate file transport for general info
const infoFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'info-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    maxSize: '50m',
    maxFiles: '30d',
    format: logFormat
});

// Daily rotate file transport for debug
const debugFileTransport = new DailyRotateFile({
    filename: path.join(logsDir, 'debug-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'debug',
    maxSize: '100m',
    maxFiles: '7d',
    format: logFormat
});

// Create the main logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'cold-email-bot' },
    transports: [
        // Console transport for development
        new winston.transports.Console({
            format: consoleFormat,
            silent: process.env.NODE_ENV === 'production' && process.env.LOG_CONSOLE !== 'true'
        }),
        // File transports
        errorFileTransport,
        actionFileTransport,
        analyticsFileTransport,
        infoFileTransport,
        debugFileTransport
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            format: logFormat
        })
    ],
    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            format: logFormat
        })
    ]
});

// Extend the logger with custom methods
interface ExtendedLogger extends winston.Logger {
    action: (message: string, meta?: any) => void;
    analytics: (message: string, data: any) => void;
    linkedinAction: (action: string, profileUrl: string, success: boolean, details?: any) => void;
    emailAction: (action: string, recipient: string, success: boolean, details?: any) => void;
    systemEvent: (event: string, details?: any) => void;
    performance: (operation: string, duration: number, details?: any) => void;
}

const extendedLogger = logger as ExtendedLogger;

// Add custom logging methods
extendedLogger.action = (message: string, meta?: any) => {
    logger.info(message, { ...meta, category: 'action' });
};

extendedLogger.analytics = (message: string, data: any) => {
    logger.info(message, { ...data, category: 'analytics' });
};

extendedLogger.linkedinAction = (action: string, profileUrl: string, success: boolean, details?: any) => {
    const level = success ? 'info' : 'error';
    const message = `LinkedIn Action: ${action} | Profile: ${profileUrl} | Success: ${success}`;

    logger[level](message, {
        category: 'action',
        subcategory: 'linkedin',
        action,
        profileUrl,
        success,
        ...details
    });
};

extendedLogger.emailAction = (action: string, recipient: string, success: boolean, details?: any) => {
    const level = success ? 'info' : 'error';
    const message = `Email Action: ${action} | Recipient: ${recipient} | Success: ${success}`;

    logger[level](message, {
        category: 'action',
        subcategory: 'email',
        action,
        recipient,
        success,
        ...details
    });
};

extendedLogger.systemEvent = (event: string, details?: any) => {
    logger.info(`System Event: ${event}`, {
        category: 'system',
        event,
        ...details
    });
};

extendedLogger.performance = (operation: string, duration: number, details?: any) => {
    logger.info(`Performance: ${operation} took ${duration}ms`, {
        category: 'performance',
        operation,
        duration,
        ...details
    });
};

// Handle log rotation events
errorFileTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('Error log rotated', { oldFilename, newFilename });
});

actionFileTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('Action log rotated', { oldFilename, newFilename });
});

analyticsFileTransport.on('rotate', (oldFilename, newFilename) => {
    logger.info('Analytics log rotated', { oldFilename, newFilename });
});

// Export the extended logger
export default extendedLogger;

// Export individual loggers for specific use cases
export const errorLogger = logger.child({ category: 'error' });
export const actionLogger = logger.child({ category: 'action' });
export const analyticsLogger = logger.child({ category: 'analytics' });
export const systemLogger = logger.child({ category: 'system' });
export const performanceLogger = logger.child({ category: 'performance' });
