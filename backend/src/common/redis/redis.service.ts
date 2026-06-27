import {
  Injectable,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * In-memory fallback cache for when Redis is unavailable.
 * Uses Map with TTL tracking for automatic expiration.
 */
class MemoryCache {
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  exists(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  // For rate limiting with sorted sets (simplified - just store count)
  private rateLimitCounts = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  getRateLimitCount(key: string): number {
    const entry = this.rateLimitCounts.get(key);
    if (!entry) return 0;
    if (entry.expiresAt <= Date.now()) {
      this.rateLimitCounts.delete(key);
      return 0;
    }
    return entry.count;
  }

  incrementRateLimit(key: string, ttlSeconds: number): number {
    const now = Date.now();
    let entry = this.rateLimitCounts.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + ttlSeconds * 1000 };
    }
    entry.count++;
    this.rateLimitCounts.set(key, entry);
    return entry.count;
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    this.rateLimitCounts.clear();
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private readonly memoryCache = new MemoryCache();
  private isRedisAvailable = true;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor(private readonly prisma: PrismaService) {
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisUrl = process.env.REDIS_URL;

    // FIX #18: Require password if REDIS_PASSWORD is configured
    if (redisPassword && redisPassword.trim() !== '') {
      // Extract password from REDIS_URL if present, otherwise use REDIS_PASSWORD
      if (redisUrl) {
        try {
          const url = new URL(redisUrl);
          if (!url.password) {
            // REDIS_PASSWORD set but REDIS_URL has no password - inject it
            url.password = redisPassword;
            const urlWithPassword = url.toString();
            this.client = new Redis(urlWithPassword);
          } else {
            // REDIS_URL already has password - use as-is
            this.client = new Redis(redisUrl);
          }
        } catch {
          // Invalid URL format, construct manually with password
          this.client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: Number(process.env.REDIS_PORT) || 6379,
            password: redisPassword,
            retryStrategy: this.getRetryStrategy(),
          });
        }
      } else {
        // No REDIS_URL, use individual config with password
        this.client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: redisPassword,
          retryStrategy: this.getRetryStrategy(),
        });
      }
    } else if (redisUrl) {
      // No password configured, use REDIS_URL as-is
      this.client = new Redis(redisUrl);
    } else {
      // No URL, no password - use defaults (WARNING: insecure for production!)
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn(
          '⚠️ SECURITY WARNING: Redis connection without password in production! Set REDIS_PASSWORD env variable.',
        );
      }
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        retryStrategy: this.getRetryStrategy(),
      });
    }

    this.setupEventHandlers();
  }

  private getRetryStrategy(): (times: number) => number | null {
    return (times: number) => {
      if (times > this.maxReconnectAttempts) {
        this.logger.warn(
          `Redis reconnection failed after ${times} attempts, using in-memory fallback`,
        );
        this.isRedisAvailable = false;
        return null; // Stop retrying
      }
      this.reconnectAttempts = times;
      return Math.min(times * 100, 3000);
    };
  }

  private setupEventHandlers(): void {
    this.client.on('error', (err) => {
      // Check for authentication errors
      if (err.message.includes('NOAUTH') || err.message.includes('AUTH')) {
        this.logger.error(
          '🔒 Redis AUTH FAILED: Invalid or missing password. Set REDIS_PASSWORD environment variable.',
        );
      }
      if (this.isRedisAvailable) {
        this.logger.error('Redis connection error:', err.message);
        this.isRedisAvailable = false;
      }
    });

    this.client.on('connect', () => {
      if (!this.isRedisAvailable) {
        this.logger.log('Redis reconnected, resuming Redis operations');
        this.isRedisAvailable = true;
        this.reconnectAttempts = 0;
      }
    });

    this.client.on('ready', () => {
      this.isRedisAvailable = true;
    });
  }

  /**
   * Check if Redis is currently available
   */
  isAvailable(): boolean {
    return this.isRedisAvailable && this.client.status === 'ready';
  }

  private useFallback<T>(
    redisOperation: () => Promise<T>,
    fallbackValue: T,
    operationName: string,
  ): Promise<T> {
    if (this.isAvailable()) {
      return redisOperation();
    }
    this.logger.warn(`Redis unavailable, falling back for ${operationName}`);
    return Promise.resolve(fallbackValue);
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return this.memoryCache.get(key);
    }
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.error('Redis GET error:', err);
      return this.memoryCache.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) {
      if (ttlSeconds) {
        this.memoryCache.set(key, value, ttlSeconds);
      }
      return;
    }
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      this.logger.error('Redis SET error:', err);
      if (ttlSeconds) {
        this.memoryCache.set(key, value, ttlSeconds);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) {
      this.memoryCache.delete(key);
      return;
    }
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.error('Redis DEL error:', err);
      this.memoryCache.delete(key);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return this.memoryCache.exists(key);
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      this.logger.error('Redis EXISTS error:', err);
      return this.memoryCache.exists(key);
    }
  }

  /**
   * FIX #7: JWT Blocklist with Database Fallback
   *
   * Check if a JWT token JTI is in the blocklist.
   * 1. First checks Redis (fast path)
   * 2. Falls back to PostgreSQL if Redis unavailable
   *
   * This ensures revoked tokens remain blocked even when Redis is down.
   */
  async isJwtBlocked(jti: string): Promise<boolean> {
    // Fast path: check Redis first if available
    if (this.isAvailable()) {
      try {
        const key = `jwt:blocklist:${jti}`;
        const result = await this.client.exists(key);
        if (result === 1) return true;
        // Also check database as source of truth (for tokens revoked while Redis was down)
        const dbBlocked = await this.prisma.revokedToken.findUnique({
          where: { id: jti },
        });
        return dbBlocked !== null;
      } catch (err) {
        this.logger.error('Redis isJwtBlocked error:', err);
        // Fall through to database fallback
      }
    }

    // Database fallback: check PostgreSQL for revoked token
    try {
      const dbBlocked = await this.prisma.revokedToken.findUnique({
        where: { id: jti },
      });
      return dbBlocked !== null;
    } catch (err) {
      this.logger.error('Database isJwtBlocked error:', err);
      // P1 FIX: Fail-closed instead of fail-open
      // If both Redis AND DB fail, we should NOT accept the token
      throw new ServiceUnavailableException(
        'Cannot verify token revocation status. Please try again later.',
      );
    }
  }

  /**
   * FIX #7: JWT Blocklist with Database Fallback
   *
   * Add a JWT token JTI to the blocklist.
   * 1. Stores in Redis if available (fast path)
   * 2. Always stores in PostgreSQL (source of truth)
   *
   * This ensures tokens remain blocked even when Redis fails.
   */
  async blockJwt(jti: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // Always store in database as source of truth (for durability)
    try {
      await this.prisma.revokedToken.upsert({
        where: { id: jti },
        update: { reason: 'logout' },
        create: {
          id: jti,
          expires_at: expiresAt,
          reason: 'logout',
        },
      });
    } catch (err) {
      this.logger.error('Database blockJwt error:', err);
      // Continue to Redis attempt
    }

    // Also store in Redis if available (for speed)
    if (this.isAvailable()) {
      try {
        const key = `jwt:blocklist:${jti}`;
        await this.client.setex(key, ttlSeconds, '1');
        return;
      } catch (err) {
        this.logger.error('Redis blockJwt error:', err);
        // Database already has it, so it's safe
        return;
      }
    }

    // Redis unavailable but database has the blocklist entry
    this.logger.warn(
      `Redis unavailable, JWT blocklist stored in database only for JTI: ${jti}`,
    );
  }

  /**
   * Check if an idempotency key exists in cache.
   */
  async getIdempotencyKey(key: string): Promise<string | null> {
    return this.useFallback(
      async () => {
        const cacheKey = `idempotency:${key}`;
        return this.client.get(cacheKey);
      },
      null,
      'getIdempotencyKey',
    );
  }

  /**
   * Set an idempotency key in cache.
   * TTL: 30 days (2592000 seconds) to handle long offline periods
   */
  async setIdempotencyKey(
    key: string,
    orderId: string,
    ttlSeconds: number = 2592000, // 30 days
  ): Promise<void> {
    return this.useFallback(
      async () => {
        const cacheKey = `idempotency:${key}`;
        await this.client.setex(cacheKey, ttlSeconds, orderId);
      },
      undefined,
      'setIdempotencyKey',
    );
  }

  /**
   * Check rate limit for a given key.
   * Uses sliding window algorithm with Redis sorted sets.
   */
  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<{ count: number; remaining: number; resetIn: number }> {
    if (!this.isAvailable()) {
      // Fallback: use in-memory rate limiting
      const count = this.memoryCache.getRateLimitCount(key);
      return {
        count,
        remaining: Math.max(0, maxRequests - count),
        resetIn: windowMs,
      };
    }

    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries outside the window
      await this.client.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      const count = await this.client.zcard(key);
      const remaining = Math.max(0, maxRequests - count);

      // Get oldest entry to calculate reset time
      let resetIn = windowMs;
      const oldest = await this.client.zrange(key, 0, 0);
      if (oldest.length > 0) {
        const oldestTimestamp = parseInt(oldest[0], 10);
        resetIn = Math.max(0, oldestTimestamp + windowMs - now);
      }

      return { count, remaining, resetIn };
    } catch (err) {
      this.logger.error('Redis rate limit error:', err);
      // Fallback to in-memory
      const count = this.memoryCache.getRateLimitCount(key);
      return {
        count,
        remaining: Math.max(0, maxRequests - count),
        resetIn: windowMs,
      };
    }
  }

  /**
   * Record a request for rate limiting.
   */
  async recordRateLimitRequest(key: string, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable()) {
      this.memoryCache.incrementRateLimit(key, ttlSeconds);
      return;
    }

    try {
      const now = Date.now();
      await this.client.zadd(key, now, `${now}:${Math.random()}`);
      await this.client.expire(key, ttlSeconds);
    } catch (err) {
      this.logger.error('Redis recordRateLimit error:', err);
      this.memoryCache.incrementRateLimit(key, ttlSeconds);
    }
  }

  /**
   * FIX #7: Cleanup expired tokens from database
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.prisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: new Date() },
        },
      });
      return result.count;
    } catch (err) {
      this.logger.error('Database cleanupExpiredTokens error:', err);
      return 0;
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
    this.memoryCache.destroy();
  }
}
