# System Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified in SYSTEM_AUDIT_REPORT.md

**Architecture:** NestJS backend with environment-based configuration

**Tech Stack:** NestJS 11, TypeScript, Docker

---

### Task 1: Add Comprehensive Environment Variable Validation

**Files:**
- Modify: `backend/src/main.ts`

**Context:** Aplikasi POS Nabil sudah menggunakan Docker secrets untuk credentials. Perlu menambahkan validasi startup untuk memastikan semua secrets accessible sebelum aplikasi berjalan.

**Requirements:**
1. Validate semua secrets critical (JWT_ACCESS_SECRET, PIN_PEPPER_SECRET, CSRF_SECRET)
2. Validate file-based secrets (DB_PASSWORD via Docker secrets)
3. Validate Midtrans keys berdasarkan environment
4. Throw clear error message jika secrets tidak valid
5. Jangan block jika optional secrets missing (seperti SENTRY_DSN)

- [ ] **Step 1: Read current main.ts implementation**

Read `backend/src/main.ts` to understand current validation approach.

- [ ] **Step 2: Add secrets validation function**

Add this validation function before app initialization:

```typescript
function validateSecrets(): void {
  const errors: string[] = [];

  // Required secrets (must exist)
  const requiredSecrets = [
    'JWT_ACCESS_SECRET',
    'PIN_PEPPER_SECRET',
    'CSRF_SECRET',
  ];

  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      errors.push(`Missing required secret: ${secret}`);
    }
  }

  // Database password (file-based secret)
  const dbPasswordFile = process.env.DATABASE_URL
    ? undefined
    : process.env.DB_PASSWORD_FILE || '/run/secrets/db_password';
  
  if (dbPasswordFile && !require('fs').existsSync(dbPasswordFile)) {
    errors.push(`Database password file not found: ${dbPasswordFile}`);
  }

  // Midtrans keys (required based on environment)
  const midtransEnv = process.env.MIDTRANS_ENV || 'sandbox';
  if (midtransEnv === 'production') {
    if (!process.env.MIDTRANS_SERVER_KEY_PRODUCTION) {
      errors.push('Missing required for production: MIDTRANS_SERVER_KEY_PRODUCTION');
    }
  } else {
    if (!process.env.MIDTRANS_SERVER_KEY_SANDBOX) {
      errors.push('Missing required for sandbox: MIDTRANS_SERVER_KEY_SANDBOX');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Secrets validation failed:\n${errors.join('\n')}`);
  }
}
```

- [ ] **Step 3: Call validation before NestJS bootstrap**

Add at the start of main.ts (before `await NestFactory.create`):
```typescript
validateSecrets();
```

- [ ] **Step 4: Add tests for validation**

Create `backend/src/__tests__/secrets-validation.spec.ts`:
```typescript
import { validateSecrets } from '../main';

describe('Secrets Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should pass when all required secrets exist', () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    process.env.PIN_PEPPER_SECRET = 'test-pepper';
    process.env.CSRF_SECRET = 'test-csrf';
    process.env.MIDTRANS_SERVER_KEY_SANDBOX = 'test-key';
    expect(() => validateSecrets()).not.toThrow();
  });

  it('should throw when JWT_ACCESS_SECRET missing', () => {
    process.env.PIN_PEPPER_SECRET = 'test-pepper';
    process.env.CSRF_SECRET = 'test-csrf';
    expect(() => validateSecrets()).toThrow('JWT_ACCESS_SECRET');
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main.ts backend/src/__tests__/secrets-validation.spec.ts
git commit -m "fix: add comprehensive secrets validation at startup"
```

---

### Task 2: Safe Error Response Serialization

**Files:**
- Modify: `backend/src/main.ts`

**Context:** Error responses saat ini bisa leak sensitive information. Perlu sanitize error sebelum dikirim ke client.

**Requirements:**
1. Create custom exception filter
2. Hide internal details (stack traces, file paths, DB errors)
3. Log full error server-side
4. Return generic message ke client dengan error code

- [ ] **Step 1: Create HttpExceptionFilter**

Create `backend/src/common/filters/http-exception.filter.ts`:

```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        error = (resp.error as string) || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else {
      // Non-HTTP exceptions - log full error, return generic message
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';
      
      // Log full error server-side only
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add request ID if available
    const requestId = request.headers['x-request-id'];
    if (requestId) {
      errorResponse.requestId = requestId as string;
    }

    response.status(status).json(errorResponse);
  }
}
```

- [ ] **Step 2: Register filter in main.ts**

After enabling Helmet and CORS:
```typescript
app.useGlobalFilters(new GlobalExceptionFilter());
```

- [ ] **Step 3: Update ValidationPipe for safe errors**

In main.ts, update ValidationPipe:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Don't expose validation error details
    exceptionFactory: (errors) => {
      return new BadRequestException({
        message: 'Validation failed',
        error: 'ValidationError',
        details: errors.map((e) => ({
          field: e.property,
          constraint: Object.keys(e.constraints || {})[0],
        })),
      });
    },
  }),
);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/filters/http-exception.filter.ts backend/src/main.ts
git commit -m "fix: add safe error serialization with server-side logging"
```

---

### Task 3: Trust Proxy Configuration

**Files:**
- Modify: `backend/src/main.ts`

**Context:** Single proxy assumption mungkin tidak cukup untuk production dengan load balancer.

- [ ] **Step 1: Update trust proxy configuration**

Replace:
```typescript
app.set('trust proxy', 1);
```

With:
```typescript
// Trust all proxies in the chain
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
```

This covers: 127.0.0.1 (loopback), 169.254.0.0/16 (linklocal), 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 (uniquelocal/private).

- [ ] **Step 2: Commit**

```bash
git add backend/src/main.ts
git commit -m "fix: improve trust proxy configuration for multi-proxy setups"
```

---

### Task 4: CSP Configuration with Environment Variables

**Files:**
- Modify: `backend/src/main.ts`

**Context:** Midtrans domains hardcoded di CSP. Perlu make configurable via environment variables.

**Requirements:**
1. Add MIDTRANS_ALLOWED_DOMAIN environment variable
2. Fallback to default Midtrans domains jika not set
3. Document the variable

- [ ] **Step 1: Update CSP configuration**

Add after helmet initialization:

```typescript
// Midtrans allowed domains for CSP (configurable)
const midtransDomains = process.env.CSP_MIDTRANS_DOMAINS || 
  "'self' https://app.sandbox.midtrans.com https://api.sandbox.midtrans.com https://app.midtrans.com https://api.midtrans.com";
```

Update helmet contentSecurityPolicy:
```typescript
directives: {
  ...helmet.contentSecurityPolicy.getDefaultDirectives(),
  'connect-src': ["'self'", 'https://*.midtrans.com'],
  'frame-src': ["'self'", midtransDomains],
  'script-src': ["'self'", "'unsafe-inline'", midtransDomains],
}
```

- [ ] **Step 2: Add environment variable documentation**

Add to `.env.example`:
```bash
# CSP Configuration
CSP_MIDTRANS_DOMAINS='self' https://app.sandbox.midtrans.com https://api.sandbox.midtrans.com
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/main.ts
git add .env.example 2>/dev/null || true
git commit -m "fix: make CSP Midtrans domains configurable via environment"
```

---

### Task 5: Caddyfile Formatting

**Files:**
- Modify: `Caddyfile`

**Context:** Caddy logs warning tentang formatting yang tidak konsisten.

- [ ] **Step 1: Format Caddyfile**

```bash
docker exec ngemiloh_caddy caddy fmt --overwrite
```

- [ ] **Step 2: Copy formatted Caddyfile back to repo**

```bash
docker cp ngemiloh_caddy:/etc/caddy/Caddyfile ./Caddyfile
```

- [ ] **Step 3: Commit**

```bash
git add Caddyfile
git commit -m "fix: format Caddyfile with caddy fmt"
```

---

### Task 6: Update System Audit Report

**Files:**
- Modify: `SYSTEM_AUDIT_REPORT.md`

**Context:** Document semua fixes yang telah diterapkan.

- [ ] **Step 1: Update report with completion status**

Update header status dan setiap issue:
```markdown
**Status:** ALL ISSUES FIXED ✅

## ISSUE 2: MISSING ENVIRONMENT VARIABLE VALIDATION (MEDIUM) ✅ FIXED
- Validasi secrets ditambahkan di main.ts
- Validate: JWT_ACCESS_SECRET, PIN_PEPPER_SECRET, CSRF_SECRET
- Validate: Database password file
- Validate: Midtrans keys berdasarkan environment
- Implementation: commit `fix: add comprehensive secrets validation at startup`

## ISSUE 3: CADDYFILE FORMATTING (LOW) ✅ FIXED
- Caddyfile diformat dengan `caddy fmt --overwrite`
- Implementation: commit `fix: format Caddyfile with caddy fmt`

## SECURITY IMPROVEMENTS APPLIED

### Error Response Safety ✅
- Custom GlobalExceptionFilter implemented
- Stack traces tidak dikirim ke client
- Full errors logged server-side only

### Trust Proxy ✅
- Multi-proxy configuration enabled
- Supports loopback, linklocal, uniquelocal

### CSP Configuration ✅
- Midtrans domains configurable via CSP_MIDTRANS_DOMAINS
- Default: sandbox + production Midtrans domains
```

- [ ] **Step 2: Commit**

```bash
git add SYSTEM_AUDIT_REPORT.md
git commit -m "docs: update audit report with completed fixes"
```

---

## Summary

| Task | Priority | Status |
|------|----------|--------|
| Secrets Validation | MEDIUM | Pending |
| Safe Error Responses | MEDIUM | Pending |
| Trust Proxy Config | LOW | Pending |
| CSP Environment Variables | LOW | Pending |
| Caddyfile Formatting | LOW | Pending |
| Update Audit Report | Documentation | Pending |
