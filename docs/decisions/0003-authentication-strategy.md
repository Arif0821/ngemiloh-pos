# ADR-0003: JWT-based Authentication with HttpOnly Cookies

## Status
Accepted

## Date
2024-01-20

## Last Updated
2026-06-25

## Context
We needed an authentication strategy that:
- Is secure against XSS (no token in localStorage)
- Supports both web and potential mobile clients
- Has short-lived tokens to limit damage from theft
- Integrates with role-based access control (KASIR, SUPERADMIN)
- Prevents brute force attacks on PIN and OTP

## Decision
Use JWT access tokens stored in HttpOnly cookies + a separate non-HttpOnly CSRF cookie.

### Token Structure

| Token | Lifespan | Storage | Access |
|-------|----------|---------|--------|
| Access Token (JWT) | 8h (kasir) / 12h (superadmin) | HttpOnly, Secure cookie | Server-only |
| CSRF Token | Matches JWT expiry | Non-HttpOnly cookie | JavaScript-readable |
| OTP (admin login) | 10 min TTL | Redis (SHA256 hashed) | Server-only |

### JWT Payload

```typescript
{
  sub: string;       // user ID
  role: 'KASIR' | 'SUPERADMIN';
  shift_id?: string; // active shift
  jti: string;       // unique token ID for revocation
  iat: number;
  exp: number;
}
```

### Authentication Flow

```
KASIR LOGIN:
1. POST /auth/login-pin  { username, pin }
2. Server: verify PIN (bcrypt 12 rounds + pepper)
3. Server: issue JWT (8h) as HttpOnly cookie
4. Server: issue CSRF token as non-HttpOnly cookie
5. Client reads CSRF token via document.cookie, sends in X-CSRF-Token header

SUPERADMIN LOGIN:
1. POST /auth/login-password  { email, password }
2. Server: verify password (16+ char strength)
3. POST /auth/verify-otp  { code }  (6-digit, Redis TTL 10min)
4. Server: issue JWT (12h) as HttpOnly cookie
5. Server: issue CSRF token as non-HttpOnly cookie
```

### CSRF Protection

- CSRF token stored as **non-HttpOnly** cookie (JS must read it)
- Frontend reads: `document.cookie.match(/csrf_token=([^;]+)/)?.[1]`
- Frontend sends: `X-CSRF-Token: <value>` custom header
- Server validates: header cookie value matches stored value
- Token rotated on every successful mutation (30 min TTL)

### PIN Security

- Bcrypt with **12 salt rounds**
- Pepper: `PIN_PEPPER_SECRET` env var mixed before hashing
- Rate limit: exponential backoff after failed attempts
- Lockout: 5-minute lockout after 3 failed verifications
- IP + User-Agent lockout after `LOCKOUT_THRESHOLD` failed attempts

### OTP Security (Admin)

- 6-digit numeric (1,000,000 combinations)
- SHA256 hashed before storing in Redis
- TTL: 10 minutes (600 seconds)
- Rate limit: 1 OTP request per 60 seconds
- Lockout: 5 minutes after 3 failed verifications
- Exponential backoff: 1min → 2min → 4min → 8min → 15min + alert

### Token Revocation

- Redis blocklist keyed by `jti` (JWT ID)
- TTL matches remaining token lifetime
- Endpoint: `POST /auth/revoke` (admin only) for emergency revocation

### Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `JWT_ACCESS_SECRET` | Yes | — |
| `CSRF_SECRET` | Yes | — |
| `PIN_PEPPER_SECRET` | Yes | — |
| `JWT_ACCESS_EXPIRES` | No | `8h` |
| `CSRF_COOKIE_MAX_AGE` | No | `28800` (8h in sec) |
| `OTP_EXPIRES_IN` | No | `600` (10min in sec) |
| `LOCKOUT_THRESHOLD` | No | `10` attempts |

## Alternatives Considered

### localStorage + Bearer Token
- Pros: Simple, works for mobile
- Cons: Vulnerable to XSS — **rejected**

### Session Cookies Only (no JWT)
- Pros: Server-side revocation is trivial
- Cons: Not stateless, doesn't scale well for POS workers
- Decision: JWT is better for distributed POS context

### JWT 365 Days (Original v8.0)
- Security risk: compromised PIN = 1 year of access
- **Fixed:** Reduced to 8h (kasir) / 12h (admin)

## Consequences

- Access tokens in HttpOnly cookies prevent XSS theft
- CSRF token prevents CSRF attacks
- Short JWT expiry limits damage from token theft
- Redis blocklist enables revocation for compromised tokens
- PIN + OTP + IP lockout layers prevent brute force
- Pepper prevents rainbow table attacks on PIN hashes
