# 10. Testing Strategy

*[← 09-security.md](./09-security.md) | [→ 11-deployment.md](./11-deployment.md)*

---

## 15.1 Stack & Target Coverage

| Layer | Tool | Target Fase 1A | Target Fase 1B+ |
|-------|------|---------------|-----------------|
| Unit test (backend) | Jest (NestJS default) | ≥70% global, ≥85% modul kritis | ≥80% global, ≥95% modul kritis |
| Integration test (backend) | Supertest + Jest | Semua controller punya ≥1 happy path + 1 error path | — |
| Unit test (frontend) | Vitest (SvelteKit) | Komponen kritis: checkout, keranjang, offline badge | — |
| E2E test | Playwright | Fase 1B+ (post-stabilisasi) | Happy path kasir + SA |
| Load test | k6 | Fase 1A sebelum go-live | Setiap release besar |
| **Mutation test** | **Stryker** `[v4.1 — baru]` | **Modul `discounts/pricing.service.ts`** saja | Perluas ke `orders/payment.service.ts` |

**Modul kritis (coverage ≥85% Fase 1A, ≥95% Fase 1B+):**
`auth/`, `shift/`, `orders/` (logika pembayaran), `discounts/` (kalkulasi harga)

**Alasan modul kritis diprioritaskan:** TC-01 mencatat bug nyata di v3.0 (final_price salah Rp 11.600 alih-alih Rp 12.100 karena urutan kalkulasi diskon+modifier). Modul *uang* punya riwayat bug yang berimplikasi langsung ke kepercayaan kasir dan owner.

---

## 15.2 Mutation Testing — Pricing Module `[v4.1 — baru]`

```bash
# Jalankan Stryker hanya untuk folder discounts/ (tidak memperlambat CI secara keseluruhan)
npx stryker run --files src/discounts/**/*.ts

# stryker.config.json
{
  "mutate": ["src/discounts/**/*.ts", "src/orders/pricing.util.ts"],
  "testRunner": "jest",
  "reporters": ["progress", "html"],
  "thresholds": { "high": 70, "low": 60, "break": 50 }
}
```

Target mutation score: **≥70%** untuk modul pricing/diskon.

**Kenapa mutation testing di sini:** Fungsi kalkulasi `final_price` mudah punya *off-by-one* atau *wrong-operator* mutation yang lolos unit test biasa (mis. test hanya cek "hasilnya positif", tidak cek nilai eksak).

---

## 15.3 Test Cases Fungsional

### TC-01: Kalkulasi Harga — Diskon + Modifier `[fix v3.0 bug]`

```
Produk: Macaroni Mateng
base_price = Rp 9.000
Diskon aktif: 10% dari base_price
Modifier: Bumbu Keju (Rp 1.500) + Saus BBQ (Rp 2.500)
Qty: 2

Kalkulasi yang BENAR (v4.1):
  discount_amount     = 9.000 × 10% = Rp 900
  discounted_base     = 9.000 - 900 = Rp 8.100
  modifier_total      = 1.500 + 2.500 = Rp 4.000
  final_price         = 8.100 + 4.000 = Rp 12.100  ← BENAR
  subtotal            = 12.100 × 2 = Rp 24.200

Bug v3.0 (sudah diperbaiki):
  final_price = 12.100 - 900 = Rp 11.600  ← SALAH (diskon dipotong dua kali)

Verifikasi DB:
  order_items.discount_amount   = 900
  order_items.discounted_base   = 8100
  order_items.modifier_total    = 4000
  order_items.final_price       = 12100  ✅
  order_items.subtotal          = 24200  ✅
```

### TC-02: Diskon — Dua Diskon Aktif, Ambil Terbesar

```
Produk: Basreng
Diskon A: 10% dari base_price Rp 7.000 → Rp 700
Diskon B (scope=product): fixed Rp 1.000

Verifikasi:
  Sistem pilih Diskon B (Rp 1.000 > Rp 700)
  order_items.discount_id   = uuid-diskon-B
  order_items.discount_amount = 1000
  order_items.discounted_base = 6000
```

### TC-03: Diskon — max_discount Cap `[v4.1 — CR-008]`

```
Produk: Mie Kremes Pedas
base_price = Rp 12.000
Diskon: 20%, max_discount = Rp 2.000

Kalkulasi:
  raw = 12.000 × 20% = Rp 2.400
  capped = MIN(2.400, 2.000) = Rp 2.000 ← cap berlaku

Verifikasi:
  order_items.discount_amount = 2000  (bukan 2400)  ✅
```

### TC-04: Split Payment Full Flow

```
Total Rp 27.900. Tunai Rp 15.000. QRIS Rp 12.900.

1. POST /orders → order_status='completed', payment_status='pending'
2. POST /orders/:id/pay/split { "cash_portion": 15000, "cash_received": 15000 }
3. Sistem: qris_amount = 27.900 - 15.000 = 12.900
4. Generate QR untuk Rp 12.900
5. Webhook Midtrans (signature valid) → payment_status='settled'

Verifikasi DB:
  orders.payment_method  = 'split'
  orders.cash_amount     = 15000
  orders.qris_amount     = 12900
  orders.cash_received   = 15000
  orders.cash_change     = 0
  orders.payment_status  = 'settled'
  cash_amount + qris_amount = total_amount ✅
```

### TC-05: Flexible Payment — Order Tanpa Metode Bayar

```
1. POST /orders {items: [...], client_uuid: "..."} — tanpa payment_method
2. Response: order_status='completed', payment_status='pending'
3. Nanti: POST /orders/:id/pay/cash { "cash_received": 30000 }

Verifikasi:
  - Step 2: payment_method IS NULL, cash_amount=0 ✅
  - Step 3: payment_status='settled', cash_change=calculated ✅
```

### TC-06: Offline Sync — 5 Transaksi Tanpa Duplikat

```
1. Simulasikan offline (DevTools → Offline)
2. Buat 5 transaksi tunai di POS
3. Setiap order masuk IndexedDB dengan client_uuid unik
4. Kembali online
5. POST /orders/sync-batch (5 order)
6. Retry sync ke-2 (simulasi network hiccup)

Verifikasi:
  - 5 baris di DB (bukan 10) — client_uuid UNIQUE ✅
  - synced_from_offline = true untuk semua
  - synced_at IS NOT NULL untuk semua
  - IndexedDB cleared setelah sync berhasil ✅
```

### TC-07: QRIS Offline — UX Non-Breaking

```
Saat koneksi offline:
  - Tombol QRIS disabled / greyed out ✅
  - Tooltip: "QRIS tidak tersedia saat offline. Gunakan tunai." ✅
  - Tidak ada HTTP request ke /payment/qris/create ✅
  - Tidak ada error dialog confusing ✅
```

### TC-08: Webhook Fraud — Signature Salah

```
POST /payment/webhook/midtrans dengan signature yang dimodifikasi:

Expected:
  - Return HTTP 200 (SELALU — jangan 4xx/5xx)
  - DB tidak berubah (order tidak ter-settle)
  - system_logs: type='security_alert', severity='warning' ✅
  - audit_logs: WEBHOOK_FRAUD_ATTEMPT ✅
```

### TC-09: Double Submit Prevention (Double-Tap)

```
Kasir tap "BAYAR TUNAI" 2× sangat cepat (<100ms):

Expected:
  - Hanya 1 pembayaran ter-record di DB
  - Request ke-2 mendapat 409 ORDER_ALREADY_PAID (bukan error 500)
  - UI: tombol disabled setelah tap pertama (loading state) ✅
  - Server: SELECT FOR UPDATE mencegah race condition ✅
```

### TC-10: Void Idempotency — Double Void `[v4.1 — baru, idempotency lock]`

```
SA void order yang sama 2× (mis. double-click):

Expected:
  - Void pertama: 200 OK, order_status='voided' ✅
  - Void kedua: 409 ORDER_ALREADY_VOIDED (bukan 500) ✅
  - audit_logs: hanya 1 entry ORDER_VOIDED (bukan 2) ✅
```

### TC-11: Harga Historis — Tidak Berubah Retroaktif

```
1. Transaksi #1 saat Macaroni Rp 9.000
2. SA ubah harga jadi Rp 10.000
3. Export CSV

Expected:
  - Transaksi #1: base_price=9000 (dari snapshot) ✅
  - Transaksi baru: base_price=10000 ✅
  - audit_logs: PRODUCT_PRICE_CHANGED (old=9000, new=10000) ✅
```

### TC-12: RBAC — Kasir Akses Admin Endpoint

```
Session kasir coba akses:
  GET  /admin/transactions      → 403 FORBIDDEN ✅
  POST /admin/orders/:id/void   → 403 FORBIDDEN ✅
  POST /admin/products          → 403 FORBIDDEN ✅
```

### TC-13: Modifier Required — Blokir Keranjang

```
Tap produk dengan modifier group is_required=true, tapi tidak pilih:
  - Frontend: tombol "Tambah ke Keranjang" disabled ✅
  - Backend: POST /orders dengan modifier_option_ids kosong → 422 MODIFIER_REQUIRED ✅
```

### TC-14: Session Kasir — Tidak Expire

```
1. Login kasir
2. Tunggu 48 jam tanpa aksi
3. GET /auth/me

Expected:
  - 200 OK, session masih valid ✅
  - Redis: TTL key = -1 (no expiry) ✅
```

### TC-15: Session Superadmin — Expire 24 Jam

```
1. Login SA
2. Tunggu 24 jam + 1 menit
3. GET /auth/me

Expected:
  - 401 Unauthorized ✅
  - Frontend redirect ke /login ✅
  - Redis: key sudah tidak ada (auto-expired) ✅
```

### TC-16: Format Nomor Transaksi `[v4.1 — CR-002]`

```
Kasir dengan cashier_letter='A', buat 3 transaksi pada 15 Juni 2026:

Expected:
  - Transaksi 1: TRX-20260615-A001 ✅
  - Transaksi 2: TRX-20260615-A002 ✅
  - Transaksi 3: TRX-20260615-A003 ✅
  - Hari berikutnya (16 Jun): TRX-20260616-A001 (reset) ✅
  - Kasir B bersamaan: TRX-20260615-B001 (namespace berbeda) ✅
```

### TC-17: Produk Di-archive Saat Order Masih pending_sync `[v4.1 — baru]`

```
Skenario: Kasir offline, buat order untuk "Basreng". SA archive Basreng. Kasir online lagi.

Expected:
  - POST /orders/sync-batch → 200 OK, status='synced' ✅
  - DB: order_items.product_id masih valid (RESTRICT, tidak dihapus)
  - DB: product_name_snapshot = "Basreng" (snapshot waktu order dibuat) ✅
  - Produk is_active=false tidak mempengaruhi penerimaan sync ✅

Alasan: snapshot data sudah disimpan saat order dibuat di client.
        Validasi sync hanya cek "produk exists", bukan "produk aktif".
```

### TC-18: Double-Payment Race Condition `[v4.1 — baru]`

```
Skenario: 2 request POST /orders/:id/pay/cash hampir bersamaan (simulasi dengan 2 curl parallel):

Request A: cash_received=30000
Request B: cash_received=30000 (ms setelahnya)

Expected:
  - Request A: 200 OK, payment_status='settled' ✅
  - Request B: 409 ORDER_ALREADY_PAID ✅
  - DB: payment_status='settled' hanya 1× (tidak terjadi double-settle) ✅
  - Tidak ada double-entry di kas shift ✅
```

### TC-19: sync-batch Partial Failure `[v4.1 — baru]`

```
Batch 5 order: 4 valid, 1 dengan client_created_at di luar rentang shift.

Expected response:
  {
    "synced_count": 4,
    "failed_count": 1,
    "results": [
      { "client_uuid": "uuid-1", "status": "synced" },
      { "client_uuid": "uuid-2", "status": "synced" },
      { "client_uuid": "uuid-3", "status": "synced" },
      { "client_uuid": "uuid-4", "status": "synced" },
      {
        "client_uuid": "uuid-5",
        "status": "failed",
        "error": "SYNC_TIMESTAMP_INVALID",
        "detail": "client_created_at di luar rentang shift aktif"
      }
    ]
  }

Verifikasi DB:
  - 4 order di DB (yang valid) ✅
  - 1 order tidak ada di DB ✅
  - IndexedDB client: uuid-5 tetap pending_sync dengan error detail ✅
```

### TC-20: Circuit Breaker Midtrans `[v4.1 — baru]`

```
Simulasikan 3 kegagalan QRIS berturut dalam 5 menit:
1. Mock Midtrans API return error 503 tiga kali
2. Cek circuit breaker state di Redis: midtrans:degraded = '1' ✅

Efek pada UI:
3. GET /products → response.qris_available = false ✅
4. Frontend: tombol QRIS disembunyikan ✅
5. Banner tampil: "QRIS sedang gangguan, gunakan Tunai" ✅

Auto-recovery:
6. Tunggu 5 menit (TTL Redis habis)
7. GET /products → response.qris_available = true ✅
8. Tombol QRIS muncul kembali ✅

system_logs: type='circuit_breaker', severity='warning' ✅
```

### TC-21: Void — Validasi Alasan

```
POST /admin/orders/:id/void { "reason": "typo" }
→ 422 VOID_REASON_TOO_SHORT ✅

POST /admin/orders/:id/void { "reason": "Pelanggan membatalkan pesanan" }
→ 200 OK
→ DB: voided_by IS NOT NULL, voided_at IS NOT NULL, void_reason.length ≥ 10 ✅
```

### TC-22: Kembalian — Preset & Uang Pas

```
Total Rp 12.100
Tap preset "Rp 20.000":
  cash_received = 20000
  cash_change = 7900
  UI menampilkan: "Kembalian: Rp 7.900" ✅

Tap "Uang Pas":
  cash_received = 12100
  cash_change = 0
  UI menampilkan: "Kembalian: Rp 0" ✅
```

---

## 15.4 Load Test Scenario (k6) `[v4.1 — disesuaikan target realistis]`

```javascript
// load-test/main.js
import http from 'k6/http';
import { check, sleep } from 'k6';

// [v4.1] Target VU disesuaikan ke 5 (realistis max 5 kasir bersamaan)
// bukan 20 VU dari template generik — ini single-outlet warung jajanan
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // ramp up ke 5 VU
    { duration: '2m',  target: 5 },   // sustain 5 VU (peak operational)
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    'http_req_duration{endpoint:orders}':  ['p(95)<500'],
    'http_req_duration{endpoint:payment}': ['p(95)<500'],
    'http_req_duration{endpoint:products}':['p(95)<300'],
    'http_req_failed': ['rate<0.01'],  // error rate < 1%
  },
};

const BASE_URL = `${__ENV.BASE_URL}/api/v1`;

export default function() {
  // 1. Get products (cached)
  const prodRes = http.get(`${BASE_URL}/products?include_modifiers=true`, {
    tags: { endpoint: 'products' },
  });
  check(prodRes, { 'products 200': (r) => r.status === 200 });

  // 2. Create order
  const orderRes = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({
      items: [{ product_id: __ENV.PRODUCT_ID, quantity: 1, modifier_option_ids: [] }],
      client_uuid: `${__VU}-${__ITER}-${Date.now()}`,
      client_created_at: new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'orders' } },
  );
  check(orderRes, { 'order 201': (r) => r.status === 201 });

  // 3. Pay cash
  const orderId = JSON.parse(orderRes.body).order_id;
  const payRes = http.post(
    `${BASE_URL}/orders/${orderId}/pay/cash`,
    JSON.stringify({ cash_received: 50000 }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'payment' } },
  );
  check(payRes, { 'payment 200': (r) => r.status === 200 });

  sleep(2); // kasir butuh ~2 detik antar transaksi
}
```

**Target Performa:**

| Metrik | Target | Catatan |
|--------|--------|---------|
| P95 `GET /products` | < 300ms | Cached Redis — harusnya jauh di bawah ini |
| P95 `POST /orders` | < 500ms | Termasuk kalkulasi diskon |
| P95 `POST /orders/:id/pay/cash` | < 500ms | Termasuk DB update |
| Error rate | < 1% | Keseluruhan |
| Concurrent users | 5 VU | Sesuai skenario realistis (bukan 20 VU) |

---

## 15.5 Testing Environment

| Environment | Tujuan | DB | Data |
|-------------|--------|-----|------|
| `test` (local/CI) | Unit + integration | PostgreSQL in-memory / Docker | Seed minimal (1 kasir, 3 produk, 1 diskon) |
| `staging` (VPS) | E2E + smoke test + load test | DB staging terpisah | Seed lengkap mirip production |
| `production` | Smoke test post-deploy saja | DB production | JANGAN jalankan load test |

**Smoke test post-deploy otomatis (CI/CD):**
```bash
# Setelah deploy ke staging/production
curl -sf https://${DOMAIN}/health | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d['status']=='ok' else 1)"
echo "Health check: OK"

# Login kasir (staging)
curl -sf -X POST https://${DOMAIN}/api/v1/auth/login/cashier \
  -H "Content-Type: application/json" \
  -d '{"pin":"999999"}' | grep -q '"role":"kasir"'
echo "Auth check: OK"
```

---

*Lanjut ke: [`11-deployment.md`](./11-deployment.md)*
