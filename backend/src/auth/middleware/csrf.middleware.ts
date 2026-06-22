import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const isMutatingRequest = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(
      req.method.toUpperCase(),
    );

    if (isMutatingRequest) {
      // Exclude login, logout, refresh, webhooks, and public member registration from CSRF
      const excludedRoutes = [
        '/api/v1/auth/login',
        '/api/v1/auth/logout',
        '/api/v1/auth/refresh',
        '/api/v1/webhooks/midtrans',
        '/member/register', // Public member registration (no /api prefix)
        '/api/member/register', // With /api prefix
      ];
      // Normalize path: remove query string and check exact match
      const pathOnly = req.originalUrl.split('?')[0];
      const isExcluded = excludedRoutes.includes(pathOnly);
      if (isExcluded) {
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
