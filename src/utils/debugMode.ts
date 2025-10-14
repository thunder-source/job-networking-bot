import logger from './winstonLogger.js';

export interface DebugConfig {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    includeStackTraces: boolean;
    logPerformance: boolean;
    logMemoryUsage: boolean;
    logNetworkRequests: boolean;
    logDatabaseQueries: boolean;
    logFileOperations: boolean;
    maxLogSize: number; // MB
    logRetention: number; // days
}

export interface PerformanceMetric {
    operation: string;
    duration: number;
    timestamp: Date;
    metadata?: any;
}

export interface MemorySnapshot {
    timestamp: Date;
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
}

class DebugMode {
    private config: DebugConfig;
    private performanceMetrics: PerformanceMetric[] = [];
    private memorySnapshots: MemorySnapshot[] = [];
    private operationTimers: Map<string, number> = new Map();
    private isMonitoring: boolean = false;

    constructor(config: DebugConfig) {
        this.config = config;
        this.setupMonitoring();
    }

    /**
     * Setup monitoring if debug mode is enabled
     */
    private setupMonitoring(): void {
        if (!this.config.enabled) return;

        // Setup performance monitoring
        if (this.config.logPerformance) {
            this.startPerformanceMonitoring();
        }

        // Setup memory monitoring
        if (this.config.logMemoryUsage) {
            this.startMemoryMonitoring();
        }

        // Setup process monitoring
        this.setupProcessMonitoring();

        logger.systemEvent('Debug mode initialized', {
            logLevel: this.config.logLevel,
            performanceMonitoring: this.config.logPerformance,
            memoryMonitoring: this.config.logMemoryUsage
        });
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        setInterval(() => {
            if (this.performanceMetrics.length > 0) {
                const recentMetrics = this.performanceMetrics.filter(
                    metric => Date.now() - metric.timestamp.getTime() < 60000 // Last minute
                );

                if (recentMetrics.length > 0) {
                    const avgDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length;
                    const slowOperations = recentMetrics.filter(m => m.duration > 1000); // > 1 second

                    logger.performance('Performance summary', {
                        recentOperations: recentMetrics.length,
                        averageDuration: Math.round(avgDuration),
                        slowOperations: slowOperations.length,
                        operations: recentMetrics.map(m => ({
                            operation: m.operation,
                            duration: m.duration
                        }))
                    });
                }
            }
        }, 60000); // Every minute
    }

    /**
     * Start memory monitoring
     */
    private startMemoryMonitoring(): void {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const snapshot: MemorySnapshot = {
                timestamp: new Date(),
                ...memUsage
            };

            this.memorySnapshots.push(snapshot);

            // Keep only recent snapshots (last hour)
            const cutoff = Date.now() - 3600000; // 1 hour
            this.memorySnapshots = this.memorySnapshots.filter(
                s => s.timestamp.getTime() > cutoff
            );

            // Log if memory usage is high
            const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            if (memUsageMB > 500) { // > 500MB
                logger.warn('High memory usage detected', {
                    heapUsed: memUsageMB,
                    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                    rss: Math.round(memUsage.rss / 1024 / 1024)
                });
            }

        }, 30000); // Every 30 seconds
    }

    /**
     * Setup process monitoring
     */
    private setupProcessMonitoring(): void {
        process.on('warning', (warning) => {
            logger.debug('Process warning', {
                name: warning.name,
                message: warning.message,
                stack: this.config.includeStackTraces ? warning.stack : undefined
            });
        });

        // Monitor unhandled promise rejections in debug mode
        process.on('unhandledRejection', (reason, promise) => {
            logger.debug('Unhandled promise rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                promise: promise.toString(),
                stack: this.config.includeStackTraces && reason instanceof Error ? reason.stack : undefined
            });
        });
    }

    /**
     * Start timing an operation
     */
    public startTimer(operation: string): void {
        if (!this.config.enabled || !this.config.logPerformance) return;

        this.operationTimers.set(operation, Date.now());
        logger.debug('Operation started', { operation });
    }

    /**
     * End timing an operation
     */
    public endTimer(operation: string, metadata?: any): void {
        if (!this.config.enabled || !this.config.logPerformance) return;

        const startTime = this.operationTimers.get(operation);
        if (!startTime) {
            logger.warn('Timer not found for operation', { operation });
            return;
        }

        const duration = Date.now() - startTime;
        this.operationTimers.delete(operation);

        const metric: PerformanceMetric = {
            operation,
            duration,
            timestamp: new Date(),
            metadata
        };

        this.performanceMetrics.push(metric);

        // Log performance metric
        logger.performance(`Operation completed: ${operation}`, {
            duration,
            operation,
            metadata
        });

        // Keep only recent metrics (last hour)
        const cutoff = Date.now() - 3600000; // 1 hour
        this.performanceMetrics = this.performanceMetrics.filter(
            m => m.timestamp.getTime() > cutoff
        );
    }

    /**
     * Log debug information
     */
    public log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        if (!this.config.enabled) return;

        const logData = {
            ...data,
            debugMode: true,
            timestamp: new Date().toISOString()
        };

        switch (level) {
            case 'debug':
                logger.debug(message, logData);
                break;
            case 'info':
                logger.info(message, logData);
                break;
            case 'warn':
                logger.warn(message, logData);
                break;
            case 'error':
                logger.error(message, logData);
                break;
        }
    }

    /**
     * Log network request
     */
    public logNetworkRequest(method: string, url: string, statusCode?: number, duration?: number): void {
        if (!this.config.enabled || !this.config.logNetworkRequests) return;

        logger.debug('Network request', {
            method,
            url,
            statusCode,
            duration,
            category: 'network'
        });
    }

    /**
     * Log database query
     */
    public logDatabaseQuery(collection: string, operation: string, duration?: number, resultCount?: number): void {
        if (!this.config.enabled || !this.config.logDatabaseQueries) return;

        logger.debug('Database query', {
            collection,
            operation,
            duration,
            resultCount,
            category: 'database'
        });
    }

    /**
     * Log file operation
     */
    public logFileOperation(operation: string, filePath: string, success: boolean, size?: number): void {
        if (!this.config.enabled || !this.config.logFileOperations) return;

        logger.debug('File operation', {
            operation,
            filePath,
            success,
            size,
            category: 'file'
        });
    }

    /**
     * Wrap a function with debug timing
     */
    public wrapWithTiming<T extends any[], R>(
        fn: (...args: T) => Promise<R>,
        operationName: string
    ): (...args: T) => Promise<R> {
        return async (...args: T): Promise<R> => {
            this.startTimer(operationName);
            try {
                const result = await fn(...args);
                this.endTimer(operationName, { success: true });
                return result;
            } catch (error) {
                this.endTimer(operationName, {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }
        };
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(timeWindow?: number): PerformanceMetric[] {
        if (!timeWindow) return [...this.performanceMetrics];

        const cutoff = Date.now() - timeWindow;
        return this.performanceMetrics.filter(m => m.timestamp.getTime() > cutoff);
    }

    /**
     * Get memory snapshots
     */
    public getMemorySnapshots(timeWindow?: number): MemorySnapshot[] {
        if (!timeWindow) return [...this.memorySnapshots];

        const cutoff = Date.now() - timeWindow;
        return this.memorySnapshots.filter(s => s.timestamp.getTime() > cutoff);
    }

    /**
     * Get debug statistics
     */
    public getDebugStats(): any {
        const recentMetrics = this.getPerformanceMetrics(300000); // Last 5 minutes
        const recentSnapshots = this.getMemorySnapshots(300000); // Last 5 minutes

        return {
            enabled: this.config.enabled,
            logLevel: this.config.logLevel,
            activeTimers: this.operationTimers.size,
            performanceMetrics: {
                total: this.performanceMetrics.length,
                recent: recentMetrics.length,
                averageDuration: recentMetrics.length > 0 ?
                    Math.round(recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length) : 0
            },
            memorySnapshots: {
                total: this.memorySnapshots.length,
                recent: recentSnapshots.length,
                currentUsage: recentSnapshots.length > 0 ?
                    Math.round(recentSnapshots[recentSnapshots.length - 1].heapUsed / 1024 / 1024) : 0
            },
            uptime: process.uptime()
        };
    }

    /**
     * Clear debug data
     */
    public clearDebugData(): void {
        this.performanceMetrics = [];
        this.memorySnapshots = [];
        this.operationTimers.clear();

        logger.debug('Debug data cleared');
    }

    /**
     * Enable/disable debug mode
     */
    public setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;

        if (enabled) {
            this.setupMonitoring();
        } else {
            this.isMonitoring = false;
        }

        logger.systemEvent('Debug mode toggled', { enabled });
    }

    /**
     * Update debug configuration
     */
    public updateConfig(newConfig: Partial<DebugConfig>): void {
        this.config = { ...this.config, ...newConfig };

        if (this.config.enabled) {
            this.setupMonitoring();
        }

        logger.systemEvent('Debug configuration updated', { config: newConfig });
    }

    /**
     * Check if debug mode is enabled
     */
    public isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get current configuration
     */
    public getConfig(): DebugConfig {
        return { ...this.config };
    }

    /**
     * Create a debug context for operations
     */
    public createContext(operation: string): DebugContext {
        return new DebugContext(this, operation);
    }
}

/**
 * Debug context for tracking operations
 */
class DebugContext {
    private debugMode: DebugMode;
    private operation: string;
    private startTime: number;

    constructor(debugMode: DebugMode, operation: string) {
        this.debugMode = debugMode;
        this.operation = operation;
        this.startTime = Date.now();

        debugMode.startTimer(operation);
    }

    /**
     * Log debug information within this context
     */
    public log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        this.debugMode.log(level, `${this.operation}: ${message}`, data);
    }

    /**
     * Complete the operation
     */
    public complete(metadata?: any): void {
        this.debugMode.endTimer(this.operation, metadata);
    }

    /**
     * Complete with error
     */
    public error(error: Error, metadata?: any): void {
        this.debugMode.endTimer(this.operation, {
            success: false,
            error: error.message,
            ...metadata
        });
    }
}

// Create singleton instance
const debugMode = new DebugMode({
    enabled: process.env.DEBUG_MODE === 'true' || process.env.NODE_ENV === 'development',
    logLevel: (process.env.DEBUG_LOG_LEVEL as any) || 'debug',
    includeStackTraces: process.env.DEBUG_INCLUDE_STACK === 'true',
    logPerformance: process.env.DEBUG_PERFORMANCE !== 'false',
    logMemoryUsage: process.env.DEBUG_MEMORY !== 'false',
    logNetworkRequests: process.env.DEBUG_NETWORK !== 'false',
    logDatabaseQueries: process.env.DEBUG_DATABASE !== 'false',
    logFileOperations: process.env.DEBUG_FILES !== 'false',
    maxLogSize: parseInt(process.env.DEBUG_MAX_LOG_SIZE || '100'),
    logRetention: parseInt(process.env.DEBUG_LOG_RETENTION || '7')
});

export default debugMode;
export { DebugContext };
