# FRONTEND ARCHITECTURE DOCUMENT — Ngemiloh POS

> **Single Source of Truth** untuk arsitektur frontend. Dokumen ini memfinalisasi semua keputusan desain berdasarkan kode aktual di `frontend/src/` dan konfirmasi pengguna.

**Status:** FINAL (2026-06-16)
**Base source:** `RINGKASAN_PERUBAHAN_FRONTEND.md` (2026-06-15 20:03) + audit (`HASIL_AUDIT_FRONTEND_REVISI.md`) + kode aktual

---

## 1. Tech Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Framework | SvelteKit | 2.57.0 |
| UI Framework | Svelte | 5.55.2 (Runes) |
| Styling | Tailwind CSS | 4.3.0 |
| Offline Storage | Dexie.js | 4.4.3 |
| HTTP Client | Fetch API (custom ApiClient) | native |
| Printer | Web Bluetooth API + HTML Print Dialog | browser-native |
| Auth Storage | localStorage | browser-native |
| Build | Vite | via SvelteKit |

---

## 2. Folder Structure

```
frontend/src/
├── lib/
│   ├── components/
│   │   └── pos/
│   │       ├── CartSidebar.svelte    # Keranjang (mobile floating + desktop fixed)
│   │       ├── Modals.svelte         # Semua modal dalam 1 file (723 baris)
│   │       └── ProductList.svelte    # Grid produk dengan diskon badge
│   ├── services/
│   │   ├── api.client.ts             # Singleton HTTP client (CSRF, timeout, 401→redirect)
│   │   ├── pos.service.ts            # Business logic (shift, sync, payment, QRIS)
│   │   └── printer.service.ts         # Web Bluetooth GATT/ESC-POS + formatReceipt()
│   ├── stores/
│   │   ├── pos.store.svelte.ts       # PosStore singleton ($state, $derived, $derived.by)
│   │   └── toast.store.svelte.ts     # Toast notifications
│   ├── db.ts                         # Dexie schema: products, orders, cart
│   ├── domain/models/
│   │   └── types.ts                 # Semua interface TypeScript (single source)
│   └── utils/
│       └── format.ts                # Konstan: QRIS_COUNTDOWN=900s, FLAG_REFRESH=60s, DEFAULT_OPENING=500000
└── routes/
    ├── login/
    │   └── +page.svelte             # Kasir: username + PIN 4 digit
    ├── login-admin/
    │   └── +page.svelte             # Admin: email + password langsung (Opsi A, TANPA OTP)
    ├── pos/
    │   ├── +page.svelte             # Mount: online detection, sync, cart restore
    │   └── print/
    │       └── +page.svelte         # Struk: toggle 58mm/80mm, pelanggan/dapur, window.print()
    └── admin/
        ├── +layout.svelte            # Admin layout guard (localStorage role check)
        ├── dashboard/
        ├── products/
        ├── inventory/
        ├── discounts/
        ├── analytics/
        ├── reports/
        ├── transactions/
        └── users/
```

---

## 3. Data Models (Dexie Schema)

### 3.1 Database: `NgemilohPOSDB` (Dexie v2)

**3 tabel:**

```typescript
// db.ts — PosDatabase
products: Table<LocalProduct, string>    // 'id, category_id'
orders:   Table<LocalOrder, string>     // 'client_uuid, sync_status, created_at'
cart:     Table<LocalCartItem, string> // 'id' (single record 'current_cart')
```

### 3.2 LocalProduct (offline product cache)

```typescript
interface LocalProduct {
  id: string;
  name: string;
  base_price: number;
  category_id?: string;
  image_url?: string;
  is_out_of_stock: boolean;
  modifier_groups: ModifierGroup[];
}
```

### 3.3 CartItem (extends LocalProduct)

```typescript
type CartItem = LocalProduct & {
  quantity: number;
  cartItemId: string;      // crypto.randomUUID()
  selectedModifiers: ModifierOption[];
};
```

### 3.4 LocalOrder (offline queue)

```typescript
interface LocalOrder {
  client_uuid: string;
  kasir_id: string;
  subtotal: number;
  tax_total: number;
  final_price: number;
  payment_method: 'cash' | 'qris' | 'split';
  status: string;
  items: LocalOrderItem[];
  sync_status: 'pending' | 'synced';
  created_at: number;     // Date.now()
}
```

---

## 4. State Management (PosStore)

**File:** `src/lib/stores/pos.store.svelte.ts`
**Pattern:** Class singleton dengan Svelte 5 Runes (`$state`, `$derived`, `$derived.by`)

### 4.1 State Fields

```typescript
// Application State
isOffline: boolean
featureFlags: Record<string, boolean>

// Products & Cart
products: LocalProduct[]
cart: CartItem[]
isCartLoaded: boolean

// Modals (boolean flags)
showPaymentModal, showModifierModal, showSuccessModal, showHistoryModal
showOpenShiftModal, showCloseShiftModal

// Shift
hasOpenShift, openingBalance, closingBalance, isCheckingShift

// Modifier
selectedProductForModifier: LocalProduct | null
selectedModifiers: Record<string, ModifierOption>

// Discount
activeDiscounts: Discount[]
appliedDiscount: Discount | null

// Payment
paymentMethod: 'cash' | 'qris' | 'split'
cashAmount, splitCashAmount, isProcessing

// QRIS State
isWaitingQris, qrisCountdown (15 menit)
qrisOrderInfo: OrderResponse | null
lastOrderDetails: OrderResponse | null
historyOrders: OrderResponse[]
```

### 4.2 Derived Values

```typescript
// Modifier total (hanya modifier price, BUKAN base_price)
modifierTotal = $derived(
  Object.values(this.selectedModifiers).reduce((sum, opt) => sum + Number(opt.additional_price || 0), 0)
)

// Validasi modifier wajib dipilih
isAllRequiredModifiersSelected = $derived.by(() => {
  if (!this.selectedProductForModifier) return false;
  for (const g of this.selectedProductForModifier.modifier_groups) {
    if (g.is_required === true && !this.selectedModifiers[g.id]) return false;
  }
  return true;
})

// Kalkulasi harga
cartTotalBeforeDiscount = $derived(...)
discountTotal = $derived(...)           // TINGGI-04: diskon HANYA dari base_price
cartTotal = $derived(Math.max(0, cartTotalBeforeDiscount - discountTotal))
splitQrisAmount = $derived(...)
cashChange = $derived(...)
```

### 4.3 Formula Diskon — TINGGI-04

> **PENTING:** Diskon dihitung dari `base_price` produk, modifier/topping TIDAK ikut kena diskon.

```typescript
// pos.store.svelte.ts — discountTotal $derived
this.cart.reduce((sum, item) => {
  const discount = this.getBestDiscountForProduct(item);
  if (!discount) return sum;
  // TINGGI-04: Discount only applies to base_price, NOT modifier total
  const baseTotal = Number(item.base_price) * item.quantity;
  return sum + (discount.type === 'percentage'
    ? baseTotal * (Number(discount.value) / 100)
    : Number(discount.value) * item.quantity);
}, 0);
```

### 4.4 Pajak Include (0%)

```typescript
taxRate: number = $state(0); // Set 0% saat ini. Ubah ke 0.1 (10%) jika kena PB1.

// Kalkulasi pajak dari total (Include Tax):
get taxTotal(): number {
  const dpp = this.cartTotal / (1 + this.taxRate);
  return Math.round(this.cartTotal - dpp);
}
```

---

## 5. Services

### 5.1 ApiClient (`api.client.ts`)

Singleton HTTP client. Semua request lewat di sini.

**Fitur:**
- CSRF token: hanya untuk mutating requests (POST/PUT/PATCH/DELETE)
- Request timeout: 30 detik (`AbortController`)
- Auth token: read dari `localStorage` berdasarkan route (`/admin` → `admin_token`, lainnya → `access_token`)
- 401 handling: hapus token + redirect ke `/login` atau `/login-admin`
- Auto-retry refresh loop (max 3 rekursi)

```typescript
// Konstan
REQUEST_TIMEOUT_MS = 30000

// Method signature
static async request(endpoint, options): Promise<Response>
static async get(endpoint, options?)
static async post(endpoint, body?, options?)
static async put(endpoint, body?, options?)
static async patch(endpoint, body?, options?)
static async delete(endpoint, options?)
```

### 5.2 PosService (`pos.service.ts`)

Business logic layer. Semua interaksi dengan API dan Dexie terpusat di sini.

**Fitur utama:**

| Method | Fungsi |
|--------|--------|
| `fetchFlags()` | Ambil feature flags dari `/flags` |
| `checkShift()` | Cek apakah ada shift aktif |
| `handleOpenShift(balance)` | Buka shift baru |
| `handleCloseShift(balance)` | Tutup shift |
| `loadProductsFromDb()` | Load dari Dexie |
| `fetchProductsFromApi()` | Sync produk dari API ke Dexie |
| `fetchDiscounts()` | Ambil diskon aktif |
| `fetchHistory()` | Ambil riwayat transaksi |
| `syncPendingOrders()` | Batch sync offline orders |
| `processPayment(onQrisWait, onSuccess)` | Proses transaksi |
| `startQrisWaiting(orderData, onSuccess)` | Mulai QRIS SSE + polling |
| `cancelQrisWaiting()` | Batalkan QRIS wait |

**QRIS Flow (SSE + Polling):**
1. Buka SSE connection ke `/api/v1/orders/{id}/sse`
2. Polling fallback setiap 5 detik ke `/orders/{id}/status`
3. Race condition prevention: flag `isOrderCompleted` + `qrisStartTime` timestamp-based countdown
4. Countdown tidak pause saat tab tersembunyi (timestamp-based, bukan interval counter)

### 5.3 PrinterService (`printer.service.ts`)

**Hybrid printer: Opsi C** (sesuai konfirmasi pengguna)

**Primary: Web Bluetooth ESC/POS** (Chrome/Edge only)
```typescript
// connectAndPrint(receiptData: string) → boolean
// UUIDs: service=0x1800, characteristic=0x2AF1
// Chunk size: 512 bytes (BLE limitation)
// Fallback: return false → toast warning
```

**Secondary: HTML Print Dialog** (`window.print()`)
- Tidak di-service ini — melainkan di `src/routes/pos/print/+page.svelte`
- `printerService.formatReceipt()` menghasilkan plain text untuk Bluetooth
- Blueprint struk lengkap ada di `LAYOUT_STRUK_KASIR.md`

---

## 6. Komponen UI

### 6.1 Modals.svelte (723 baris)

**SEMUA modal dalam 1 file.** Pecah dengan hati-hati jika diperlukan (side effect ke posStore).

| Modal | Trigger | State Flag |
|-------|---------|-----------|
| OpenShiftModal | `!hasOpenShift && !isCheckingShift` | auto-show |
| CloseShiftModal | `showCloseShiftModal` | flag |
| ModifierModal | `showModifierModal` | flag |
| PaymentModal | `showPaymentModal` | flag |
| QrisWaitModal | `isWaitingQris` | state |
| SuccessModal | `showSuccessModal` | flag |
| HistoryModal | `showHistoryModal` | flag |

**Accessibility:** `focusTrap` action + Escape key handler + ARIA roles

### 6.2 CartSidebar.svelte

- Desktop: fixed sidebar 26rem (md+)
- Mobile: floating bottom-right FAB + slide-up drawer
- Haptic feedback: `navigator.vibrate(50)`
- Input nama pelanggan: required untuk antrean

### 6.3 ProductList.svelte

- Grid responsive: 2 → 3 → 4 kolom
- Badge: `HABIS` (grayscale + opacity-50) atau diskon (`DISKON 10%` / `HEMAT Rp5.000`)
- Image safety: whitelist `/uploads/` dan `http://` prefix
- Fallback: initials 2 huruf (bg-indigo-50)

### 6.4 Print Page (`pos/print/+page.svelte`)

**Toggle controls:**
- Jenis struk: `pelanggan` | `dapur`
- Ukuran kertas: `58mm` | `80mm`

**Struk Pelanggan:**
- Header: logo + nama bisnis + alamat
- Info: tanggal, nomor TRX, kasir, nama pelanggan
- Item: nama + qty + harga (modifier di-detail)
- Rincian: subtotal, diskon, TOTAL, metode bayar, kembalian
- Footer: "Terima Kasih" + WA contact

**Struk Dapur:**
- Header: "ORDER DAPUR" + tanggal
- Box jumbo: nama pelanggan + 4 digit ID transaksi
- Item: qty + nama produk + modifier (tanpa harga)
- Footer: "--- AKHIR PESANAN ---"

**CSS Print:** `@media print` → visibility:hidden semua → `#printable-receipt` visible only

---

## 7. Auth Flow

### 7.1 Kasir (`/login`)

```
URL: /login
Kredensial: username + PIN 4 digit
Endpoint: POST /api/v1/auth/login/cashier { pin }
Token: access_token (localStorage)
Token TTL: 20 jam
```

### 7.2 Admin (`/login-admin`)

```
URL: /login-admin
Kredensial: email + password langsung (Opsi A — TANPA OTP step)
Endpoint: POST /api/v1/auth/login { username: email, pin: password }
Role guard: localStorage.user.role === 'superadmin'
Token: admin_token (localStorage)
Token TTL: 12 jam
```

**Layout guard:** `admin/+layout.svelte` → cek `localStorage.getItem('user')` → redirect jika bukan superadmin

---

## 8. Offline Strategy

### 8.1 Produk
1. Mount → `fetchProductsFromApi()` → simpan ke Dexie
2. Offline → `loadProductsFromDb()` dari Dexie
3. Image cache: Service Worker (future)

### 8.2 Transaksi
1. Online → POST `/orders` → response
2. Offline → simpan ke Dexie `orders` (sync_status: pending)
3. Reconnect → `syncPendingOrders()` → batch POST `/orders/sync-batch`
4. QRIS/split payment → tidak bisa offline (toast error)

### 8.3 Cart
- Cart tidak di-persist ke Dexie (hanya di-memory posStore)
- Cart di-clear saat: resetPos(), logout, close shift

---

## 9. Konstanta

**File:** `src/lib/utils/format.ts`

```typescript
QRIS_COUNTDOWN_SECONDS    = 900   // 15 menit
FLAG_REFRESH_INTERVAL_MS  = 60000 // 1 menit
DEFAULT_OPENING_BALANCE   = 500000 // Rp 500.000
MIN_QRIS_PAYMENT          = 1000  // Rp 1.000
```

---

## 10. API Endpoint Reference

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/v1/auth/login/cashier` | Login kasir (PIN) |
| POST | `/api/v1/auth/login` | Login admin (email+password) |
| GET | `/api/v1/flags` | Feature flags |
| GET | `/api/v1/cash/current` | Cek shift aktif |
| POST | `/api/v1/cash/open` | Buka shift |
| POST | `/api/v1/cash/close` | Tutup shift |
| GET | `/api/v1/products?include_modifiers=true` | Daftar produk |
| GET | `/api/v1/admin/discounts` | Diskon aktif |
| POST | `/api/v1/orders` | Buat transaksi |
| GET | `/api/v1/orders` | Riwayat transaksi |
| GET | `/api/v1/orders/{id}/status` | Status order (polling) |
| GET | `/api/v1/orders/{id}/sse` | Status order (SSE) |
| POST | `/api/v1/orders/sync-batch` | Sync offline orders |

---

## 11. Todos & Catatan Implementasi

### Printer Hybrid (Opsi C) — CATATAN PENTING

`printer.service.ts` menyediakan **Bluetooth ESC/POS** (return `false` jika gagal).
`pos/print/+page.svelte` menyediakan **HTML Print Dialog** (`window.print()`).

**Issue yang perlu diperbaiki:**
`Modals.svelte` → SuccessModal → tombol "CETAK STRUK" hanya memanggil `printerService.connectAndPrint()`. Jika Bluetooth gagal, struk tidak bisa dicetak sama sekali.

**Perbaikan yang disarankan:**
Tambahkan tombol sekunder "PRINT via BROWSER" di SuccessModal yang mengarahkan ke `/pos/print` (HTML print fallback).

### Modals.svelte — Refactoring Warning

File ini 723 baris dengan 7 modal berbeda. Pecah menjadi:
- `ShiftModal.svelte` (open + close shift)
- `ModifierModal.svelte`
- `PaymentModal.svelte`
- `QrisWaitModal.svelte`
- `SuccessModal.svelte`
- `HistoryModal.svelte`

**PERHATIAN:** Perubahan di sini BERDAMPAK ke banyak file. Lakukan dengan hati-hati, pastikan state di `posStore` tidak rusak.

### TINGGI-04 — Diskon Formula

Formula diskon HARUS konsisten antara frontend dan backend:
- **Frontend:** `pos.store.svelte.ts` — diskon dari `base_price` saja
- **Backend:** harus sama (cek di `orders/` service)

---

## 12. Reference Files

| File | Kontribusi |
|------|-----------|
| `RINGKASAN_PERUBAHAN_FRONTEND.md` | Source code lengkap semua file |
| `HASIL_AUDIT_FRONTEND_REVISI.md` | Pajak include 0%, struk dapur, split payment |
| `LAYOUT_STRUK_KASIR.md` | Blueprint struk 58/80mm |
| `frontend/src/lib/stores/pos.store.svelte.ts` | Kode aktual PosStore |
| `frontend/src/lib/services/printer.service.ts` | Kode aktual PrinterService |
| `frontend/src/lib/services/pos.service.ts` | Kode aktual PosService |
| `frontend/src/lib/db.ts` | Kode aktual Dexie schema |
| `frontend/src/lib/domain/models/types.ts` | Kode aktual TypeScript types |
| `frontend/src/lib/utils/format.ts` | Kode aktual konstanta |
| `frontend/src/lib/components/pos/Modals.svelte` | Kode aktual semua modal |
| `frontend/src/routes/login/+page.svelte` | Kode aktual login kasir |
| `frontend/src/routes/login-admin/+page.svelte` | Kode aktual login admin |
| `frontend/src/routes/pos/print/+page.svelte` | Kode aktual print page |

---

*Document generated: 2026-06-16*
*Based on: actual source code + RINGKASAN_PERUBAHAN_FRONTEND.md (2026-06-15 20:03) + HASIL_AUDIT_FRONTEND_REVISI.md (2026-06-15 02:22)*
