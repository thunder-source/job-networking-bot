import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import logger from '../utils/winstonLogger.js';
import databaseConnection from '../config/database.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface BackupConfig {
    enabled: boolean;
    backupDir: string;
    maxBackups: number;
    backupInterval: number; // ms
    compression: boolean;
    includeCollections: string[];
    excludeCollections: string[];
    retentionDays: number;
    encryptionKey?: string;
    cloudStorage?: {
        enabled: boolean;
        provider: 'aws' | 'gcp' | 'azure';
        bucket: string;
        credentials: any;
    };
}

export interface BackupInfo {
    id: string;
    timestamp: Date;
    size: number;
    collections: string[];
    compressed: boolean;
    encrypted: boolean;
    checksum: string;
    status: 'success' | 'failed' | 'in-progress';
    error?: string;
}

class DatabaseBackup {
    private config: BackupConfig;
    private backupInterval: NodeJS.Timeout | null = null;
    private isBackingUp: boolean = false;
    private backupHistory: BackupInfo[] = [];

    constructor(config: BackupConfig) {
        this.config = config;
        this.ensureBackupDirectory();
        this.loadBackupHistory();
    }

    /**
     * Ensure backup directory exists
     */
    private ensureBackupDirectory(): void {
        if (!fs.existsSync(this.config.backupDir)) {
            fs.mkdirSync(this.config.backupDir, { recursive: true });
            logger.systemEvent('Backup directory created', { path: this.config.backupDir });
        }
    }

    /**
     * Start automatic backups
     */
    public startAutomaticBackups(): void {
        if (!this.config.enabled) {
            logger.info('Database backups disabled in configuration');
            return;
        }

        if (this.backupInterval) {
            logger.warn('Automatic backups already started');
            return;
        }

        this.backupInterval = setInterval(async () => {
            try {
                await this.createBackup();
            } catch (error) {
                logger.error('Automatic backup failed', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }, this.config.backupInterval);

        logger.systemEvent('Automatic database backups started', {
            interval: this.config.backupInterval,
            backupDir: this.config.backupDir
        });
    }

    /**
     * Stop automatic backups
     */
    public stopAutomaticBackups(): void {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            logger.systemEvent('Automatic database backups stopped');
        }
    }

    /**
     * Create a database backup
     */
    public async createBackup(): Promise<BackupInfo> {
        if (this.isBackingUp) {
            throw new Error('Backup already in progress');
        }

        this.isBackingUp = true;
        const backupId = this.generateBackupId();
        const timestamp = new Date();

        logger.systemEvent('Starting database backup', { backupId });

        try {
            const backupInfo: BackupInfo = {
                id: backupId,
                timestamp,
                size: 0,
                collections: [],
                compressed: this.config.compression,
                encrypted: !!this.config.encryptionKey,
                checksum: '',
                status: 'in-progress'
            };

            // Get all collections
            const collections = await this.getCollections();
            const collectionsToBackup = collections.filter(collection => {
                if (this.config.includeCollections.length > 0) {
                    return this.config.includeCollections.includes(collection);
                }
                if (this.config.excludeCollections.length > 0) {
                    return !this.config.excludeCollections.includes(collection);
                }
                return true;
            });

            backupInfo.collections = collectionsToBackup;

            // Create backup data
            const backupData = await this.exportCollections(collectionsToBackup);
            let finalData = backupData;

            // Compress if enabled
            if (this.config.compression) {
                finalData = await gzip(backupData);
                logger.info('Backup data compressed', {
                    originalSize: backupData.length,
                    compressedSize: finalData.length
                });
            }

            // Encrypt if key provided
            if (this.config.encryptionKey) {
                finalData = await this.encryptData(finalData, this.config.encryptionKey);
                logger.info('Backup data encrypted');
            }

            // Calculate checksum
            const crypto = require('crypto');
            backupInfo.checksum = crypto.createHash('sha256').update(finalData).digest('hex');

            // Save backup file
            const filename = this.generateBackupFilename(backupId, timestamp);
            const filepath = path.join(this.config.backupDir, filename);

            await fs.promises.writeFile(filepath, finalData);
            backupInfo.size = finalData.length;
            backupInfo.status = 'success';

            // Add to history
            this.backupHistory.push(backupInfo);
            await this.saveBackupHistory();

            // Upload to cloud storage if configured
            if (this.config.cloudStorage?.enabled) {
                await this.uploadToCloudStorage(filepath, filename);
            }

            // Cleanup old backups
            await this.cleanupOldBackups();

            logger.systemEvent('Database backup completed successfully', {
                backupId,
                size: backupInfo.size,
                collections: backupInfo.collections.length,
                filename
            });

            return backupInfo;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Database backup failed', { backupId, error: errorMessage });

            const backupInfo: BackupInfo = {
                id: backupId,
                timestamp,
                size: 0,
                collections: [],
                compressed: this.config.compression,
                encrypted: !!this.config.encryptionKey,
                checksum: '',
                status: 'failed',
                error: errorMessage
            };

            this.backupHistory.push(backupInfo);
            await this.saveBackupHistory();

            throw error;

        } finally {
            this.isBackingUp = false;
        }
    }

    /**
     * Restore from a backup
     */
    public async restoreBackup(backupId: string): Promise<void> {
        logger.systemEvent('Starting database restore', { backupId });

        try {
            // Find backup info
            const backupInfo = this.backupHistory.find(backup => backup.id === backupId);
            if (!backupInfo) {
                throw new Error(`Backup not found: ${backupId}`);
            }

            if (backupInfo.status !== 'success') {
                throw new Error(`Cannot restore from failed backup: ${backupId}`);
            }

            // Find backup file
            const filename = this.generateBackupFilename(backupId, backupInfo.timestamp);
            const filepath = path.join(this.config.backupDir, filename);

            if (!fs.existsSync(filepath)) {
                throw new Error(`Backup file not found: ${filepath}`);
            }

            // Read backup file
            let backupData = await fs.promises.readFile(filepath);

            // Decrypt if encrypted
            if (backupInfo.encrypted && this.config.encryptionKey) {
                backupData = await this.decryptData(backupData, this.config.encryptionKey);
                logger.info('Backup data decrypted');
            }

            // Decompress if compressed
            if (backupInfo.compressed) {
                backupData = await gunzip(backupData);
                logger.info('Backup data decompressed');
            }

            // Verify checksum
            const crypto = require('crypto');
            const calculatedChecksum = crypto.createHash('sha256').update(backupData).digest('hex');
            if (calculatedChecksum !== backupInfo.checksum) {
                throw new Error('Backup file checksum verification failed');
            }

            // Parse backup data
            const backupCollections = JSON.parse(backupData.toString());

            // Clear existing collections (optional - could be made configurable)
            for (const collectionName of backupInfo.collections) {
                await this.clearCollection(collectionName);
            }

            // Restore collections
            for (const [collectionName, documents] of Object.entries(backupCollections)) {
                if (backupInfo.collections.includes(collectionName)) {
                    await this.restoreCollection(collectionName, documents as any[]);
                    logger.info('Collection restored', { collection: collectionName });
                }
            }

            logger.systemEvent('Database restore completed successfully', {
                backupId,
                collections: backupInfo.collections.length
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Database restore failed', { backupId, error: errorMessage });
            throw error;
        }
    }

    /**
     * Get all collections in the database
     */
    private async getCollections(): Promise<string[]> {
        try {
            const db = databaseConnection.connection?.db;
            if (!db) {
                throw new Error('Database not connected');
            }

            const collections = await db.listCollections().toArray();
            return collections.map(col => col.name);
        } catch (error) {
            logger.error('Failed to get collections', { error });
            throw error;
        }
    }

    /**
     * Export collections to JSON
     */
    private async exportCollections(collections: string[]): Promise<Buffer> {
        try {
            const db = databaseConnection.connection?.db;
            if (!db) {
                throw new Error('Database not connected');
            }

            const backupData: any = {};

            for (const collectionName of collections) {
                const collection = db.collection(collectionName);
                const documents = await collection.find({}).toArray();
                backupData[collectionName] = documents;

                logger.info('Collection exported', {
                    collection: collectionName,
                    documentCount: documents.length
                });
            }

            return Buffer.from(JSON.stringify(backupData, null, 2));

        } catch (error) {
            logger.error('Failed to export collections', { error });
            throw error;
        }
    }

    /**
     * Restore a collection
     */
    private async restoreCollection(collectionName: string, documents: any[]): Promise<void> {
        try {
            const db = databaseConnection.connection?.db;
            if (!db) {
                throw new Error('Database not connected');
            }

            const collection = db.collection(collectionName);

            if (documents.length > 0) {
                await collection.insertMany(documents);
            }

        } catch (error) {
            logger.error('Failed to restore collection', { collection: collectionName, error });
            throw error;
        }
    }

    /**
     * Clear a collection
     */
    private async clearCollection(collectionName: string): Promise<void> {
        try {
            const db = databaseConnection.connection?.db;
            if (!db) {
                throw new Error('Database not connected');
            }

            const collection = db.collection(collectionName);
            await collection.deleteMany({});

        } catch (error) {
            logger.error('Failed to clear collection', { collection: collectionName, error });
            throw error;
        }
    }

    /**
     * Encrypt data
     */
    private async encryptData(data: Buffer, key: string): Promise<Buffer> {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);

        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const authTag = cipher.getAuthTag();

        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypt data
     */
    private async decryptData(data: Buffer, key: string): Promise<Buffer> {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';

        const iv = data.slice(0, 16);
        const authTag = data.slice(16, 32);
        const encrypted = data.slice(32);

        const decipher = crypto.createDecipher(algorithm, key);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted;
    }

    /**
     * Upload backup to cloud storage
     */
    private async uploadToCloudStorage(filepath: string, filename: string): Promise<void> {
        // TODO: Implement cloud storage upload
        logger.info('Cloud storage upload not implemented yet', { filename });
    }

    /**
     * Cleanup old backups
     */
    private async cleanupOldBackups(): Promise<void> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

        // Remove old backup files
        const files = await fs.promises.readdir(this.config.backupDir);
        let removedCount = 0;

        for (const file of files) {
            if (file.startsWith('backup-') && file.endsWith('.json.gz')) {
                const filepath = path.join(this.config.backupDir, file);
                const stats = await fs.promises.stat(filepath);

                if (stats.mtime < cutoffDate) {
                    await fs.promises.unlink(filepath);
                    removedCount++;
                }
            }
        }

        // Remove old backup history entries
        this.backupHistory = this.backupHistory.filter(backup =>
            backup.timestamp > cutoffDate
        );

        if (removedCount > 0) {
            logger.info('Old backups cleaned up', { removedCount });
            await this.saveBackupHistory();
        }
    }

    /**
     * Generate backup ID
     */
    private generateBackupId(): string {
        return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate backup filename
     */
    private generateBackupFilename(backupId: string, timestamp: Date): string {
        const dateStr = timestamp.toISOString().split('T')[0];
        const timeStr = timestamp.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
        return `${backupId}-${dateStr}-${timeStr}.json${this.config.compression ? '.gz' : ''}`;
    }

    /**
     * Save backup history
     */
    private async saveBackupHistory(): Promise<void> {
        const historyPath = path.join(this.config.backupDir, 'backup-history.json');
        await fs.promises.writeFile(historyPath, JSON.stringify(this.backupHistory, null, 2));
    }

    /**
     * Load backup history
     */
    private async loadBackupHistory(): Promise<void> {
        const historyPath = path.join(this.config.backupDir, 'backup-history.json');

        try {
            if (fs.existsSync(historyPath)) {
                const data = await fs.promises.readFile(historyPath, 'utf8');
                this.backupHistory = JSON.parse(data);
                logger.info('Backup history loaded', { count: this.backupHistory.length });
            }
        } catch (error) {
            logger.error('Failed to load backup history', { error });
        }
    }

    /**
     * Get backup history
     */
    public getBackupHistory(): BackupInfo[] {
        return [...this.backupHistory];
    }

    /**
     * Get backup statistics
     */
    public getBackupStats(): any {
        const totalBackups = this.backupHistory.length;
        const successfulBackups = this.backupHistory.filter(b => b.status === 'success').length;
        const failedBackups = this.backupHistory.filter(b => b.status === 'failed').length;
        const totalSize = this.backupHistory.reduce((sum, backup) => sum + backup.size, 0);

        return {
            totalBackups,
            successfulBackups,
            failedBackups,
            totalSize,
            averageSize: totalBackups > 0 ? Math.round(totalSize / totalBackups) : 0,
            lastBackup: this.backupHistory.length > 0 ?
                this.backupHistory[this.backupHistory.length - 1].timestamp : null
        };
    }

    /**
     * List available backups
     */
    public listBackups(): any[] {
        return this.backupHistory.map(backup => ({
            id: backup.id,
            timestamp: backup.timestamp,
            size: backup.size,
            collections: backup.collections.length,
            status: backup.status,
            compressed: backup.compressed,
            encrypted: backup.encrypted
        }));
    }
}

export default DatabaseBackup;
