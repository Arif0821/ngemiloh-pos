# Products API Documentation

**API Version:** v1  
**Base URL:** `/api/v1`  
**Authentication:** JWT Bearer Token

---

## Table of Contents

1. [Overview](#1-overview)
2. [Products Endpoints](#2-products-endpoints)
3. [Admin Product Endpoints](#3-admin-product-endpoints)
4. [Modifier Groups](#4-modifier-groups)
5. [Categories](#5-categories)
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
| Kasir | JWT Bearer Token | List products, view categories |
| Superadmin | JWT Bearer Token + superadmin role | All endpoints |

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

For multipart/form-data requests (image upload):
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

---

## 2. Products Endpoints

### 2.1 GET /api/v1/products

List all products with optional filtering.

**Authentication:** Required (any authenticated user)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `category_id` | UUID | No | - | Filter by category UUID |
| `include_modifiers` | boolean | No | false | Include modifier groups in response |

**Example Request:**
```http
GET /api/v1/products?category_id=550e8400-e29b-41d4-a716-446655440000&include_modifiers=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Keripik Singkong Original",
      "base_price": 15000,
      "cost_per_unit": 8500,
      "image_url": "/uploads/abc123.webp",
      "is_active": true,
      "is_out_of_stock": false,
      "sort_order": 1,
      "category": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Keripik"
      },
      "modifierGroups": [
        {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "name": "Level Pedas",
          "is_required": true,
          "max_selections": 1,
          "sort_order": 1,
          "options": [
            {
              "id": "770e8400-e29b-41d4-a716-446655440001",
              "name": "Normal",
              "additional_price": 0,
              "sort_order": 1
            },
            {
              "id": "770e8400-e29b-41d4-a716-446655440002",
              "name": "Pedas",
              "additional_price": 0,
              "sort_order": 2
            },
            {
              "id": "770e8400-e29b-41d4-a716-446655440003",
              "name": "Sangat Pedas",
              "additional_price": 1000,
              "sort_order": 3
            }
          ]
        }
      ],
      "created_at": "2026-06-01T08:00:00Z",
      "updated_at": "2026-06-15T14:30:00Z"
    }
  ],
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Products retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

### 2.2 GET /api/v1/products/:id

Get detailed information for a single product.

**Authentication:** Required (any authenticated user)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Product UUID |

**Example Request:**
```http
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Keripik Singkong Original",
    "base_price": 15000,
    "cost_per_unit": 8500,
    "image_url": "/uploads/abc123.webp",
    "is_active": true,
    "is_out_of_stock": false,
    "sort_order": 1,
    "category": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Keripik"
    },
    "modifierGroups": [...],
    "created_at": "2026-06-01T08:00:00Z",
    "updated_at": "2026-06-15T14:30:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Product retrieved successfully |
| 401 | Unauthorized - invalid or missing token |
| 404 | Product not found |

---

### 2.3 GET /api/v1/products/:id/stock

Get stock information for a product (requires BOM recipe).

> **Note:** This endpoint retrieves BOM-based stock availability. Stock is calculated from raw materials defined in Bill of Materials (BOM) recipes.

**Authentication:** Required (any authenticated user)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Product UUID |

**Example Request:**
```http
GET /api/v1/products/550e8400-e29b-41d4-a716-446655440001/stock
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "productId": "550e8400-e29b-41d4-a716-446655440001",
    "productName": "Keripik Singkong Original",
    "hppPerUnit": 8500,
    "bom": {
      "hasRecipe": true,
      "items": [
        {
          "materialId": "880e8400-e29b-41d4-a716-446655440001",
          "materialName": "Singkong",
          "unit": "kg",
          "quantityNeeded": 0.5,
          "currentStock": 100,
          "canProduce": 200,
          "costPerUnit": 5000,
          "itemCost": 2500
        },
        {
          "materialId": "880e8400-e29b-41d4-a716-446655440002",
          "materialName": "Minyak Goreng",
          "unit": "liter",
          "quantityNeeded": 0.1,
          "currentStock": 20,
          "canProduce": 200,
          "costPerUnit": 10000,
          "itemCost": 1000
        }
      ],
      "lowestStockMaterial": "Minyak Goreng"
    }
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Stock info retrieved successfully |
| 401 | Unauthorized - invalid or missing token |
| 404 | Product not found |

---

## 3. Admin Product Endpoints

> **Note:** All admin endpoints require `superadmin` role.

### 3.1 POST /api/v1/admin/products

Create a new product.

**Authentication:** Required (superadmin only)

**Request Content-Type:** `multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Product name (max 100 chars) |
| `category_id` | UUID | Yes | Category UUID |
| `base_price` | number | Yes | Product price in IDR |
| `image` | file | No | Product image (max 5MB, auto-converted to WebP) |
| `image_url` | string | No | External image URL (validated for security) |
| `is_active` | boolean | No | Product is active (default: true) |
| `is_out_of_stock` | boolean | No | Product is out of stock (default: false) |

**Image Upload Rules:**
- Max file size: 5MB (configurable via `MAX_FILE_SIZE_MB` env)
- Supported formats: JPEG, PNG, GIF, SVG
- Auto-converted to WebP format
- Resized to max 800px width
- External URLs must be HTTPS from approved CDNs

**Example Request:**
```http
POST /api/v1/admin/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data

-----------------------------1234567890
Content-Disposition: form-data; name="name"

Keripik Singkong Pedas
-----------------------------1234567890
Content-Disposition: form-data; name="category_id"

550e8400-e29b-41d4-a716-446655440000
-----------------------------1234567890
Content-Disposition: form-data; name="base_price"

18000
-----------------------------1234567890
Content-Disposition: form-data; name="is_active"

true
-----------------------------1234567890
Content-Disposition: form-data; name="image"; filename="keripik.jpg"
Content-Type: image/jpeg

<binary data>
-----------------------------1234567890--
```

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Keripik Singkong Pedas",
    "base_price": 18000,
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "image_url": "/uploads/def456.webp",
    "is_active": true,
    "is_out_of_stock": false,
    "sort_order": 2,
    "created_by": "110e8400-e29b-41d4-a716-446655440001",
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
| 201 | Product created successfully |
| 400 | Validation error |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |

---

### 3.2 PUT /api/v1/admin/products/:id

Update an existing product.

**Authentication:** Required (superadmin only)

**Request Content-Type:** `multipart/form-data` (or `application/json`)

**Form Fields (all optional):**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Product name (max 100 chars) |
| `category_id` | UUID | Category UUID |
| `base_price` | number | Product price in IDR |
| `image` | file | New product image |
| `image_url` | string | External image URL |
| `is_active` | boolean | Product is active |
| `is_out_of_stock` | boolean | Product is out of stock |

**Example Request (JSON):**
```http
PATCH /api/v1/admin/products/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "name": "Keripik Singkong Pedas Level 3",
  "base_price": 20000,
  "is_out_of_stock": false
}
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Keripik Singkong Pedas Level 3",
    "base_price": 20000,
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "image_url": "/uploads/abc123.webp",
    "is_active": true,
    "is_out_of_stock": false,
    "sort_order": 1,
    "updated_at": "2026-06-26T11:00:00Z"
  },
  "meta": {
    "timestamp": "2026-06-26T11:00:00Z"
  }
}
```

**Price Change Logging:**
When `base_price` changes, the system automatically logs the price update with:
- Previous price
- New price
- Admin who made the change
- Timestamp

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Product updated successfully |
| 400 | Validation error |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |
| 404 | Product not found |

---

### 3.3 DELETE /api/v1/admin/products/:id

Soft delete a product.

> **Behavior:** 
> - If product has associated order items → Soft delete (`is_active: false`)
> - If product has no order items → Hard delete from database

**Authentication:** Required (superadmin only)

**Example Request:**
```http
DELETE /api/v1/admin/products/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Keripik Singkong Original",
    "is_active": false,
    "message": "Product soft deleted"
  },
  "meta": {
    "timestamp": "2026-06-26T11:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Product deleted successfully |
| 401 | Unauthorized - invalid or missing token |
| 403 | Forbidden - requires superadmin role |
| 404 | Product not found |

---

## 4. Modifier Groups

Modifier groups define optional or required customizations for products.

### 4.1 POST /api/v1/admin/products/:id/modifier-groups

Create a modifier group for a product.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "name": "Level Pedas",
  "is_required": true,
  "max_selections": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Modifier group name (max 50 chars) |
| `is_required` | boolean | No | Customer must select (default: true) |
| `max_selections` | number | No | Max options selectable (default: 1) |

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "product_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Level Pedas",
    "is_required": true,
    "max_selections": 1,
    "sort_order": 1,
    "is_active": true
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

---

### 4.2 PATCH /api/v1/admin/modifier-groups/:id

Update a modifier group.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "name": "Level Pedas Updated",
  "is_required": false,
  "max_selections": 2
}
```

**Example Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Level Pedas Updated",
    "is_required": false,
    "max_selections": 2,
    "is_active": true
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

---

### 4.3 POST /api/v1/admin/modifier-groups/:id/options

Add an option to a modifier group.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "name": "Sangat Pedas",
  "additional_price": 1000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Option name (max 100 chars) |
| `additional_price` | number | Yes | Price adjustment in IDR |

**Example Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440001",
    "group_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Sangat Pedas",
    "additional_price": 1000,
    "sort_order": 3,
    "is_active": true
  },
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

---

### 4.4 PATCH /api/v1/admin/modifier-options/:id

Update a modifier option.

**Authentication:** Required (superadmin only)

**Request Body:**
```json
{
  "name": "Extra Pedas",
  "additional_price": 1500
}
```

---

## 5. Categories

### 5.1 GET /api/v1/categories

List all product categories.

> **Note:** Endpoint path is `/categories`, not `/products/categories`.

**Authentication:** Required (any authenticated user)

**Example Request:**
```http
GET /api/v1/categories
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Example Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Keripik",
      "sort_order": 1,
      "is_active": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Kue",
      "sort_order": 2,
      "is_active": true
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Minuman",
      "sort_order": 3,
      "is_active": true
    }
  ],
  "meta": {
    "timestamp": "2026-06-26T10:30:00Z"
  }
}
```

**Response Codes:**

| Code | Description |
|------|-------------|
| 200 | Categories retrieved successfully |
| 401 | Unauthorized - invalid or missing token |

---

## 6. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `INVALID_CREDENTIALS` | 401 | Wrong username/pin/password |
| `FORBIDDEN` | 403 | Insufficient permissions (requires superadmin) |
| `NOT_FOUND` | 404 | Resource not found |
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
        "field": "base_price",
        "message": "base_price must be a number"
      },
      {
        "field": "name",
        "message": "name should not be empty"
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
