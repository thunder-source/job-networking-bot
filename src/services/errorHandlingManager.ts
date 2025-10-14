import logger from '../utils/winstonLogger.js';
import ErrorHandler from './errorHandler.js';
import ProcessMonitor from './processMonitor.js';
import DatabaseBackup from './databaseBackup.js';
import GracefulShutdown from './gracefulShutdown.js';
import debugMode from '../utils/debugMode.js';
import { ErrorHandlingConfig } from '../config/errorHandling.js';

class ErrorHandlingManager {
    private errorHandler: ErrorHandler;
    private processMonitor: ProcessMonitor;
    private databaseBackup: DatabaseBackup;
    private gracefulShutdown: GracefulShutdown;
    private config: ErrorHandlingConfig;
    private initialized: boolean = false;

    constructor(config: ErrorHandlingConfig) {
        this.config = config;

        // Initialize services
        this.errorHandler = new ErrorHandler(config.errorHandler);
        this.processMonitor = new ProcessMonitor(this.errorHandler);
        this.databaseBackup = new DatabaseBackup(config.databaseBackup);
        this.gracefulShutdown = new GracefulShutdown(config.gracefulShutdown);
    }

    /**
     * Initialize the error handling system
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            logger.warn('Error handling system already initialized');
            return;
        }

        const context = debugMode.createContext('error-handling-init');

        try {
            context.log('debug', 'Initializing error handling system');

            // Register services with graceful shutdown
            this.registerServices();

            // Start database backups if enabled
            if (this.config.databaseBackup.enabled) {
                this.databaseBackup.startAutomaticBackups();
                context.log('info', 'Database backups started');
            }

            // Register processes for monitoring
            for (const processConfig of this.config.processMonitor) {
                this.processMonitor.registerProcess(processConfig);
            }

            // Load previous application state
            const previousState = await this.gracefulShutdown.loadApplicationState();
            if (previousState) {
                context.log('info', 'Previous application state loaded', {
                    services: previousState.services.size,
                    uptime: previousState.uptime
                });
            }

            this.initialized = true;
            context.log('info', 'Error handling system initialized successfully');
            context.complete({ success: true });

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
            throw new Error(`Failed to initialize error handling system: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Register services with graceful shutdown
     */
    private registerServices(): void {
        // Register error handler
        this.gracefulShutdown.registerService('error-handler', async () => {
            logger.systemEvent('Shutting down error handler');
            // Error handler doesn't need explicit shutdown
        });

        // Register process monitor
        this.gracefulShutdown.registerService('process-monitor', async () => {
            logger.systemEvent('Shutting down process monitor');
            await this.processMonitor.stopAllProcesses();
        });

        // Register database backup
        this.gracefulShutdown.registerService('database-backup', async () => {
            logger.systemEvent('Shutting down database backup');
            this.databaseBackup.stopAutomaticBackups();
        });

        // Register database connection
        this.gracefulShutdown.registerService('database-connection', async () => {
            logger.systemEvent('Shutting down database connection');
            const databaseConnection = (await import('../config/database.js')).default;
            await databaseConnection.disconnect();
        });

        logger.systemEvent('Services registered with graceful shutdown');
    }

    /**
     * Start monitoring processes
     */
    public async startProcessMonitoring(): Promise<void> {
        if (!this.initialized) {
            throw new Error('Error handling system not initialized');
        }

        const context = debugMode.createContext('process-monitoring-start');

        try {
            context.log('debug', 'Starting process monitoring');

            for (const processConfig of this.config.processMonitor) {
                const success = await this.processMonitor.startProcess(processConfig.name);
                if (success) {
                    context.log('info', `Process started: ${processConfig.name}`);
                } else {
                    context.log('error', `Failed to start process: ${processConfig.name}`);
                }
            }

            context.complete({ success: true });

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
            throw error;
        }
    }

    /**
     * Stop monitoring processes
     */
    public async stopProcessMonitoring(): Promise<void> {
        const context = debugMode.createContext('process-monitoring-stop');

        try {
            context.log('debug', 'Stopping process monitoring');
            await this.processMonitor.stopAllProcesses();
            context.complete({ success: true });

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
            throw error;
        }
    }

    /**
     * Create a manual backup
     */
    public async createManualBackup(): Promise<any> {
        const context = debugMode.createContext('manual-backup');

        try {
            context.log('debug', 'Creating manual backup');
            const backupInfo = await this.databaseBackup.createBackup();
            context.log('info', 'Manual backup created successfully', { backupId: backupInfo.id });
            context.complete({ success: true, backupId: backupInfo.id });
            return backupInfo;

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
            throw error;
        }
    }

    /**
     * Restore from a backup
     */
    public async restoreFromBackup(backupId: string): Promise<void> {
        const context = debugMode.createContext('backup-restore');

        try {
            context.log('debug', 'Starting backup restore', { backupId });
            await this.databaseBackup.restoreBackup(backupId);
            context.log('info', 'Backup restored successfully', { backupId });
            context.complete({ success: true });

        } catch (error) {
            context.error(error instanceof Error ? error : new Error(String(error)), { success: false });
            throw error;
        }
    }

    /**
     * Get system health status
     */
    public getSystemHealth(): any {
        const errorStats = this.errorHandler.getErrorStatistics();
        const processStats = this.processMonitor.getMonitoringStats();
        const backupStats = this.databaseBackup.getBackupStats();
        const shutdownStatus = this.gracefulShutdown.getShutdownStatus();
        const debugStats = debugMode.getDebugStats();

        return {
            timestamp: new Date().toISOString(),
            errorHandling: {
                enabled: this.config.errorHandler.enabled,
                totalErrors: errorStats.totalErrors,
                recentErrors: Object.keys(errorStats.errorCounts).length,
                serviceStats: errorStats.serviceStats
            },
            processMonitoring: {
                active: processStats.monitoringActive,
                totalProcesses: processStats.totalProcesses,
                runningProcesses: processStats.runningProcesses,
                totalRestarts: processStats.totalRestarts
            },
            databaseBackup: {
                enabled: this.config.databaseBackup.enabled,
                totalBackups: backupStats.totalBackups,
                successfulBackups: backupStats.successfulBackups,
                lastBackup: backupStats.lastBackup,
                totalSize: backupStats.totalSize
            },
            gracefulShutdown: {
                inProgress: shutdownStatus.isShuttingDown,
                services: shutdownStatus.services.length,
                registeredCallbacks: shutdownStatus.registeredCallbacks
            },
            debugMode: {
                enabled: debugStats.enabled,
                activeTimers: debugStats.activeTimers,
                memoryUsage: debugStats.memorySnapshots.currentUsage
            },
            system: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                version: process.env.npm_package_version || '1.0.0'
            }
        };
    }

    /**
     * Get error statistics
     */
    public getErrorStatistics(): any {
        return this.errorHandler.getErrorStatistics();
    }

    /**
     * Reset error counts
     */
    public resetErrorCounts(): void {
        this.errorHandler.resetErrorCounts();
    }

    /**
     * Get process statistics
     */
    public getProcessStatistics(): any {
        return this.processMonitor.getMonitoringStats();
    }

    /**
     * Get backup history
     */
    public getBackupHistory(): any[] {
        return this.databaseBackup.getBackupHistory();
    }

    /**
     * List available backups
     */
    public listBackups(): any[] {
        return this.databaseBackup.listBackups();
    }

    /**
     * Get debug statistics
     */
    public getDebugStatistics(): any {
        return debugMode.getDebugStats();
    }

    /**
     * Enable/disable debug mode
     */
    public setDebugMode(enabled: boolean): void {
        debugMode.setEnabled(enabled);
    }

    /**
     * Force graceful shutdown
     */
    public async forceShutdown(reason: string = 'manual'): Promise<void> {
        await this.gracefulShutdown.forceShutdown(reason);
    }

    /**
     * Check if system is healthy
     */
    public isSystemHealthy(): boolean {
        const health = this.getSystemHealth();

        // System is healthy if:
        // - No critical errors in the last hour
        // - All monitored processes are running
        // - Recent backups are successful
        // - Not currently shutting down

        const hasRecentErrors = health.errorHandling.recentErrors > 0;
        const allProcessesRunning = health.processMonitoring.runningProcesses === health.processMonitoring.totalProcesses;
        const hasRecentBackup = health.databaseBackup.lastBackup &&
            (Date.now() - new Date(health.databaseBackup.lastBackup).getTime()) < 86400000; // 24 hours
        const notShuttingDown = !health.gracefulShutdown.inProgress;

        return !hasRecentErrors && allProcessesRunning && hasRecentBackup && notShuttingDown;
    }

    /**
     * Get service instances for direct access
     */
    public getServices(): {
        errorHandler: ErrorHandler;
        processMonitor: ProcessMonitor;
        databaseBackup: DatabaseBackup;
        gracefulShutdown: GracefulShutdown;
    } {
        return {
            errorHandler: this.errorHandler,
            processMonitor: this.processMonitor,
            databaseBackup: this.databaseBackup,
            gracefulShutdown: this.gracefulShutdown
        };
    }

    /**
     * Check if initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }
}

export default ErrorHandlingManager;
