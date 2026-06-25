# Inventory API Documentation

**API Version:** v1  
**Base URL:** `/api/v1`  
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Overview](#1-overview)
2. [Raw Materials](#2-raw-materials)
3. [Stock Management](#3-stock-management)
4. [BOM Recipes](#4-bom-recipes)
5. [Stock Movements](#5-stock-movements)
6. [Admin Stock View](#6-admin-stock-view)
7. [Error Codes](#7-error-codes)
8. [Version History](#8-version-history)

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
| Kasir | JWT Bearer Token | View stock, raw materials |
| Superadmin | JWT Bearer Token + superadmin role | All endpoints including adjustments |

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 2. Raw Materials

### 2.1 GET /api/v1/inventory/raw-materials

List all raw materials with optional filtering.

**Authentication:** Required (any authenticated user)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `low_stock` | boolean | No | false | Show only materials below threshold |
| `category` | string | No | - | Filter by material category |
| `search` | string | No | - | Search by name |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 50 | Items per page (max: 100) |

**Example Request:**
```http
GET /api/v1/inventory/raw-materials?low_stock=true&page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Singkong",
      "category": "Bahan Utama",
      "unit": "kg",
      "current_stock": 15,
      "low_stock_threshold": 20,
      "cost_per_unit": 5000,
      "total_value": 75000,
      "is_low_stock": true,
      "last_restocked_at": "2026-06-20T08:00:00Z",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-06-25T14:30:00Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Minyak Goreng",
      "category": "Bahan Utama",
      "unit": "liter",
      "current_stock": 25,
      "low_stock_threshold": 10,
      "cost_per_unit": 18000,
      "total_value": 450000,
      "is_low_stock": false,
      "last_restocked_at": "2026-06-22T10:00:00Z",
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-06-25T14:30:00Z"
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
| 200 | Raw materials retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

## 3. Stock Management

### 3.1 GET /api/v1/inventory/stock

Get current stock levels for all raw materials.

**Authentication:** Required (any authenticated user)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category` | string | No | - | Filter by material category |
| `low_stock_only` | boolean | No | false | Show only items below threshold |
| `sort_by` | string | No | name | Sort field (name, stock, value) |
| `sort_order` | string | No | asc | Sort order (asc, desc) |

**Example Request:**
```http
GET /api/v1/inventory/stock?low_stock_only=true&sort_by=current_stock&sort_order=asc
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_materials": 45,
      "total_value": 15000000,
      "low_stock_count": 5,
      "out_of_stock_count": 0
    },
    "items": [
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440001",
        "material_name": "Singkong",
        "category": "Bahan Utama",
        "unit": "kg",
        "current_stock": 15,
        "low_stock_threshold": 20,
        "cost_per_unit": 5000,
        "total_value": 75000,
        "status": "low",
        "suggested_restock": 50
      },
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440002",
        "material_name": "Minyak Goreng",
        "category": "Bahan Utama",
        "unit": "liter",
        "current_stock": 25,
        "low_stock_threshold": 10,
        "cost_per_unit": 18000,
        "total_value": 450000,
        "status": "ok",
        "suggested_restock": 0
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Stock Status Values:**

| Status | Description |
|--------|-------------|
| `ok` | Stock above threshold |
| `low` | Stock below threshold |
| `critical` | Stock below 50% of threshold |
| `out` | Stock is zero |

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Stock levels retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

## 4. BOM Recipes

### 4.1 POST /api/v1/inventory/bom

Create or update BOM (Bill of Materials) recipe for a product.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    {
      "material_id": "550e8400-e29b-41d4-a716-446655440001",
      "quantity": 0.5
    },
    {
      "material_id": "550e8400-e29b-41d4-a716-446655440002",
      "quantity": 0.1
    },
    {
      "material_id": "550e8400-e29b-41d4-a716-446655440003",
      "quantity": 0.02
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | UUID | Yes | Product UUID |
| `items` | array | Yes | Array of BOM items |
| `items[].material_id` | UUID | Yes | Raw material UUID |
| `items[].quantity` | number | Yes | Quantity needed per unit (decimal) |

**Validation:**
- Product ID must exist
- All material IDs must exist
- Quantity must be greater than 0
- If BOM exists for product, it will be replaced

**Example Request:**
```http
POST /api/v1/inventory/bom
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "items": [
    { "material_id": "550e8400-e29b-41d4-a716-446655440001", "quantity": 0.5 },
    { "material_id": "550e8400-e29b-41d4-a716-446655440002", "quantity": 0.1 }
  ]
}
```

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "product_name": "Keripik Singkong Original",
    "hpp_per_unit": 8500,
    "items": [
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440001",
        "material_name": "Singkong",
        "quantity": 0.5,
        "cost_per_unit": 5000,
        "item_cost": 2500
      },
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440002",
        "material_name": "Minyak Goreng",
        "quantity": 0.1,
        "cost_per_unit": 18000,
        "item_cost": 1800
      },
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440003",
        "material_name": "Bumbu Racikan",
        "quantity": 0.02,
        "cost_per_unit": 120000,
        "item_cost": 2400
      }
    ],
    "created_at": "2026-06-26T10:30:00Z",
    "updated_at": "2026-06-26T10:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 201 | BOM created successfully |
| 400 | Validation error |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |
| 404 | Product not found |

---

### 4.2 GET /api/v1/inventory/bom/:productId

Get HPP (Harga Pokok Penjualan) for a product based on BOM recipe.

**Authentication:** Required (any authenticated user)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `productId` | UUID | Yes | Product UUID |

**Example Request:**
```http
GET /api/v1/inventory/bom/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "product_name": "Keripik Singkong Original",
    "has_bom": true,
    "hpp_per_unit": 8500,
    "items": [
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440001",
        "material_name": "Singkong",
        "unit": "kg",
        "quantity": 0.5,
        "cost_per_unit": 5000,
        "item_cost": 2500,
        "current_stock": 100,
        "can_produce": 200
      },
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440002",
        "material_name": "Minyak Goreng",
        "unit": "liter",
        "quantity": 0.1,
        "cost_per_unit": 18000,
        "item_cost": 1800,
        "current_stock": 20,
        "can_produce": 200
      },
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440003",
        "material_name": "Bumbu Racikan",
        "unit": "kg",
        "quantity": 0.02,
        "cost_per_unit": 120000,
        "item_cost": 2400,
        "current_stock": 5,
        "can_produce": 250
      }
    ],
    "production_capacity": 200,
    "limiting_material": null,
    "margin": {
      "selling_price": 15000,
      "hpp": 8500,
      "gross_profit": 6500,
      "margin_percentage": 43.33
    }
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response when product has no BOM:**
```json
{
  "success": true,
  "data": {
    "product_id": "550e8400-e29b-41d4-a716-446655440999",
    "product_name": "Kue Cubit",
    "has_bom": false,
    "hpp_per_unit": null,
    "items": [],
    "message": "No BOM recipe defined for this product"
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | BOM retrieved successfully |
| 401 | Unauthorized - invalid or missing token |
| 404 | Product not found |

---

## 5. Stock Movements

### 5.1 POST /api/v1/inventory/movements

Record stock movements (adjustments, restocks, waste).

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "material_id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "restock",
  "quantity": 100,
  "reference": "PO-2026-0625-001",
  "notes": "Restock dari supplier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `material_id` | UUID | Yes | Raw material UUID |
| `type` | enum | Yes | Movement type |
| `quantity` | number | Yes | Quantity (positive for additions, negative for deductions) |
| `reference` | string | No | Reference number (e.g., PO number) |
| `notes` | string | No | Additional notes |

**Movement Types:**

| Type | Description |
|------|-------------|
| `restock` | Stock received from supplier |
| `adjustment` | Manual stock adjustment |
| `waste` | Stock written off as waste |
| `production` | Stock used in production |
| `return` | Stock returned from production/sale |

**Validation:**
- Quantity must not be 0
- For `adjustment`, `waste`, `production`: resulting stock must not be negative
- `reference` max length: 100 characters
- `notes` max length: 500 characters

**Example Request:**
```http
POST /api/v1/inventory/movements
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "material_id": "550e8400-e29b-41d4-a716-446655440001",
  "type": "restock",
  "quantity": 100,
  "reference": "PO-2026-0625-001",
  "notes": "Restock dari supplier"
}
```

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440001",
    "material_id": "550e8400-e29b-41d4-a716-446655440001",
    "material_name": "Singkong",
    "type": "restock",
    "quantity": 100,
    "previous_stock": 15,
    "new_stock": 115,
    "reference": "PO-2026-0625-001",
    "notes": "Restock dari supplier",
    "created_by": "110e8400-e29b-41d4-a716-446655440001",
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
| 201 | Stock movement recorded successfully |
| 400 | Validation error (e.g., resulting stock negative) |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |
| 404 | Material not found |

---

## 6. Admin Stock View

### 6.1 GET /api/v1/admin/inventory/stock

Admin view for stock management with extended functionality.

**Authentication:** Required (superadmin only)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `outlet_id` | UUID | No | - | Filter by outlet |
| `category` | string | No | - | Filter by material category |
| `low_stock_only` | boolean | No | false | Show only items below threshold |
| `out_of_stock_only` | boolean | No | false | Show only out of stock items |
| `search` | string | No | - | Search by material name |
| `sort_by` | string | No | name | Sort field |
| `sort_order` | string | No | asc | Sort order |
| `page` | number | No | 1 | Page number |
| `limit` | number | No | 50 | Items per page |

**Example Request:**
```http
GET /api/v1/admin/inventory/stock?low_stock_only=true&outlet_id=660e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_materials": 45,
      "total_value": 15000000,
      "low_stock_count": 5,
      "out_of_stock_count": 0,
      "total_movements_today": 12
    },
    "items": [
      {
        "material_id": "550e8400-e29b-41d4-a716-446655440001",
        "material_name": "Singkong",
        "category": "Bahan Utama",
        "unit": "kg",
        "current_stock": 15,
        "low_stock_threshold": 20,
        "cost_per_unit": 5000,
        "total_value": 75000,
        "status": "low",
        "last_movement": {
          "type": "production",
          "quantity": -5,
          "created_at": "2026-06-26T08:00:00Z"
        },
        "outlets": [
          {
            "outlet_id": "660e8400-e29b-41d4-a716-446655440001",
            "outlet_name": "Outlet Utama",
            "stock": 15
          }
        ]
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 45,
    "total_pages": 1,
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Stock retrieved successfully |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |

---

## 7. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Wrong username/pin/password |
| `FORBIDDEN` | 403 | Insufficient permissions (requires superadmin) |
| `NOT_FOUND` | 404 | Resource not found |
| `STOCK_NEGATIVE` | 400 | Operation would result in negative stock |
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
        "field": "quantity",
        "message": "quantity must be a positive number"
      },
      {
        "field": "material_id",
        "message": "material_id must be a valid UUID"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

---

## 8. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-26 | Initial documentation |

---

*Generated from PRD v2 API Contract and implementation*
