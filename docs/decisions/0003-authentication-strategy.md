# ADR-0003: JWT-based Authentication with HttpOnly Cookies

## Status
Accepted

## Date
2024-01-20

## Context
We needed an authentication strategy that:
- Is secure against XSS (no token in localStorage)
- Supports both web and potential mobile clients
- Has refresh token capability for long sessions
- Integrates with role-based access control

## Decision
Use JWT access tokens with HttpOnly cookies for storage.

### Token Structure
- **Access Token**: Short-lived (8 hours), stored in memory/cookie
- **Refresh Token**: Longer-lived (7 days), HttpOnly cookie
- **CSRF Token**: Separate cookie for CSRF protection

### Authentication Flow
1. User logs in with credentials
2. Server validates and issues access + refresh tokens
3. Access token stored in HttpOnly cookie
4. Refresh token stored in HttpOnly cookie (different cookie)
5. CSRF token stored in non-HttpOnly cookie
6. Client reads CSRF token and sends in X-CSRF-Token header

## Security Considerations
- Access tokens in HttpOnly cookies prevent XSS theft
- CSRF token prevents CSRF attacks
- Refresh tokens can be revoked via database
- IP lockout prevents brute force

## Consequences
- Need to handle cookie parsing correctly
- CORS must allow credentials
- Refresh token rotation on each use
- Token revocation requires database lookup