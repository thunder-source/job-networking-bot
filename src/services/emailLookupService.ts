import { logger } from '../utils/logger.js';
import validator from 'validator';
import databaseService from './databaseService.js';
import { promisify } from 'util';
import dns from 'dns';

// Email lookup service for finding and verifying email addresses
export class EmailLookupService {
    private hunterApiKey: string;
    private rocketReachApiKey: string;
    private cache: Map<string, IEmailLookupResult> = new Map();
    private verificationCache: Map<string, IEmailVerificationResult> = new Map();

    constructor(config: IEmailLookupConfig) {
        this.hunterApiKey = config.hunterApiKey;
        this.rocketReachApiKey = config.rocketReachApiKey;

        // Load cache from database on startup
        this.loadCacheFromDatabase();
    }

    /**
     * Find email address using multiple methods
     * @param firstName - Person's first name
     * @param lastName - Person's last name
     * @param company - Company name or domain
     * @param options - Lookup options
     * @returns Promise<IEmailLookupResult> - Lookup result with email and metadata
     */
    async findEmail(
        firstName: string,
        lastName: string,
        company: string,
        options: IEmailLookupOptions = {}
    ): Promise<IEmailLookupResult> {
        const cacheKey = this.generateCacheKey(firstName, lastName, company);

        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey)!;
            logger.info(`Email found in cache: ${cached.email} for ${firstName} ${lastName} at ${company}`);
            return cached;
        }

        // Check database cache
        const dbCached = await this.getCachedEmail(firstName, lastName, company);
        if (dbCached) {
            this.cache.set(cacheKey, dbCached);
            logger.info(`Email found in database cache: ${dbCached.email} for ${firstName} ${lastName} at ${company}`);
            return dbCached;
        }

        const result: IEmailLookupResult = {
            email: '',
            confidence: 0,
            source: 'unknown',
            method: 'none',
            metadata: {},
            verified: false,
            foundAt: new Date()
        };

        try {
            // Try Hunter.io first
            if (options.preferHunter !== false && this.hunterApiKey) {
                const hunterResult = await this.lookupWithHunter(firstName, lastName, company);
                if (hunterResult.email && hunterResult.confidence > 0) {
                    result.email = hunterResult.email;
                    result.confidence = hunterResult.confidence;
                    result.source = 'hunter';
                    result.method = 'api';
                    result.metadata = hunterResult.metadata;
                }
            }

            // Try RocketReach if Hunter.io didn't find anything or confidence is low
            if ((!result.email || result.confidence < 70) && this.rocketReachApiKey) {
                const rocketResult = await this.lookupWithRocketReach(firstName, lastName, company);
                if (rocketResult.email && rocketResult.confidence > result.confidence) {
                    result.email = rocketResult.email;
                    result.confidence = rocketResult.confidence;
                    result.source = 'rocketreach';
                    result.method = 'api';
                    result.metadata = rocketResult.metadata;
                }
            }

            // Try fallback patterns if APIs didn't find anything
            if (!result.email && options.enableFallback !== false) {
                const fallbackResult = await this.generateFallbackEmails(firstName, lastName, company);
                if (fallbackResult.email && fallbackResult.confidence > 0) {
                    result.email = fallbackResult.email;
                    result.confidence = fallbackResult.confidence;
                    result.source = 'fallback';
                    result.method = 'pattern';
                    result.metadata = fallbackResult.metadata;
                }
            }

            // Verify email if found
            if (result.email && options.verifyEmail !== false) {
                result.verified = await this.verifyEmail(result.email);
            }

            // Cache the result
            this.cache.set(cacheKey, result);
            await this.cacheEmailResult(firstName, lastName, company, result);

            logger.info(`Email lookup completed: ${result.email || 'not found'} for ${firstName} ${lastName} at ${company} (confidence: ${result.confidence}%)`);

        } catch (error) {
            logger.error('Error during email lookup:', error);
            result.metadata.error = error instanceof Error ? error.message : 'Unknown error';
        }

        return result;
    }

    /**
     * Verify email address using multiple methods
     * @param email - Email address to verify
     * @returns Promise<boolean> - True if email is valid and deliverable
     */
    async verifyEmail(email: string): Promise<boolean> {
        if (!validator.isEmail(email)) {
            return false;
        }

        // Check verification cache
        if (this.verificationCache.has(email)) {
            const cached = this.verificationCache.get(email)!;
            // Cache verification results for 24 hours
            if (Date.now() - cached.verifiedAt.getTime() < 24 * 60 * 60 * 1000) {
                return cached.valid;
            }
        }

        try {
            // Basic format validation
            if (!validator.isEmail(email)) {
                return false;
            }

            // DNS validation
            const domain = email.split('@')[1];
            const hasValidDNS = await this.validateDNS(domain);
            if (!hasValidDNS) {
                return false;
            }

            // SMTP validation (if enabled)
            if (this.hunterApiKey) {
                const hunterVerification = await this.verifyWithHunter(email);
                if (hunterVerification !== null) {
                    const result = hunterVerification;
                    this.verificationCache.set(email, {
                        valid: result,
                        verifiedAt: new Date(),
                        method: 'hunter'
                    });
                    return result;
                }
            }

            // Default to DNS validation result
            const result = hasValidDNS;
            this.verificationCache.set(email, {
                valid: result,
                verifiedAt: new Date(),
                method: 'dns'
            });

            return result;

        } catch (error) {
            logger.error('Error verifying email:', error);
            return false;
        }
    }

    /**
     * Lookup email using Hunter.io API
     */
    private async lookupWithHunter(firstName: string, lastName: string, company: string): Promise<IEmailLookupResult> {
        try {
            const domain = this.extractDomain(company);
            if (!domain) {
                throw new Error('Could not extract domain from company name');
            }

            const url = `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${this.hunterApiKey}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.data && data.data.email) {
                return {
                    email: data.data.email,
                    confidence: data.data.score || 0,
                    source: 'hunter',
                    method: 'api',
                    metadata: {
                        domain,
                        hunterData: data.data
                    },
                    verified: false,
                    foundAt: new Date()
                };
            }

            return {
                email: '',
                confidence: 0,
                source: 'hunter',
                method: 'api',
                metadata: { domain, error: 'No email found' },
                verified: false,
                foundAt: new Date()
            };

        } catch (error) {
            logger.error('Hunter.io lookup error:', error);
            return {
                email: '',
                confidence: 0,
                source: 'hunter',
                method: 'api',
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
                verified: false,
                foundAt: new Date()
            };
        }
    }

    /**
     * Lookup email using RocketReach API
     */
    private async lookupWithRocketReach(firstName: string, lastName: string, company: string): Promise<IEmailLookupResult> {
        try {
            const url = 'https://api.rocketreach.co/v2/lookup';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Api-Key': this.rocketReachApiKey
                },
                body: JSON.stringify({
                    name: `${firstName} ${lastName}`,
                    company: company
                })
            });

            const data = await response.json();

            if (data.person && data.person.emails && data.person.emails.length > 0) {
                const email = data.person.emails[0].email;
                const confidence = data.person.emails[0].confidence || 0;

                return {
                    email,
                    confidence,
                    source: 'rocketreach',
                    method: 'api',
                    metadata: {
                        rocketReachData: data.person
                    },
                    verified: false,
                    foundAt: new Date()
                };
            }

            return {
                email: '',
                confidence: 0,
                source: 'rocketreach',
                method: 'api',
                metadata: { error: 'No email found' },
                verified: false,
                foundAt: new Date()
            };

        } catch (error) {
            logger.error('RocketReach lookup error:', error);
            return {
                email: '',
                confidence: 0,
                source: 'rocketreach',
                method: 'api',
                metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
                verified: false,
                foundAt: new Date()
            };
        }
    }

    /**
     * Generate fallback email patterns
     */
    private async generateFallbackEmails(firstName: string, lastName: string, company: string): Promise<IEmailLookupResult> {
        const domain = this.extractDomain(company);
        if (!domain) {
            return {
                email: '',
                confidence: 0,
                source: 'fallback',
                method: 'pattern',
                metadata: { error: 'Could not extract domain' },
                verified: false,
                foundAt: new Date()
            };
        }

        const patterns = [
            `${firstName}.${lastName}@${domain}`,
            `${firstName}${lastName}@${domain}`,
            `${firstName.charAt(0)}${lastName}@${domain}`,
            `${firstName}${lastName.charAt(0)}@${domain}`,
            `${firstName}@${domain}`,
            `${lastName}@${domain}`,
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
            `${firstName.toLowerCase()}${lastName.toLowerCase()}@${domain}`,
            `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@${domain}`,
            `${firstName.toLowerCase()}${lastName.charAt(0).toLowerCase()}@${domain}`
        ];

        // Try to verify each pattern
        for (const email of patterns) {
            try {
                const isValid = await this.verifyEmail(email);
                if (isValid) {
                    return {
                        email,
                        confidence: 60, // Lower confidence for fallback patterns
                        source: 'fallback',
                        method: 'pattern',
                        metadata: {
                            domain,
                            pattern: email,
                            verified: true
                        },
                        verified: true,
                        foundAt: new Date()
                    };
                }
            } catch (error) {
                logger.debug(`Pattern verification failed for ${email}:`, error);
            }
        }

        // Return the first pattern even if not verified (lowest confidence)
        return {
            email: patterns[0],
            confidence: 30,
            source: 'fallback',
            method: 'pattern',
            metadata: {
                domain,
                pattern: patterns[0],
                verified: false,
                allPatterns: patterns
            },
            verified: false,
            foundAt: new Date()
        };
    }

    /**
     * Verify email using Hunter.io API
     */
    private async verifyWithHunter(email: string): Promise<boolean | null> {
        try {
            const url = `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${this.hunterApiKey}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.data && data.data.result) {
                return data.data.result === 'deliverable';
            }

            return null;

        } catch (error) {
            logger.error('Hunter.io verification error:', error);
            return null;
        }
    }

    /**
     * Validate DNS for domain
     */
    private async validateDNS(domain: string): Promise<boolean> {
        try {
            const resolveMx = promisify(dns.resolveMx);
            await resolveMx(domain);
            return true;

        } catch (error) {
            logger.debug(`DNS validation failed for ${domain}:`, error);
            return false;
        }
    }

    /**
     * Extract domain from company name or URL
     */
    private extractDomain(company: string): string | null {
        // If it's already a domain
        if (company.includes('.') && !company.includes(' ')) {
            return company.toLowerCase();
        }

        // Convert company name to potential domain
        const cleanCompany = company
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '')
            .replace(/inc|corp|llc|ltd|company|corporation/g, '');

        return `${cleanCompany}.com`;
    }

    /**
     * Generate cache key
     */
    private generateCacheKey(firstName: string, lastName: string, company: string): string {
        return `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${company.toLowerCase()}`;
    }

    /**
     * Cache email result in database
     */
    private async cacheEmailResult(firstName: string, lastName: string, company: string, result: IEmailLookupResult): Promise<void> {
        try {
            const cacheData = {
                firstName: firstName.toLowerCase(),
                lastName: lastName.toLowerCase(),
                company: company.toLowerCase(),
                email: result.email,
                confidence: result.confidence,
                source: result.source,
                method: result.method,
                metadata: result.metadata,
                verified: result.verified,
                foundAt: result.foundAt
            };

            // Store in a simple cache collection (you might want to create a proper model for this)
            await databaseService.createContact({
                name: `${firstName} ${lastName}`,
                email: result.email || `${firstName}.${lastName}@example.com`, // Placeholder if no email found
                company: company,
                source: 'email_lookup' as any,
                status: 'pending' as any,
                tags: ['email_lookup_cache'],
                priority: 'medium' as any,
                responseRate: 0,
                conversationHistory: [],
                lastContactDate: new Date()
            });

            logger.debug(`Cached email lookup result for ${firstName} ${lastName} at ${company}`);

        } catch (error) {
            logger.error('Error caching email lookup result:', error);
        }
    }

    /**
     * Get cached email from database
     */
    private async getCachedEmail(firstName: string, lastName: string, company: string): Promise<IEmailLookupResult | null> {
        try {
            const contacts = await databaseService.searchContacts(`${firstName} ${lastName}`);

            for (const contact of contacts) {
                if (contact.company?.toLowerCase().includes(company.toLowerCase()) &&
                    contact.tags.includes('email_lookup_cache')) {

                    return {
                        email: contact.email,
                        confidence: 80, // Assume cached results are reliable
                        source: 'cache',
                        method: 'database',
                        metadata: {
                            cachedAt: contact.createdAt,
                            contactId: contact._id
                        },
                        verified: true, // Assume cached emails are verified
                        foundAt: contact.createdAt
                    };
                }
            }

            return null;

        } catch (error) {
            logger.error('Error retrieving cached email:', error);
            return null;
        }
    }

    /**
     * Load cache from database
     */
    private async loadCacheFromDatabase(): Promise<void> {
        try {
            // This could be implemented to preload frequently accessed emails
            logger.info('Email lookup cache initialized');
        } catch (error) {
            logger.error('Error loading cache from database:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): ICacheStats {
        return {
            memoryCacheSize: this.cache.size,
            verificationCacheSize: this.verificationCache.size,
            cacheHitRate: 0 // Could be calculated based on usage
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
        this.verificationCache.clear();
        logger.info('Email lookup cache cleared');
    }
}

// Interface definitions
export interface IEmailLookupConfig {
    hunterApiKey?: string;
    rocketReachApiKey?: string;
}

export interface IEmailLookupOptions {
    preferHunter?: boolean;
    enableFallback?: boolean;
    verifyEmail?: boolean;
    timeout?: number;
}

export interface IEmailLookupResult {
    email: string;
    confidence: number; // 0-100
    source: 'hunter' | 'rocketreach' | 'fallback' | 'cache' | 'unknown';
    method: 'api' | 'pattern' | 'database' | 'none';
    metadata: Record<string, any>;
    verified: boolean;
    foundAt: Date;
}

export interface IEmailVerificationResult {
    valid: boolean;
    verifiedAt: Date;
    method: string;
}

export interface ICacheStats {
    memoryCacheSize: number;
    verificationCacheSize: number;
    cacheHitRate: number;
}

export default EmailLookupService;
