import { ErrorAlertConfig } from '../services/errorHandler.js';
import { BackupConfig } from '../services/databaseBackup.js';
import { ProcessConfig } from '../services/processMonitor.js';
import { ShutdownConfig } from '../services/gracefulShutdown.js';

export interface ErrorHandlingConfig {
    errorHandler: ErrorAlertConfig;
    databaseBackup: BackupConfig;
    processMonitor: ProcessConfig[];
    gracefulShutdown: ShutdownConfig;
}

export const defaultErrorHandlingConfig: ErrorHandlingConfig = {
    errorHandler: {
        enabled: true,
        email: {
            enabled: process.env.ERROR_EMAIL_ENABLED === 'true',
            recipients: process.env.ERROR_EMAIL_RECIPIENTS?.split(',') || [],
            smtp: {
                host: process.env.ERROR_EMAIL_SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.ERROR_EMAIL_SMTP_PORT || '587'),
                secure: process.env.ERROR_EMAIL_SMTP_SECURE === 'true',
                auth: {
                    user: process.env.ERROR_EMAIL_USER || '',
                    pass: process.env.ERROR_EMAIL_PASS || ''
                }
            }
        },
        criticalErrorThreshold: parseInt(process.env.ERROR_THRESHOLD || '5'),
        errorWindowMs: parseInt(process.env.ERROR_WINDOW_MS || '3600000') // 1 hour
    },

    databaseBackup: {
        enabled: process.env.BACKUP_ENABLED !== 'false',
        backupDir: process.env.BACKUP_DIR || './backups/database',
        maxBackups: parseInt(process.env.BACKUP_MAX_BACKUPS || '30'),
        backupInterval: parseInt(process.env.BACKUP_INTERVAL || '86400000'), // 24 hours
        compression: process.env.BACKUP_COMPRESSION !== 'false',
        includeCollections: process.env.BACKUP_INCLUDE_COLLECTIONS?.split(',') || [],
        excludeCollections: process.env.BACKUP_EXCLUDE_COLLECTIONS?.split(',') || ['sessions'],
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '90'),
        encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    },

    processMonitor: [
        {
            name: 'cold-email-bot',
            script: 'dist/index.js',
            args: [],
            cwd: process.cwd(),
            restartDelay: 5000,
            maxRestarts: 5,
            maxMemory: parseInt(process.env.PROCESS_MAX_MEMORY || '1024'), // MB
            healthCheckInterval: parseInt(process.env.PROCESS_HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
            healthCheckTimeout: parseInt(process.env.PROCESS_HEALTH_CHECK_TIMEOUT || '5000'), // 5 seconds
            restartOnExit: true,
            restartOnMemoryExceed: true
        }
    ],

    gracefulShutdown: {
        timeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '30000'), // 30 seconds
        saveState: process.env.SHUTDOWN_SAVE_STATE !== 'false',
        stateDir: process.env.SHUTDOWN_STATE_DIR || './backups/state',
        cleanupResources: process.env.SHUTDOWN_CLEANUP_RESOURCES !== 'false',
        notifyServices: process.env.SHUTDOWN_NOTIFY_SERVICES !== 'false'
    }
};

export default defaultErrorHandlingConfig;
