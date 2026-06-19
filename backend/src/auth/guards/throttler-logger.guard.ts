import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { getClientIp } from '../../common/utils';

@Injectable()
export class ThrottlerLoggerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ThrottlerLoggerGuard.name);

  protected async throwThrottlingException(context: {
    switchToHttp: () => { getRequest: () => Request };
  }): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip = getClientIp(req);
    const method = req.method;
    const url = req.url;

    this.logger.warn(`Rate limit exceeded: ${method} ${url} from ${ip}`);

    throw new ThrottlerException('Too many requests');
  }
}
