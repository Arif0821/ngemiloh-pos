import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../common/redis/redis.service';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const MEMBER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  register: { windowMs: 60000, maxRequests: 10 }, // 10 per minute
  lookup: { windowMs: 60000, maxRequests: 30 }, // 30 per minute
};

/**
 * Redis-based distributed rate limiter middleware for member endpoints.
 * Prevents abuse of member registration and lookup APIs.
 * Uses sliding window algorithm with Redis sorted sets.
 */
@Injectable()
export class MemberRateLimiterMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MemberRateLimiterMiddleware.name);

  constructor(private readonly redisService: RedisService) {}

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) return forwardedFor[0];
    if (typeof forwardedFor === 'string')
      return forwardedFor.split(',')[0].trim();
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private getRouteKey(req: Request): string {
    const path = req.path;
    if (path.includes('register')) return 'register';
    if (path.includes('lookup')) return 'lookup';
    return 'default';
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip if Redis is not available - fail open
    if (!this.redisService) {
      return next();
    }

    const ip = this.getClientIp(req);
    const routeKey = this.getRouteKey(req);
    const config = MEMBER_RATE_LIMITS[routeKey] || MEMBER_RATE_LIMITS.lookup;

    const key = `ratelimit:member:${routeKey}:${ip}`;
    const windowSeconds = Math.ceil(config.windowMs / 1000);

    try {
      // Check current rate limit status
      const { count, remaining, resetIn } =
        await this.redisService.checkRateLimit(
          key,
          config.maxRequests,
          config.windowMs,
        );

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetIn / 1000).toString());

      if (count >= config.maxRequests) {
        this.logger.warn(
          `Rate limit exceeded for ${ip} on ${routeKey}: ${count}/${config.maxRequests}`,
        );

        res.setHeader('Retry-After', Math.ceil(resetIn / 1000).toString());

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            retryAfter: Math.ceil(resetIn / 1000),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Record this request
      await this.redisService.recordRateLimitRequest(key, windowSeconds + 1);

      next();
    } catch (error) {
      // If Redis fails, allow the request but log the error
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Rate limiter Redis error: ${String(error)}`);
      // Fail open - allow request if Redis is down
      next();
    }
  }
}
