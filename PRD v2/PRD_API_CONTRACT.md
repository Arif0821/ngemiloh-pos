# PRD API CONTRACT v8.3 - NGEMILOH POS
**API Specification Document**

| Metadata | Value |
|----------|-------|
| Version | 8.3 |
| Date | 2026-06-25 |
| Base URL | `/api/v1` |
| Auth Type | JWT Bearer Token |

---

## 1. Overview

### 1.1 API Design Principles

| Principle | Implementation |
|-----------|-----------------|
| RESTful | Resource-based endpoints |
| JSON | Request/response format |
| Pagination | Cursor-based for large lists |
| Versioning | URL prefix `/api/v1` |
| Error Format | Standardized error response |

### 1.2 Response Envelope

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-06-25T10:30:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-06-25T10:30:00Z"
  }
}
```

### 1.3 HTTP Status Codes

| Code | Usage |
|------|-------|
| `200` | Success |
| `201` | Created |
| `400` | Validation error |
| `401` | Unauthorized |
| `403` | Forbidden |
| `404` | Not found |
| `429` | Rate limited |
| `500` | Internal error |

### 1.4 Authentication

| Role | Auth Method | Token Expiry |
|------|-------------|--------------|
| Superadmin | Email + Password + OTP | 8 hours |
| Kasir | Username + PIN | 8 hours |
| Public | None | N/A |

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 2. Public Endpoints

### 2.1 Member Registration

#### POST /member/register

Register a new loyalty member.

**Request:**
```json
{
  "phone": "081234567890",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "MEM-XXXXXX",
    "phone": "081234567890",
    "name": "John Doe",
    "points": 0,
    "tier": {
      "name": "Bronze",
      "discountRate": 0
    }
  }
}
```

**Validation:**
- Phone: Required, valid Indonesian format (08xx)
- Name: Required, 2-100 characters

---

#### GET /member/lookup

Lookup member by phone or code.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Phone number or member code |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "MEM-XXXXXX",
    "phone": "081234567890",
    "name": "John Doe",
    "points": 1500,
    "tier": {
      "name": "Gold",
      "discountRate": 0.10
    },
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

---

### 2.2 Products (Public Read)

#### GET /products

List all products (public catalog).

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | uuid | - | Filter by category |
| `available` | boolean | true | Filter available only |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Items per page |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Keripik Singkong",
      "price": 15000,
      "imageUrl": "https://...",
      "category": {
        "id": "uuid",
        "name": "Keripik"
      },
      "modifierGroups": [
        {
          "id": "uuid",
          "name": "Level Pedas",
          "isRequired": true,
          "options": [
            { "id": "uuid", "name": "Normal", "priceAdjustment": 0 },
            { "id": "uuid", "name": "Pedas", "priceAdjustment": 0 },
            { "id": "uuid", "name": "Sangat Pedas", "priceAdjustment": 1000 }
          ]
        }
      ],
      "isAvailable": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

#### GET /products/categories

List all categories.

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Keripik", "sortOrder": 1 },
    { "id": "uuid", "name": "Kue", "sortOrder": 2 }
  ]
}
```

---

## 3. Authentication Endpoints

### 3.1 POS Authentication

#### POST /auth/login

Login for kasir (PIN) or admin (email+password).

**Kasir Login:**
```json
{
  "type": "kasir",
  "username": "kasir1",
  "pin": "1234",
  "outletId": "uuid"
}
```

**Admin Login:**
```json
{
  "type": "admin",
  "email": "admin@ngemiloh.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "tokenType": "Bearer",
    "expiresIn": 28800,
    "user": {
      "id": "uuid",
      "username": "kasir1",
      "role": "kasir",
      "outlet": {
        "id": "uuid",
        "name": "Outlet Utama"
      }
    }
  }
}
```

---

#### POST /auth/verify-otp

Verify admin OTP for login.

**Request:**
```json
{
  "email": "admin@ngemiloh.com",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "expiresIn": 28800,
    "user": {
      "id": "uuid",
      "email": "admin@ngemiloh.com",
      "role": "superadmin"
    }
  }
}
```

---

#### POST /auth/refresh

Refresh access token (for silent refresh).

**Request:**
```json
{
  "refreshToken": "uuid-from-cookie"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "expiresIn": 28800
  }
}
```

---

### 3.2 Token Management

#### GET /auth/me

Get current authenticated user.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "kasir1",
    "email": "kasir1@ngemiloh.com",
    "role": "kasir",
    "outlets": [
      { "id": "uuid", "name": "Outlet Utama" }
    ],
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

---

#### PATCH /auth/change-pin

Change kasir PIN (self-service).

**Request:**
```json
{
  "currentPin": "1234",
  "newPin": "5678"
}
```

**Validation:**
- Current PIN: Required, must match
- New PIN: Required, 4-6 digits

---

## 4. Order Endpoints

### 4.1 Order Operations

#### POST /orders

Create a new order.

**Request:**
```json
{
  "outletId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "modifiers": [
        { "optionId": "uuid", "priceAdjustment": 0 }
      ],
      "notes": "Extra crispy"
    }
  ],
  "customerId": "uuid",
  "memberId": "uuid",
  "paymentMethod": "cash",
  "cashPaid": 100000,
  "discountCode": "DISKON10"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "ORD-20260625-001",
    "status": "completed",
    "items": [...],
    "subtotal": 58000,
    "discountAmount": 5800,
    "tierDiscount": 0,
    "taxAmount": 5742,
    "total": 57942,
    "cashPaid": 100000,
    "change": 42058,
    "memberPointsEarned": 290,
    "createdAt": "2026-06-25T14:30:00Z"
  }
}
```

---

#### POST /orders/sync-batch

Sync offline orders when back online.

**Request:**
```json
{
  "orders": [
    { ...order data... },
    { ...order data... }
  ],
  "lastSyncAt": "2026-06-25T12:00:00Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "synced": 5,
    "failed": 0,
    "errors": []
  }
}
```

---

#### GET /orders

List orders with pagination and filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `outletId` | uuid | Filter by outlet |
| `status` | string | Filter by status |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |
| `cashierId` | uuid | Filter by cashier |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response (200):**
```json
{
  "success": true,
  "data": [...orders],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### 4.2 Shift Operations

#### POST /pos/shift/start

Start a new shift.

**Request:**
```json
{
  "outletId": "uuid",
  "openingBalance": 500000
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "open",
    "openingBalance": 500000,
    "startedAt": "2026-06-25T07:00:00Z",
    "cashier": {
      "id": "uuid",
      "username": "kasir1"
    }
  }
}
```

---

#### GET /pos/shift/status

Get current shift status.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "open",
    "openingBalance": 500000,
    "startedAt": "2026-06-25T07:00:00Z",
    "currentBalance": 750000,
    "totalSales": 250000,
    "orderCount": 8
  }
}
```

---

#### GET /orders/shift

Get shift summary with order breakdown.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "shiftId": "uuid",
    "openingBalance": 500000,
    "closingBalance": 750000,
    "totalSales": 250000,
    "totalCash": 200000,
    "totalQris": 50000,
    "orderCount": 10,
    "voidCount": 1,
    "voidAmount": 30000,
    "refundCount": 0,
    "refundAmount": 0,
    "orders": [...]
  }
}
```

---

### 4.3 Admin Order Operations

#### POST /admin/transactions/:id/void

Void an order (admin only).

**Request:**
```json
{
  "reason": "Customer requested cancellation due to wrong order",
  "refundMethod": "cash"
}
```

**Validation:**
- Reason: Required, minimum 10 characters
- Refund method: Required, must be valid enum

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "voided",
    "voidedAt": "2026-06-25T15:00:00Z",
    "voidReason": "Customer requested...",
    "refundAmount": 57942
  }
}
```

---

#### PATCH /admin/transactions/:id/flag

Flag an order for review.

**Request:**
```json
{
  "flagReason": "Price discrepancy detected"
}
```

---

### 4.4 Payment Webhooks

#### POST /webhooks/midtrans

Midtrans payment status webhook.

**Headers:**
```
X-Override-Key: <midtrans_server_key>
```

**Request:**
```json
{
  "orderId": "ORD-20260625-001",
  "transactionStatus": "settlement",
  "transactionTime": "2026-06-25 14:30:00",
  "grossAmount": "57942"
}
```

---

## 5. Member Endpoints (POS)

### 5.1 POS Member Operations

#### GET /pos/member/lookup

Lookup member during POS transaction.

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | Yes | Phone or member code |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "MEM-123456",
    "name": "John Doe",
    "phone": "081234567890",
    "points": 1500,
    "tier": {
      "name": "Gold",
      "discountRate": 0.10
    },
    "canRedeem": true,
    "redeemablePoints": 1400
  }
}
```

---

#### POST /pos/member/process

Process points earning or redemption.

**Earn Points:**
```json
{
  "memberId": "uuid",
  "orderId": "uuid",
  "action": "earn",
  "amount": 57942
}
```

**Redeem Points:**
```json
{
  "memberId": "uuid",
  "orderId": "uuid",
  "action": "redeem",
  "points": 500
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "previousPoints": 1500,
    "pointsChange": 290,
    "newPoints": 1790,
    "tier": {
      "name": "Gold",
      "discountRate": 0.10
    },
    "tierUpgraded": false
  }
}
```

---

## 6. Admin Member Endpoints

### 6.1 Member Management

#### GET /admin/members

List all members (paginated).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `tier` | string | Filter by tier |
| `search` | string | Search name/phone |
| `sort` | string | Sort field |
| `page` | number | Page number |
| `limit` | number | Items per page |

---

#### GET /admin/members/stats

Member statistics dashboard.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "byTier": {
      "Bronze": 800,
      "Silver": 400,
      "Gold": 250,
      "Platinum": 50
    },
    "avgPoints": 750,
    "activeThisMonth": 450,
    "newThisMonth": 50
  }
}
```

---

## 7. Product Management Endpoints (Admin)

### 7.1 Product CRUD

#### POST /products

Create a new product.

**Request:**
```json
{
  "name": "Keripik Singkong Original",
  "price": 15000,
  "categoryId": "uuid",
  "image": "base64...",
  "isAvailable": true,
  "modifierGroupIds": ["uuid1", "uuid2"]
}
```

---

#### PATCH /products/:id

Update a product.

---

#### DELETE /products/:id

Delete a product (soft delete).

---

### 7.2 Category CRUD

#### POST /products/categories

Create category.

**Request:**
```json
{
  "name": "Keripik",
  "sortOrder": 1
}
```

---

#### PATCH /products/categories/:id

Update category.

---

## 8. Inventory Endpoints (Admin)

### 8.1 Raw Materials

#### GET /admin/inventory

List raw materials.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `lowStock` | boolean | Show low stock only |
| `category` | string | Filter by category |

---

#### POST /admin/inventory/materials

Create raw material.

**Request:**
```json
{
  "name": "Singkong",
  "unit": "kg",
  "currentStock": 100,
  "lowStockThreshold": 20,
  "costPerUnit": 5000
}
```

**Validation:**
- Cost per unit: Required, must be > 0 (for BOM calculation)

---

#### PATCH /admin/inventory/materials/:id

Update raw material.

---

#### POST /admin/inventory/adjust

Adjust stock manually.

**Request:**
```json
{
  "materialId": "uuid",
  "type": "adjustment",
  "quantity": -5,
  "reason": "Stock opname correction"
}
```

---

### 8.2 BOM Recipes

#### POST /admin/inventory/bom

Create BOM recipe.

**Request:**
```json
{
  "productId": "uuid",
  "items": [
    { "materialId": "uuid", "quantity": 0.5 },
    { "materialId": "uuid", "quantity": 0.1 }
  ]
}
```

---

#### GET /admin/inventory/bom/:productId

Get BOM for a product.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "productName": "Keripik Singkong",
    "hppPerUnit": 8500,
    "items": [
      { "materialId": "uuid", "materialName": "Singkong", "quantity": 0.5, "cost": 2500 },
      { "materialId": "uuid", "materialName": "Minyak", "quantity": 0.1, "cost": 1000 }
    ]
  }
}
```

---

#### GET /admin/inventory/bom-coverage

Get BOM coverage report.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalProducts": 150,
    "withBom": 100,
    "withoutBom": 50,
    "coverageRate": 0.67,
    "productsWithoutBom": [
      { "id": "uuid", "name": "Keripik Bulu" }
    ]
  }
}
```

---

### 8.3 Waste Tracking

#### POST /admin/inventory/waste

Record waste entry.

**Request:**
```json
{
  "materialId": "uuid",
  "quantity": 2,
  "reason": "Expired",
  "estimatedCost": 10000
}
```

---

#### GET /admin/inventory/waste

Get waste history.

---

## 9. Finance Endpoints

### 9.1 Dashboard

#### GET /finance/dashboard

Dashboard KPIs.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "today": {
      "revenue": 2500000,
      "orderCount": 85,
      "avgOrderValue": 29412
    },
    "thisMonth": {
      "revenue": 75000000,
      "orderCount": 2550
    },
    "topProducts": [...],
    "topCashiers": [...]
  }
}
```

---

### 9.2 Shifts

#### GET /finance/shifts

List all shifts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `outletId` | uuid | Filter by outlet |
| `cashierId` | uuid | Filter by cashier |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |

---

#### GET /finance/shifts/:id

Get shift detail with all orders.

---

### 9.3 Cash Report

#### GET /finance/cash

Cash register report.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `shiftId` | uuid | Specific shift |
| `date` | ISO date | Date filter |

---

#### GET /finance/cash/export

Export cash report as CSV.

**Response:** CSV file download

---

### 9.4 Profit Share

#### GET /finance/profit-share

Get profit share report.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `period` | string | Period (daily/monthly/yearly) |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |
| `outletId` | uuid | Filter by outlet |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "period": "2026-06",
    "grossRevenue": 100000000,
    "ppn": 11000000,
    "netRevenue": 89000000,
    "hpp": 45000000,
    "opex": 15000000,
    "depreciation": 5000000,
    "netProfit": 24000000,
    "ownerShare": 14400000,
    "kasirPool": 9600000,
    "cashierShares": [
      { "cashierId": "uuid", "cashierName": "Kasir 1", "sales": 50000000, "share": 4800000 },
      { "cashierId": "uuid", "cashierName": "Kasir 2", "sales": 40000000, "share": 3840000 }
    ]
  }
}
```

---

#### POST /finance/profit-share/calculate

Calculate profit share for a period.

**Request:**
```json
{
  "period": "2026-06",
  "outletId": "uuid",
  "hpp": 45000000,
  "opex": 15000000,
  "depreciation": 5000000
}
```

---

### 9.5 Operational Expenses

#### GET /finance/opex

List operational expenses.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `outletId` | uuid | Filter by outlet |
| `category` | string | Filter by category |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |

---

#### POST /finance/opex

Create expense.

**Request:**
```json
{
  "outletId": "uuid",
  "category": "electricity",
  "description": "Token listrik bulan Juni",
  "amount": 1500000,
  "date": "2026-06-25"
}
```

---

#### DELETE /finance/opex/:id

Delete expense.

---

## 10. User Management Endpoints

### 10.1 Cashier CRUD

#### GET /api/v1/admin/users

List all users (kasir).

---

#### POST /api/v1/admin/users

Create new kasir.

**Request:**
```json
{
  "username": "kasir4",
  "name": "Jane Doe",
  "pin": "1234",
  "outletIds": ["uuid1", "uuid2"]
}
```

**Validation:**
- PIN: 4-6 digits, unique

---

#### PATCH /api/v1/admin/users/:id

Update kasir.

---

#### PATCH /api/v1/admin/users/:id/reset-pin

Reset kasir PIN (admin action).

**Request:**
```json
{
  "newPin": "5678"
}
```

---

## 11. Discount Endpoints

### 11.1 Discount CRUD

#### GET /api/v1/admin/discounts

List all discounts.

---

#### POST /api/v1/admin/discounts

Create discount.

**Request:**
```json
{
  "name": "Diskon 10%",
  "type": "percentage",
  "value": 10,
  "scope": "all_products",
  "startDate": "2026-06-01",
  "endDate": "2026-06-30",
  "isActive": true
}
```

---

## 12. System Endpoints

### 12.1 Health & Status

#### GET /_health

Basic health check.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-06-25T10:30:00Z",
  "version": "8.1.0"
}
```

---

#### GET /admin/system-health

Detailed system health.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "database": { "status": "connected", "latency": 5 },
    "redis": { "status": "connected", "latency": 2 },
    "midtrans": { "status": "connected" },
    "uptime": 86400
  }
}
```

---

### 12.2 Feature Flags

#### GET /api/v1/flags

Get all feature flags.

---

#### PATCH /api/v1/flags/:key

Toggle feature flag.

**Request:**
```json
{
  "isEnabled": true
}
```

---

### 12.3 Audit Logs

#### GET /admin/audit-logs

Get audit logs.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `action` | string | Filter by action |
| `actorId` | uuid | Filter by user |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |

---

## 13. Export Endpoints

### 13.1 Data Export

#### GET /admin/reports/export

Export transactions as CSV.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | "transactions" or "products" |
| `dateFrom` | ISO date | Start date |
| `dateTo` | ISO date | End date |
| `outletId` | uuid | Filter by outlet |

**Response:** CSV file download

**Limit:** Maximum 50,000 rows per export

---

## 14. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Wrong username/pin/password |
| `OTP_EXPIRED` | 401 | OTP has expired |
| `OTP_INVALID` | 401 | Wrong OTP |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 15. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 | 30 min per IP |
| `/auth/verify-otp` | 5 | 30 min per IP |
| `/member/register` | 5 | 30 min per IP |
| `/orders` | 20 | 1 min per user |
| Admin endpoints | 60 | 1 min per user |

---

## 16. Pagination

### Standard Pagination

```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Cursor Pagination (for large datasets)

```json
{
  "meta": {
    "cursor": "base64-encoded-cursor",
    "hasMore": true
  }
}
```

---

## 17. Version History

| Version | Date | Changes |
|---------|------|---------|
| 8.3 | 2026-06-27 | Version sync with PRD v8.3 |
| 8.1 | 2026-06-25 | Split from monolithic PRD |
| 8.0 | 2026-06-19 | Initial API documentation |

---

*This document defines the API contract for NGEMILOH POS*
*Frontend team should use this as source of truth for API integration*
