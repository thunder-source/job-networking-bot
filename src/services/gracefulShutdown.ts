import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/winstonLogger.js';
import databaseConnection from '../config/database.js';

export interface ShutdownConfig {
    timeout: number; // ms
    saveState: boolean;
    stateDir: string;
    cleanupResources: boolean;
    notifyServices: boolean;
}

export interface ServiceState {
    name: string;
    status: 'running' | 'stopping' | 'stopped';
    startTime: Date;
    lastActivity: Date;
    metadata?: any;
}

export interface ApplicationState {
    services: Map<string, ServiceState>;
    lastSave: Date;
    version: string;
    uptime: number;
}

class GracefulShutdown {
    private config: ShutdownConfig;
    private isShuttingDown: boolean = false;
    private shutdownStartTime: Date | null = null;
    private services: Map<string, ServiceState> = new Map();
    private shutdownCallbacks: Map<string, () => Promise<void>> = new Map();
    private statePath: string;

    constructor(config: ShutdownConfig) {
        this.config = config;
        this.statePath = path.join(config.stateDir, 'application-state.json');
        this.ensureStateDirectory();
        this.setupSignalHandlers();
    }

    /**
     * Ensure state directory exists
     */
    private ensureStateDirectory(): void {
        if (!fs.existsSync(this.config.stateDir)) {
            fs.mkdirSync(this.config.stateDir, { recursive: true });
            logger.systemEvent('State directory created', { path: this.config.stateDir });
        }
    }

    /**
     * Setup signal handlers for graceful shutdown
     */
    private setupSignalHandlers(): void {
        // Handle SIGTERM (termination request)
        process.on('SIGTERM', () => {
            logger.systemEvent('SIGTERM received, initiating graceful shutdown');
            this.initiateShutdown('SIGTERM');
        });

        // Handle SIGINT (interrupt signal)
        process.on('SIGINT', () => {
            logger.systemEvent('SIGINT received, initiating graceful shutdown');
            this.initiateShutdown('SIGINT');
        });

        // Handle SIGHUP (hangup signal)
        process.on('SIGHUP', () => {
            logger.systemEvent('SIGHUP received, reloading configuration');
            this.reloadConfiguration();
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception, initiating emergency shutdown', { error });
            this.emergencyShutdown(error);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection, initiating emergency shutdown', {
                reason,
                promise: promise.toString()
            });
            this.emergencyShutdown(new Error(`Unhandled promise rejection: ${reason}`));
        });
    }

    /**
     * Register a service for shutdown management
     */
    public registerService(name: string, shutdownCallback?: () => Promise<void>): void {
        const serviceState: ServiceState = {
            name,
            status: 'running',
            startTime: new Date(),
            lastActivity: new Date()
        };

        this.services.set(name, serviceState);

        if (shutdownCallback) {
            this.shutdownCallbacks.set(name, shutdownCallback);
        }

        logger.systemEvent('Service registered for shutdown management', {
            name,
            hasCallback: !!shutdownCallback
        });
    }

    /**
     * Unregister a service
     */
    public unregisterService(name: string): void {
        this.services.delete(name);
        this.shutdownCallbacks.delete(name);

        logger.systemEvent('Service unregistered from shutdown management', { name });
    }

    /**
     * Update service activity
     */
    public updateServiceActivity(name: string, metadata?: any): void {
        const service = this.services.get(name);
        if (service) {
            service.lastActivity = new Date();
            if (metadata) {
                service.metadata = metadata;
            }
        }
    }

    /**
     * Initiate graceful shutdown
     */
    public async initiateShutdown(reason: string): Promise<void> {
        if (this.isShuttingDown) {
            logger.warn('Shutdown already in progress', { reason });
            return;
        }

        this.isShuttingDown = true;
        this.shutdownStartTime = new Date();

        logger.systemEvent('Graceful shutdown initiated', { reason });

        try {
            // Save current state if configured
            if (this.config.saveState) {
                await this.saveApplicationState();
            }

            // Notify all services to stop
            if (this.config.notifyServices) {
                await this.notifyServicesToStop();
            }

            // Wait for services to stop gracefully
            await this.waitForServicesToStop();

            // Cleanup resources
            if (this.config.cleanupResources) {
                await this.cleanupResources();
            }

            // Final state save
            if (this.config.saveState) {
                await this.saveApplicationState();
            }

            const shutdownDuration = Date.now() - this.shutdownStartTime.getTime();
            logger.systemEvent('Graceful shutdown completed', {
                reason,
                duration: shutdownDuration
            });

            // Exit process
            process.exit(0);

        } catch (error) {
            logger.error('Error during graceful shutdown', {
                error: error instanceof Error ? error.message : 'Unknown error',
                reason
            });

            // Emergency shutdown if graceful shutdown fails
            await this.emergencyShutdown(error as Error);
        }
    }

    /**
     * Emergency shutdown when graceful shutdown fails
     */
    private async emergencyShutdown(error: Error): Promise<void> {
        logger.error('Emergency shutdown initiated', { error: error.message });

        try {
            // Save error state
            await this.saveEmergencyState(error);

            // Force close database connection
            if (databaseConnection.connection) {
                await databaseConnection.disconnect();
            }

            // Force exit
            process.exit(1);

        } catch (emergencyError) {
            logger.error('Emergency shutdown failed', {
                originalError: error.message,
                emergencyError: emergencyError instanceof Error ? emergencyError.message : 'Unknown error'
            });
            process.exit(1);
        }
    }

    /**
     * Notify all services to stop
     */
    private async notifyServicesToStop(): Promise<void> {
        logger.systemEvent('Notifying services to stop');

        const stopPromises: Promise<void>[] = [];

        for (const [name, service] of this.services.entries()) {
            if (service.status === 'running') {
                service.status = 'stopping';

                const callback = this.shutdownCallbacks.get(name);
                if (callback) {
                    stopPromises.push(
                        callback().catch(error => {
                            logger.error('Service shutdown callback failed', {
                                name,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        })
                    );
                }
            }
        }

        // Wait for all services to acknowledge shutdown
        await Promise.allSettled(stopPromises);
    }

    /**
     * Wait for services to stop gracefully
     */
    private async waitForServicesToStop(): Promise<void> {
        const startTime = Date.now();
        const timeout = this.config.timeout;

        logger.systemEvent('Waiting for services to stop', { timeout });

        while (Date.now() - startTime < timeout) {
            const runningServices = Array.from(this.services.values()).filter(
                service => service.status === 'running' || service.status === 'stopping'
            );

            if (runningServices.length === 0) {
                logger.systemEvent('All services stopped gracefully');
                return;
            }

            // Check if any service has been stopping for too long
            const stuckServices = runningServices.filter(service => {
                if (service.status === 'stopping') {
                    const stoppingTime = Date.now() - service.lastActivity.getTime();
                    return stoppingTime > (timeout / 2); // Half of total timeout
                }
                return false;
            });

            if (stuckServices.length > 0) {
                logger.warn('Some services appear to be stuck during shutdown', {
                    services: stuckServices.map(s => s.name)
                });

                // Force mark as stopped
                stuckServices.forEach(service => {
                    service.status = 'stopped';
                });
            }

            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Timeout reached, force stop remaining services
        const stillRunning = Array.from(this.services.values()).filter(
            service => service.status === 'running' || service.status === 'stopping'
        );

        if (stillRunning.length > 0) {
            logger.warn('Shutdown timeout reached, forcing stop of remaining services', {
                services: stillRunning.map(s => s.name)
            });

            stillRunning.forEach(service => {
                service.status = 'stopped';
            });
        }
    }

    /**
     * Cleanup resources
     */
    private async cleanupResources(): Promise<void> {
        logger.systemEvent('Cleaning up resources');

        try {
            // Close database connection
            if (databaseConnection.connection) {
                await databaseConnection.disconnect();
                logger.info('Database connection closed');
            }

            // Close any open file handles
            // This is handled automatically by Node.js, but we can add custom cleanup here

            // Clear any caches
            if (global.gc) {
                global.gc();
                logger.info('Garbage collection triggered');
            }

            logger.systemEvent('Resource cleanup completed');

        } catch (error) {
            logger.error('Error during resource cleanup', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Save application state
     */
    private async saveApplicationState(): Promise<void> {
        try {
            const state: ApplicationState = {
                services: new Map(this.services),
                lastSave: new Date(),
                version: process.env.npm_package_version || '1.0.0',
                uptime: process.uptime()
            };

            const stateData = {
                services: Array.from(state.services.entries()),
                lastSave: state.lastSave,
                version: state.version,
                uptime: state.uptime,
                shutdownInProgress: this.isShuttingDown
            };

            await fs.promises.writeFile(this.statePath, JSON.stringify(stateData, null, 2));

            logger.systemEvent('Application state saved', {
                services: this.services.size,
                uptime: state.uptime
            });

        } catch (error) {
            logger.error('Failed to save application state', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Save emergency state
     */
    private async saveEmergencyState(error: Error): Promise<void> {
        try {
            const emergencyState = {
                error: {
                    message: error.message,
                    stack: error.stack,
                    timestamp: new Date().toISOString()
                },
                services: Array.from(this.services.entries()),
                uptime: process.uptime(),
                shutdownInProgress: this.isShuttingDown
            };

            const emergencyPath = path.join(this.config.stateDir, 'emergency-state.json');
            await fs.promises.writeFile(emergencyPath, JSON.stringify(emergencyState, null, 2));

            logger.systemEvent('Emergency state saved', { errorPath: emergencyPath });

        } catch (emergencyError) {
            logger.error('Failed to save emergency state', {
                error: emergencyError instanceof Error ? emergencyError.message : 'Unknown error'
            });
        }
    }

    /**
     * Load application state
     */
    public async loadApplicationState(): Promise<ApplicationState | null> {
        try {
            if (!fs.existsSync(this.statePath)) {
                return null;
            }

            const data = await fs.promises.readFile(this.statePath, 'utf8');
            const stateData = JSON.parse(data);

            // Check if we're recovering from an unexpected shutdown
            if (!stateData.shutdownInProgress) {
                logger.warn('Application state indicates unexpected shutdown');
            }

            const state: ApplicationState = {
                services: new Map(stateData.services),
                lastSave: new Date(stateData.lastSave),
                version: stateData.version,
                uptime: stateData.uptime
            };

            logger.systemEvent('Application state loaded', {
                services: state.services.size,
                lastSave: state.lastSave,
                version: state.version
            });

            return state;

        } catch (error) {
            logger.error('Failed to load application state', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }

    /**
     * Reload configuration
     */
    private async reloadConfiguration(): Promise<void> {
        logger.systemEvent('Configuration reload requested');

        // TODO: Implement configuration reload logic
        // This would typically involve reloading environment variables,
        // configuration files, or connecting to a configuration service
    }

    /**
     * Get shutdown status
     */
    public getShutdownStatus(): any {
        return {
            isShuttingDown: this.isShuttingDown,
            shutdownStartTime: this.shutdownStartTime,
            services: Array.from(this.services.values()),
            registeredCallbacks: this.shutdownCallbacks.size,
            config: this.config
        };
    }

    /**
     * Get service status
     */
    public getServiceStatus(name?: string): any {
        if (name) {
            return this.services.get(name);
        }

        return Array.from(this.services.values());
    }

    /**
     * Check if shutdown is in progress
     */
    public isShutdownInProgress(): boolean {
        return this.isShuttingDown;
    }

    /**
     * Force shutdown (for testing or emergency use)
     */
    public async forceShutdown(reason: string = 'force'): Promise<void> {
        logger.systemEvent('Force shutdown requested', { reason });
        await this.initiateShutdown(`force-${reason}`);
    }
}

export default GracefulShutdown;
