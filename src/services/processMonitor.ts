import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import logger from '../utils/winstonLogger.js';
import ErrorHandler from './errorHandler.js';

export interface ProcessConfig {
    name: string;
    script: string;
    args?: string[];
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    restartDelay?: number;
    maxRestarts?: number;
    maxMemory?: number; // MB
    maxCpuTime?: number; // seconds
    healthCheckInterval?: number; // ms
    healthCheckTimeout?: number; // ms
    restartOnExit?: boolean;
    restartOnMemoryExceed?: boolean;
    restartOnCpuExceed?: boolean;
}

export interface ProcessStats {
    pid: number;
    startTime: Date;
    restarts: number;
    lastRestart?: Date;
    memoryUsage: number;
    cpuUsage: number;
    status: 'running' | 'stopped' | 'error' | 'restarting';
    healthCheck: {
        lastCheck: Date;
        status: 'healthy' | 'unhealthy' | 'unknown';
        responseTime?: number;
    };
}

class ProcessMonitor {
    private processes: Map<string, ChildProcess> = new Map();
    private processConfigs: Map<string, ProcessConfig> = new Map();
    private processStats: Map<string, ProcessStats> = new Map();
    private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
    private errorHandler: ErrorHandler;
    private monitoringActive: boolean = false;
    private stateBackupPath: string;

    constructor(errorHandler: ErrorHandler) {
        this.errorHandler = errorHandler;
        this.stateBackupPath = path.join(process.cwd(), 'backups', 'process-state.json');
        this.setupGlobalHandlers();
        this.loadProcessState();
    }

    /**
     * Setup global process handlers
     */
    private setupGlobalHandlers(): void {
        process.on('exit', () => {
            this.stopAllProcesses();
        });

        process.on('SIGTERM', () => {
            this.stopAllProcesses();
        });

        process.on('SIGINT', () => {
            this.stopAllProcesses();
        });
    }

    /**
     * Register a process for monitoring
     */
    public registerProcess(config: ProcessConfig): void {
        this.processConfigs.set(config.name, config);
        this.processStats.set(config.name, {
            pid: 0,
            startTime: new Date(),
            restarts: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            status: 'stopped',
            healthCheck: {
                lastCheck: new Date(),
                status: 'unknown'
            }
        });

        logger.systemEvent('Process registered for monitoring', {
            name: config.name,
            script: config.script
        });
    }

    /**
     * Start monitoring a process
     */
    public async startProcess(name: string): Promise<boolean> {
        const config = this.processConfigs.get(name);
        if (!config) {
            logger.error('Process not registered', { name });
            return false;
        }

        try {
            await this.spawnProcess(name, config);
            this.startHealthCheck(name);
            this.monitoringActive = true;

            logger.systemEvent('Process started successfully', {
                name,
                pid: this.processStats.get(name)?.pid
            });

            return true;

        } catch (error) {
            logger.error('Failed to start process', {
                name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Spawn a new process
     */
    private async spawnProcess(name: string, config: ProcessConfig): Promise<void> {
        const stats = this.processStats.get(name);
        if (!stats) return;

        return new Promise((resolve, reject) => {
            try {
                const child = spawn('node', [config.script, ...(config.args || [])], {
                    cwd: config.cwd || process.cwd(),
                    env: { ...process.env, ...config.env },
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                this.processes.set(name, child);
                stats.pid = child.pid || 0;
                stats.startTime = new Date();
                stats.status = 'running';

                // Handle process events
                child.on('exit', (code, signal) => {
                    this.handleProcessExit(name, code, signal);
                });

                child.on('error', (error) => {
                    this.handleProcessError(name, error);
                });

                // Handle stdout
                child.stdout?.on('data', (data) => {
                    logger.info(`[${name}] ${data.toString().trim()}`);
                });

                // Handle stderr
                child.stderr?.on('data', (data) => {
                    logger.error(`[${name}] ${data.toString().trim()}`);
                });

                // Wait for process to start
                setTimeout(() => {
                    if (child.pid && !child.killed) {
                        resolve();
                    } else {
                        reject(new Error('Process failed to start'));
                    }
                }, 1000);

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle process exit
     */
    private handleProcessExit(name: string, code: number | null, signal: string | null): void {
        const config = this.processConfigs.get(name);
        const stats = this.processStats.get(name);

        if (!config || !stats) return;

        logger.systemEvent('Process exited', {
            name,
            code,
            signal,
            restarts: stats.restarts
        });

        stats.status = code === 0 ? 'stopped' : 'error';

        // Attempt restart if configured
        if (config.restartOnExit && stats.restarts < (config.maxRestarts || 5)) {
            setTimeout(() => {
                this.restartProcess(name);
            }, config.restartDelay || 5000);
        } else if (stats.restarts >= (config.maxRestarts || 5)) {
            logger.error('Max restarts exceeded for process', {
                name,
                maxRestarts: config.maxRestarts || 5
            });

            // Send critical error alert
            this.errorHandler.handleCriticalError(
                this.errorHandler.createCriticalError(
                    new Error(`Process ${name} exceeded maximum restart attempts`),
                    {
                        service: 'process-monitor',
                        operation: 'restart-limit-exceeded',
                        metadata: { name, restarts: stats.restarts, maxRestarts: config.maxRestarts }
                    },
                    'critical',
                    false
                )
            );
        }
    }

    /**
     * Handle process errors
     */
    private handleProcessError(name: string, error: Error): void {
        logger.error('Process error', {
            name,
            error: error.message,
            stack: error.stack
        });

        const stats = this.processStats.get(name);
        if (stats) {
            stats.status = 'error';
        }

        // Send error alert
        this.errorHandler.handleCriticalError(
            this.errorHandler.createCriticalError(
                error,
                {
                    service: 'process-monitor',
                    operation: 'process-error',
                    metadata: { name }
                },
                'high',
                true
            )
        );
    }

    /**
     * Restart a process
     */
    public async restartProcess(name: string): Promise<boolean> {
        const config = this.processConfigs.get(name);
        const stats = this.processStats.get(name);

        if (!config || !stats) {
            logger.error('Cannot restart process - not found', { name });
            return false;
        }

        logger.systemEvent('Restarting process', {
            name,
            currentRestarts: stats.restarts
        });

        stats.status = 'restarting';
        stats.restarts++;
        stats.lastRestart = new Date();

        // Stop current process
        await this.stopProcess(name);

        // Start new process
        try {
            await this.spawnProcess(name, config);
            this.startHealthCheck(name);

            logger.systemEvent('Process restarted successfully', {
                name,
                newPid: stats.pid,
                totalRestarts: stats.restarts
            });

            return true;

        } catch (error) {
            logger.error('Failed to restart process', {
                name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Stop a process
     */
    public async stopProcess(name: string): Promise<void> {
        const process = this.processes.get(name);
        const stats = this.processStats.get(name);

        if (!process || !stats) {
            logger.warn('Process not found for stopping', { name });
            return;
        }

        logger.systemEvent('Stopping process', { name, pid: stats.pid });

        // Stop health check
        const healthCheckInterval = this.healthCheckIntervals.get(name);
        if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            this.healthCheckIntervals.delete(name);
        }

        // Kill process
        if (!process.killed) {
            process.kill('SIGTERM');

            // Force kill after 5 seconds
            setTimeout(() => {
                if (!process.killed) {
                    process.kill('SIGKILL');
                }
            }, 5000);
        }

        this.processes.delete(name);
        stats.status = 'stopped';
        stats.pid = 0;
    }

    /**
     * Start health check for a process
     */
    private startHealthCheck(name: string): void {
        const config = this.processConfigs.get(name);
        if (!config || !config.healthCheckInterval) return;

        const interval = setInterval(async () => {
            await this.performHealthCheck(name);
        }, config.healthCheckInterval);

        this.healthCheckIntervals.set(name, interval);
    }

    /**
     * Perform health check on a process
     */
    private async performHealthCheck(name: string): Promise<void> {
        const config = this.processConfigs.get(name);
        const stats = this.processStats.get(name);
        const process = this.processes.get(name);

        if (!config || !stats || !process) return;

        const startTime = Date.now();

        try {
            // Check if process is still running
            if (process.killed || !process.pid) {
                stats.healthCheck.status = 'unhealthy';
                stats.healthCheck.lastCheck = new Date();
                return;
            }

            // Get process memory usage
            const memoryUsage = process.memoryUsage?.() || { rss: 0 };
            stats.memoryUsage = Math.round(memoryUsage.rss / 1024 / 1024); // MB

            // Check memory limits
            if (config.maxMemory && stats.memoryUsage > config.maxMemory) {
                logger.warn('Process memory usage exceeded limit', {
                    name,
                    current: stats.memoryUsage,
                    limit: config.maxMemory
                });

                if (config.restartOnMemoryExceed) {
                    await this.restartProcess(name);
                    return;
                }
            }

            // TODO: Implement CPU usage monitoring
            // This would require platform-specific code

            const responseTime = Date.now() - startTime;
            stats.healthCheck.status = 'healthy';
            stats.healthCheck.lastCheck = new Date();
            stats.healthCheck.responseTime = responseTime;

        } catch (error) {
            stats.healthCheck.status = 'unhealthy';
            stats.healthCheck.lastCheck = new Date();

            logger.error('Health check failed', {
                name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get process statistics
     */
    public getProcessStats(name?: string): any {
        if (name) {
            return this.processStats.get(name);
        }

        return Object.fromEntries(this.processStats);
    }

    /**
     * Get all monitored processes
     */
    public getMonitoredProcesses(): string[] {
        return Array.from(this.processConfigs.keys());
    }

    /**
     * Stop all monitored processes
     */
    public async stopAllProcesses(): Promise<void> {
        logger.systemEvent('Stopping all monitored processes');

        const stopPromises = Array.from(this.processConfigs.keys()).map(name =>
            this.stopProcess(name)
        );

        await Promise.all(stopPromises);
        this.monitoringActive = false;

        // Save state
        await this.saveProcessState();
    }

    /**
     * Save process state to file
     */
    private async saveProcessState(): Promise<void> {
        try {
            const state = {
                processStats: Object.fromEntries(this.processStats),
                lastUpdated: new Date().toISOString()
            };

            await fs.promises.mkdir(path.dirname(this.stateBackupPath), { recursive: true });
            await fs.promises.writeFile(this.stateBackupPath, JSON.stringify(state, null, 2));

        } catch (error) {
            logger.error('Failed to save process state', { error });
        }
    }

    /**
     * Load process state from file
     */
    private async loadProcessState(): Promise<void> {
        try {
            if (fs.existsSync(this.stateBackupPath)) {
                const data = await fs.promises.readFile(this.stateBackupPath, 'utf8');
                const state = JSON.parse(data);

                // Restore process stats
                for (const [name, stats] of Object.entries(state.processStats)) {
                    this.processStats.set(name, stats as ProcessStats);
                }

                logger.info('Process state loaded from backup', {
                    lastUpdated: state.lastUpdated
                });
            }
        } catch (error) {
            logger.error('Failed to load process state', { error });
        }
    }

    /**
     * Check if monitoring is active
     */
    public isMonitoringActive(): boolean {
        return this.monitoringActive;
    }

    /**
     * Get monitoring statistics
     */
    public getMonitoringStats(): any {
        const totalProcesses = this.processConfigs.size;
        const runningProcesses = Array.from(this.processStats.values()).filter(
            stats => stats.status === 'running'
        ).length;
        const totalRestarts = Array.from(this.processStats.values()).reduce(
            (sum, stats) => sum + stats.restarts, 0
        );

        return {
            totalProcesses,
            runningProcesses,
            stoppedProcesses: totalProcesses - runningProcesses,
            totalRestarts,
            monitoringActive: this.monitoringActive,
            lastUpdated: new Date().toISOString()
        };
    }
}

export default ProcessMonitor;
