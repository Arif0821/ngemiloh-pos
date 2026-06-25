# Finance API Documentation

**API Version:** v1  
**Base URL:** `/api/v1`  
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Overview](#1-overview)
2. [Dashboard](#2-dashboard)
3. [Shift Management](#3-shift-management)
4. [Profit Share](#4-profit-share)
5. [Operational Expenses](#5-operational-expenses)
6. [Error Codes](#6-error-codes)
7. [Version History](#7-version-history)

---

## 1. Overview

### 1.1 Response Format

All API responses follow a consistent envelope format.

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable error message",
    "details": { ... }
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

### 1.2 Authentication

| Role | Auth Method | Required For |
|------|-------------|--------------|
| Kasir | JWT Bearer Token | View dashboard, shift history |
| Superadmin | JWT Bearer Token + superadmin role | All endpoints including profit share calculation |

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 1.3 Business Rules

**Profit Share Formula:**
```
Gross Revenue = Total Penjualan (termasuk PPN)
PPN = Gross Revenue × 11%
Net Revenue = Gross Revenue - PPN

HPP = Total Biaya Pokok (from BOM)
Opex = Biaya Operasional
Depreciation = Total Depresiasi Aset

Net Profit = Net Revenue - HPP - Opex - Depreciation
Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%
Per Kasir = Kasir Pool × (Kasir Sales / Total Sales)
```

---

## 2. Dashboard

### 2.1 GET /api/v1/finance/dashboard

Get dashboard KPIs for the current user or outlet.

**Authentication:** Required (any authenticated user)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `outlet_id` | UUID | No | User's assigned outlet | Filter by outlet |
| `period` | string | No | today | Period filter (today, week, month) |

**Example Request:**
```http
GET /api/v1/finance/dashboard?period=month
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "today": {
      "revenue": 2500000,
      "order_count": 85,
      "avg_order_value": 29412,
      "cash_sales": 1500000,
      "qris_sales": 1000000
    },
    "this_week": {
      "revenue": 17500000,
      "order_count": 595,
      "avg_order_value": 29412
    },
    "this_month": {
      "revenue": 75000000,
      "order_count": 2550,
      "avg_order_value": 29412
    },
    "top_products": [
      {
        "product_id": "550e8400-e29b-41d4-a716-446655440001",
        "product_name": "Keripik Singkong Original",
        "quantity_sold": 150,
        "revenue": 2250000
      },
      {
        "product_id": "550e8400-e29b-41d4-a716-446655440002",
        "product_name": "Keripik Singkong Pedas",
        "quantity_sold": 120,
        "revenue": 2160000
      }
    ],
    "top_cashiers": [
      {
        "cashier_id": "110e8400-e29b-41d4-a716-446655440001",
        "cashier_name": "Kasir 1",
        "order_count": 45,
        "revenue": 1350000
      },
      {
        "cashier_id": "110e8400-e29b-41d4-a716-446655440002",
        "cashier_name": "Kasir 2",
        "order_count": 40,
        "revenue": 1150000
      }
    ],
    "low_stock_alert": 5,
    "pending_review_count": 2
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Dashboard data retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

## 3. Shift Management

### 3.1 GET /api/v1/finance/shifts

List shift history with filters.

**Authentication:** Required (any authenticated user)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `outlet_id` | UUID | No | - | Filter by outlet |
| `cashier_id` | UUID | No | - | Filter by cashier |
| `status` | string | No | - | Filter by status (open, closed) |
| `date_from` | ISO date | No | - | Start date (YYYY-MM-DD) |
| `date_to` | ISO date | No | - | End date (YYYY-MM-DD) |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 20 | Items per page (max: 100) |

**Example Request:**
```http
GET /api/v1/finance/shifts?outlet_id=660e8400-e29b-41d4-a716-446655440001&date_from=2026-06-01&date_to=2026-06-30
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "outlet": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Outlet Utama"
      },
      "cashier": {
        "id": "110e8400-e29b-41d4-a716-446655440001",
        "name": "Kasir 1"
      },
      "status": "closed",
      "opening_balance": 500000,
      "closing_balance": 750000,
      "total_sales": 250000,
      "total_cash": 200000,
      "total_qris": 50000,
      "order_count": 10,
      "void_count": 1,
      "void_amount": 30000,
      "started_at": "2026-06-25T07:00:00Z",
      "closed_at": "2026-06-25T14:00:00Z",
      "duration_minutes": 420
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440002",
      "outlet": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Outlet Utama"
      },
      "cashier": {
        "id": "110e8400-e29b-41d4-a716-446655440002",
        "name": "Kasir 2"
      },
      "status": "open",
      "opening_balance": 500000,
      "closing_balance": null,
      "total_sales": 125000,
      "total_cash": 100000,
      "total_qris": 25000,
      "order_count": 5,
      "void_count": 0,
      "void_amount": 0,
      "started_at": "2026-06-26T07:00:00Z",
      "closed_at": null,
      "duration_minutes": 210
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3,
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Shift history retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

### 3.2 POST /api/v1/finance/shifts/open

Open a new shift.

**Authentication:** Required (kasir role)

**Request Body:**
```json
{
  "outlet_id": "660e8400-e29b-41d4-a716-446655440001",
  "opening_balance": 500000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outlet_id` | UUID | Yes | Outlet UUID |
| `opening_balance` | number | Yes | Initial cash balance (IDR) |

**Validation:**
- User must have access to the outlet
- User must not have an open shift
- Opening balance must be non-negative

**Example Request:**
```http
POST /api/v1/finance/shifts/open
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "outlet_id": "660e8400-e29b-41d4-a716-446655440001",
  "opening_balance": 500000
}
```

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "outlet": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Outlet Utama"
    },
    "cashier": {
      "id": "110e8400-e29b-41d4-a716-446655440001",
      "name": "Kasir 1"
    },
    "status": "open",
    "opening_balance": 500000,
    "current_balance": 500000,
    "total_sales": 0,
    "order_count": 0,
    "started_at": "2026-06-26T07:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T07:00:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 201 | Shift opened successfully |
| 400 | Validation error (e.g., existing open shift) |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - insufficient permissions |
| 404 | Outlet not found |

---

### 3.3 POST /api/v1/finance/shifts/:id/close

Close an existing shift.

**Authentication:** Required (kasir role, must be the shift owner)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Shift UUID |

**Request Body:**
```json
{
  "closing_balance": 750000,
  "notes": "Shift berjalan lancar"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `closing_balance` | number | Yes | Final cash balance (IDR) |
| `notes` | string | No | Closing notes |

**Validation:**
- User must own the shift
- Closing balance must be non-negative
- System will calculate expected balance and alert if there's a discrepancy

**Example Request:**
```http
POST /api/v1/finance/shifts/880e8400-e29b-41d4-a716-446655440001/close
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "closing_balance": 750000,
  "notes": "Shift berjalan lancar"
}
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "outlet": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Outlet Utama"
    },
    "cashier": {
      "id": "110e8400-e29b-41d4-a716-446655440001",
      "name": "Kasir 1"
    },
    "status": "closed",
    "opening_balance": 500000,
    "closing_balance": 750000,
    "expected_balance": 750000,
    "balance_difference": 0,
    "total_sales": 250000,
    "total_cash": 200000,
    "total_qris": 50000,
    "order_count": 10,
    "void_count": 1,
    "void_amount": 30000,
    "notes": "Shift berjalan lancar",
    "started_at": "2026-06-25T07:00:00Z",
    "closed_at": "2026-06-25T14:00:00Z",
    "duration_minutes": 420
  },
  "meta": {
    "timestamp": "2026-06-25T14:00:00Z"
  }
}
```

**Response when there's a balance discrepancy:**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "status": "closed",
    "closing_balance": 740000,
    "expected_balance": 750000,
    "balance_difference": -10000,
    "discrepancy_alert": true,
    "requires_review": true
  },
  "meta": {
    "timestamp": "2026-06-25T14:00:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Shift closed successfully |
| 400 | Validation error |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - not the shift owner |
| 404 | Shift not found |

---

## 4. Profit Share

### 4.1 GET /api/v1/finance/profit-share

Get profit share report for a period.

**Authentication:** Required (superadmin only)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `period` | string | Yes | - | Period type (daily, weekly, monthly) |
| `date_from` | ISO date | Yes | - | Start date (YYYY-MM-DD) |
| `date_to` | ISO date | Yes | - | End date (YYYY-MM-DD) |
| `outlet_id` | UUID | No | - | Filter by outlet |

**Validation:**
- Period must be one of: daily, weekly, monthly
- Date range must not exceed 12 months
- For superadmin only

**Example Request:**
```http
GET /api/v1/finance/profit-share?period=monthly&date_from=2026-06-01&date_to=2026-06-30
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-06-01",
      "end": "2026-06-30",
      "type": "monthly"
    },
    "outlet": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Outlet Utama"
    },
    "revenue": {
      "gross_revenue": 100000000,
      "ppn_rate": 0.11,
      "ppn_amount": 11000000,
      "net_revenue": 89000000
    },
    "costs": {
      "hpp": 45000000,
      "opex": 15000000,
      "depreciation": 5000000,
      "total_costs": 65000000
    },
    "profit": {
      "net_profit": 24000000,
      "owner_share": 14400000,
      "kasir_pool": 9600000,
      "profit_margin": 0.24
    },
    "cashier_shares": [
      {
        "cashier_id": "110e8400-e29b-41d4-a716-446655440001",
        "cashier_name": "Kasir 1",
        "total_sales": 55000000,
        "sales_percentage": 0.6111,
        "share_amount": 5871111
      },
      {
        "cashier_id": "110e8400-e29b-41d4-a716-446655440002",
        "cashier_name": "Kasir 2",
        "total_sales": 35000000,
        "sales_percentage": 0.3889,
        "share_amount": 3728889
      }
    ],
    "breakdown": {
      "order_count": 3400,
      "avg_order_value": 29412,
      "void_count": 15,
      "void_amount": 450000,
      "refund_count": 5,
      "refund_amount": 150000
    },
    "generated_at": "2026-06-26T10:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Profit share report generated |
| 400 | Validation error (invalid date range) |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |

---

## 5. Operational Expenses

### 5.1 GET /api/v1/finance/expenses

List operational expenses with filters.

**Authentication:** Required (superadmin only)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `outlet_id` | UUID | No | - | Filter by outlet |
| `category` | string | No | - | Filter by expense category |
| `date_from` | ISO date | No | - | Start date |
| `date_to` | ISO date | No | - | End date |
| `min_amount` | number | No | - | Minimum amount filter |
| `max_amount` | number | No | - | Maximum amount filter |
| `search` | string | No | - | Search in description |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 50 | Items per page |

**Expense Categories:**

| Category | Description |
|----------|-------------|
| `electricity` | Electricity bills |
| `water` | Water bills |
| `gas` | Gas/fuel expenses |
| `supplies` | Office/supply expenses |
| `maintenance` | Equipment maintenance |
| `marketing` | Marketing/promotion expenses |
| `transport` | Transportation costs |
| `salary` | Salary/wages |
| `other` | Other expenses |

**Example Request:**
```http
GET /api/v1/finance/expenses?outlet_id=660e8400-e29b-41d4-a716-446655440001&category=electricity&date_from=2026-06-01
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440001",
      "outlet": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Outlet Utama"
      },
      "category": "electricity",
      "description": "Token listrik bulan Juni 2026",
      "amount": 1500000,
      "date": "2026-06-25",
      "created_by": {
        "id": "110e8400-e29b-41d4-a716-446655440001",
        "name": "Admin"
      },
      "receipt_url": "/uploads/receipts/expense-001.pdf",
      "created_at": "2026-06-25T09:00:00Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440002",
      "outlet": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Outlet Utama"
      },
      "category": "supplies",
      "description": "Kantong plastik dan packaging",
      "amount": 250000,
      "date": "2026-06-20",
      "created_by": {
        "id": "110e8400-e29b-41d4-a716-446655440001",
        "name": "Admin"
      },
      "receipt_url": null,
      "created_at": "2026-06-20T14:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "total_pages": 1,
    "summary": {
      "total_amount": 3250000,
      "by_category": {
        "electricity": 1500000,
        "supplies": 250000,
        "maintenance": 1000000,
        "other": 500000
      }
    },
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Expenses retrieved successfully |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |

---

### 5.2 POST /api/v1/finance/expenses

Create a new operational expense entry.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "outlet_id": "660e8400-e29b-41d4-a716-446655440001",
  "category": "electricity",
  "description": "Token listrik bulan Juni 2026",
  "amount": 1500000,
  "date": "2026-06-25"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `outlet_id` | UUID | Yes | Outlet UUID |
| `category` | string | Yes | Expense category |
| `description` | string | Yes | Expense description |
| `amount` | number | Yes | Amount in IDR (must be positive) |
| `date` | string | Yes | Date (YYYY-MM-DD) |

**Validation:**
- Amount must be positive (> 0)
- Category must be valid enum
- Date cannot be in the future
- Description max length: 500 characters
- Receipt upload optional (max 5MB, PDF/image)

**Example Request:**
```http
POST /api/v1/finance/expenses
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "outlet_id": "660e8400-e29b-41d4-a716-446655440001",
  "category": "electricity",
  "description": "Token listrik bulan Juni 2026",
  "amount": 1500000,
  "date": "2026-06-25"
}
```

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440003",
    "outlet": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Outlet Utama"
    },
    "category": "electricity",
    "description": "Token listrik bulan Juni 2026",
    "amount": 1500000,
    "date": "2026-06-25",
    "created_by": {
      "id": "110e8400-e29b-41d4-a716-446655440001",
      "name": "Admin"
    },
    "receipt_url": null,
    "created_at": "2026-06-26T10:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 201 | Expense created successfully |
| 400 | Validation error |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |
| 404 | Outlet not found |

---

## 6. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Wrong username/pin/password |
| `FORBIDDEN` | 403 | Insufficient permissions (requires superadmin) |
| `NOT_FOUND` | 404 | Resource not found |
| `SHIFT_ALREADY_OPEN` | 400 | User already has an open shift |
| `SHIFT_NOT_FOUND` | 404 | Shift not found |
| `INVALID_DATE_RANGE` | 400 | Date range is invalid or too large |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Validation Error Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "amount",
        "message": "amount must be a positive number"
      },
      {
        "field": "category",
        "message": "category must be one of: electricity, water, gas, supplies, maintenance, marketing, transport, salary, other"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

---

## 7. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-26 | Initial documentation |

---

*Generated from PRD v2 API Contract and implementation*
