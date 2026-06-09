import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../domain/interfaces/audit.repository.interface';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest() as Record<string, unknown>;
    const method = String(request.method ?? '').toUpperCase();

    // Only log mutating requests automatically
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (!isMutatingRequest) {
      return next.handle();
    }

    const requestUrl = String(request.url ?? '');
    // Skip login as it's handled manually in AuthService for more detailed logging
    if (requestUrl.includes('/api/v1/auth/login')) {
      return next.handle();
    }

    const user = request.user as { id?: string } | undefined;
    const userId = user?.id ?? null;
    const headers = request.headers as Record<string, string | undefined>;
    const ipAddress = headers['x-forwarded-for'] || 'unknown';
    const action = `${method}_${requestUrl.split('?')[0].replace(/\//g, '_')}`;

    // Capture old state (optional, for advanced implementations)
    // Here we just log the action and the request body as the new_value
    const newValue = request.body ? { body: request.body } : null;

    return next.handle().pipe(
      tap(() => {
        // Run async without blocking response
        this.auditRepository.createAuditLog({
          actor_id: userId,
          action: action,
          entity_type: 'API_REQUEST',
          entity_id: requestUrl,
          old_value: null,
          new_value: newValue,
          ip_address: ipAddress,
        }).catch(err => {
          console.error('Failed to write audit log:', err);
        });
      })
    );
  }
}
