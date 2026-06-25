# ADR-0004: Offline-First POS Architecture

## Status
Accepted

## Date
2024-02-01

## Last Updated
2026-06-25

## Context
The POS system must handle:
- Intermittent network connectivity in Indonesian stores
- Continuous operation during outages
- No data loss during offline periods
- Sync when connection is restored

## Decision
Implement offline-first architecture with IndexedDB (Dexie.js) and a sync queue.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│                    SvelteKit Frontend                  │
│  ┌──────────────────┐    ┌────────────────────────┐  │
│  │   POS Store      │    │   Member Store         │  │
│  │   (Runes $state)│    │   (Runes $state)      │  │
│  └────────┬─────────┘    └───────────┬────────────┘  │
│           │                            │               │
│           ▼                            ▼               │
│  ┌──────────────────────────────────────────────┐     │
│  │              Dexie.js (IndexedDB)            │     │
│  │  Tables: products, orders, cart, discounts,   │     │
│  │          receipts                            │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────┬───────────────────────────────┘
                       │
                       │  Sync Queue (when online)
                       ▼
┌──────────────────────────────────────────────────────┐
│                 NestJS Backend API                    │
│  POST /api/v1/pos/orders/sync                       │
│  Idempotent: server checks client_uuid deduplication  │
└──────────────────────────────────────────────────────┘
```

### Dexie.js Schema (Version 5)

| Table | Indexed On | Purpose |
|-------|-----------|---------|
| `products` | `id`, `category_id` | Product catalog cache |
| `orders` | `client_uuid`, `sync_status`, `created_at` | Local order queue |
| `cart` | `id` | Current transaction cart |
| `discounts` | `id`, `is_active` | Active discount cache |
| `receipts` | `id`, `order_data_client_uuid`, `print_status`, `created_at` | Offline receipts |

### Sync Strategy

1. **Write-local-first:** All mutations write to IndexedDB first
2. **Queue:** Set `sync_status = 'pending'` in orders table
3. **Sync trigger:** On reconnect (online event or periodic polling)
4. **Batch sync:** Max 200 orders per request
5. **Idempotency:** Each order has `client_uuid`; server uses `SELECT ... FOR UPDATE`
6. **Conflict resolution:** Server timestamp wins

### Offline Payment Constraints

| Payment | Online | Offline |
|---------|--------|---------|
| Cash | ✅ Full | ✅ Full (print receipt) |
| QRIS | ✅ Full | ❌ Disabled |
| Split | ✅ Full | ❌ Disabled |

### Offline Receipt

- Receipt HTML generated locally and stored in `receipts` table
- `print_status: 'pending' | 'printed' | 'failed'`
- Browser `window.print()` triggered automatically
- Receipt includes: order ID, items, total, cashier, shift, timestamp
- Client UUID printed as verification code for server-side lookup

### Limitations

- QRIS payments require online connectivity (QR code generation + Midtrans)
- Real-time stock checks use cached data (may be stale)
- Discount cache has 60-second TTL
- No member points sync while offline (queued for sync)

## Alternatives Considered

### Service Worker Cache
- Pros: Offline API responses, transparent to app
- Cons: Doesn't persist order data, no sync queue
- Decision: Dexie.js is purpose-built for offline data

### Cloud-First (No Offline)
- Pros: Simpler, always consistent
- Cons: POS stops working when network drops — unacceptable for POS
- Decision: **Rejected** — POS must never stop

## Consequences

- Kasir can continue selling during outages (cash only)
- No customer disputes due to missing receipts
- Sync is idempotent — safe to retry
- QRIS requires online — kasir must understand this limitation
- Dexie.js schema migrations needed when adding new tables
