# Ngemiloh POS — Implementation Plan (PRD v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all PRD v2 features for Ngemiloh POS system in one unified plan: hybrid printer fallback, modal refactoring, API client singleton, backend Trust-but-Verify fix, and database migrations.

**Architecture:** NestJS 11 + Prisma 6 + PostgreSQL 16 + SvelteKit 2 (Svelte 5 Runes) + Dexie.js + Tailwind CSS 4. Clean Architecture with presentation/application/domain/infrastructure layers.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma ORM, PostgreSQL, Redis, SvelteKit, Vitest, Jest

---

## FILE STRUCTURE

### Frontend (Frontend Changes)
```
frontend/src/lib/
├── services/
│   ├── api.client.ts              # [NEW] Singleton API client (CSRF, timeout, 401→redirect)
│   └── printer.service.ts         # [MODIFY] Add try-catch fallback, return false on Bluetooth fail
├── components/pos/
│   ├── ModalManager.svelte        # [NEW] Centralized modal orchestrator
│   └── modals/                    # [NEW] Split modal folder
│       ├── ShiftModal.svelte      # [NEW] Open + Close shift
│       ├── ModifierModal.svelte   # [NEW] Product modifiers
│       ├── PaymentModal.svelte    # [NEW] Payment method selection
│       ├── QrisWaitModal.svelte   # [NEW] QRIS waiting
│       ├── SuccessModal.svelte    # [NEW] Success with hybrid print buttons
│       └── HistoryModal.svelte    # [NEW] Transaction history
├── stores/
│   └── pos.store.svelte.ts        # [MODIFY] Add customer_name, paper_size state
└── routes/pos/
    └── print/+page.svelte         # [NEW] HTML print dialog page
```

### Backend (Backend Changes)
```
backend/src/
├── auth/
│   ├── application/services/
│   │   └── auth.service.ts        # [MODIFY] Remove refresh token, add OTP flow
│   ├── infrastructure/repositories/
│   │   └── prisma-auth.repository.ts  # [MODIFY] OTP verify/resend logic
│   └── presentation/
│       └── auth.controller.ts    # [MODIFY] Add verify-otp, resend-otp, change-pin endpoints
├── orders/
│   └── application/services/
│       └── orders.service.ts     # [MODIFY] Trust but Verify: no throw on price discrepancy
└── prisma/
    └── schema.prisma              # [MODIFY] Add cashier_letter, customer_name, order_number fields
```

---

## Task 1: Frontend — Hybrid Printer Fallback (P0)

**Files:**
- Modify: `frontend/src/lib/components/pos/Modals.svelte` (Success Modal section)
- Create: `frontend/src/routes/pos/print/+page.svelte`
- Test: `frontend/src/lib/services/printer.service.ts`

### Task 1.1: Update SuccessModal in Modals.svelte

Locate the SuccessModal section in `Modals.svelte` (look for "Transaksi Berhasil" or payment success modal) and replace the single print button with two buttons:

- [ ] **Step 1: Find SuccessModal in Modals.svelte**

Search for the button that calls `printerService.connectAndPrint()` inside the success modal section. It typically appears after a successful payment.

- [ ] **Step 2: Replace with dual-button layout**

Replace the single print button with:
```svelte
<!-- Tombol Utama: Bluetooth Printer -->
<button
  onclick={async () => {
    if (posStore.lastOrderDetails) {
      const receiptText = printerService.formatReceipt(posStore.lastOrderDetails);
      const printed = await printerService.connectAndPrint(receiptText);
      if (!printed) {
        alert("Koneksi Bluetooth gagal. Gunakan tombol 'Print Browser' di sebelahnya.");
      }
    }
  }}
  class="flex-1 py-4 px-6 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex justify-center items-center gap-2"
>
  PRINT BLUETOOTH
</button>

<!-- Tombol Fallback: HTML Print Dialog -->
<a
  href="/pos/print"
  class="py-4 px-6 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 active:scale-95 transition-all flex justify-center items-center"
>
  PRINT BROWSER
</a>
```

### Task 1.2: Create Print Page

- [ ] **Step 1: Create directory structure**

Create `frontend/src/routes/pos/print/+page.svelte`

- [ ] **Step 2: Implement print page with CSS @media print**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { posStore } from '$lib/stores/pos.store.svelte';

  let paperSize = $state('80mm'); // Default from localStorage or setting
  let receiptType = $state('pelanggan'); // 'pelanggan' or 'dapur'

  onMount(() => {
    // Auto-open print dialog after component mounts
    setTimeout(() => window.print(), 300);
    // Load settings
    paperSize = localStorage.getItem('receipt_paper_width') || '80mm';
  });

  function formatRupiah(num: number): string {
    return num.toLocaleString('id-ID');
  }
</script>

<!-- Control buttons (hidden when printing) -->
<div class="no-print flex gap-4 p-4 bg-slate-100">
  <select bind:value={paperSize} class="border rounded px-2 py-1">
    <option value="58mm">58mm</option>
    <option value="80mm">80mm</option>
  </select>
  <select bind:value={receiptType} class="border rounded px-2 py-1">
    <option value="pelanggan">Struk Pelanggan</option>
    <option value="dapur">Struk Dapur</option>
  </select>
  <button onclick={() => window.print()} class="bg-brand-600 text-white px-4 py-1 rounded">
    Cetak
  </button>
</div>

<!-- Receipt Content -->
<div id="printable-receipt" class="mx-auto" style="width: {paperSize === '80mm' ? '72mm' : '48mm'}; font-family: 'Courier New', monospace; font-size: 12px; padding: 4px;">
  {#if posStore.lastOrderDetails}
    <!-- Header -->
    <div class="text-center font-bold text-lg">NGEMILOH</div>
    <div class="text-center">Jl. [Alamat Toko]</div>
    <div class="border-t border-dashed my-2"></div>

    <!-- Info -->
    <div>
      {new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
      {' '}
      {new Date().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
    <div>No Trx: {posStore.lastOrderDetails.order_number || 'N/A'}</div>
    <div>Kasir: {posStore.lastOrderDetails.cashier_name || 'Kasir'}</div>
    {#if posStore.lastOrderDetails.customer_name}
      <div>Pelgn: {posStore.lastOrderDetails.customer_name}</div>
    {/if}
    <div class="border-t border-dashed my-2"></div>

    <!-- Items (Pelanggan type) -->
    {#if receiptType === 'pelanggan'}
      {#each posStore.lastOrderDetails.items as item}
        <div>{item.quantity}x {item.name}</div>
        {#if item.modifiers && item.modifiers.length > 0}
          {#each item.modifiers as mod}
            <div class="pl-4">+ {mod.name}</div>
          {/each}
        {/if}
        <div class="text-right">{formatRupiah(item.subtotal)}</div>
      {/each}
    {:else}
      <!-- Dapur type: show only qty and name -->
      <div class="font-bold text-center text-xl">
        ORDER DAPUR
      </div>
      <div class="text-center">{posStore.lastOrderDetails.customer_name || ''}</div>
      {#each posStore.lastOrderDetails.items as item}
        <div class="text-2xl">{item.quantity}x {item.name}</div>
      {/each}
    {/if}

    <div class="border-t border-dashed my-2"></div>

    <!-- Totals -->
    <div class="flex justify-between">
      <span>Subtotal</span>
      <span>{formatRupiah(posStore.lastOrderDetails.subtotal || posStore.lastOrderDetails.total_amount)}</span>
    </div>
    {#if posStore.lastOrderDetails.discount_total > 0}
      <div class="flex justify-between">
        <span>Diskon</span>
        <span>-{formatRupiah(posStore.lastOrderDetails.discount_total)}</span>
      </div>
    {/if}
    <div class="flex justify-between font-bold">
      <span>TOTAL</span>
      <span>{formatRupiah(posStore.lastOrderDetails.total_amount)}</span>
    </div>
    <div class="border-t border-dashed my-2"></div>

    <!-- Payment info -->
    {#if posStore.lastOrderDetails.payment_method === 'cash'}
      <div class="flex justify-between">
        <span>Tunai</span>
        <span>Rp {formatRupiah(posStore.lastOrderDetails.cash_received)}</span>
      </div>
      <div class="flex justify-between">
        <span>Kembalian</span>
        <span>Rp {formatRupiah(posStore.lastOrderDetails.cash_change || 0)}</span>
      </div>
    {:else if posStore.lastOrderDetails.payment_method === 'qris'}
      <div class="text-center">QRIS - LUNAS</div>
    {:else}
      <div class="flex justify-between">
        <span>Tunai</span>
        <span>Rp {formatRupiah(posStore.lastOrderDetails.cash_amount)}</span>
      </div>
      <div class="flex justify-between">
        <span>QRIS</span>
        <span>Rp {formatRupiah(posStore.lastOrderDetails.qris_amount)}</span>
      </div>
    {/if}

    <div class="border-t border-dashed my-2"></div>

    <!-- Footer -->
    <div class="text-center">Terima kasih!</div>
    <div class="text-center">IG: @ngemiloh.id</div>
  {:else}
    <div class="text-center text-red-500">Data struk tidak ditemukan</div>
  {/if}
</div>

<style>
  @media print {
    @page {
      margin: 0;
      size: 80mm auto;
    }
    body * {
      visibility: hidden;
    }
    #printable-receipt,
    #printable-receipt * {
      visibility: visible;
    }
    #printable-receipt {
      position: absolute;
      left: 0;
      top: 0;
      width: 72mm;
    }
    .no-print {
      display: none !important;
    }
  }
</style>
```

### Task 1.3: Update printer.service.ts with safe fallback

- [ ] **Step 1: Add try-catch to connectAndPrint**

```typescript
async connectAndPrint(receiptData: string): Promise<boolean> {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
    });
    // ... existing Bluetooth printing logic ...
    return true;
  } catch (err) {
    console.warn("Bluetooth Print Failed or Cancelled:", err);
    return false; // Return false instead of throwing
  }
}
```

---

## Task 2: Frontend — API Client Singleton (P0)

**Files:**
- Create: `frontend/src/lib/services/api.client.ts`
- Test: `frontend/src/lib/services/api.client.test.ts`

### Task 2.1: Create ApiClient singleton

- [ ] **Step 1: Create api.client.ts with singleton pattern**

```typescript
const REQUEST_TIMEOUT_MS = 30000;

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private defaultTimeout: number;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'https://103-150-227-117.nip.io';
    this.defaultTimeout = REQUEST_TIMEOUT_MS;
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private getAuthToken(isAdminRoute: boolean): string | null {
    if (typeof window === 'undefined') return null;
    return isAdminRoute ? localStorage.getItem('admin_token') : localStorage.getItem('access_token');
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);

    const isAdminRoute = endpoint.includes('/admin/') || endpoint.includes('/api/v1/admin/');
    const token = this.getAuthToken(isAdminRoute);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // CSRF Token for mutating requests
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET');
    if (isMutating) {
      const csrf = this.getCookie('csrf_token');
      if (csrf) headers['X-CSRF-Token'] = csrf;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });

      // Auto logout on 401
      if (response.status === 401 && typeof window !== 'undefined') {
        const key = isAdminRoute ? 'admin_token' : 'access_token';
        localStorage.removeItem(key);
        window.location.href = isAdminRoute ? '/login-admin' : '/login';
      }

      return response;
    } catch (error: any) {
      // Offline detection
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        if (typeof window !== 'undefined') {
          console.warn('Network offline:', endpoint);
        }
      }
      if (error.name === 'AbortError') {
        throw new Error('Request Timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get(endpoint: string, options?: RequestInit): Promise<Response> {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  async post(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async put(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async patch(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    });
  }

  async delete(endpoint: string, options?: RequestInit): Promise<Response> {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

// Singleton export
export const api = ApiClient.getInstance();
```

### Task 2.2: Update pos.service.ts to use new ApiClient

- [ ] **Step 1: Update imports in pos.service.ts**

Replace direct fetch calls with the api client:
```typescript
import { api } from './api.client';

// Instead of fetch, use:
const response = await api.post('/api/v1/orders', orderData);
```

### Task 2.3: Write unit test for ApiClient

- [ ] **Step 1: Create api.client.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from './api.client';

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return singleton instance', () => {
    const instance1 = ApiClient.getInstance();
    const instance2 = ApiClient.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should include Authorization header when token exists', async () => {
    // Mock localStorage
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    global.fetch = mockFetch;

    // Setup localStorage mock
    Object.defineProperty(global, 'localStorage', {
      value: { getItem: () => 'test-token' },
      writable: true
    });

    const api = ApiClient.getInstance();
    await api.get('/api/v1/products');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/products'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-token'
        })
      })
    );
  });

  it('should redirect to /login on 401 response', async () => {
    const mockRedirect = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );

    global.fetch = mockFetch;
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: () => 'test-token',
        removeItem: vi.fn()
      },
      writable: true
    });
    Object.defineProperty(global, 'window', {
      value: { location: { href: '' }, localStorage: global.localStorage },
      writable: true
    });

    const api = ApiClient.getInstance();
    await api.get('/api/v1/products');

    // Verify localStorage was cleared
    expect((global.localStorage as any).removeItem).toHaveBeenCalledWith('access_token');
  });
});
```

---

## Task 3: Frontend — Centralized Modal Manager (P1)

**Files:**
- Create: `frontend/src/lib/components/pos/ModalManager.svelte`
- Create: `frontend/src/lib/components/pos/modals/ShiftModal.svelte`
- Create: `frontend/src/lib/components/pos/modals/ModifierModal.svelte`
- Create: `frontend/src/lib/components/pos/modals/PaymentModal.svelte`
- Create: `frontend/src/lib/components/pos/modals/QrisWaitModal.svelte`
- Create: `frontend/src/lib/components/pos/modals/SuccessModal.svelte`
- Create: `frontend/src/lib/components/pos/modals/HistoryModal.svelte`
- Delete: `frontend/src/lib/components/pos/Modals.svelte`
- Modify: `frontend/src/routes/pos/+page.svelte`
- Test: `frontend/src/lib/stores/pos.store.test.ts`

### Task 3.1: Create ModalManager.svelte

- [ ] **Step 1: Create ModalManager.svelte**

```svelte
<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';

  // Import all modal components
  import ShiftModal from './modals/ShiftModal.svelte';
  import ModifierModal from './modals/ModifierModal.svelte';
  import PaymentModal from './modals/PaymentModal.svelte';
  import QrisWaitModal from './modals/QrisWaitModal.svelte';
  import SuccessModal from './modals/SuccessModal.svelte';
  import HistoryModal from './modals/HistoryModal.svelte';
</script>

<!-- Open Shift Modal (auto-show when no open shift) -->
{#if !posStore.hasOpenShift && !posStore.isCheckingShift}
  <ShiftModal mode="open" />
{/if}

<!-- Close Shift Modal -->
{#if posStore.showCloseShiftModal}
  <ShiftModal mode="close" />
{/if}

<!-- Modifier Selection Modal -->
{#if posStore.showModifierModal}
  <ModifierModal />
{/if}

<!-- Payment Modal -->
{#if posStore.showPaymentModal}
  <PaymentModal />
{/if}

<!-- QRIS Wait Modal -->
{#if posStore.isWaitingQris}
  <QrisWaitModal />
{/if}

<!-- Success Modal -->
{#if posStore.showSuccessModal}
  <SuccessModal />
{/if}

<!-- History Modal -->
{#if posStore.showHistoryModal}
  <HistoryModal />
{/if}
```

### Task 3.2: Create SuccessModal.svelte (with Hybrid Printer)

- [ ] **Step 1: Create modals/SuccessModal.svelte**

```svelte
<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import { printerService } from '$lib/services/printer.service';

  function handleNewOrder() {
    posStore.resetPos();
  }

  async function handlePrintBluetooth() {
    if (posStore.lastOrderDetails) {
      const receiptText = printerService.formatReceipt(posStore.lastOrderDetails);
      const printed = await printerService.connectAndPrint(receiptText);
      if (!printed) {
        alert("Koneksi Bluetooth gagal. Gunakan tombol 'Print Browser' di sebelahnya.");
      }
    }
  }
</script>

<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-8 text-center">

    <div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>

    <h3 class="text-3xl font-black text-slate-800 mb-2">Pembayaran Berhasil!</h3>
    <p class="text-slate-500 mb-8 font-bold">Transaksi telah tersimpan ke sistem.</p>

    <div class="flex flex-col sm:flex-row gap-3">
      <button
        onclick={handleNewOrder}
        class="flex-1 py-4 px-6 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
      >
        PESANAN BARU
      </button>

      <button
        onclick={handlePrintBluetooth}
        class="flex-1 py-4 px-6 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 active:scale-95 transition-all flex justify-center items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
        </svg>
        PRINT BLUETOOTH
      </button>

      <a
        href="/pos/print"
        class="py-4 px-6 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 active:scale-95 transition-all flex justify-center items-center"
      >
        PRINT BROWSER
      </a>
    </div>
  </div>
</div>
```

### Task 3.3: Create other modal components (abbreviated)

For each modal, create a separate file in `modals/` folder:

- [ ] **Step 1: ShiftModal.svelte** — handles both open and close shift
- [ ] **Step 2: ModifierModal.svelte** — product modifier selection
- [ ] **Step 3: PaymentModal.svelte** — payment method selection (cash/QRIS/split)
- [ ] **Step 4: QrisWaitModal.svelte** — QRIS payment waiting with countdown
- [ ] **Step 5: HistoryModal.svelte** — transaction history list

### Task 3.4: Update pos/+page.svelte

- [ ] **Step 1: Replace Modals.svelte import with ModalManager**

```svelte
<script lang="ts">
  // Remove: import Modals from '$lib/components/pos/Modals.svelte';
  import ModalManager from '$lib/components/pos/ModalManager.svelte';
</script>

<!-- Replace <Modals /> with <ModalManager /> -->
<ModalManager />
```

### Task 3.5: Delete old Modals.svelte

- [ ] **Step 1: Delete Modals.svelte**

Once all modals are split and tested, delete the monolithic file:
```bash
rm frontend/src/lib/components/pos/Modals.svelte
```

### Task 3.6: Write store tests

- [ ] **Step 1: Create pos.store.test.ts**

Test discount formula TINGGI-04:
```typescript
import { describe, it, expect } from 'vitest';
import { posStore } from './pos.store.svelte';

describe('PosStore - Discount Formula (TINGGI-04)', () => {
  it('should apply discount only to base_price, not modifiers', () => {
    // Setup: product with base_price=15000, modifier=2000
    const cartItem = {
      id: '1',
      name: 'Mie Tek-tek',
      base_price: 15000,
      quantity: 1,
      selectedModifiers: [{ id: 'm1', name: 'Level Pedas', additional_price: 2000 }]
    };

    posStore.cart = [cartItem];

    // Apply 10% discount
    // Expected: discount = 15000 * 0.10 = 1500 (only base_price)
    // NOT: (15000 + 2000) * 0.10 = 1700
    const discount = posStore.getBestDiscountForProduct(cartItem);
    const discountAmount = discount
      ? (discount.type === 'percentage'
        ? Number(cartItem.base_price) * (Number(discount.value) / 100)
        : Number(discount.value))
      : 0;

    expect(discountAmount).toBe(1500); // Only 10% of 15000, not 17000
  });
});
```

---

## Task 4: Backend — Trust but Verify Bug Fix (P0)

**Files:**
- Modify: `backend/src/orders/application/services/orders.service.ts`
- Modify: `backend/src/orders/dto/create-order.dto.ts`
- Test: `backend/src/orders/application/services/orders.service.spec.ts`

### Task 4.1: Fix createOrderWithCache in orders.service.ts

- [ ] **Step 1: Find createOrderWithCache function (around line 514-550)**

- [ ] **Step 2: Replace price discrepancy rejection with Trust but Verify**

Find this code:
```typescript
if (diffPct > thresholdPct) {
  throw new BadRequestException('Price calculation discrepancy exceeds threshold');
}
```

Replace with:
```typescript
// Trust but Verify: Accept client's price but flag for review
let vStatus = 'Valid';
if (diffPct > thresholdPct) {
  this.logger.warn(`[Trust but Verify] Discrepancy on Order ${data.client_uuid}. Server: ${calculatedFinalPrice}, Client: ${clientFinalPrice}`);
  vStatus = 'Perlu Cek';
}
```

- [ ] **Step 3: Ensure order saves with client's price**

Find where order is created and ensure `total_amount` uses client price:
```typescript
// In the Prisma create data, use clientFinalPrice, not calculated:
total_amount: clientFinalPrice, // Client's reported price (Trust but Verify)
verification_status: vStatus,   // Flag as 'Valid' or 'Perlu Cek'
```

- [ ] **Step 4: Remove server price usage in Prisma create**

Find and update:
```typescript
// WRONG (old code):
total_amount: orderItemsPayload.reduce((sum, item) => sum + Number(item.final_price), 0),

// CORRECT (Trust but Verify):
total_amount: clientFinalPrice,
```

### Task 4.2: Fix sync-batch QRIS rejection

- [ ] **Step 1: Find syncBatchOrders function**

- [ ] **Step 2: Allow QRIS offline sync with pending_sync status**

Find:
```typescript
if (orderData.payment_method === PaymentMethod.qris) {
  // Currently: throw error or skip
  throw new BadRequestException('QRIS requires online connection');
}
```

Replace with:
```typescript
// Allow QRIS offline sync but mark as pending_sync
if (orderData.payment_method === PaymentMethod.qris) {
  orderData.status = 'pending_sync';
  this.logger.warn(`[Trust but Verify] QRIS offline order ${orderData.client_uuid} saved as pending_sync`);
}
```

### Task 4.3: Update CreateOrderDto

- [ ] **Step 1: Add missing fields to CreateOrderDto**

```typescript
// In create-order.dto.ts
export class CreateOrderDto {
  @IsUUID()
  client_uuid: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  customer_name?: string;  // Add this field

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsNumber()
  client_final_price: number;

  @IsOptional()
  @IsNumber()
  cash_received?: number;  // Add for cash payments

  // ... rest of DTO
}
```

### Task 4.4: Write tests for Trust but Verify

- [ ] **Step 1: Create orders.service.spec.ts**

```typescript
describe('OrdersService - Trust but Verify', () => {
  describe('createOrderWithCache', () => {
    it('should accept order even when price discrepancy exceeds threshold', async () => {
      const mockData = {
        client_uuid: 'test-uuid',
        payment_method: PaymentMethod.cash,
        client_final_price: 50000, // Different from server calculation
        items: [{ product_id: 'prod-1', quantity: 1, modifiers: [] }]
      };

      // Mock server calculates 55000 but client sends 50000
      // Should NOT throw, should save with client price
      const result = await service.createOrderWithCache(mockData, mockTx);

      expect(result).toBeDefined();
      expect(result.total_amount).toBe(50000); // Client price
      expect(result.verification_status).toBe('Perlu Cek'); // Flagged
    });

    it('should set verification_status=Valid when prices match', async () => {
      const mockData = {
        client_uuid: 'test-uuid-2',
        payment_method: PaymentMethod.cash,
        client_final_price: 55000, // Matches server calculation
        items: [...]
      };

      const result = await service.createOrderWithCache(mockData, mockTx);

      expect(result.verification_status).toBe('Valid');
    });
  });

  describe('syncBatchOrders', () => {
    it('should accept QRIS orders even when offline', async () => {
      const mockOrders = [{
        client_uuid: 'test-offline-qris',
        payment_method: PaymentMethod.qris,
        client_final_price: 30000,
        items: [...]
      }];

      const result = await service.syncBatchOrders(mockOrders, mockCashierId);

      expect(result[0].status).toBe('pending_sync');
      expect(result[0].payment_status).toBe('pending');
    });
  });
});
```

---

## Task 5: Backend — Remove Refresh Token (P0)

**Files:**
- Modify: `backend/src/auth/application/services/auth.service.ts`
- Modify: `backend/src/auth/presentation/auth.controller.ts`
- Remove: `backend/src/auth/dto/refresh-token.dto.ts` (if exists)

### Task 5.1: Remove refresh token from auth service

- [ ] **Step 1: Remove refreshToken method from auth.service.ts**

Find and delete:
```typescript
// DELETE THIS METHOD:
async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
  // ... all refresh token logic
}
```

- [ ] **Step 2: Remove JWT_REFRESH_SECRET from environment usage**

Find all references to `JWT_REFRESH_SECRET` and remove them.

### Task 5.2: Remove refresh endpoint from auth controller

- [ ] **Step 1: Remove @Post('refresh') endpoint**

Find and delete the refresh token endpoint in auth.controller.ts.

- [ ] **Step 2: Update logout to revoke only access_token**

```typescript
@Post('logout')
async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const token = req.cookies?.access_token;
  if (token) {
    await this.authService.revokeToken(token);
  }
  res.clearCookie('access_token');
  res.clearCookie('csrf_token');
  return { success: true, message: 'Logged out successfully' };
}
```

---

## Task 6: Database Migrations (P1)

**Files:**
- Create: `backend/prisma/migrations/20260616_v5_001_add_cashier_letter/migration.sql`
- Create: `backend/prisma/migrations/20260616_v5_002_add_order_fields/migration.sql`
- Create: `backend/prisma/migrations/20260616_v5_003_add_system_logs/migration.sql`
- Create: `backend/prisma/seed.sql`

### Task 6.1: Create migration for cashier_letter

- [ ] **Step 1: Create migration file**

```sql
-- migration.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cashier_letter" CHAR(1);
CREATE UNIQUE INDEX IF NOT EXISTS "users_cashier_letter_unique" ON "users"("cashashier_letter") WHERE "cashier_letter" IS NOT NULL;
```

### Task 6.2: Create migration for order fields

- [ ] **Step 1: Create migration for orders table (use raw SQL for partitioned table)**

```sql
-- migration.sql
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" VARCHAR(30);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cash_received" DECIMAL(12, 0);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cash_change" DECIMAL(12, 0);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_unique" ON "orders"("order_number");
```

### Task 6.3: Create system_logs table migration

- [ ] **Step 1: Create system_logs table**

```sql
-- migration.sql
CREATE TABLE IF NOT EXISTS "system_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "level" VARCHAR(10) NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "system_logs_source_created_at_idx" ON "system_logs"("source", "created_at" DESC);
```

### Task 6.4: Update seed data

- [ ] **Step 1: Add cashier_letter to seed**

```sql
-- In seed.ts or seed.sql
UPDATE "users" SET "cashier_letter" = 'A' WHERE "role" = 'kasir';
```

### Task 6.5: Update Prisma schema

- [ ] **Step 1: Add fields to schema.prisma**

```prisma
model User {
  // ... existing fields
  cashier_letter String? @unique @db.Char(1)  // Add this field
}

model Order {
  // ... existing fields
  order_number   String?  @unique @db.VarChar(30)
  customer_name  String?  @db.VarChar(50)
  cash_received  Decimal? @db.Decimal(12, 0)
  cash_change    Decimal? @db.Decimal(12, 0)
}

model SystemLog {
  id         BigInt   @id @default(autoincrement())
  level      String  @db.VarChar(10)
  source     String  @db.VarChar(100)
  message    String  @db.Text
  metadata   Json?
  created_at DateTime @default(now()) @db.Timestamptz

  @@map("system_logs")
  @@index([level, created_at(sort: Desc)])
  @@index([source, created_at(sort: Desc)])
}
```

---

## Task 7: Admin Login OTP Flow (P1)

**Files:**
- Create: `backend/src/auth/dto/verify-otp.dto.ts`
- Create: `backend/src/auth/dto/resend-otp.dto.ts`
- Create: `backend/src/auth/dto/change-pin.dto.ts`
- Modify: `backend/src/auth/application/services/auth.service.ts`
- Modify: `backend/src/auth/presentation/auth.controller.ts`
- Create: `frontend/src/routes/verify-otp/+page.svelte`
- Modify: `frontend/src/routes/login-admin/+page.svelte`

### Task 7.1: Backend - Add OTP endpoints

- [ ] **Step 1: Create verify-otp.dto.ts**

```typescript
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otp: string;
}
```

- [ ] **Step 2: Create resend-otp.dto.ts**

```typescript
import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @IsEmail()
  email: string;
}
```

- [ ] **Step 3: Add verifyOtp and resendOtp to auth.service.ts**

```typescript
async verifyOtp(email: string, otp: string): Promise<AuthUserDto> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'superadmin') {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Get OTP from Redis
  const otpKey = `otp:admin:${user.id}`;
  const storedOtp = await this.redis.get(otpKey);

  if (!storedOtp) {
    throw new BadRequestException('OTP expired or not requested');
  }

  const { code_hash, attempts } = JSON.parse(storedOtp);
  if (attempts >= 3) {
    await this.redis.del(otpKey);
    throw new BadRequestException('Too many attempts. Request new OTP.');
  }

  // Verify OTP (hash comparison)
  const isValid = await this.compareHash(otp, code_hash);
  if (!isValid) {
    // Increment attempts
    await this.redis.set(otpKey, JSON.stringify({ code_hash, attempts: attempts + 1 }), 'EX', 600);
    throw new BadRequestException('Invalid OTP');
  }

  // OTP valid - delete and generate token
  await this.redis.del(otpKey);

  return this.generateTokens(user);
}

async resendOtp(email: string): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'superadmin') {
    throw new UnauthorizedException('Invalid credentials');
  }

  // Delete old OTP if exists
  await this.redis.del(`otp:admin:${user.id}`);

  // Generate new OTP
  const otp = this.generateOtp();
  const hashedOtp = await this.hashPassword(otp);

  await this.redis.set(`otp:admin:${user.id}`, JSON.stringify({
    code_hash: hashedOtp,
    attempts: 0
  }), 'EX', 600);

  // Send email
  await this.emailService.sendOtp(user.email, otp);
}
```

- [ ] **Step 4: Add endpoints to auth.controller.ts**

```typescript
@Post('verify-otp')
async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
  const user = await this.authService.verifyOtp(dto.email, dto.otp);
  this.setAuthCookies(res, user);
  return { success: true, data: user };
}

@Post('resend-otp')
@Throttle(3, 600000) // 3 requests per 10 minutes
async resendOtp(@Body() dto: ResendOtpDto) {
  await this.authService.resendOtp(dto.email);
  return { success: true, message: 'Kode OTP baru telah dikirim' };
}
```

### Task 7.2: Frontend - OTP page

- [ ] **Step 1: Create verify-otp page**

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/services/api.client';

  let email = '';
  let otp = '';
  let error = '';
  let loading = false;

  async function handleVerify() {
    loading = true;
    error = '';

    try {
      const res = await api.post('/api/v1/auth/verify-otp', { email, otp });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.data));
        goto('/admin/dashboard');
      } else {
        error = data.message || 'OTP tidak valid';
      }
    } catch (e: any) {
      error = e.message || 'Terjadi kesalahan';
    } finally {
      loading = false;
    }
  }

  async function handleResend() {
    try {
      await api.post('/api/v1/auth/resend-otp', { email });
      alert('Kode OTP baru telah dikirim');
    } catch (e) {
      alert('Gagal mengirim OTP');
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-slate-100">
  <div class="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
    <h1 class="text-2xl font-bold mb-6">Verifikasi OTP</h1>

    {#if error}
      <div class="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleVerify(); }}>
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Email</label>
        <input type="email" bind:value={email} required class="w-full border rounded-lg px-4 py-2" />
      </div>

      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">Kode OTP</label>
        <input type="text" bind:value={otp} maxlength="6" required class="w-full border rounded-lg px-4 py-2 text-center text-2xl tracking-widest" />
      </div>

      <button type="submit" disabled={loading} class="w-full bg-brand-600 text-white py-3 rounded-lg font-bold">
        {loading ? 'Memverifikasi...' : 'Verifikasi'}
      </button>
    </form>

    <button onclick={handleResend} class="w-full mt-4 text-brand-600 font-medium">
      Kirim Ulang OTP
    </button>
  </div>
</div>
```

### Task 7.3: Update login-admin page for OTP flow

- [ ] **Step 1: Modify login-admin/+page.svelte**

Update the admin login page to:
1. After successful email/password validation, show "OTP dikirim" message
2. Navigate to `/verify-otp?email={email}`

```svelte
<script lang="ts">
  // ... existing code

  let email = '';
  let password = '';
  let step = $state<'login' | 'otp'>('login');

  async function handleLogin() {
    const res = await api.post('/api/v1/auth/login', { email, password });
    const data = await res.json();

    if (data.success && data.data.otp_sent) {
      // OTP was sent, redirect to OTP page
      goto(`/verify-otp?email=${encodeURIComponent(email)}`);
    } else if (data.success) {
      // Direct login (shouldn't happen for admin)
      localStorage.setItem('user', JSON.stringify(data.data));
      goto('/admin/dashboard');
    } else {
      error = data.message || 'Login gagal';
    }
  }
</script>
```

---

## Task 8: Admin Layout Guard (P1)

**Files:**
- Modify: `frontend/src/routes/admin/+layout.svelte`

### Task 8.1: Implement admin route guard

- [ ] **Step 1: Update admin/+layout.svelte**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let isAuthenticated = $state(false);
  let loading = $state(true);

  onMount(() => {
    const token = localStorage.getItem('admin_token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      goto('/login-admin');
      return;
    }

    try {
      const user = JSON.parse(userStr);
      if (user.role !== 'superadmin') {
        localStorage.removeItem('admin_token');
        goto('/login-admin');
        return;
      }
      isAuthenticated = true;
    } catch (e) {
      goto('/login-admin');
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="h-screen w-full flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
  </div>
{:else if isAuthenticated}
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r">
      <!-- Admin navigation links -->
      <nav class="p-4">
        <a href="/admin/dashboard" class="block py-2 px-4 rounded hover:bg-slate-100">Dashboard</a>
        <a href="/admin/products" class="block py-2 px-4 rounded hover:bg-slate-100">Products</a>
        <!-- Add more nav items -->
      </nav>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
{/if}
```

---

## Task 9: Order Number Generation (P2)

**Files:**
- Modify: `backend/src/orders/application/services/orders.service.ts`
- Test: `backend/src/orders/application/services/orders.service.spec.ts`

### Task 9.1: Implement order number generation

- [ ] **Step 1: Add generateOrderNumber helper**

```typescript
async generateOrderNumber(cashierLetter: string, date: Date): Promise<string> {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

  // Get the next sequence for this cashier on this date
  const existingOrders = await this.prisma.order.count({
    where: {
      order_number: {
        startsWith: `TRX-${dateStr}-${cashierLetter}`
      }
    }
  });

  const sequence = String(existingOrders + 1).padStart(3, '0');
  return `TRX-${dateStr}-${cashierLetter}${sequence}`;
}
```

- [ ] **Step 2: Use in createOrderWithCache**

```typescript
const orderNumber = await this.generateOrderNumber(cashierLetter, new Date());
```

---

## Task 10: Integration & E2E Testing (P2)

**Files:**
- Create: `frontend/tests/pos.test.ts`
- Create: `backend/tests/orders.e2e-spec.ts`

### Task 10.1: Frontend E2E test

- [ ] **Step 1: Create Vitest E2E test**

```typescript
import { test, expect } from 'vitest';

test('POS flow: login, add product, pay cash, print receipt', async () => {
  // 1. Login as kasir
  // 2. Open shift
  // 3. Click product
  // 4. Add to cart
  // 5. Click Bayar
  // 6. Select cash, enter amount
  // 7. Confirm payment
  // 8. Verify success modal appears
  // 9. Click Print Browser
  // 10. Verify print dialog opens
});
```

### Task 10.2: Backend integration test

- [ ] **Step 1: Create Jest E2E test**

```typescript
describe('Orders E2E', () => {
  it('should process cash order and save with correct totals', async () => {
    const orderData = {
      client_uuid: 'test-e2e-' + Date.now(),
      payment_method: 'cash',
      cash_received: 100000,
      client_final_price: 50000,
      items: [{ product_id: testProductId, quantity: 2, modifiers: [] }]
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(orderData);

    expect(res.status).toBe(201);
    expect(res.body.data.payment_status).toBe('settled');
    expect(res.body.data.cash_change).toBe(50000);
  });

  it('should accept offline order with price discrepancy (Trust but Verify)', async () => {
    // Server calculates 55000 but client sends 50000
    const orderData = {
      client_uuid: 'test-trust-verify-' + Date.now(),
      payment_method: 'cash',
      client_final_price: 50000, // Intentional mismatch
      items: [...]
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/orders/sync-batch')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [orderData] });

    expect(res.status).toBe(200);
    expect(res.body.data[0].status).toBe('success');
    expect(res.body.data[0].verification_status).toBe('Perlu Cek');
  });
});
```

---

## Self-Review Checklist

After completing all tasks, verify:

1. **Spec coverage:**
   - [ ] Hybrid printer fallback (SuccessModal has both Bluetooth and Browser buttons)
   - [ ] ApiClient singleton handles 401 redirect
   - [ ] ModalManager splits all 7 modals
   - [ ] Trust but Verify: orders saved with client price, not rejected
   - [ ] QRIS offline orders saved as pending_sync
   - [ ] Refresh token removed from backend
   - [ ] OTP flow for admin login
   - [ ] Admin layout guard checks role

2. **Placeholder scan:**
   - No "TODO" or "TBD" in implementation code
   - All code blocks show actual implementation
   - No "similar to Task X" without full code

3. **Type consistency:**
   - `client_uuid` used consistently (not `clientUuid` or `clientId`)
   - `order_number` used consistently (not `orderNumber`)
   - `customer_name` used consistently (not `customerName`)
   - `cash_received` and `cash_change` field names match across frontend and backend

4. **Missing items from PRD:**
   - [ ] `shift_number` generation in openShift
   - [ ] `carry_over_from_shift_id` logic
   - [ ] `auto_close_at` calculation
   - [ ] `system_cash_total` and `discrepancy` calculation in closeShift

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-16-ngemiloh-pos-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**