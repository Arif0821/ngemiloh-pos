import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

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

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.client = new Redis(redisUrl);
    } else {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        retryStrategy: (times) => {
          if (times > this.maxReconnectAttempts) {
            this.logger.warn(
              `Redis reconnection failed after ${times} attempts, using in-memory fallback`,
            );
            this.isRedisAvailable = false;
            return null; // Stop retrying
          }
          this.reconnectAttempts = times;
          return Math.min(times * 100, 3000);
        },
      });
    }

    this.client.on('error', (err) => {
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
   * Check if a JWT token JTI is in the blocklist.
   * Returns true if the token has been revoked/logged out.
   */
  async isJwtBlocked(jti: string): Promise<boolean> {
    return this.useFallback(
      async () => {
        const key = `jwt:blocklist:${jti}`;
        const result = await this.client.exists(key);
        return result === 1;
      },
      false,
      'isJwtBlocked',
    );
  }

  /**
   * Add a JWT token JTI to the blocklist.
   */
  async blockJwt(jti: string, ttlSeconds: number): Promise<void> {
    return this.useFallback(
      async () => {
        const key = `jwt:blocklist:${jti}`;
        await this.client.setex(key, ttlSeconds, '1');
      },
      undefined,
      'blockJwt',
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
   */
  async setIdempotencyKey(
    key: string,
    orderId: string,
    ttlSeconds: number = 86400,
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

  onModuleDestroy() {
    this.client.disconnect();
    this.memoryCache.destroy();
  }
}
