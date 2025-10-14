import mongoose, { Connection } from 'mongoose';
import chalk from 'chalk';
import ora from 'ora';
import type { IDatabaseConnection, IHealthCheck } from '../types/index.js';

class DatabaseConnection implements IDatabaseConnection {
    public connection: Connection | null = null;
    public retryCount: number = 0;
    public readonly maxRetries: number = 5;
    public readonly retryDelay: number = 5000; // 5 seconds

    async connect(): Promise<Connection> {
        const spinner = ora('Connecting to MongoDB...').start();

        try {
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/job-networking-bot';

            // Connection options
            const options: mongoose.ConnectOptions = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
            };

            await mongoose.connect(mongoUri, options);
            this.connection = mongoose.connection;

            spinner.succeed(chalk.green('✅ Connected to MongoDB successfully'));

            // Set up connection event listeners
            this.setupEventListeners();

            return this.connection;
        } catch (error) {
            spinner.fail(chalk.red('❌ Failed to connect to MongoDB'));
            console.error(chalk.red('Connection error:'), (error as Error).message);

            // Retry logic
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(chalk.yellow(`🔄 Retrying connection (${this.retryCount}/${this.maxRetries}) in ${this.retryDelay / 1000}s...`));

                await this.delay(this.retryDelay);
                return this.connect();
            } else {
                console.error(chalk.red('❌ Max retry attempts reached. Please check your MongoDB connection.'));
                process.exit(1);
            }
        }
    }

    private setupEventListeners(): void {
        if (!this.connection) return;

        mongoose.connection.on('connected', () => {
            console.log(chalk.blue('📡 Mongoose connected to MongoDB'));
        });

        mongoose.connection.on('error', (error: Error) => {
            console.error(chalk.red('❌ Mongoose connection error:'), error);
        });

        mongoose.connection.on('disconnected', () => {
            console.log(chalk.yellow('⚠️  Mongoose disconnected from MongoDB'));
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            await this.disconnect();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await this.disconnect();
            process.exit(0);
        });
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            const spinner = ora('Disconnecting from MongoDB...').start();
            try {
                await mongoose.disconnect();
                spinner.succeed(chalk.green('✅ Disconnected from MongoDB'));
            } catch (error) {
                spinner.fail(chalk.red('❌ Error disconnecting from MongoDB'));
                console.error(chalk.red('Disconnect error:'), (error as Error).message);
            }
        }
    }

    async healthCheck(): Promise<IHealthCheck> {
        try {
            if (mongoose.connection.readyState === 1) {
                return { status: 'healthy', message: 'Database connection is active' };
            } else {
                return { status: 'unhealthy', message: 'Database connection is not active' };
            }
        } catch (error) {
            return { status: 'unhealthy', message: (error as Error).message };
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get connection status
    getConnectionStatus(): string {
        const states: Record<number, string> = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[mongoose.connection.readyState] || 'unknown';
    }
}

// Create singleton instance
const databaseConnection = new DatabaseConnection();

export default databaseConnection;
