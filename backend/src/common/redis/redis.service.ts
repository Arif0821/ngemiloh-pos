import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.client = new Redis(redisUrl);
    } else {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      });
    }

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err.message);
    });
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Check if a JWT token JTI is in the blocklist.
   * Returns true if the token has been revoked/logged out.
   */
  async isJwtBlocked(jti: string): Promise<boolean> {
    const key = `jwt:blocklist:${jti}`;
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * Add a JWT token JTI to the blocklist.
   * @param jti - The JWT ID to block
   * @param ttlSeconds - How long to keep in blocklist (should match token expiry remaining)
   */
  async blockJwt(jti: string, ttlSeconds: number): Promise<void> {
    const key = `jwt:blocklist:${jti}`;
    await this.client.setex(key, ttlSeconds, '1');
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
