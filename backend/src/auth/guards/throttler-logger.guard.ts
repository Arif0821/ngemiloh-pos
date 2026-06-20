import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { getClientIp } from '../../common/utils';

@Injectable()
export class ThrottlerLoggerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ThrottlerLoggerGuard.name);

  /**
   * Override getRequest to properly extract the request object
   */
  protected getRequest(context: ExecutionContext): Request {
    return context.switchToHttp().getRequest();
  }

  /**
   * Override canActivate to check for @SkipThrottle() decorator BEFORE throttling
   * This is the KEY fix - the parent class's implementation doesn't properly check the decorator
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if @SkipThrottle() decorator is present on handler or class
    const skipThrottle = this.reflector.getAllAndOverride<boolean>(
      'skip-throttle',
      [context.getHandler(), context.getClass()],
    );

    if (skipThrottle) {
      // Skip throttling entirely for this route
      return true;
    }

    // Also skip throttling for health check endpoints (belt and suspenders approach)
    const request = this.getRequest(context);
    const url = request.url;
    if (url === '/_health' || url === '/health') {
      return true;
    }

    // Proceed with normal throttling check
    return super.canActivate(context);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip = getClientIp(req);
    const method = req.method;
    const url = req.url;

    this.logger.warn(`Rate limit exceeded: ${method} ${url} from ${ip}`);

    throw new ThrottlerException('Too many requests');
  }
}
