# Hybrid Token Migration - httpOnly Cookie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move JWT tokens from localStorage to httpOnly cookies for improved XSS protection while maintaining CSRF protection.

**Architecture:** Hybrid approach where:
- Access token stored in httpOnly;Secure;SameSite=Strict cookie (set by backend)
- CSRF token returned as JSON (readable by frontend, stored in memory)
- Frontend reads cookies automatically via `credentials: 'include'`
- CSRF token from memory sent via `X-CSRF-Token` header

**Tech Stack:** TypeScript, NestJS, SvelteKit, Express (via NestJS)

---

## File Structure

### Backend Changes
```
backend/src/
├── common/utils/
│   └── cookie.ts                    # NEW: Cookie utility functions
├── auth/
│   ├── application/services/
│   │   └── auth.service.ts          # MODIFY: Set httpOnly cookie on login
│   └── presentation/
│       └── auth.controller.ts       # MODIFY: Pass Response object
```

### Frontend Changes
```
frontend/src/
├── lib/
│   └── services/
│       └── api.client.ts            # MODIFY: Read token from cookie
└── routes/
    ├── login/
    │   └── +page.svelte            # MODIFY: Store CSRF in memory only
    └── login-admin/
        └── +page.svelte             # MODIFY: Store CSRF in memory only
```

---

## Task 1: Backend - Add Cookie Utility

**Files:**
- Create: `backend/src/common/utils/cookie.ts`
- Test: `backend/src/common/utils/cookie.spec.ts`

- [ ] **Step 1: Create cookie utility**

```typescript
// backend/src/common/utils/cookie.ts

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
  domain?: string;
}

/**
 * Set a cookie on the Response object
 */
export function set_cookie(
  res: Response,
  name: string,
  value: string,
  options: CookieOptions = {},
): void {
  const {
    httpOnly = true,
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'strict',
    maxAge,
    path = '/',
    domain,
  } = options;

  let cookie_str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookie_str += `; Path=${path}`;

  if (domain) cookie_str += `; Domain=${domain}`;
  if (httpOnly) cookie_str += '; HttpOnly';
  if (secure) cookie_str += '; Secure';
  cookie_str += `; SameSite=${sameSite}`;
  if (maxAge !== undefined) cookie_str += `; Max-Age=${maxAge}`;

  res.headers.append('Set-Cookie', cookie_str);
}

/**
 * Clear a cookie
 */
export function clear_cookie(res: Response, name: string, path = '/'): void {
  set_cookie(res, name, '', { maxAge: 0, path });
}
```

- [ ] **Step 2: Create test file**

```typescript
// backend/src/common/utils/cookie.spec.ts

import { set_cookie, clear_cookie } from './cookie';

describe('cookie utilities', () => {
  const mock_res = {
    headers: new Map<string, string[]>(),
    append: function(key: string, value: string) {
      const existing = this.headers.get(key) || [];
      existing.push(value);
      this.headers.set(key, existing);
    },
  } as unknown as Response;

  describe('set_cookie', () => {
    it('should set basic cookie', () => {
      set_cookie(mock_res, 'test', 'value');
      const cookies = mock_res.headers.get('Set-Cookie');
      expect(cookies).toContain('test=value');
    });

    it('should set HttpOnly flag', () => {
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie');
      expect(cookies).toContain('HttpOnly');
    });

    it('should set SameSite=Strict', () => {
      set_cookie(mock_res, 'token', 'abc123');
      const cookies = mock_res.headers.get('Set-Cookie');
      expect(cookies).toContain('SameSite=strict');
    });

    it('should set Max-Age for session cookies', () => {
      set_cookie(mock_res, 'token', 'abc123', { maxAge: 7200 });
      const cookies = mock_res.headers.get('Set-Cookie');
      expect(cookies).toContain('Max-Age=7200');
    });
  });

  describe('clear_cookie', () => {
    it('should clear cookie by setting Max-Age=0', () => {
      clear_cookie(mock_res, 'token');
      const cookies = mock_res.headers.get('Set-Cookie');
      expect(cookies).toContain('Max-Age=0');
    });
  });
});
```

- [ ] **Step 3: Export from index**

Add to `backend/src/common/utils/index.ts`:
```typescript
export * from './cookie';
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/utils/cookie.ts backend/src/common/utils/cookie.spec.ts backend/src/common/utils/index.ts
git commit -m "feat(auth): add cookie utility for httpOnly token storage"
```

---

## Task 2: Backend - Update AuthService

**Files:**
- Modify: `backend/src/auth/application/services/auth.service.ts`

- [ ] **Step 1: Read current auth.service.ts**

The service currently returns `{ accessToken, csrfToken, user }`. We need to modify login and verifyOtp to accept `Response` and set cookie.

- [ ] **Step 2: Update login method signature**

```typescript
// Add Response import at top
import type { Response } from 'express';

// Modify login method
async login(
  usernameOrEmail: string,
  pinOrPassword: string,
  ipAddress: string = 'unknown',
  res?: Response,  // NEW: Optional response object
) {
  // ... existing logic until token generation ...

  const payload = { sub: user.id, role: user.role as string };
  const jti = crypto.randomUUID();
  const accessToken = this.jwtService.sign(payload, {
    secret: process.env.JWT_ACCESS_SECRET ?? '',
    expiresIn: '20h',
    jwtid: jti,
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');

  // NEW: Set httpOnly cookie if response object provided
  if (res) {
    // Token expires in 20 hours = 72000 seconds
    set_cookie(res, 'access_token', accessToken, {
      maxAge: 72000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  return {
    // NEW: Only return CSRF token (access token is in cookie)
    csrfToken,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      must_change_pin: user.must_change_pin,
    },
  };
}
```

- [ ] **Step 3: Update validateAdminCredentials method**

```typescript
async validateAdminCredentials(
  email: string,
  password: string,
  ipAddress: string,
  res?: Response,  // NEW
) {
  // ... existing logic until token generation ...

  const payload = { sub: user.id, role: user.role as string };
  const jti = crypto.randomUUID();
  const accessToken = this.jwtService.sign(payload, {
    secret: process.env.JWT_ACCESS_SECRET ?? '',
    expiresIn: '12h',
    jwtid: jti,
  });

  // NEW: Set httpOnly cookie
  if (res) {
    set_cookie(res, 'admin_token', accessToken, {
      maxAge: 43200, // 12 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  return {
    // Return CSRF only, no access token
    csrfToken: crypto.randomBytes(32).toString('hex'),
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}
```

- [ ] **Step 4: Update verifyOtp method**

```typescript
async verifyOtp(
  email: string,
  otpCode: string,
  ipAddress: string,
  res?: Response,  // NEW
) {
  // ... existing OTP verification logic ...

  // Generate tokens
  const payload = { sub: user.id, role: user.role as string };
  const jti = crypto.randomUUID();
  const accessToken = this.jwtService.sign(payload, {
    secret: process.env.JWT_ACCESS_SECRET ?? '',
    expiresIn: '12h',
    jwtid: jti,
  });
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // NEW: Set httpOnly cookie
  if (res) {
    set_cookie(res, 'admin_token', accessToken, {
      maxAge: 43200,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  return {
    csrfToken,  // Changed from accessToken to csrfToken
    user: { id: user.id, name: user.name, role: user.role },
  };
}
```

- [ ] **Step 5: Update changePin method**

```typescript
async changePin(userId: string, currentPin: string, newPin: string, res?: Response) {
  // ... existing logic ...

  // Generate new token
  const payload = { sub: user.id, role: user.role as string };
  const jti = crypto.randomUUID();
  const accessToken = this.jwtService.sign(payload, {
    secret: process.env.JWT_ACCESS_SECRET ?? '',
    expiresIn: '20h',
    jwtid: jti,
  });

  // NEW: Set httpOnly cookie
  if (res) {
    set_cookie(res, 'access_token', accessToken, {
      maxAge: 72000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }

  return {
    csrfToken: crypto.randomBytes(32).toString('hex'),  // Changed
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      must_change_pin: false,
    },
  };
}
```

- [ ] **Step 6: Add import**

```typescript
import { set_cookie } from '../../../common/utils/cookie';
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/application/services/auth.service.ts
git commit -m "feat(auth): set httpOnly cookie for tokens in AuthService"
```

---

## Task 3: Backend - Update AuthController

**Files:**
- Modify: `backend/src/auth/presentation/auth.controller.ts`

- [ ] **Step 1: Read current auth.controller.ts**

- [ ] **Step 2: Add Response parameter to endpoints**

```typescript
// Add to imports
import { Response } from 'express';

// Update @Post('login') handler
@Post('login')
@Public()
async login(
  @Body() dto: LoginDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,  // NEW
) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return this.authService.login(dto.username, dto.pin, ip, res);  // Pass res
}

// Update @Post('admin') handler
@Post('admin')
@Public()
async adminLogin(
  @Body() dto: LoginDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,  // NEW
) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return this.authService.validateAdminCredentials(dto.username, dto.pin, ip, res);
}

// Update @Post('verify-otp') handler
@Post('verify-otp')
@Public()
async verifyOtp(
  @Body() dto: VerifyOtpDto,
  @Req() req: Request,
  @Res({ passthrough: true }) res: Response,  // NEW
) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return this.authService.verifyOtp(dto.email, dto.otp, ip, res);
}

// Update @Post('change-pin') handler (protected)
@Post('change-pin')
@UseGuards(JwtAuthGuard)
async changePin(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: ChangePinDto,
  @Res({ passthrough: true }) res: Response,  // NEW
) {
  return this.authService.changePin(user.id, dto.current_pin, dto.new_pin, res);
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/auth/presentation/auth.controller.ts
git commit -m "feat(auth): pass Response to set httpOnly cookies"
```

---

## Task 4: Frontend - Update ApiClient

**Files:**
- Modify: `frontend/src/lib/services/api.client.ts`

- [ ] **Step 1: Update get_auth_token method**

Replace localStorage with cookie reading:

```typescript
// REPLACE this method:
private get_auth_token(endpoint: string): string | null {
  if (typeof localStorage === 'undefined') return null;

  // Check if this is an admin route
  const is_admin_route = endpoint.includes('/admin/') || endpoint.includes('/auth/admin');

  if (is_admin_route) {
    return localStorage.getItem('admin_token');
  }
  return localStorage.getItem('access_token');
}

// WITH:
private get_auth_token(endpoint: string): string | null {
  // Read from httpOnly cookie (set by backend)
  const token_name = endpoint.includes('/admin/') || endpoint.includes('/auth/admin')
    ? 'admin_token'
    : 'access_token';

  return get_cookie(token_name);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/services/api.client.ts
git commit -m "feat(frontend): read auth token from cookie instead of localStorage"
```

---

## Task 5: Frontend - Update Login Components

**Files:**
- Modify: `frontend/src/routes/login/+page.svelte`
- Modify: `frontend/src/routes/login-admin/+page.svelte`

- [ ] **Step 1: Read login page**

- [ ] **Step 2: Update to store CSRF in memory**

```typescript
// Replace localStorage.setItem('access_token', ...) with only CSRF storage
// CSRF token is still stored for CSRF protection header

// In the login success handler:
const result = await res.json();
// Store CSRF token in localStorage for CSRF header (not the access token)
localStorage.setItem('csrf_token', result.csrfToken);
// Remove access_token storage (it's now in httpOnly cookie)
// DO NOT: localStorage.setItem('access_token', result.accessToken)
```

- [ ] **Step 3: Update get_cookie function to also read csrf_token**

Actually, we need to keep CSRF token accessible. Update api.client.ts:

```typescript
// Add this method
private get_csrf_token(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('csrf_token');
}

// Update the CSRF handling in request method
if (is_mutating) {
  // First try to get from cookie (httpOnly)
  let csrf_token = get_cookie('csrf_token');
  // Fall back to localStorage for backward compatibility
  if (!csrf_token) {
    csrf_token = this.get_csrf_token();
  }
  if (csrf_token) {
    options.headers['X-CSRF-Token'] = csrf_token;
  }
  // ... rest of CSRF handling
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/login/+page.svelte frontend/src/routes/login-admin/+page.svelte
git commit -m "feat(frontend): store CSRF token in localStorage (access token via cookie)"
```

---

## Task 6: Verify and Test

**Files:**
- Test: Full integration test

- [ ] **Step 1: Run backend tests**

```bash
cd backend && npm test
```

Expected: All tests pass

- [ ] **Step 2: Run backend lint**

```bash
cd backend && npm run lint
```

Expected: No errors

- [ ] **Step 3: Run backend build**

```bash
cd backend && npm run build
```

Expected: Build successful

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && npm test
```

Expected: All tests pass

- [ ] **Step 5: Run frontend type check**

```bash
cd frontend && npm run check
```

Expected: No TypeScript errors

- [ ] **Step 6: Rebuild Docker image**

```bash
docker compose build nestjs-api
```

- [ ] **Step 7: Test login flow manually**

1. POST /api/v1/auth/login
2. Verify Set-Cookie header is set with httpOnly
3. Verify subsequent requests work with cookie

- [ ] **Step 8: Commit final changes**

```bash
git add -A
git commit -m "feat: complete hybrid token migration - httpOnly cookies"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Cookie utility | `cookie.ts`, `cookie.spec.ts` |
| 2 | AuthService update | `auth.service.ts` |
| 3 | AuthController update | `auth.controller.ts` |
| 4 | ApiClient update | `api.client.ts` |
| 5 | Login pages update | `login/+page.svelte`, `login-admin/+page.svelte` |
| 6 | Verification | All tests pass |

---

## Security Improvements

| Before | After |
|--------|-------|
| Token in localStorage (XSS stealable) | Token in httpOnly cookie (JS cannot access) |
| CSRF token stored with token | CSRF token separate |
| Token visible in localStorage | Token hidden from all JS |

---

## Cookie Configuration

| Cookie | HttpOnly | Secure | SameSite | MaxAge |
|--------|----------|--------|----------|--------|
| access_token | Yes | Prod only | Strict | 20h |
| admin_token | Yes | Prod only | Strict | 12h |
| csrf_token | No (frontend reads) | - | - | - |
