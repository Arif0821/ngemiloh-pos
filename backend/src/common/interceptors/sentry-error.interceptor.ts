import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryErrorInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SentryErrorInterceptor.name);

  // HIGH FIX S-03: Sensitive fields to redact before sending to Sentry
  private readonly sensitiveFields = [
    'password',
    'pin',
    'pin_hash',
    'access_token',
    'authorization',
    'cookie',
    'secret',
    'api_key',
    'apiKey',
    'token',
  ];

  private sanitizeBody(body: unknown): Record<string, unknown> | unknown[] {
    if (!body || typeof body !== 'object')
      return body as Record<string, unknown>;
    if (Array.isArray(body)) {
      return body.map(
        (item) => this.sanitizeBody(item) as Record<string, unknown>,
      );
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      if (
        this.sensitiveFields.some((f) =>
          key.toLowerCase().includes(f.toLowerCase()),
        )
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeBody(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const status = error.getStatus
          ? error.getStatus()
          : error.status || 500;
        const isExpectedError = status >= 400 && status < 500;

        if (!isExpectedError && status !== 404) {
          // HIGH FIX S-03: Sanitize body before sending to Sentry
          const sanitizedBody = this.sanitizeBody(request.body);
          Sentry.captureException(error, {
            extra: {
              path: request.url,
              method: request.method,
              body: sanitizedBody,
            },
          });

          this.logger.error(
            `Unhandled exception: ${error.message}`,
            error.stack,
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
