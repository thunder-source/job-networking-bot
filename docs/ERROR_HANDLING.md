# Comprehensive Error Handling System

This document describes the comprehensive error handling system implemented for the Cold Email Bot, including logging, monitoring, alerts, backups, and graceful shutdown capabilities.

## Overview

The error handling system provides:

- **Winston Logging**: Separate log files for errors, actions, and analytics
- **Error Handler**: Centralized error management with email alerts
- **Process Monitor**: Automatic restart on crashes with health checks
- **Database Backup**: Automated backups with compression and encryption
- **Graceful Shutdown**: State saving and resource cleanup
- **Debug Mode**: Verbose logging and performance monitoring

## Components

### 1. Winston Logger (`src/utils/winstonLogger.ts`)

Enhanced logging system with separate files for different log types:

```typescript
import logger from '../utils/winstonLogger.js';

// Standard logging
logger.info('Application started');
logger.error('Database connection failed', { error: error.message });

// Specialized logging methods
logger.action('LinkedIn profile scraped', { profileUrl, success: true });
logger.analytics('Email sent', { recipient, templateType, openRate: 0.25 });
logger.linkedinAction('CONNECTION_REQUEST', profileUrl, true, { message: 'Custom message' });
logger.emailAction('EMAIL_SENT', recipient, false, { error: 'SMTP timeout' });
logger.systemEvent('Process restarted', { pid: 1234, reason: 'memory_limit' });
logger.performance('Database query', 150, { collection: 'contacts', count: 100 });
```

**Log Files:**
- `logs/error-YYYY-MM-DD.log` - Error messages
- `logs/actions-YYYY-MM-DD.log` - User actions and automation
- `logs/analytics-YYYY-MM-DD.log` - Performance metrics and analytics
- `logs/info-YYYY-MM-DD.log` - General information
- `logs/debug-YYYY-MM-DD.log` - Debug information (when enabled)

### 2. Error Handler (`src/services/errorHandler.ts`)

Centralized error management with alerting and recovery:

```typescript
import ErrorHandler from '../services/errorHandler.js';

const errorHandler = new ErrorHandler({
    enabled: true,
    email: {
        enabled: true,
        recipients: ['admin@domain.com'],
        smtp: { /* SMTP configuration */ }
    },
    criticalErrorThreshold: 5,
    errorWindowMs: 3600000 // 1 hour
});

// Wrap functions with error handling
const safeFunction = errorHandler.wrapWithErrorHandling(
    riskyFunction,
    { service: 'linkedin', operation: 'scrapeProfile' }
);
```

**Features:**
- Automatic error categorization by severity
- Email alerts for critical errors
- Error frequency tracking
- Recovery action suggestions
- State persistence across restarts

### 3. Process Monitor (`src/services/processMonitor.ts`)

Process monitoring with automatic restart capabilities:

```typescript
import ProcessMonitor from '../services/processMonitor.js';

const processMonitor = new ProcessMonitor(errorHandler);

// Register process for monitoring
processMonitor.registerProcess({
    name: 'cold-email-bot',
    script: 'dist/index.js',
    maxRestarts: 5,
    maxMemory: 1024, // MB
    restartDelay: 5000
});

// Start monitoring
await processMonitor.startProcess('cold-email-bot');
```

**Features:**
- Automatic restart on crashes
- Memory usage monitoring
- Health check intervals
- Restart limit enforcement
- Process statistics tracking

### 4. Database Backup (`src/services/databaseBackup.ts`)

Automated database backup system:

```typescript
import DatabaseBackup from '../services/databaseBackup.js';

const backup = new DatabaseBackup({
    enabled: true,
    backupDir: './backups/database',
    maxBackups: 30,
    backupInterval: 86400000, // 24 hours
    compression: true,
    retentionDays: 90
});

// Start automatic backups
backup.startAutomaticBackups();

// Create manual backup
const backupInfo = await backup.createBackup();

// Restore from backup
await backup.restoreBackup(backupId);
```

**Features:**
- Automated daily backups
- Compression and encryption support
- Collection filtering (include/exclude)
- Backup rotation and cleanup
- Cloud storage integration (planned)

### 5. Graceful Shutdown (`src/services/gracefulShutdown.ts`)

State saving and resource cleanup:

```typescript
import GracefulShutdown from '../services/gracefulShutdown.js';

const shutdown = new GracefulShutdown({
    timeout: 30000,
    saveState: true,
    stateDir: './backups/state',
    cleanupResources: true
});

// Register services for shutdown
shutdown.registerService('database', async () => {
    await databaseConnection.disconnect();
});

shutdown.registerService('email-service', async () => {
    await emailService.close();
});
```

**Features:**
- Signal handling (SIGTERM, SIGINT)
- Service shutdown coordination
- State persistence
- Resource cleanup
- Emergency shutdown fallback

### 6. Debug Mode (`src/utils/debugMode.ts`)

Comprehensive debugging and performance monitoring:

```typescript
import debugMode from '../utils/debugMode.js';

// Enable debug mode
debugMode.setEnabled(true);

// Create debug context
const context = debugMode.createContext('linkedin-scraping');

try {
    context.log('debug', 'Starting profile scraping');
    // ... operation
    context.complete({ success: true, profiles: 10 });
} catch (error) {
    context.error(error, { success: false });
}

// Wrap functions with timing
const timedFunction = debugMode.wrapWithTiming(
    async () => { /* operation */ },
    'database-query'
);
```

**Features:**
- Performance timing
- Memory usage monitoring
- Network request logging
- Database query logging
- File operation tracking

## Configuration

### Environment Variables

Create a `.env` file based on `env.example`:

```bash
# Error Handling
ERROR_EMAIL_ENABLED=true
ERROR_EMAIL_RECIPIENTS=admin@domain.com
ERROR_THRESHOLD=5
ERROR_WINDOW_MS=3600000

# Database Backup
BACKUP_ENABLED=true
BACKUP_DIR=./backups/database
BACKUP_MAX_BACKUPS=30
BACKUP_INTERVAL=86400000

# Debug Mode
DEBUG_MODE=false
DEBUG_LOG_LEVEL=debug
DEBUG_PERFORMANCE=true
DEBUG_MEMORY=true

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
```

### Error Handling Manager

Central management interface:

```typescript
import ErrorHandlingManager from '../services/errorHandlingManager.js';
import { defaultErrorHandlingConfig } from '../config/errorHandling.js';

const errorManager = new ErrorHandlingManager(defaultErrorHandlingConfig);

// Initialize system
await errorManager.initialize();

// Check system health
const health = errorManager.getSystemHealth();
const isHealthy = errorManager.isSystemHealthy();

// Create backup
const backup = await errorManager.createManualBackup();

// Get statistics
const errorStats = errorManager.getErrorStatistics();
const processStats = errorManager.getProcessStatistics();
```

## CLI Commands

### System Health Check

```bash
npm run cli system health
```

Shows comprehensive system health including:
- Error statistics
- Process monitoring status
- Database backup status
- Debug mode status
- System resource usage

### Backup Management

```bash
# Create manual backup
npm run cli system backup create

# List available backups
npm run cli system backup list

# Restore from backup
npm run cli system backup restore <backup-id>
```

### Debug Mode Management

```bash
# Check debug status
npm run cli system debug status

# Enable debug mode
npm run cli system debug enable

# Disable debug mode
npm run cli system debug disable
```

### Process Monitoring

```bash
# Check process status
npm run cli system process status
```

### Error Management

```bash
# Show error statistics
npm run cli system error stats

# Reset error counts
npm run cli system error reset
```

### Configuration

```bash
# Show current configuration
npm run cli system config
```

## PM2 Integration

Use PM2 for production process management:

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Monitor processes
pm2 monit

# View logs
pm2 logs cold-email-bot

# Restart application
pm2 restart cold-email-bot

# Stop application
pm2 stop cold-email-bot
```

The `ecosystem.config.js` includes:
- Automatic restart on crashes
- Memory limit monitoring
- Log file management
- Environment-specific configurations
- Health check settings

## Monitoring and Alerts

### Email Alerts

Configure email alerts for critical errors:

```typescript
{
    email: {
        enabled: true,
        recipients: ['admin@domain.com', 'alerts@domain.com'],
        smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'your-email@gmail.com',
                pass: 'your-app-password'
            }
        }
    }
}
```

### Error Severity Levels

- **Critical**: System crashes, data corruption
- **High**: Service failures, authentication issues
- **Medium**: Rate limiting, temporary failures
- **Low**: Warnings, non-critical issues

### Recovery Actions

The system automatically suggests recovery actions based on error type:

- **LinkedIn Errors**: Wait for rate limit reset, check account status
- **Email Errors**: Verify SMTP settings, check credentials
- **Database Errors**: Check connection, verify credentials
- **AI Errors**: Verify API key, check quota

## Best Practices

### 1. Error Handling in Services

```typescript
// Wrap risky operations
const context = debugMode.createContext('linkedin-login');

try {
    context.log('debug', 'Starting LinkedIn login');
    const result = await linkedinService.login(credentials);
    context.complete({ success: true });
    return result;
} catch (error) {
    context.error(error, { success: false });
    
    // Log with specialized method
    logger.linkedinAction('LOGIN', credentials.email, false, { error: error.message });
    throw error;
}
```

### 2. Service Registration

```typescript
// Register services for graceful shutdown
gracefulShutdown.registerService('linkedin-service', async () => {
    await linkedinService.close();
});

gracefulShutdown.registerService('email-service', async () => {
    await emailService.close();
});
```

### 3. Performance Monitoring

```typescript
// Wrap expensive operations
const timedOperation = debugMode.wrapWithTiming(
    async () => {
        // Expensive operation
    },
    'bulk-email-send'
);

await timedOperation();
```

### 4. Error Context

```typescript
// Provide rich error context
const criticalError = errorHandler.createCriticalError(
    error,
    {
        service: 'linkedin',
        operation: 'scrapeProfile',
        userId: user.id,
        sessionId: session.id,
        metadata: { profileUrl, attempt: 3 }
    },
    'medium',
    true
);

await errorHandler.handleCriticalError(criticalError);
```

## Troubleshooting

### Common Issues

1. **Log Files Not Created**
   - Check write permissions in `logs/` directory
   - Verify `LOG_LEVEL` environment variable

2. **Email Alerts Not Working**
   - Verify SMTP credentials
   - Check email provider settings
   - Test with `DEBUG_MODE=true`

3. **Backups Failing**
   - Check database connection
   - Verify backup directory permissions
   - Review backup configuration

4. **Process Monitoring Issues**
   - Check PM2 installation
   - Verify ecosystem.config.js
   - Review process limits

### Debug Mode

Enable debug mode for detailed troubleshooting:

```bash
DEBUG_MODE=true npm run cli system debug enable
```

This provides:
- Detailed performance metrics
- Memory usage tracking
- Network request logging
- Database query logging
- File operation tracking

### Log Analysis

Use the specialized log files for analysis:

```bash
# View recent errors
tail -f logs/error-$(date +%Y-%m-%d).log

# View LinkedIn actions
grep "LinkedIn Action" logs/actions-$(date +%Y-%m-%d).log

# View performance metrics
grep "Performance:" logs/debug-$(date +%Y-%m-%d).log
```

## Security Considerations

1. **Encrypt Sensitive Data**
   - Use encryption for backups
   - Secure email credentials
   - Protect API keys

2. **Access Control**
   - Restrict log file access
   - Secure backup directories
   - Use environment variables for secrets

3. **Monitoring**
   - Monitor for suspicious activity
   - Set up intrusion detection
   - Regular security audits

## Performance Impact

The error handling system is designed for minimal performance impact:

- **Logging**: Asynchronous file writes
- **Monitoring**: Configurable intervals
- **Backups**: Scheduled during low-usage periods
- **Debug Mode**: Can be disabled in production

Monitor system performance with:

```bash
npm run cli system health
```

The system automatically tracks and reports its own performance impact.
