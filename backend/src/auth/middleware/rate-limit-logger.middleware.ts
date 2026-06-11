import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RateLimit');
  private requestCounts: Map<string, { count: number; resetTime: number }> =
    new Map();

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100;

    let clientData = this.requestCounts.get(ip);

    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs };
      this.requestCounts.set(ip, clientData);
    }

    clientData.count++;

    // Log warning if approaching limit
    if (clientData.count > maxRequests * 0.8) {
      this.logger.warn(
        `High request rate from ${ip}: ${clientData.count}/${maxRequests}`,
      );
    }

    // Clean up expired entries on every request (prevent unbounded memory growth)
    if (this.requestCounts.size > 100) {
      for (const [key, value] of this.requestCounts.entries()) {
        if (now > value.resetTime) {
          this.requestCounts.delete(key);
        }
      }
    }

    // Hard limit: if map grows too large, clear oldest entries
    if (this.requestCounts.size > 50000) {
      this.logger.warn(
        `Rate limit map overflow: ${this.requestCounts.size} entries, clearing old entries`,
      );
      const entries = Array.from(this.requestCounts.entries());
      // Keep only the most recent 25000 entries
      entries
        .slice(0, entries.length - 25000)
        .forEach(([key]) => this.requestCounts.delete(key));
    }

    next();
  }
}
