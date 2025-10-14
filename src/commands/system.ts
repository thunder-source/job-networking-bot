import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import ErrorHandlingManager from '../services/errorHandlingManager.js';
import { defaultErrorHandlingConfig } from '../config/errorHandling.js';
import logger from '../utils/winstonLogger.js';

const systemCommand = new Command('system');

systemCommand
    .description('System management and monitoring commands')
    .option('-v, --verbose', 'Enable verbose output')
    .option('--config', 'Show current configuration');

// Health check command
systemCommand
    .command('health')
    .description('Check system health status')
    .action(async (options) => {
        const spinner = ora('Checking system health...').start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const health = errorManager.getSystemHealth();
            const isHealthy = errorManager.isSystemHealthy();

            spinner.stop();

            console.log(chalk.bold('\n📊 System Health Report'));
            console.log(chalk.gray('=' * 50));

            // Overall status
            const statusColor = isHealthy ? chalk.green : chalk.red;
            const statusIcon = isHealthy ? '✅' : '❌';
            console.log(`${statusIcon} Overall Status: ${statusColor(isHealthy ? 'HEALTHY' : 'UNHEALTHY')}`);

            // Error handling
            console.log(chalk.bold('\n🚨 Error Handling:'));
            console.log(`  • Total Errors: ${health.errorHandling.totalErrors}`);
            console.log(`  • Recent Errors: ${health.errorHandling.recentErrors}`);
            console.log(`  • Service Stats: ${Object.keys(health.errorHandling.serviceStats).length} services`);

            // Process monitoring
            console.log(chalk.bold('\n🔄 Process Monitoring:'));
            console.log(`  • Active: ${health.processMonitoring.active ? 'Yes' : 'No'}`);
            console.log(`  • Running: ${health.processMonitoring.runningProcesses}/${health.processMonitoring.totalProcesses}`);
            console.log(`  • Total Restarts: ${health.processMonitoring.totalRestarts}`);

            // Database backup
            console.log(chalk.bold('\n💾 Database Backup:'));
            console.log(`  • Enabled: ${health.databaseBackup.enabled ? 'Yes' : 'No'}`);
            console.log(`  • Total Backups: ${health.databaseBackup.totalBackups}`);
            console.log(`  • Last Backup: ${health.databaseBackup.lastBackup ? new Date(health.databaseBackup.lastBackup).toLocaleString() : 'Never'}`);

            // Debug mode
            console.log(chalk.bold('\n🐛 Debug Mode:'));
            console.log(`  • Enabled: ${health.debugMode.enabled ? 'Yes' : 'No'}`);
            console.log(`  • Active Timers: ${health.debugMode.activeTimers}`);
            console.log(`  • Memory Usage: ${health.debugMode.memoryUsage} MB`);

            // System info
            console.log(chalk.bold('\n💻 System Info:'));
            console.log(`  • Uptime: ${Math.round(health.system.uptime / 60)} minutes`);
            console.log(`  • Memory: ${Math.round(health.system.memoryUsage.rss / 1024 / 1024)} MB`);
            console.log(`  • Version: ${health.system.version}`);

        } catch (error) {
            spinner.fail('Failed to check system health');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

// Backup management commands
const backupCommand = systemCommand
    .command('backup')
    .description('Database backup management');

backupCommand
    .command('create')
    .description('Create a manual database backup')
    .action(async () => {
        const spinner = ora('Creating database backup...').start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const backupInfo = await errorManager.createManualBackup();

            spinner.succeed('Database backup created successfully');

            console.log(chalk.green('\n✅ Backup Details:'));
            console.log(`  • ID: ${backupInfo.id}`);
            console.log(`  • Size: ${Math.round(backupInfo.size / 1024)} KB`);
            console.log(`  • Collections: ${backupInfo.collections.length}`);
            console.log(`  • Compressed: ${backupInfo.compressed ? 'Yes' : 'No'}`);
            console.log(`  • Encrypted: ${backupInfo.encrypted ? 'Yes' : 'No'}`);
            console.log(`  • Timestamp: ${backupInfo.timestamp.toLocaleString()}`);

        } catch (error) {
            spinner.fail('Failed to create backup');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

backupCommand
    .command('list')
    .description('List available backups')
    .option('-l, --limit <number>', 'Limit number of backups shown', '10')
    .action(async (options) => {
        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const backups = errorManager.listBackups();
            const limit = parseInt(options.limit);
            const recentBackups = backups.slice(-limit).reverse();

            console.log(chalk.bold(`\n📋 Recent Backups (${recentBackups.length}/${backups.length}):`));
            console.log(chalk.gray('=' * 80));

            if (recentBackups.length === 0) {
                console.log(chalk.yellow('No backups found'));
                return;
            }

            recentBackups.forEach((backup, index) => {
                const statusColor = backup.status === 'success' ? chalk.green : chalk.red;
                const statusIcon = backup.status === 'success' ? '✅' : '❌';

                console.log(`\n${index + 1}. ${statusIcon} ${chalk.bold(backup.id)}`);
                console.log(`   ${chalk.gray('Status:')} ${statusColor(backup.status.toUpperCase())}`);
                console.log(`   ${chalk.gray('Size:')} ${Math.round(backup.size / 1024)} KB`);
                console.log(`   ${chalk.gray('Collections:')} ${backup.collections}`);
                console.log(`   ${chalk.gray('Compressed:')} ${backup.compressed ? 'Yes' : 'No'}`);
                console.log(`   ${chalk.gray('Encrypted:')} ${backup.encrypted ? 'Yes' : 'No'}`);
                console.log(`   ${chalk.gray('Timestamp:')} ${new Date(backup.timestamp).toLocaleString()}`);
            });

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

backupCommand
    .command('restore <backupId>')
    .description('Restore from a backup')
    .option('-f, --force', 'Force restore without confirmation')
    .action(async (backupId, options) => {
        if (!options.force) {
            console.log(chalk.yellow('⚠️  This will restore the database from backup:'), backupId);
            console.log(chalk.yellow('   This action will overwrite current data!'));

            const { confirm } = await import('inquirer').then(m => m.default).catch(() => ({ default: {} }));
            const answers = await confirm([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you want to continue?',
                    default: false
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.blue('Restore cancelled'));
                return;
            }
        }

        const spinner = ora(`Restoring from backup ${backupId}...`).start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            await errorManager.restoreFromBackup(backupId);

            spinner.succeed('Database restored successfully');
            console.log(chalk.green('\n✅ Restore completed'));

        } catch (error) {
            spinner.fail('Failed to restore backup');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

// Debug management commands
const debugCommand = systemCommand
    .command('debug')
    .description('Debug mode management');

debugCommand
    .command('status')
    .description('Show debug mode status')
    .action(async () => {
        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const debugStats = errorManager.getDebugStatistics();

            console.log(chalk.bold('\n🐛 Debug Mode Status:'));
            console.log(chalk.gray('=' * 40));

            const statusColor = debugStats.enabled ? chalk.green : chalk.red;
            const statusIcon = debugStats.enabled ? '✅' : '❌';
            console.log(`${statusIcon} Debug Mode: ${statusColor(debugStats.enabled ? 'ENABLED' : 'DISABLED')}`);

            console.log(`\n📊 Statistics:`);
            console.log(`  • Log Level: ${debugStats.logLevel}`);
            console.log(`  • Active Timers: ${debugStats.activeTimers}`);
            console.log(`  • Performance Metrics: ${debugStats.performanceMetrics.total} total, ${debugStats.performanceMetrics.recent} recent`);
            console.log(`  • Average Duration: ${debugStats.performanceMetrics.averageDuration}ms`);
            console.log(`  • Memory Snapshots: ${debugStats.memorySnapshots.total} total, ${debugStats.memorySnapshots.recent} recent`);
            console.log(`  • Current Memory Usage: ${debugStats.memorySnapshots.currentUsage} MB`);
            console.log(`  • System Uptime: ${Math.round(debugStats.uptime / 60)} minutes`);

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

debugCommand
    .command('enable')
    .description('Enable debug mode')
    .action(async () => {
        const spinner = ora('Enabling debug mode...').start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            errorManager.setDebugMode(true);

            spinner.succeed('Debug mode enabled');
            console.log(chalk.green('\n✅ Debug mode is now active'));
            console.log(chalk.gray('   • Enhanced logging enabled'));
            console.log(chalk.gray('   • Performance monitoring active'));
            console.log(chalk.gray('   • Memory usage tracking enabled'));

        } catch (error) {
            spinner.fail('Failed to enable debug mode');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

debugCommand
    .command('disable')
    .description('Disable debug mode')
    .action(async () => {
        const spinner = ora('Disabling debug mode...').start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            errorManager.setDebugMode(false);

            spinner.succeed('Debug mode disabled');
            console.log(chalk.green('\n✅ Debug mode is now inactive'));

        } catch (error) {
            spinner.fail('Failed to disable debug mode');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

// Process management commands
const processCommand = systemCommand
    .command('process')
    .description('Process monitoring management');

processCommand
    .command('status')
    .description('Show process monitoring status')
    .action(async () => {
        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const processStats = errorManager.getProcessStatistics();

            console.log(chalk.bold('\n🔄 Process Monitoring Status:'));
            console.log(chalk.gray('=' * 40));

            const statusColor = processStats.monitoringActive ? chalk.green : chalk.red;
            const statusIcon = processStats.monitoringActive ? '✅' : '❌';
            console.log(`${statusIcon} Monitoring: ${statusColor(processStats.monitoringActive ? 'ACTIVE' : 'INACTIVE')}`);

            console.log(`\n📊 Statistics:`);
            console.log(`  • Total Processes: ${processStats.totalProcesses}`);
            console.log(`  • Running Processes: ${processStats.runningProcesses}`);
            console.log(`  • Stopped Processes: ${processStats.stoppedProcesses}`);
            console.log(`  • Total Restarts: ${processStats.totalRestarts}`);

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

// Error management commands
const errorCommand = systemCommand
    .command('error')
    .description('Error handling management');

errorCommand
    .command('stats')
    .description('Show error statistics')
    .action(async () => {
        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            const errorStats = errorManager.getErrorStatistics();

            console.log(chalk.bold('\n🚨 Error Statistics:'));
            console.log(chalk.gray('=' * 40));

            console.log(`\n📊 Overview:`);
            console.log(`  • Total Errors: ${errorStats.totalErrors}`);
            console.log(`  • Error Types: ${Object.keys(errorStats.errorCounts).length}`);
            console.log(`  • Last Updated: ${new Date(errorStats.lastUpdated).toLocaleString()}`);

            if (Object.keys(errorStats.serviceStats).length > 0) {
                console.log(`\n🔧 Service Breakdown:`);
                Object.entries(errorStats.serviceStats).forEach(([service, count]) => {
                    const countColor = count > 10 ? chalk.red : count > 5 ? chalk.yellow : chalk.green;
                    console.log(`  • ${service}: ${countColor(count)} errors`);
                });
            }

            if (Object.keys(errorStats.errorCounts).length > 0) {
                console.log(`\n📋 Recent Errors:`);
                Object.entries(errorStats.errorCounts).forEach(([key, data]: [string, any]) => {
                    const [service, operation] = key.split(':');
                    const timeAgo = Math.round((Date.now() - new Date(data.firstOccurrence).getTime()) / 60000);
                    console.log(`  • ${service}:${operation} - ${data.count} errors (${timeAgo}m ago)`);
                });
            }

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

errorCommand
    .command('reset')
    .description('Reset error counts')
    .option('-f, --force', 'Force reset without confirmation')
    .action(async (options) => {
        if (!options.force) {
            console.log(chalk.yellow('⚠️  This will reset all error counts'));

            const { confirm } = await import('inquirer').then(m => m.default).catch(() => ({ default: {} }));
            const answers = await confirm([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you want to reset error counts?',
                    default: false
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.blue('Reset cancelled'));
                return;
            }
        }

        const spinner = ora('Resetting error counts...').start();

        try {
            const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);
            await errorManager.initialize();

            errorManager.resetErrorCounts();

            spinner.succeed('Error counts reset successfully');
            console.log(chalk.green('\n✅ All error counts have been reset'));

        } catch (error) {
            spinner.fail('Failed to reset error counts');
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

// Configuration command
systemCommand
    .command('config')
    .description('Show current error handling configuration')
    .action(async () => {
        try {
            console.log(chalk.bold('\n⚙️  Error Handling Configuration:'));
            console.log(chalk.gray('=' * 50));

            const config = defaultErrorHandlingConfig;

            console.log(chalk.bold('\n🚨 Error Handler:'));
            console.log(`  • Enabled: ${config.errorHandler.enabled}`);
            console.log(`  • Email Alerts: ${config.errorHandler.email.enabled}`);
            console.log(`  • Recipients: ${config.errorHandler.email.recipients.length}`);
            console.log(`  • Error Threshold: ${config.errorHandler.criticalErrorThreshold}`);
            console.log(`  • Error Window: ${config.errorHandler.errorWindowMs / 60000} minutes`);

            console.log(chalk.bold('\n💾 Database Backup:'));
            console.log(`  • Enabled: ${config.databaseBackup.enabled}`);
            console.log(`  • Backup Dir: ${config.databaseBackup.backupDir}`);
            console.log(`  • Max Backups: ${config.databaseBackup.maxBackups}`);
            console.log(`  • Interval: ${config.databaseBackup.backupInterval / 3600000} hours`);
            console.log(`  • Compression: ${config.databaseBackup.compression}`);
            console.log(`  • Retention: ${config.databaseBackup.retentionDays} days`);

            console.log(chalk.bold('\n🔄 Process Monitor:'));
            config.processMonitor.forEach((process, index) => {
                console.log(`  • Process ${index + 1}: ${process.name}`);
                console.log(`    - Script: ${process.script}`);
                console.log(`    - Max Restarts: ${process.maxRestarts}`);
                console.log(`    - Max Memory: ${process.maxMemory} MB`);
            });

            console.log(chalk.bold('\n🛑 Graceful Shutdown:'));
            console.log(`  • Timeout: ${config.gracefulShutdown.timeout / 1000} seconds`);
            console.log(`  • Save State: ${config.gracefulShutdown.saveState}`);
            console.log(`  • Cleanup Resources: ${config.gracefulShutdown.cleanupResources}`);
            console.log(`  • State Dir: ${config.gracefulShutdown.stateDir}`);

        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
            process.exit(1);
        }
    });

export default systemCommand;
