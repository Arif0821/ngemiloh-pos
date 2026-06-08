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

        // Don't capture expected errors (4xx) in Sentry
        const isExpectedError = error.status >= 400 && error.status < 500;

        if (!isExpectedError && error.status !== 404) {
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
