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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        // Only capture errors that weren't already handled by exception filter
        const request = context.switchToHttp().getRequest();

        // Get status safely - use getStatus() method if available
        const status = error.getStatus ? error.getStatus() : (error.status || 500);

        // Don't capture expected errors (4xx) in Sentry
        const isExpectedError = status >= 400 && status < 500;

        if (!isExpectedError && status !== 404) {
          Sentry.captureException(error, {
            extra: {
              path: request.url,
              method: request.method,
              body: request.body,
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
