# Orders API

## POST /api/v1/orders

Create a new order.

### Request
```json
{
  "client_uuid": "uuid-v4",
  "payment_method": "cash",
  "client_final_price": 50000,
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2,
      "modifiers": [{ "option_id": "uuid" }]
    }
  ]
}
```

### Response (201)
```json
{
  "success": true,
  "data": {
    "id": "order-uuid",
    "client_uuid": "uuid-v4",
    "total_amount": 50000,
    "status": "completed",
    "payment_status": "paid"
  }
}
```

---

## GET /api/v1/orders

Get order history for current user.

### Query Parameters
- `page` (optional): Page number, default 1

### Response (200)
```json
{
  "success": true,
  "data": [...]
}
```

---

## POST /api/v1/orders/sync-batch

Sync multiple orders from offline queue.

### Request
```json
{
  "orders": [
    { ... },
    { ... }
  ]
}
```

### Response (200)
```json
{
  "success": true,
  "data": [
    { "client_uuid": "...", "status": "success", "server_id": "..." },
    { "client_uuid": "...", "status": "error", "message": "..." }
  ]
}
```