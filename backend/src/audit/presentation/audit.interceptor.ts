import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../domain/interfaces/audit.repository.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const method = String(request.method ?? '').toUpperCase();

    // Only log mutating requests
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
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
    const headers = http.getRequestHeaders();
    const ipAddress = String(headers['x-forwarded-for'] ?? 'unknown');
    const sanitizedUrl = requestUrl.split('?')[0].replace(/\//g, '_');
    const action = `${method}_${sanitizedUrl}`;
    const body = request.body;
    const newValue = body ? { body: JSON.stringify(body) } : null;

    return next.handle().pipe(
      tap(() => {
        this.auditRepository.createAuditLog({
          actor_id: userId,
          action: action,
          entity_type: 'API_REQUEST',
          entity_id: requestUrl,
          old_value: null,
          new_value: newValue,
          ip_address: ipAddress,
        }).catch((err: Error) => {
          console.error('Failed to write audit log:', err.message);
        });
      })
    );
  }
}
