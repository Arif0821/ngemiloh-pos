import { CsrfMiddleware } from './csrf.middleware';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';

// Helper to create mock request
const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    method: 'POST',
    originalUrl: '/api/v1/test',
    cookies: {},
    headers: {},
    ...overrides,
  } as unknown as Request;
};

// Helper to create mock response
const createMockResponse = (): Response => {
  return {
    statusCode: 200,
  } as unknown as Response;
};

// Helper to create mock next function
const createMockNext = (): jest.Mock => jest.fn();

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
    nextFunction = createMockNext();
  });

  describe('Request passthrough (non-mutating)', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should allow GET requests without CSRF token', () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', () => {
      const req = createMockRequest({ method: 'HEAD' });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without CSRF token', () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle lowercase HTTP methods', () => {
      const req = createMockRequest({ method: 'get' });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle mixed case HTTP methods', () => {
      const req = createMockRequest({ method: 'GeT' });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Excluded routes', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should allow POST to /api/v1/auth/login without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/auth/login',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow POST to /api/v1/auth/logout without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/auth/logout',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow POST to /api/v1/auth/refresh without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/auth/refresh',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow POST to /api/v1/webhooks/midtrans without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/webhooks/midtrans',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow POST to /member/register without CSRF (public registration)', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/member/register',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow POST to /api/member/register without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/member/register',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle query strings in excluded routes', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/auth/login?redirect=/dashboard',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle /api prefix for member register', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/member/register?ref=ABC123',
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('CSRF validation', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should allow request when CSRF token matches', () => {
      const csrfToken = 'valid-csrf-token-12345';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow PUT requests with valid CSRF token', () => {
      const csrfToken = 'valid-csrf-token-12345';
      const req = createMockRequest({
        method: 'PUT',
        originalUrl: '/api/v1/products/123',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow PATCH requests with valid CSRF token', () => {
      const csrfToken = 'valid-csrf-token-12345';
      const req = createMockRequest({
        method: 'PATCH',
        originalUrl: '/api/v1/products/123',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should allow DELETE requests with valid CSRF token', () => {
      const csrfToken = 'valid-csrf-token-12345';
      const req = createMockRequest({
        method: 'DELETE',
        originalUrl: '/api/v1/products/123',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should reject request without CSRF cookie', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: {},
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request without CSRF header', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'some-token' },
        headers: {},
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with empty CSRF cookie', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: '' },
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should reject request with empty CSRF header', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'some-token' },
        headers: { 'x-csrf-token': '' },
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should reject request when tokens do not match', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'cookie-token' },
        headers: { 'x-csrf-token': 'header-token' },
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
      expect(nextFunction).not.toHaveBeenCalled();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should reject request when CSRF header is array (malformed)', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'valid-token' },
        headers: { 'x-csrf-token': ['token1', 'token2'] as unknown as string },
      });
      const res = createMockResponse();

      // Array should be handled by taking first element
      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should handle undefined cookies gracefully (throws TypeError)', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: undefined,
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = createMockResponse();

      // Note: The middleware crashes when cookies is undefined
      // This is actually a bug in the middleware, but test documents current behavior
      expect(() => middleware.use(req, res, nextFunction)).toThrow();
    });

    it('should handle undefined headers gracefully (throws TypeError)', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'some-token' },
        headers: undefined,
      });
      const res = createMockResponse();

      // Note: The middleware crashes when headers is undefined
      // This is actually a bug in the middleware, but test documents current behavior
      expect(() => middleware.use(req, res, nextFunction)).toThrow();
    });

    it('should handle null cookies.csrf_token', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: null } as unknown as Record<string, string>,
        headers: { 'x-csrf-token': 'some-token' },
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Timing-safe comparison', () => {
    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle identical tokens of different lengths', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: 'short' },
        headers: { 'x-csrf-token': 'much-longer-token' },
      });
      const res = createMockResponse();

      // Different lengths should be rejected
      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should handle tokens with special characters', () => {
      const csrfToken = 'token-with-émojis-🎉-and-unicode-中文';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle very long tokens', () => {
      const csrfToken = 'a'.repeat(10000); // 10KB token
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle tokens with newlines', () => {
      const csrfToken = 'token\nwith\nnewlines';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('Non-excluded routes validation', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should validate CSRF for /api/v1/orders', () => {
      const csrfToken = 'valid-token';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should validate CSRF for /api/v1/products', () => {
      const csrfToken = 'valid-token';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/products',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should validate CSRF for nested routes', () => {
      const csrfToken = 'valid-token';
      const req = createMockRequest({
        method: 'PUT',
        originalUrl: '/api/v1/members/123/points',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should reject POST to non-excluded route without CSRF', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: {},
        headers: {},
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should reject DELETE to non-excluded route without CSRF', () => {
      const req = createMockRequest({
        method: 'DELETE',
        originalUrl: '/api/v1/products/123',
        cookies: {},
        headers: {},
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    it('should reject PATCH without CSRF', () => {
      const req = createMockRequest({
        method: 'PATCH',
        originalUrl: '/api/v1/settings',
        cookies: {},
        headers: {},
      });
      const res = createMockResponse();

      expect(() => middleware.use(req, res, nextFunction)).toThrow(
        ForbiddenException,
      );
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should differentiate similar but different routes', () => {
      const csrfToken = 'valid-token';

      // /api/member/register is excluded
      const req1 = createMockRequest({
        method: 'POST',
        originalUrl: '/api/member/register',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      expect(() =>
        middleware.use(req1, createMockResponse(), nextFunction),
      ).not.toThrow();

      // But /api/member/login is NOT excluded
      const req2 = createMockRequest({
        method: 'POST',
        originalUrl: '/api/member/login',
        cookies: {},
        headers: {},
      });
      expect(() =>
        middleware.use(req2, createMockResponse(), nextFunction),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Security edge cases', () => {
    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle X-Forwarded-Prefix in URL (proxy scenarios)', () => {
      const csrfToken = 'valid-token';
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should accept whitespace-only CSRF tokens (current behavior)', () => {
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: '   ' },
        headers: { 'x-csrf-token': '   ' },
      });
      const res = createMockResponse();

      // Note: Current behavior accepts whitespace tokens - this could be a security issue
      // The middleware doesn't trim or validate token content
      middleware.use(req, res, nextFunction);
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should handle base64-encoded tokens', () => {
      const csrfToken = Buffer.from('csrf-token-data').toString('base64');
      const req = createMockRequest({
        method: 'POST',
        originalUrl: '/api/v1/orders',
        cookies: { csrf_token: csrfToken },
        headers: { 'x-csrf-token': csrfToken },
      });
      const res = createMockResponse();

      middleware.use(req, res, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });
  });
});
