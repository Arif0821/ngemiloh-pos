import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class ThrottlerLoggerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: {
    switchToHttp: () => { getRequest: () => Request };
  }): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip = this.getClientIP(req);
    const method = req.method;
    const url = req.url;

    // Log throttling event
    console.warn(`[THROTTLE] Rate limit exceeded: ${method} ${url} from ${ip}`);

    throw new ThrottlerException('Too many requests');
  }

  protected async getTracker(req: Request): Promise<string> {
    return this.getClientIP(req);
  }

  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
