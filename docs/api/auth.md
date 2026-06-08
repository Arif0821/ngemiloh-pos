# Authentication API

## POST /api/v1/auth/login

Login with username/email and password or PIN.

### Request
```json
{
  "username": "kasir1",
  "pin": "123456"
}
```

Or for superadmin:
```json
{
  "username": "admin@ngemiloh.com",
  "password": "secretpassword"
}
```

### Response (200)
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Kasir Satu",
    "role": "kasir",
    "must_change_pin": false
  }
}
```

Cookies set:
- `access_token` (HttpOnly)
- `refresh_token` (HttpOnly)
- `csrf_token` (readable by JS)

---

## POST /api/v1/auth/refresh

Refresh access token using refresh token cookie.

### Response (200)
```json
{
  "success": true,
  "message": "Token refreshed"
}
```

New access token cookie set.

---

## POST /api/v1/auth/logout

Logout and invalidate refresh token.

### Response (200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```