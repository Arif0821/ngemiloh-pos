import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

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

      // req.cookies['csrf_token'] is typed as any, cast to string safely
      const csrfCookie = String(req.cookies['csrf_token'] ?? '');
      // req.headers can be string | string[], handle both cases
      const csrfHeaderRaw = req.headers['x-csrf-token'];
      const csrfHeader: string | undefined = Array.isArray(csrfHeaderRaw)
        ? csrfHeaderRaw[0]
        : csrfHeaderRaw;

      if (!csrfCookie || !csrfHeader) {
        throw new ForbiddenException('Invalid CSRF Token');
      }

      if (!this.timingSafeEqual(csrfCookie, csrfHeader)) {
        throw new ForbiddenException('Invalid CSRF Token');
      }
    }

    next();
  }

  /**
   * Timing-safe string comparison to prevent timing attacks.
   * Uses crypto.timingSafeEqual which performs constant-time comparison.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }

    // Convert strings to buffers for timingSafeEqual
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    // If lengths differ, crypto.timingSafeEqual will throw.
    // For security, we still want constant-time behavior here.
    // Return false immediately only if we can guarantee no timing leak,
    // but to be truly constant-time, we should compare lengths in constant time too.
    if (bufA.length !== bufB.length) {
      // Still perform a dummy comparison to maintain constant time,
      // but this will always return false
      try {
        crypto.timingSafeEqual(bufA, bufB);
      } catch {
        // timingSafeEqual throws when lengths differ - this is expected
      }
      return false;
    }

    try {
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      // Fallback to false if any error occurs (should not happen if lengths match)
      return false;
    }
  }
}
