import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    
    if (isMutatingRequest) {
      // Exclude login, refresh, and webhooks from CSRF
      const excludedRoutes = [
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/webhooks/midtrans'
      ];
      if (excludedRoutes.some(route => req.originalUrl.includes(route))) {
        return next();
      }

      const csrfCookie = req.cookies['csrf_token'];
      const csrfHeader = req.headers['x-csrf-token'];

      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new ForbiddenException('Invalid CSRF Token');
      }
    }
    
    next();
  }
}
