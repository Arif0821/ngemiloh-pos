import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AUDIT_REPOSITORY,
  type IAuditRepository,
} from '../domain/interfaces/audit.repository.interface';

/**
 * TINGGI-05: Sanitize body to redact sensitive fields
 */
function sanitizeBody(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const clean: any = { ...obj };
  const sensitiveFields = [
    'pin',
    'password',
    'pin_hash',
    'password_hash',
    'token',
    'secret',
    'key',
  ];
  for (const field of sensitiveFields) {
    if (field in clean) clean[field] = '[REDACTED]';
  }
  return clean;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: IAuditRepository,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const method = String(request.method ?? '').toUpperCase();

    // Only log mutating requests
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      method,
    );
    if (!isMutatingRequest) {
      return next.handle();
    }

    const requestUrl = String(request.url ?? '');
    // Skip login as it's handled manually in AuthService
    if (requestUrl.includes('/api/v1/auth/login')) {
      return next.handle();
    }

    const user = request.user as { id?: string } | undefined;
    const userId = user?.id ?? null;
    const headers = request.headers as Record<string, string | undefined>;

    // TINGGI-05: Properly parse X-Forwarded-For header (may contain multiple IPs)
    const forwardedFor = headers['x-forwarded-for'];
    const ipAddress = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : 'unknown';

    const sanitizedUrl = requestUrl.split('?')[0].replace(/\//g, '_');
    const action = `${method}_${sanitizedUrl}`;
    const body = request.body;

    // TINGGI-05: Redact sensitive fields before logging
    const newValue = body ? { body: JSON.stringify(sanitizeBody(body)) } : null;

    return next.handle().pipe(
      tap(() => {
        this.auditRepository
          .createAuditLog({
            actor_id: userId,
            action: action,
            entity_type: 'API_REQUEST',
            entity_id: requestUrl,
            old_value: null,
            new_value: newValue,
            ip_address: ipAddress,
          })
          .catch((err: Error) => {
            console.error('Failed to write audit log:', err.message);
          });
      }),
    );
  }
}
