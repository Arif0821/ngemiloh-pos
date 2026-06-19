# Midtrans Payment Testing Checklist

## Overview

This document provides manual testing procedures for verifying the Midtrans QRIS payment integration in POS Nabil.

## Configuration Verification

### Required Environment Variables

```bash
# Backend (.env)
MIDTRANS_ENV=sandbox                    # or 'production'
MIDTRANS_SERVER_KEY_SANDBOX=<key>       # Server-side only
MIDTRANS_CLIENT_KEY_SANDBOX=<key>       # Can be used in frontend
MIDTRANS_SERVER_KEY_PRODUCTION=<key>    # Production server key
MIDTRANS_CLIENT_KEY_PRODUCTION=<key>    # Production client key
QRIS_EXPIRY_SECONDS=900                # 15 minutes default
```

### Related Files

| File | Purpose |
|------|---------|
| `backend/src/payment/payment.module.ts` | Payment module with gateway DI |
| `backend/src/payment/midtrans-gateway.service.ts` | Midtrans Core API integration |
| `backend/src/payment/fake-gateway.service.ts` | Mock gateway for testing |
| `backend/src/payment/payment-gateway.interface.ts` | Gateway abstraction interface |
| `backend/src/orders/presentation/orders.controller.ts` | Webhook endpoint handler |

---

## Prerequisites

- [ ] Sandbox Midtrans account configured at https://dashboard.midtrans.com
- [ ] `MIDTRANS_ENV=sandbox` in environment
- [ ] Valid sandbox server key in `MIDTRANS_SERVER_KEY_SANDBOX`
- [ ] Application running: `docker compose up -d`
- [ ] Ngrok or public webhook URL for local testing (optional)

---

## Test Scenarios

### T1: Create QRIS Order

**Steps:**
1. Navigate to POS interface (http://localhost:5173)
2. Login as kasir with PIN
3. Add items to cart
4. Select payment method: QRIS
5. Click "Bayar" (Pay)

**Expected Results:**
- Payment modal opens with QR code displayed
- Network tab shows POST to `/api/v1/orders`
- Order created with status: `pending`, payment_status: `unpaid`
- Response includes `payment_gateway_ref` (transaction_id)
- Response includes `payment_raw_response` (QR string/URL)

**Verification Commands:**
```bash
# Check order was created
curl -X GET http://localhost:3000/api/v1/orders/{order_id} \
  -H "Authorization: Bearer {kasir_token}" | jq

# Expected response:
# {
#   "status": "pending",
#   "payment_status": "unpaid",
#   "payment_method": "qris",
#   "payment_gateway_ref": "txn-xxx-xxx"
# }
```

---

### T2: Payment Callback (Sandbox Simulation)

**Steps:**
1. Complete T1 to create a pending order
2. Open Midtrans Dashboard (sandbox): https://dashboard.sandbox.midtrans.com
3. Navigate to Transaction > Transaction List
4. Find the order by order_id
5. Click "Process" to simulate successful payment

**Expected Results:**
- Midtrans sends webhook to `/api/v1/orders/webhooks/midtrans`
- Order status updates to `completed`
- Order payment_status updates to `paid`
- `payment_settled_at` timestamp is set

**Verification Commands:**
```bash
# Check order status after webhook
curl -X GET http://localhost:3000/api/v1/orders/{order_id} \
  -H "Authorization: Bearer {admin_token}" | jq '.status, .payment_status, .payment_settled_at'

# Expected:
# "completed"
# "paid"
# "2026-06-19T12:00:00.000Z"
```

---

### T3: Payment Cancellation

**Steps:**
1. Create order (T1)
2. In Midtrans Dashboard, click "Cancel" on the transaction
3. Verify: Order status updates to `completed`, payment_status = `failed`

**Expected Results:**
- Webhook received with `transaction_status: "cancel"`
- Order payment_status = `failed`
- Order remains in `completed` status (cannot undo completed order)

**Verification:**
```bash
curl -X GET http://localhost:3000/api/v1/orders/{order_id} \
  -H "Authorization: Bearer {admin_token}" | jq '.status, .payment_status'
# "completed"
# "failed"
```

---

### T4: Payment Expiry

**Steps:**
1. Create order (T1)
2. Wait for QRIS_EXPIRY_SECONDS (default: 900s = 15 minutes)
3. OR: In Midtrans Dashboard, click "Expire"

**Expected Results:**
- Webhook received with `transaction_status: "expire"`
- Order payment_status = `expire`

---

### T5: Refund Flow

**Prerequisites:** Order must be in `completed` status with `payment_status: paid`

**Steps:**
1. Create and complete payment (T1-T2)
2. Login as admin
3. Navigate to Orders > find the order
4. Click "Refund" button
5. Confirm refund
6. In Midtrans Dashboard, approve the refund

**Expected Results:**
- Order payment_status = `refunded`
- `refunded_at` timestamp is set

**Verification:**
```bash
curl -X GET http://localhost:3000/api/v1/orders/{order_id} \
  -H "Authorization: Bearer {admin_token}" | jq '.payment_status, .refunded_at'
# "refunded"
# "2026-06-19T12:30:00.000Z"
```

---

### T6: Split Payment

**Steps:**
1. Navigate to POS interface
2. Add items with total > Rp 10,000
3. Select payment method: Split
4. Enter cash amount (minimum: Rp 1,000 for QRIS portion)
5. Complete order

**Expected Results:**
- Two payment records: cash portion + QRIS portion
- QRIS portion follows same flow as T1-T2
- Cash portion marked as paid immediately

---

## Manual Testing Instructions

### Step 1: Start the Application

```bash
# Start all services
docker compose up -d

# Verify services are running
docker compose ps
```

### Step 2: Login as Kasir

1. Open http://localhost:5173
2. Enter kasir PIN (default: check seeded data)
3. Verify redirect to POS interface

### Step 3: Create Test Order with QRIS

1. Click on products to add to cart
2. Verify cart total is calculated correctly
3. Select "QRIS" as payment method
4. Click "Bayar" button
5. Verify QR code modal appears
6. Note the order_id from the response

### Step 4: Simulate Payment in Sandbox

1. Open https://dashboard.sandbox.midtrans.com
2. Go to Transaction > Transaction List
3. Search for your order_id
4. Click on the transaction row
5. Click "Process" button
6. Verify the status changes to "Settlement"

### Step 5: Verify Status Update

1. Refresh the POS interface
2. Verify order status shows "Lunas" (paid)
3. Or check via API:
   ```bash
   curl http://localhost:3000/api/v1/orders/{order_id} \
     -H "Authorization: Bearer {token}"
   ```

---

## API Endpoint Reference

### Create Order with QRIS

```http
POST /api/v1/orders
Authorization: Bearer {kasir_token}
Content-Type: application/json

{
  "items": [
    { "product_id": "uuid", "quantity": 2 }
  ],
  "payment_method": "qris"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "order_number": "ORD-20260619-001",
    "status": "pending",
    "payment_status": "unpaid",
    "payment_method": "qris",
    "payment_gateway_ref": "txn-xxx",
    "payment_raw_response": "https://api.midtrans.com/..."
  }
}
```

### Midtrans Webhook

```http
POST /api/v1/orders/webhooks/midtrans
Content-Type: application/json

{
  "order_id": "ORD-20260619-001",
  "transaction_status": "settlement",
  "status_code": "200",
  "gross_amount": "50000",
  "signature_key": "sha512_hash..."
}
```

### Transaction Status Mapping

| Midtrans Status | Order payment_status | Action |
|-----------------|---------------------|--------|
| `settlement` | `paid` | Payment successful |
| `cancel` | `failed` | Payment cancelled |
| `expire` | `expire` | QR code expired |
| `deny` | `failed` | Payment denied |
| `pending` | `unpaid` | Awaiting payment |

---

## Expected Results Summary

| Test | HTTP Status | Order Status | Payment Status | Notes |
|------|-------------|--------------|----------------|-------|
| T1 Create | 201 | pending | unpaid | QR code generated |
| T2 Paid | 200 | completed | paid | Webhook processed |
| T3 Cancelled | 200 | completed | failed | Webhook processed |
| T4 Expired | 200 | completed | expire | Webhook processed |
| T5 Refunded | 200 | completed | refunded | Admin action + webhook |
| T6 Split | 201 | pending | partial | Cash + QRIS split |

---

## Troubleshooting

### QR Code Not Showing

1. Check browser console for JavaScript errors
2. Verify `payment_raw_response` contains valid URL in order response
3. Check network tab for POST to `/api/v1/orders`
4. Verify MIDTRANS_SERVER_KEY_SANDBOX is correct

### Webhook Not Received

1. Check server logs for webhook endpoint hits:
   ```bash
   docker compose logs nestjs-api | grep webhook
   ```

2. Verify webhook URL is publicly accessible:
   - Local testing: Use ngrok to expose local server
   - Check URL in Midtrans Dashboard > Settings > Webhook

3. Check Midtrans Dashboard for webhook history:
   - Go to Settings > Webhook History
   - Verify webhook was sent and check response

### Signature Verification Failed

1. Verify `signature_key` is present in webhook payload
2. Check server key matches Midtrans Dashboard
3. Check logs for "Invalid webhook signature" errors

### IP Blocking

1. Webhook is blocked in non-dev/test environments
2. Configure `MIDTRANS_ALLOWED_IPS` for production
3. Default IPs: 13.229.87.0/24, 54.255.192.0/24, 103.211.86.0/24

---

## Testing with Fake Gateway

For development without Midtrans keys:

```bash
# Enable fake gateway
FAKE_MIDTRANS=true docker compose up -d
```

The fake gateway generates mock QR codes and always accepts webhooks.

---

## Related Documentation

- [Backend Audit Report](./audit-report-2026-06-18.md)
- [Secrets Management](./SECRETS_MANAGEMENT.md)
- [Midtrans Documentation](https://docs.midtrans.com/)
