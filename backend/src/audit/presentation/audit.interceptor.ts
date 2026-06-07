import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../domain/interfaces/audit.repository.interface';
import { Role } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    
    // Only log mutating requests automatically
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    
    if (!isMutatingRequest) {
      return next.handle();
    }

    // Skip login as it's handled manually in AuthService for more detailed logging
    if (request.url.includes('/api/v1/auth/login')) {
      return next.handle();
    }

    const userId = request.user?.id;
    const ipAddress = request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown';
    const action = `${method}_${request.url.split('?')[0].replace(/\//g, '_').toUpperCase()}`;

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
          entity_id: request.url,
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
