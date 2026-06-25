# Members API

Dokumentasi API untuk modul Member & Loyalty System NGEMILOH POS.

## Overview

| Base URL | `/api/v1` |
|----------|-----------|
| Auth | JWT Bearer Token (HttpOnly cookie) |
| Rate Limiting | Per-endpoint (lihat masing-masing) |

---

## Loyalty Tiers

| Tier | Min Points | Discount | Points Multiplier |
|------|------------|---------|-------------------|
| Bronze | 0 | 0% | 1.0x |
| Silver | 500 | 5% | 1.0x |
| Gold | 1,500 | 10% | 1.0x |
| Platinum | 5,000 | 15% | 1.0x |

### Points Calculation

```
Points Earned = floor(transaction_subtotal / 1000) × 5 points

Redeem Value = floor(points / 5) × Rp 1,000

Example:
- Purchase Rp 58,000 → 5 × floor(58000/1000) = 290 points earned
- Redeem 500 points → floor(500/5) × 1000 = Rp 100,000 discount
```

### Cooldown Policy

- **2 minutes cooldown** antara transaksi earn points
- Dicek via Redis: `member:cooldown:{memberId}`
- Lookup tetap bisa dilakukan selama cooldown

---

## Public Endpoints

### POST /member/register

Register member baru tanpa autentikasi.

**Rate Limit:** 10 requests/minute per IP

**Request:**
```json
{
  "phone": "081234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "ref_code": "base64_encoded_outlet_id"
}
```

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `phone` | string | Yes | Nomor HP Indonesia (08xx) |
| `name` | string | Yes | Nama lengkap (2-100 chars) |
| `email` | string | No | Email opsional |
| `ref_code` | string | No | Referensi outlet (base64 encoded) |

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "member_code": "MBR-ABC123",
    "name": "John Doe",
    "phone": "081234567890",
    "tier": "Bronze",
    "loyalty_points": 0,
    "registered_at": "2026-06-26T10:30:00Z"
  },
  "message": "Pendaftaran berhasil! Selamat datang di NGEMILOH Members."
}
```

**Error Responses:**
- `409 Conflict` - Phone already registered
- `400 Bad Request` - Validation error

**Example (curl):**
```bash
curl -X POST https://api.ngemiloh.com/api/v1/member/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "081234567890", "name": "John Doe"}'
```

---

### GET /member/lookup

Lookup member berdasarkan phone atau member code.

**Rate Limit:** 30 requests/minute per IP

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|---------|-------------|
| `phone` | string | No* | Nomor HP |
| `code` | string | No* | Member code (e.g., MBR-ABC123) |
| `qr` | string | No* | QR code value |

*Salah satu dari phone/code/qr wajib ada.

**Response (200) - Bronze Member:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "member_code": "MBR-ABC123",
    "name": "John Doe",
    "tier": "Bronze",
    "loyalty_points": 0,
    "points_value": 0,
    "can_earn": true,
    "cooldown_until": null
  }
}
```

**Response (200) - Gold Member with Points:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "member_code": "MBR-XYZ789",
    "name": "Jane Smith",
    "tier": "Gold",
    "loyalty_points": 2500,
    "points_value": 500000,
    "can_earn": true,
    "cooldown_until": null
  }
}
```

**Points Value Calculation:**
```
points_value = floor(loyalty_points / 5) × 1,000

Example: 2500 points = floor(2500/5) × 1000 = Rp 500,000 redeemable value
```

**Error Responses:**
- `404 Not Found` - Member tidak ditemukan
- `429 Too Many Requests` - Rate limit exceeded

**Example (curl):**
```bash
# By phone
curl "https://api.ngemiloh.com/api/v1/member/lookup?phone=081234567890"

# By member code
curl "https://api.ngemiloh.com/api/v1/member/lookup?code=MBR-ABC123"
```

---

## POS Authenticated Endpoints

Memerlukan JWT token di cookie (kasir login).

### GET /pos/member/lookup

Lookup member saat transaksi POS.

**Rate Limit:** 60 requests/minute per user

**Auth:** Kasir/Admin JWT required

**Query Parameters:** Same as `/member/lookup`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "member_code": "MBR-XYZ789",
    "name": "Jane Smith",
    "phone": "081234567890",
    "tier": "Gold",
    "loyalty_points": 2500,
    "points_value": 500000,
    "can_earn": true,
    "cooldown_until": null
  }
}
```

---

### POST /pos/member/process

Process earn points dan/atau redeem points dalam satu transaksi.

**Rate Limit:** 30 requests/minute per user

**Auth:** Kasir/Admin JWT required

**Request - Earn Points Only:**
```json
{
  "member_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_id": "ORD-20260626-001",
  "transaction_subtotal": 58000,
  "redeem_requested": false
}
```

**Request - Earn + Full Redeem:**
```json
{
  "member_id": "550e8400-e29b-41d4-a716-446655440001",
  "order_id": "ORD-20260626-002",
  "transaction_subtotal": 58000,
  "redeem_requested": true
}
```

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `member_id` | UUID | Yes | Member ID |
| `order_id` | UUID | No | Order ID untuk linking |
| `transaction_subtotal` | number | Yes | Subtotal transaksi (tanpa tax) |
| `redeem_requested` | boolean | No | Set true untuk redeem semua points |

**Response (200) - Earn Points:**
```json
{
  "success": true,
  "data": {
    "points_earned": 290,
    "points_redeemed": 0,
    "discount_amount": 0,
    "final_payment": null,
    "new_balance": 2790,
    "cooldown_until": "2026-06-26T10:32:00Z",
    "tier": "Gold",
    "tier_changed": false,
    "tier_benefits": null
  }
}
```

**Response (200) - Redeem + Earn (tier upgrade):**
```json
{
  "success": true,
  "data": {
    "points_earned": 290,
    "points_redeemed": 2500,
    "discount_amount": 500000,
    "final_payment": 0,
    "new_balance": 290,
    "cooldown_until": "2026-06-26T10:32:00Z",
    "tier": "Gold",
    "tier_changed": false,
    "tier_benefits": null
  }
}
```

**Response (200) - Tier Upgrade:**
```json
{
  "success": true,
  "data": {
    "points_earned": 290,
    "points_redeemed": 0,
    "discount_amount": 0,
    "final_payment": null,
    "new_balance": 5000,
    "cooldown_until": "2026-06-26T10:32:00Z",
    "tier": "Platinum",
    "tier_changed": true,
    "tier_benefits": {
      "free_item": "Keripik Singkong (Bonus)"
    }
  }
}
```

**Points Calculation in Response:**
```
Points Earned = floor(subtotal / 1000) × 5
Points Redeemed = all current points (full redemption)
Discount Amount = floor(points_redeemed / 5) × 1000
Final Payment = max(0, subtotal - discount_amount)

Example (subtotal = Rp 58,000):
- points_earned = floor(58000/1000) × 5 = 290 points
- If member has 2500 points and redeem_requested = true:
  - points_redeemed = 2500
  - discount_amount = floor(2500/5) × 1000 = Rp 500,000
  - final_payment = max(0, 58000 - 500000) = Rp 0
```

**Error Responses:**
- `404 Not Found` - Member tidak ditemukan
- `400 Bad Request` - Member tidak aktif

**Example (curl):**
```bash
curl -X POST https://api.ngemiloh.com/api/v1/pos/member/process \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=eyJhbG..." \
  -d '{
    "member_id": "550e8400-e29b-41d4-a716-446655440001",
    "order_id": "ORD-20260626-001",
    "transaction_subtotal": 58000,
    "redeem_requested": false
  }'
```

---

## Admin Endpoints

Memerlukan JWT token dengan role `superadmin`.

### GET /admin/members

List semua member dengan pagination.

**Rate Limit:** 60 requests/minute per user

**Auth:** Superadmin only

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `tier` | string | - | Filter by tier name |
| `search` | string | - | Search name/phone (max 100 chars) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "member_code": "MBR-XYZ789",
      "name": "Jane Smith",
      "phone": "081234567890",
      "tier": {
        "name": "Gold",
        "discount_rate": 10
      },
      "loyalty_points": 2500,
      "is_active": true,
      "registered_at": "2026-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1500,
    "totalPages": 75
  }
}
```

**Example (curl):**
```bash
curl "https://api.ngemiloh.com/api/v1/admin/members?page=1&limit=20&tier=Gold" \
  -H "Cookie: access_token=eyJhbG..."
```

---

### GET /admin/members/stats

Statistik member untuk dashboard.

**Rate Limit:** 30 requests/minute per user

**Auth:** Superadmin only

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_members": 1500,
    "new_this_month": 50,
    "tier_distribution": {
      "Bronze": 800,
      "Silver": 400,
      "Gold": 250,
      "Platinum": 50
    }
  }
}
```

---

### GET /admin/members/:id

Detail member dengan history transaksi.

**Rate Limit:** 30 requests/minute per user

**Auth:** Superadmin only

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Member ID (v4) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "member_code": "MBR-XYZ789",
    "name": "Jane Smith",
    "phone": "081234567890",
    "email": "jane@example.com",
    "tier": {
      "id": "uuid",
      "name": "Gold",
      "min_points": 1500,
      "discount_rate": 10,
      "points_multiplier": 1.0
    },
    "loyalty_points": 2500,
    "points_value": 500000,
    "tier_benefits": null,
    "is_active": true,
    "registered_at": "2026-01-15T10:30:00Z",
    "transactions": [
      {
        "id": "uuid",
        "type": "earn",
        "points": 290,
        "balance_after": 2500,
        "description": "Earn 290 pts",
        "order_id": "ORD-20260626-001",
        "created_at": "2026-06-26T10:30:00Z"
      },
      {
        "id": "uuid",
        "type": "redeem",
        "points": -500,
        "balance_after": 2210,
        "description": "Redeem 500 pts",
        "order_id": "ORD-20260625-005",
        "created_at": "2026-06-25T14:20:00Z"
      }
    ]
  }
}
```

**Points Value Display:**
```
points_value = floor(loyalty_points / 5) × 1,000

Example: 2500 points → Rp 500,000 redeemable
```

**Error Responses:**
- `404 Not Found` - Member tidak ditemukan

**Example (curl):**
```bash
curl "https://api.ngemiloh.com/api/v1/admin/members/550e8400-e29b-41d4-a716-446655440001" \
  -H "Cookie: access_token=eyJhbG..."
```

---

### PATCH /admin/members/:id/tier

Manual tier adjustment (upgrade/downgrade).

**Rate Limit:** 20 requests/minute per user

**Auth:** Superadmin only

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `id` | UUID | Member ID (v4) |

**Request:**
```json
{
  "tier": "Gold"
}
```

Valid tier values: `Bronze`, `Silver`, `Gold`, `Platinum`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "member_id": "550e8400-e29b-41d4-a716-446655440001",
    "old_tier": "Silver",
    "new_tier": "Gold",
    "tier": {
      "id": "uuid",
      "name": "Gold",
      "min_points": 1500,
      "discount_rate": 10
    }
  }
}
```

**Audit Log:** Aksi ini dicatat di `AuditLog` dengan:
- `action`: `MEMBER_TIER_ADJUSTED`
- `entity_type`: `Member`
- `old_value`: `{ tier: "Silver" }`
- `new_value`: `{ tier: "Gold", tier_id: "uuid" }`

**Error Responses:**
- `400 Bad Request` - Invalid tier name
- `404 Not Found` - Member tidak ditemukan

**Example (curl):**
```bash
curl -X PATCH "https://api.ngemiloh.com/api/v1/admin/members/550e8400-e29b-41d4-a716-446655440001/tier" \
  -H "Content-Type: application/json" \
  -H "Cookie: access_token=eyJhbG..." \
  -d '{"tier": "Gold"}'
```

---

## Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions (not superadmin) |
| `NOT_FOUND` | 404 | Member not found |
| `CONFLICT` | 409 | Phone already registered |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits Summary

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/member/register` | 10 | 1 min/IP |
| `/member/lookup` | 30 | 1 min/IP |
| `/pos/member/lookup` | 60 | 1 min/user |
| `/pos/member/process` | 30 | 1 min/user |
| `/admin/members` | 60 | 1 min/user |
| `/admin/members/stats` | 30 | 1 min/user |
| `/admin/members/:id` | 30 | 1 min/user |
| `/admin/members/:id/tier` | 20 | 1 min/user |

---

## Endpoint Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/member/register` | Public | Register member baru |
| GET | `/member/lookup` | Public | Lookup by phone/code |
| GET | `/pos/member/lookup` | Kasir/Admin | Lookup untuk POS |
| POST | `/pos/member/process` | Kasir/Admin | Earn + redeem points |
| GET | `/admin/members` | Superadmin | List semua member |
| GET | `/admin/members/stats` | Superadmin | Statistik member |
| GET | `/admin/members/:id` | Superadmin | Detail member |
| PATCH | `/admin/members/:id/tier` | Superadmin | Adjust tier manual |

---

*Document Version: 1.0*
*Last Updated: 2026-06-26*
*Source: backend/src/members/*
