# 📋 Laporan Audit & Panduan Perbaikan — POS Ngemiloh

> **Dibuat:** 2026-06-20  
> **Lingkup:** Seluruh file dan folder project (backend, frontend, infra, CI/CD)  
> **Tujuan:** Identifikasi masalah + solusi kode siap pakai yang simple & mudah dipahami

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [🔴 Masalah Kritis](#2--masalah-kritis-harus-diperbaiki-sebelum-production)
3. [🟠 Masalah Tinggi](#3--masalah-tinggi-penting-sebelum-go-live)
4. [🟡 Masalah Sedang](#4--masalah-sedang-sprint-berikutnya)
5. [🟢 Masalah Rendah](#5--masalah-rendah-nice-to-have)
6. [Fitur yang Belum Dibangun](#6-fitur-yang-belum-dibangun)
7. [Status Implementasi Semua Modul](#7-status-implementasi-semua-modul)
8. [Checklist Perbaikan](#8-checklist-perbaikan)

---

## 1. Ringkasan Eksekutif

| Area | Status | Kritis |
|------|--------|--------|
| Backend — Core Modules | ✅ Solid | 0 |
| Backend — Business Logic | ⚠️ Ada Bug | 2 |
| Frontend — POS Interface | ✅ Solid | 1 |
| Frontend — Admin Panel | ⚠️ Partial | 2 |
| CI/CD Pipeline | ❌ Broken | 1 |
| Konfigurasi Deploy | ❌ Broken | 1 |
| Testing | ⚠️ Kurang | 2 |
| Security | ⚠️ Medium Risk | 2 |
| Fitur Missing | ❌ Missing | 4 |

**Total masalah ditemukan:** 4 Kritis · 6 Tinggi · 6 Sedang · 9 Rendah

---

## 2. 🔴 Masalah Kritis (Harus Diperbaiki Sebelum Production)

---

### KRITIS-01 — CI/CD Build Docker Akan Selalu Gagal

**File:** `.github/workflows/ci.yml` baris 340  
**Dampak:** Tidak ada Docker image yang bisa dibuild dan di-push ke production

**Masalah:**
```yaml
# SALAH — file ini TIDAK ADA di project:
file: ./Caddy.Dockerfile
```

**File sebenarnya ada di:**
```
docker/caddy.Dockerfile  ← ini yang benar
```

**Perbaikan — Edit `.github/workflows/ci.yml` baris 336-344:**
```yaml
# SEBELUM (salah):
- name: Build and push Caddy (frontend)
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./Caddy.Dockerfile        # ← path salah, file tidak ada
    push: true
    tags: ${{ secrets.DOCKER_USERNAME }}/ngemiloh-caddy:${{ github.sha }}

# SESUDAH (benar):
- name: Build and push Caddy (frontend)
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./docker/caddy.Dockerfile  # ← path yang benar
    push: true
    tags: ${{ secrets.DOCKER_USERNAME }}/ngemiloh-caddy:${{ github.sha }}
    build-args: |
      VITE_API_URL=${{ secrets.VITE_API_URL }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

> **Catatan:** Sekalian tambahkan `VITE_API_URL` sebagai build arg (lihat KRITIS-02).

---

### KRITIS-02 — Frontend Production Tidak Bisa Hit API (URL Kosong)

**File:** `frontend/src/lib/services/api.client.ts` baris 8-15  
**Dampak:** Semua API call gagal di production karena BASE_URL jadi string kosong `""`

**Masalah:**
```typescript
// Di production: VITE_API_URL tidak di-set, DEV=false
// Hasilnya BASE_URL = '' → semua fetch ke URL kosong → ERROR
const BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV && 'http://localhost:3000') ||
  '';
```

**Root cause:** Tidak ada `.env` di folder `frontend/`, dan `docker/caddy.Dockerfile` tidak inject `VITE_API_URL` saat build.

**Perbaikan — Langkah 1: Buat file `frontend/.env.example`:**
```bash
# frontend/.env.example
# Salin file ini ke .env untuk development
VITE_API_URL=http://localhost:3000
```

**Perbaikan — Langkah 2: Buat file `frontend/.env` untuk development:**
```bash
# frontend/.env  (jangan commit ke git!)
VITE_API_URL=http://localhost:3000
```

**Perbaikan — Langkah 3: Update `docker/caddy.Dockerfile` agar bisa menerima build arg:**
```dockerfile
# Cari bagian build frontend di Caddy.Dockerfile, tambahkan:

# Tambahkan SEBELUM RUN npm run build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Contoh lengkap bagian build:
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Terima URL API dari build argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build
```

**Perbaikan — Langkah 4: Update `docker-compose.yml` untuk development:**
```yaml
# Tambahkan bagian caddy build args:
caddy:
  build:
    context: .
    dockerfile: docker/caddy.Dockerfile
    args:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
```

**Perbaikan — Langkah 5: Tambahkan ke `secrets` GitHub Actions:**
```
Repository → Settings → Secrets → Actions → New repository secret
Name: VITE_API_URL
Value: https://api.namadomain-anda.com
```

---

### KRITIS-03 — Auto-Close Shift Ambil Order Tanpa Batas Waktu

**File:** `backend/src/finance/finance.cron.ts` baris 92-98  
**Dampak:** Kasir yang buka shift baru setelah auto-close akan ikut terhitung di shift lama

**Masalah:**
```typescript
// SALAH: tidak ada batas akhir waktu
const orders = await this.prisma.order.findMany({
  where: {
    cashier_id: shift.cashier_id,
    status: 'completed',
    created_at: { gte: shift.shift_start },  // ← tidak ada lte/lt!
  },
});
```

Dari CLAUDE.md: **"Shift = Business Date — filter by `shift_start..shift_end`"**

**Perbaikan — Edit fungsi `autoCloseShift` di `finance.cron.ts`:**
```typescript
private async autoCloseShift(shift: {
  id: string;
  cashier_id: string;
  opening_balance: unknown;
  shift_start: Date;
  cashier: { name: string; email: string | null };
}) {
  this.logger.warn(
    `Auto-closing shift ${shift.id} for cashier ${shift.cashier.name}`,
  );

  try {
    // Waktu auto-close adalah sekarang (saat cron berjalan)
    const auto_close_time = new Date();

    // PERBAIKAN: Gunakan shift_start sampai auto_close_time sebagai boundary
    // Ini sesuai business rule: "Shift = Business Date"
    const orders = await this.prisma.order.findMany({
      where: {
        cashier_id: shift.cashier_id,
        status: 'completed',
        created_at: {
          gte: shift.shift_start,   // mulai shift dibuka
          lt: auto_close_time,      // ← TAMBAH: sampai saat auto-close
        },
      },
    });

    const totalCashSales = orders.reduce((sum, o) => {
      if (o.payment_method === 'cash') return sum + Number(o.total_amount);
      if (o.payment_method === 'split') return sum + Number(o.cash_amount || 0);
      return sum;
    }, 0);

    const expectedBalance = Number(shift.opening_balance) + totalCashSales;

    await this.prisma.cashRegister.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        actual_close_at: auto_close_time,  // gunakan variabel yang sama
        closing_balance: expectedBalance,
        system_cash_total: expectedBalance,
        discrepancy: 0,
        is_auto_closed: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actor_id: shift.cashier_id,
        action: 'CASH_REGISTER_AUTO_CLOSE',
        entity_type: 'CashRegister',
        entity_id: shift.id,
        new_value: {
          reason: 'Auto-closed: planned_close_at exceeded grace period',
          system_cash_total: expectedBalance,
          order_count: orders.length,
        },
      },
    });

    this.logger.log(`Shift ${shift.id} auto-closed. Orders: ${orders.length}`);
  } catch (err) {
    this.logger.error(
      `Failed to auto-close shift ${shift.id}: ${(err as Error).message}`,
    );
  }
}
```

---

### KRITIS-04 — Tombol Logout POS Tidak Clear Token

**File:** `frontend/src/routes/pos/+page.svelte` baris 148-162  
**Dampak:** Kasir "logout" tapi cookie `access_token` masih ada → masih ter-auth jika langsung akses `/pos`

**Masalah:**
```html
<!-- SALAH: hanya navigasi, tidak clear apapun -->
<a href="/login" title="Keluar">Logout</a>
```

**Perbaikan — Ganti `<a>` menjadi `<button>` dengan fungsi logout di `pos/+page.svelte`:**

Di bagian `<script>`, tambahkan fungsi:
```typescript
// Tambahkan di bagian script (setelah import)
import { api } from '$lib/services/api.client';

async function handle_logout() {
  try {
    // Hapus cookie access_token dengan expire di masa lalu
    // Cookie httpOnly tidak bisa dihapus via JS, tapi bisa minta backend
    await api.post('/auth/logout', {});
  } catch {
    // Lanjutkan logout walau request gagal
  } finally {
    // Bersihkan data lokal
    localStorage.removeItem('user');
    // Arahkan ke halaman login
    window.location.href = '/login';
  }
}
```

Di bagian template, ganti `<a>` dengan `<button>`:
```html
<!-- SEBELUM: -->
<a href="/login" class="...">Logout</a>

<!-- SESUDAH: -->
<button
  onclick={handle_logout}
  class="flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100"
  title="Keluar"
>
  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
  <span class="hidden sm:inline">Logout</span>
</button>
```

**Tambahkan endpoint logout di backend** `backend/src/auth/presentation/auth.controller.ts`:
```typescript
// Tambahkan endpoint logout sederhana
@Post('logout')
@HttpCode(200)
logout(@Res({ passthrough: true }) res: Response) {
  // Clear cookie dengan expire di masa lalu
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie('csrf_token', { path: '/' });
  return { success: true, message: 'Logged out' };
}
```

---

## 3. 🟠 Masalah Tinggi (Penting Sebelum Go-Live)

---

### TINGGI-01 — Admin Layout Auth Guard Bisa Di-Bypass

**File:** `frontend/src/routes/admin/+layout.svelte` baris 13-30  
**Dampak:** Halaman admin terbuka jika manipulasi `localStorage` via browser console

**Masalah:**
```typescript
// Siapapun bisa jalankan di console browser:
// localStorage.setItem('user', JSON.stringify({ role: 'superadmin', name: 'Test' }))
// → Langsung masuk admin panel!

onMount(() => {
  const user_str = localStorage.getItem('user'); // ← hanya cek localStorage
  const user = JSON.parse(user_str);
  if (user.role !== 'superadmin') { goto('/login-admin'); return; }
  // ← tidak verifikasi token ke backend
});
```

**Perbaikan — Tambahkan verifikasi token ke backend:**
```typescript
// Di bagian script admin/+layout.svelte, ganti onMount menjadi:

onMount(async () => {
  const user_str = localStorage.getItem('user');
  if (!user_str) {
    goto('/login-admin');
    return;
  }

  let user: { role: string; name: string };
  try {
    user = JSON.parse(user_str);
    if (user.role !== 'superadmin') {
      goto('/login-admin');
      return;
    }
  } catch {
    goto('/login-admin');
    return;
  }

  // TAMBAH: Verifikasi token ke backend untuk memastikan masih valid
  try {
    const res = await api.get('/auth/me');
    if (!res.ok) {
      // Token expired atau invalid → redirect ke login
      localStorage.removeItem('user');
      goto('/login-admin');
      return;
    }
  } catch {
    // Jika offline, percayakan localStorage sementara
    // (acceptable trade-off untuk admin yang perlu akses saat offline)
    console.warn('Cannot verify session — network offline');
  }

  is_superadmin = true;
  admin_name = user.name || 'Admin';
});
```

**Pastikan endpoint `/auth/me` ada di backend:**
```typescript
// backend/src/auth/presentation/auth.controller.ts
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@Request() req) {
  // JwtAuthGuard sudah verifikasi token, tinggal return user info
  return {
    success: true,
    data: {
      id: req.user.id,
      name: req.user.name,
      role: req.user.role,
    },
  };
}
```

---

### TINGGI-02 — Link Sidebar `/admin/users` Mengarah ke Route 404

**File:** `frontend/src/routes/admin/+layout.svelte` baris 64 (dalam array navigasi)  
**Dampak:** Klik "Manajemen Kasir" di sidebar → halaman 404

**Masalah:**
```javascript
// Di sidebar navigation array:
{ href: '/admin/users', label: 'Manajemen Kasir', icon: '...' }
// ← Route /admin/users tidak ada!
// Yang ada adalah /admin/cashiers/
```

**Perbaikan — Edit array navigasi di `admin/+layout.svelte`:**
```javascript
// SEBELUM:
{ href: '/admin/users', label: 'Manajemen Kasir', icon: '...' }

// SESUDAH:
{ href: '/admin/cashiers', label: 'Manajemen Kasir', icon: '...' }
```

Cari dan ganti `'/admin/users'` dengan `'/admin/cashiers'` di file tersebut.

---

### TINGGI-03 — Tidak Ada Swagger API Documentation

**File:** `backend/src/` (semua controller)  
**Dampak:** Endpoint API tidak terdokumentasi, frontend developer harus tebak-tebak

**Masalah:**
Dari pencarian kode, tidak ditemukan satu pun decorator `@ApiTags`, `@ApiOperation`, atau `@ApiProperty` di seluruh codebase. `setupSwagger()` ada tapi akan menampilkan daftar kosong.

**Perbaikan — Contoh untuk `orders.controller.ts`:**
```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Orders')           // ← Kelompok di Swagger UI
@ApiBearerAuth()             // ← Tandai perlu auth
@Controller('orders')
export class OrdersController {

  @Post()
  @ApiOperation({
    summary: 'Buat order baru',
    description: 'Membuat order baru dengan item dan metode pembayaran',
  })
  @ApiResponse({ status: 201, description: 'Order berhasil dibuat' })
  @ApiResponse({ status: 400, description: 'Data tidak valid' })
  @ApiResponse({ status: 401, description: 'Tidak terautentikasi' })
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }
}
```

**Perbaikan — Contoh untuk DTO:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'cash', enum: ['cash', 'qris', 'split'] })
  payment_method: string;

  @ApiProperty({
    type: [OrderItemDto],
    description: 'Daftar item yang dipesan',
  })
  items: OrderItemDto[];

  @ApiPropertyOptional({ example: 50000, description: 'Jumlah uang tunai' })
  cash_amount?: number;
}
```

**Prioritas controller yang perlu diberi Swagger terlebih dahulu:**
1. `auth.controller.ts` — login, logout, OTP
2. `orders.controller.ts` — core business flow
3. `finance.controller.ts` — shift management
4. `products.controller.ts` — product catalog

---

### TINGGI-04 — Frontend Store Tests Tidak Ada (Directory Kosong)

**File:** `frontend/src/test/stores/` (direktori kosong)  
**Dampak:** Logic paling kritis di `pos.store.svelte.ts` tidak ada test sama sekali

**Perbaikan — Buat file `frontend/src/test/stores/pos.store.test.ts`:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PosStore } from '$lib/stores/pos.store.svelte';

// Mock Svelte runes agar bisa ditest di luar Svelte
vi.mock('$lib/db', () => ({
  db: {
    cart: { delete: vi.fn() },
  },
}));

describe('PosStore', () => {
  let store: PosStore;

  beforeEach(() => {
    store = new PosStore();
  });

  // Test: Tambah produk ke keranjang
  it('menambahkan produk baru ke cart', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);

    expect(store.cart).toHaveLength(1);
    expect(store.cart[0].id).toBe('prod-1');
    expect(store.cart[0].quantity).toBe(1);
  });

  // Test: Tambah produk yang sama → qty bertambah
  it('menambahkan quantity jika produk + modifier sama', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);
    store.add_to_cart(product as any, []);

    expect(store.cart).toHaveLength(1);
    expect(store.cart[0].quantity).toBe(2);
  });

  // Test: Kalkulasi total cart
  it('menghitung cart_total dengan benar', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);
    store.add_to_cart(product as any, []);

    // 2 item × 10000 = 20000
    expect(store.cart_total).toBe(20000);
  });

  // Test: Diskon hanya berlaku pada base_price, bukan modifier
  it('menerapkan diskon hanya pada base_price', () => {
    const modifier = { id: 'mod-1', additional_price: 5000 };
    const product = {
      id: 'prod-1',
      name: 'Macaroni',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.active_discounts = [
      {
        id: 'disc-1',
        type: 'percentage',
        value: 10,
        scope: 'all_products',
        is_active: true,
        applicable_days: null,
        target_id: null,
      } as any,
    ];

    store.add_to_cart(product as any, [modifier as any]);

    // Diskon 10% dari base_price 10000 = 1000
    // Total cart: (10000 + 5000) - 1000 = 14000
    expect(store.discount_total).toBe(1000);
    expect(store.cart_total).toBe(14000);
  });

  // Test: Reset cart
  it('mereset cart dan payment state', () => {
    const product = {
      id: 'prod-1',
      name: 'Test',
      base_price: 5000,
      category_id: 'cat-1',
      modifier_groups: [],
    };
    store.add_to_cart(product as any, []);
    store.cash_amount = 50000;

    store.reset_cart();

    expect(store.cart).toHaveLength(0);
    expect(store.cash_amount).toBe(0);
  });
});
```

---

### TINGGI-05 — Warning Email Shift Tidak Terkirim

**File:** `backend/src/finance/finance.cron.ts` baris 67-76  
**Dampak:** Admin tidak dapat notifikasi ketika shift kasir hampir auto-close

**Masalah:**
```typescript
for (const shift of shiftsNearClose) {
  const minutesLeft = ...;
  this.logger.log(`Shift warning: ...`);
  // Warning email could be sent here if needed  ← tidak ada email!
}
```

**Perbaikan — Implementasi pengiriman email:**
```typescript
// Di sendAutoCloseWarnings(), ganti loop dengan:
for (const shift of shiftsNearClose) {
  const plannedClose = shift.planned_close_at;
  const minutesLeft = Math.round((plannedClose.getTime() - now.getTime()) / 60000);

  this.logger.log(
    `Shift warning: ${shift.id} closes in ${minutesLeft} minutes`,
  );

  // Kirim email peringatan ke kasir (jika punya email)
  if (shift.cashier.email) {
    await this.emailService
      .sendAlert(
        `Peringatan: Shift Anda akan otomatis ditutup dalam ${minutesLeft} menit`,
        `
          <p>Halo <strong>${shift.cashier.name}</strong>,</p>
          <p>Shift Anda akan <strong>otomatis ditutup</strong> dalam 
             <strong>${minutesLeft} menit</strong>.</p>
          <p>Mohon segera tutup shift secara manual melalui aplikasi POS 
             dan hitung uang tunai Anda.</p>
          <p>Jika Anda sudah tutup shift, abaikan pesan ini.</p>
        `,
      )
      .catch((err) =>
        this.logger.error(
          `Gagal kirim warning email ke ${shift.cashier.email}: ${err.message}`,
        ),
      );
  }
}
```

---

### TINGGI-06 — Dashboard KPI Masih Filter by `created_at` bukan Shift Range

**File:** `backend/src/finance/application/services/finance.service.ts` baris 31-59  
**Dampak:** Laporan dashboard bisa tidak akurat untuk shift yang melintasi tengah malam

**Masalah:**
```typescript
// Filter by tanggal kalender, bukan shift business date
async getDashboardKpi(date: string) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  // query pakai created_at range...
}
```

Dari PRD/CLAUDE.md: **"All reports filter by `shift_start..shift_end`, NOT `created_at::date`"**

**Perbaikan — Untuk laporan harian, cari shift yang dimulai pada tanggal tersebut:**
```typescript
async getDashboardKpi(date: string) {
  const query_date = new Date(date);
  query_date.setHours(0, 0, 0, 0);
  const query_date_end = new Date(date);
  query_date_end.setHours(23, 59, 59, 999);

  // Cari semua shift yang DIMULAI pada tanggal tersebut
  const shifts = await this.prisma.cashRegister.findMany({
    where: {
      shift_start: { gte: query_date, lte: query_date_end },
    },
    select: { id: true, shift_start: true, actual_close_at: true },
  });

  if (shifts.length === 0) {
    // Tidak ada shift pada tanggal ini
    return { revenue: 0, order_count: 0, /* ... */ };
  }

  // Ambil semua order dalam range shift-shift yang ada
  const shift_ids = shifts.map((s) => s.id);

  // Query order berdasarkan cash_register_id (lebih akurat)
  const [aggregateResult, paymentCounts] = await Promise.all([
    this.prisma.order.aggregate({
      where: {
        cash_register_id: { in: shift_ids },  // ← filter by shift
        status: { not: 'voided' },
      },
      _sum: { total_amount: true, cogs_total: true },
      _count: true,
    }),
    this.prisma.$queryRaw<{ payment_method: string; count: bigint }[]>`
      SELECT payment_method, COUNT(*)::bigint as count
      FROM orders
      WHERE cash_register_id = ANY(${shift_ids}::text[])
        AND status != 'voided'
      GROUP BY payment_method
    `,
  ]);

  // ... rest of the function
}
```

---

## 4. 🟡 Masalah Sedang (Sprint Berikutnya)

---

### SEDANG-01 — Dexie: Tidak Ada Cache Diskon untuk Mode Offline

**File:** `frontend/src/lib/db.ts`  
**Dampak:** Saat offline dan page di-refresh, data diskon hilang → harga tidak akurat

**Masalah:**
```typescript
// Hanya ada 3 tabel, tidak ada cache untuk diskon
this.version(3).stores({
  products: 'id, category_id',
  orders: 'client_uuid, sync_status, created_at',
  cart: 'id',
  // ← tidak ada discounts!
});
```

**Perbaikan:**
```typescript
// frontend/src/lib/db.ts — tambah tabel discounts
import Dexie, { type Table } from 'dexie';
import type {
  LocalProduct,
  LocalOrderItem,
  LocalOrder,
  LocalCartItem,
  Discount,         // ← tambah import
} from '$lib/domain/models/types';

export class PosDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  orders!: Table<LocalOrder, string>;
  cart!: Table<LocalCartItem, string>;
  discounts!: Table<Discount, string>;  // ← tambah ini

  constructor() {
    super('NgemilohPOSDB');
    this.version(4).stores({  // ← increment version
      products: 'id, category_id',
      orders: 'client_uuid, sync_status, created_at',
      cart: 'id',
      discounts: 'id, is_active',  // ← tambah ini
    });
  }
}

export const db = new PosDatabase();
```

**Update `pos.service.ts` agar simpan diskon ke Dexie:**
```typescript
async fetch_discounts() {
  try {
    const res = await api.get(`/admin/discounts`);
    if (res.ok) {
      const json: ApiResponse<Discount[]> = await res.json();
      if (json.success) {
        pos_store.active_discounts = json.data.filter((d) => d.is_active);

        // Simpan ke Dexie untuk mode offline
        await db.discounts.clear();
        await db.discounts.bulkAdd(json.data);
      }
    } else {
      console.warn('Failed to fetch discounts:', res.status);
      // Fallback: load dari Dexie jika offline
      const cached = await db.discounts.where('is_active').equals(1).toArray();
      pos_store.active_discounts = cached;
    }
  } catch {
    console.warn('Offline: loading discounts from local cache');
    const cached = await db.discounts.toArray();
    pos_store.active_discounts = cached.filter((d) => d.is_active);
  }
}
```

---

### SEDANG-02 — `confirm()` Native Dialog di Inventory (UX Buruk)

**File:** `frontend/src/routes/admin/inventory/+page.svelte` baris 42-45  
**Dampak:** Dialog konfirmasi tidak bisa di-style, tidak konsisten dengan design system

**Masalah:**
```typescript
// Browser native popup, tidak bisa di-style
if (!confirm('Apakah Anda yakin...?')) return;
```

**Perbaikan — Tambahkan variabel konfirmasi inline:**
```svelte
<script lang="ts">
  // Tambahkan state untuk konfirmasi
  let show_confirm_opname = $state(false);
</script>

<!-- Ganti confirm() dengan modal sederhana -->
<!-- Tombol submit: -->
<button
  onclick={() => (show_confirm_opname = true)}
  class="..."
>
  Simpan Opname
</button>

<!-- Modal konfirmasi: -->
{#if show_confirm_opname}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-slate-800 mb-2">Konfirmasi Opname</h3>
      <p class="text-slate-600 text-sm mb-6">
        Stok sistem akan diperbarui secara permanen sesuai hitungan fisik.
        Tindakan ini tidak dapat dibatalkan.
      </p>
      <div class="flex gap-3">
        <button
          onclick={() => (show_confirm_opname = false)}
          class="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          onclick={async () => {
            show_confirm_opname = false;
            await submitOpname();
          }}
          class="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700"
        >
          Ya, Simpan
        </button>
      </div>
    </div>
  </div>
{/if}
```

---

### SEDANG-03 — Profit Share: HPP Selalu 0

**File:** `frontend/src/routes/admin/profit-share/+page.svelte` baris 106  
**Dampak:** Kalkulasi bagi hasil owner vs kasir tidak akurat

**Status:** Disebutkan di UI bahwa HPP belum akurat karena BOM belum dikonfigurasi.

**Perbaikan jangka pendek — Tampilkan warning yang lebih jelas:**
```svelte
<!-- Tambahkan warning banner di profit-share page -->
{#if hppIsZero}
  <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
    <div class="flex items-start gap-3">
      <svg class="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
      </svg>
      <div>
        <p class="font-medium text-amber-800">HPP Belum Dikonfigurasi</p>
        <p class="text-sm text-amber-700 mt-1">
          Nilai HPP (Harga Pokok Penjualan) masih Rp 0 karena resep BOM belum diisi.
          Pergi ke menu <a href="/admin/inventory" class="underline font-medium">Bahan Baku</a>
          dan lengkapi resep BOM untuk setiap produk agar kalkulasi profit akurat.
        </p>
      </div>
    </div>
  </div>
{/if}
```

**Perbaikan jangka panjang:** Wiring BOM → HPP di `finance.service.ts` saat kalkulasi profit share.

---

### SEDANG-04 — `sendAutoCloseWarnings` Cron Jalan Tanpa Efek

**File:** `backend/src/finance/finance.cron.ts` baris 46-77  
**Dampak:** Query database setiap 15 menit tapi tidak melakukan apapun yang useful

Sudah tercakup di **TINGGI-05** di atas. Implementasi email warning adalah solusinya.

---

### SEDANG-05 — Dashboard KPI Filter Salah (Gunakan `created_at` bukan Shift Range)

Sudah tercakup di **TINGGI-06** di atas.

---

### SEDANG-06 — `hooks.server.ts` Guard Tidak Efektif untuk Static SPA

**File:** `frontend/src/hooks.server.ts`  
**Dampak:** Guard hanya berlaku jika ada SSR, tapi frontend adalah static SPA

**Penjelasan:**
```typescript
// Guard ini TIDAK berjalan saat user navigasi ke /admin/dashboard
// karena SvelteKit static adapter = semua halaman adalah file HTML statis
// yang di-serve langsung oleh Caddy
export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  if (path.startsWith('/api/v1/admin')) {
    // Ini hanya berlaku untuk API proxy calls, bukan navigasi halaman
  }
  return resolve(event);
};
```

**Catatan:** Untuk static SPA, auth harus dilakukan di client-side (onMount) atau dengan SSR. Karena backend NestJS sudah menggunakan JWT guard, data tetap aman. Yang perlu diperbaiki adalah UX (halaman admin tidak tampil ke non-admin), bukan security data.

**Perbaikan minimal (sudah cukup aman):** Pastikan onMount di `admin/+layout.svelte` sudah melakukan verifikasi token ke backend (lihat TINGGI-01).

---

## 5. 🟢 Masalah Rendah (Nice to Have)

---

### RENDAH-01 — Private Key SSH Ada di Root Project

**File:** `ngemiloh-key.pem`, `ngemiloh-key.ppk` (root project)  
**Dampak:** Risiko accidental commit jika `.gitignore` lupa di-update

**Perbaikan:**
```bash
# Pindahkan ke ~/.ssh/ (di luar project)
mv c:/POS_Nabil/ngemiloh-key.pem ~/.ssh/
mv c:/POS_Nabil/ngemiloh-key.ppk ~/.ssh/

# Verifikasi sudah ada di .gitignore
grep "ngemiloh-key" .gitignore
```

---

### RENDAH-02 — Codecov Upload Di-Disable di CI

**File:** `.github/workflows/ci.yml`  
**Masalah:** Step Codecov di-comment out. `codecov.yml` ada tapi tidak terpakai.

**Perbaikan:**
```
1. Daftar di codecov.io dengan akun GitHub
2. Dapatkan CODECOV_TOKEN dari dashboard Codecov
3. Tambahkan ke GitHub Secrets:
   Repository → Settings → Secrets → Actions → New secret
   Name: CODECOV_TOKEN
   Value: [token dari Codecov]
4. Uncomment step upload di ci.yml
```

---

### RENDAH-03 — Backup Tidak Otomatis

**File:** `scripts/backup.sh`  
**Masalah:** Script bagus tapi tidak ada cron yang menjalankannya otomatis.

**Perbaikan — Tambahkan cron di server (setelah deploy):**
```bash
# Jalankan di server production
crontab -e

# Tambahkan baris berikut:
# Backup setiap hari jam 02:00 WIB
0 2 * * * /path/to/project/scripts/backup.sh >> /var/log/ngemiloh-backup.log 2>&1
```

---

### RENDAH-04 — Monitoring Script Tidak Auto-Deploy

**File:** `scripts/health-monitor.sh`, `scripts/monitor.sh`  
**Masalah:** Script monitoring ada tapi tidak ada cron otomatis.

**Perbaikan — Setup cron di server:**
```bash
# Cek kesehatan setiap 5 menit
*/5 * * * * /path/to/project/scripts/health-monitor.sh >> /var/log/ngemiloh-monitor.log 2>&1
```

---

### RENDAH-05 — k6 Load Test Tidak Ada Auth

**File:** `tests/k6/load_test.js`  
**Masalah:** Request ke `/api/v1/orders` tanpa token → selalu 401 → test tidak valid.

**Perbaikan:**
```javascript
// tests/k6/load_test.js
import http from 'k6/http';
import { check } from 'k6';

// Login dulu untuk dapatkan token
export function setup() {
  const login_res = http.post(
    `${__ENV.BASE_URL}/api/v1/auth/kasir/login`,
    JSON.stringify({ username: 'kasir1', pin: '1234' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const token = login_res.json('data.access_token');
  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  const res = http.get(`${__ENV.BASE_URL}/api/v1/products`, { headers });
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

---

### RENDAH-06 — SAST/DAST Tidak Terintegrasi di CI

**File:** `.github/workflows/ci.yml`  
**Masalah:** `sast_scan.js` dan `dast_scan.js` tidak dijalankan di CI.

**Perbaikan — Tambahkan job di ci.yml:**
```yaml
# Tambahkan job baru setelah job 'security':
sast:
  name: SAST Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - name: Run SAST scan
      run: node tests/sast_scan.js
```

---

### RENDAH-07 — Tidak Ada `docker-compose.prod.yml`

**File:** Root project  
**Masalah:** `Caddyfile.prod` ada (dengan security headers lengkap) tapi tidak pernah dipakai otomatis karena Caddy Dockerfile meng-copy `Caddyfile` (dev config).

**Perbaikan — Update `docker/caddy.Dockerfile`:**
```dockerfile
# Cari baris COPY Caddyfile, ganti dengan:

# Untuk production, gunakan Caddyfile.prod
ARG CADDY_ENV=production
COPY Caddyfile.prod /etc/caddy/Caddyfile
# (atau buat logika: jika development, copy Caddyfile; jika production, copy Caddyfile.prod)
```

---

### RENDAH-08 — `data/postgres_init/` Kosong

**File:** `data/postgres_init/` (direktori kosong)  
**Masalah:** Di-mount ke Docker tapi kosong, membingungkan.

**Perbaikan — Tambahkan file README:**
```bash
# Buat file data/postgres_init/README.md dengan isi:
# Direktori ini untuk SQL scripts inisialisasi PostgreSQL.
# File .sql di sini dijalankan SEKALI saat container pertama kali dibuat.
# Contoh: 01_extensions.sql untuk enable extensions.
# Saat ini tidak diperlukan karena Prisma migrate sudah menangani schema.
```

---

### RENDAH-09 — robots.txt Perlu Di-Update

**File:** `frontend/static/robots.txt`  
**Perbaikan:**
```
# frontend/static/robots.txt
# Blokir semua bot — ini adalah aplikasi internal
User-agent: *
Disallow: /
```

---

## 6. Fitur yang Belum Dibangun

---

### MISSING-01 — 🔴 Modul Member & Loyalty (HIGH Priority)

**Status:** Model `Customer` ada di Prisma schema, tapi tidak ada API endpoint atau UI.

**Yang perlu dibangun:**

**Backend — Buat module `members/`:**
```
backend/src/members/
├── members.module.ts
├── application/services/members.service.ts
├── presentation/members.controller.ts
└── presentation/dto/members.dto.ts
```

**Endpoint yang dibutuhkan:**
```
POST   /api/v1/members          — Daftar member baru
GET    /api/v1/members          — List semua member (admin)
GET    /api/v1/members/:phone   — Cari member by nomor HP
PATCH  /api/v1/members/:id/points — Update points setelah transaksi
```

**Logika tier (dari PRD):**
```typescript
// Kalkulasi tier berdasarkan total points bulan berjalan
function getTier(points_this_month: number): 'bronze' | 'silver' | 'gold' {
  if (points_this_month >= 1000) return 'gold';
  if (points_this_month >= 500) return 'silver';
  return 'bronze';
}

// Poin diberikan: 1 poin per Rp 1000 belanja
function calculatePoints(total_amount: number): number {
  return Math.floor(total_amount / 1000);
}
```

**Frontend — Buat route `/admin/members/`:**
```
frontend/src/routes/admin/members/
└── +page.svelte   — List member + search by HP + detail points
```

---

### MISSING-02 — 🟠 BOM Recipes Belum Terhubung ke HPP

**Status:** Model `BomRecipe` ada di schema, tapi kalkulasi HPP di profit-share belum menggunakannya.

**Yang perlu dibangun di `finance.service.ts`:**
```typescript
// Tambahkan fungsi kalkulasi HPP berdasarkan BOM
async calculateHppForPeriod(start_date: Date, end_date: Date): Promise<number> {
  // Ambil semua order dalam periode
  const orders = await this.prisma.order.findMany({
    where: {
      created_at: { gte: start_date, lt: end_date },
      status: 'completed',
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              bom_recipes: {
                include: { raw_material: true },
              },
            },
          },
        },
      },
    },
  });

  let total_hpp = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const product_hpp = item.product.bom_recipes.reduce((sum, bom) => {
        // HPP per unit = quantity_needed × current_price raw material
        const material_cost =
          Number(bom.quantity_needed) * Number(bom.raw_material.current_price);
        return sum + material_cost;
      }, 0);

      total_hpp += product_hpp * item.quantity;
    }
  }

  return total_hpp;
}
```

---

### MISSING-03 — 🟠 Waste Tracking UI

**Status:** Model `StockMovement` ada (`type: 'waste'`), tapi tidak ada UI untuk input waste harian.

**Yang perlu dibangun:**

Tambahkan tab "Waste" di halaman `/admin/inventory/+page.svelte`:
```svelte
<!-- Form input waste -->
<div class="rounded-xl bg-white p-6 shadow-sm">
  <h2 class="text-lg font-bold mb-4">Input Waste / Kerusakan</h2>
  
  <div class="grid gap-4">
    <select bind:value={waste_material_id} class="input">
      {#each materials as m}
        <option value={m.id}>{m.name} (Stok: {m.stock} {m.unit})</option>
      {/each}
    </select>
    
    <input
      type="number"
      bind:value={waste_quantity}
      placeholder="Jumlah waste"
      class="input"
    />
    
    <input
      type="text"
      bind:value={waste_note}
      placeholder="Keterangan (contoh: bahan expired)"
      class="input"
    />
    
    <button onclick={submitWaste} class="btn-primary">
      Catat Waste
    </button>
  </div>
</div>
```

---

### MISSING-04 — 🟡 Check-in System (Partial)

**Status:** Disebutkan di CLAUDE.md sebagai "⚠️ Partial". Perlu investigasi lebih lanjut apa yang sudah ada.

**Rekomendasi:** Prioritaskan Member (MISSING-01) terlebih dahulu karena lebih berdampak ke bisnis.

---

## 7. Status Implementasi Semua Modul

### Backend

| Module | File | Status | Catatan |
|--------|------|--------|---------|
| `auth/` | auth.service.ts (18KB) | ✅ Complete | PIN, OTP, JWT, lockout |
| `products/` | — | ✅ Complete | CRUD + modifiers + image |
| `orders/` | orders.service.ts (39KB) | ✅ Complete | State machine, sync-batch, SSE |
| `payment/` | midtrans-gateway.service.ts | ✅ Complete | Midtrans + fake gateway |
| `finance/` | finance.service.ts (22KB) | ✅ Mostly | Bug filter shift di dashboard |
| `discounts/` | — | ✅ Complete | Cron + scheduled discounts |
| `users/` | — | ✅ Complete | CRUD, PIN change |
| `inventory/` | inventory.service.ts (7KB) | ✅ Complete | Stock, BOM, opname |
| `audit/` | — | ✅ Complete | Global interceptor |
| `receipts/` | — | ✅ Complete | Receipt generation |
| `email/` | email.service.ts (5KB) | ✅ Complete | Nodemailer OTP + alerts |
| `jobs/` | email.processor + sync.processor | ✅ Complete | BullMQ processors |
| `flags/` | — | ✅ Complete | Feature flags CRUD |
| `finance.cron.ts` | — | ⚠️ Bug | Auto-close tanpa boundary, warning email tidak terkirim |
| `members/` | — | ❌ Missing | Tidak ada sama sekali |
| `loyalty/` | — | ❌ Missing | Tidak ada |

### Frontend Routes

| Route | File Size | Status | Catatan |
|-------|-----------|--------|---------|
| `/login` | 8.2KB | ✅ Complete | PIN kasir |
| `/login-admin` | — | ✅ Complete | Email + OTP |
| `/pos` | 6.3KB | ✅ Complete | Core POS flow |
| `/shift` | — | ✅ Complete | Open/close shift |
| `/change-pin` | — | ✅ Complete | Ganti PIN |
| `/admin/dashboard` | 8.7KB | ✅ Complete | KPI cards |
| `/admin/products` | 20.6KB | ✅ Complete | CRUD + modifiers |
| `/admin/categories` | — | ✅ Complete | |
| `/admin/transactions` | — | ✅ Complete | |
| `/admin/shifts` | — | ✅ Complete | |
| `/admin/cash` | — | ✅ Complete | |
| `/admin/cashiers` | — | ✅ Complete | |
| `/admin/analytics` | — | ✅ Complete | Chart.js |
| `/admin/discounts` | — | ✅ Complete | |
| `/admin/inventory` | 7.7KB | ✅ Complete | Opname mode |
| `/admin/profit-share` | — | ⚠️ Partial | HPP = 0 |
| `/admin/opex` | — | ✅ Complete | |
| `/admin/assets` | — | ✅ Complete | |
| `/admin/reports` | — | ✅ Complete | Export |
| `/admin/settings` | — | ✅ Complete | + flags sub-route |
| `/admin/system-logs` | — | ✅ Complete | |
| `/admin/system-health` | — | ✅ Complete | |
| `/admin/audit-logs` | — | ✅ Complete | |
| `/admin/users` | — | ❌ 404 | Link sidebar salah |
| `/admin/members` | — | ❌ Missing | Belum dibangun |

### Testing

| Jenis Test | File | Status | CI? |
|------------|------|--------|-----|
| Backend unit (auth) | auth.service.spec.ts | ✅ | ✅ |
| Backend unit (orders) | orders.service.spec.ts (49KB) | ✅ | ✅ |
| Backend unit (finance) | finance.service.spec.ts | ✅ | ✅ |
| Backend unit (inventory) | inventory.service.spec.ts | ✅ | ✅ |
| Backend unit (payment) | midtrans-gateway.service.spec.ts | ✅ | ✅ |
| Backend unit (users) | users.service.spec.ts | ✅ | ✅ |
| Backend E2E (app) | app.e2e-spec.ts | ✅ | ✅ |
| Backend E2E (orders) | orders.e2e-spec.ts (262 baris) | ✅ | ✅ |
| Frontend unit (api.client) | api.client.test.ts (529 baris) | ✅ | ✅ |
| Frontend store tests | test/stores/ | ❌ Kosong | ❌ |
| Frontend component tests | — | ❌ Tidak ada | ❌ |
| E2E comprehensive | tests/e2e_test.js | ✅ | ❌ Manual |
| SAST | tests/sast_scan.js | ✅ | ❌ Manual |
| DAST | tests/dast_scan.js | ✅ | ❌ Manual |
| Load (k6) | tests/k6/load_test.js | ⚠️ No auth | ❌ Manual |

---

## 8. Checklist Perbaikan

Gunakan checklist ini untuk tracking progress perbaikan:

### 🔴 Kritis (Selesaikan Ini Dulu)

- [ ] **KRITIS-01** — Fix CI path: `./Caddy.Dockerfile` → `./docker/caddy.Dockerfile`
- [ ] **KRITIS-02** — Buat `frontend/.env.example` + Update Caddy Dockerfile + GitHub Secret `VITE_API_URL`
- [ ] **KRITIS-03** — Fix `finance.cron.ts` `autoCloseShift()`: tambah `lt: auto_close_time`
- [ ] **KRITIS-04** — Fix logout POS: ganti `<a>` dengan `<button>` + endpoint `/auth/logout`

### 🟠 Tinggi (Sprint Ini)

- [ ] **TINGGI-01** — Tambahkan verifikasi token ke backend di `admin/+layout.svelte` onMount
- [ ] **TINGGI-02** — Fix sidebar link: `/admin/users` → `/admin/cashiers`
- [ ] **TINGGI-03** — Tambahkan `@ApiTags` & `@ApiOperation` ke semua controller (minimal 4 controller utama)
- [ ] **TINGGI-04** — Buat file `frontend/src/test/stores/pos.store.test.ts`
- [ ] **TINGGI-05** — Implementasi email warning di `sendAutoCloseWarnings()`
- [ ] **TINGGI-06** — Fix `getDashboardKpi()`: filter by shift range bukan `created_at` date

### 🟡 Sedang (Sprint Berikutnya)

- [ ] **SEDANG-01** — Tambah tabel `discounts` di Dexie (upgrade ke version 4)
- [ ] **SEDANG-02** — Ganti `confirm()` dengan modal konfirmasi custom di inventory
- [ ] **SEDANG-03** — Tampilkan warning HPP=0 yang lebih actionable di profit-share
- [ ] **MISSING-01** — Bangun modul Member & Loyalty (backend API + frontend UI)
- [ ] **MISSING-02** — Wire BOM → HPP di kalkulasi profit share

### 🟢 Rendah (Backlog)

- [ ] **RENDAH-01** — Pindahkan private key SSH keluar dari folder project
- [ ] **RENDAH-02** — Setup Codecov token di GitHub Secrets
- [ ] **RENDAH-03** — Setup cron backup otomatis di server
- [ ] **RENDAH-04** — Setup cron monitoring otomatis di server
- [ ] **RENDAH-05** — Fix k6 load test dengan auth token
- [ ] **RENDAH-06** — Tambahkan SAST job ke CI pipeline
- [ ] **RENDAH-07** — Fix Caddy Dockerfile pakai `Caddyfile.prod` bukan `Caddyfile`
- [ ] **RENDAH-08** — Tambah README di `data/postgres_init/`
- [ ] **RENDAH-09** — Update `robots.txt` dengan `Disallow: /`
- [ ] **MISSING-03** — Tambah UI Waste Tracking di inventory page
- [ ] **MISSING-04** — Selesaikan Check-in System

---

## Hal-Hal yang Sudah Berjalan Baik ✅

| Area | Detail |
|------|--------|
| **Arsitektur Backend** | Clean Architecture konsisten (domain/application/infrastructure/presentation) |
| **POS Core Flow** | Produk → Keranjang → Bayar (cash/QRIS/split) → Struk — lengkap |
| **Offline-First** | Dexie + sync queue + exponential backoff retry |
| **QRIS SSE + Polling** | Dual strategy (SSE primary, polling fallback) untuk real-time |
| **Docker Security** | Hardening excellent: cap_drop ALL, read_only, non-root, network isolation |
| **Backup System** | Encrypted + verified + retention + alert via Telegram |
| **Auth System** | PIN kasir + OTP admin, JWT, brute force protection (IpLockout) |
| **Logika Diskon** | Context-aware priority (specific > category > all), hanya pada base_price |
| **Shift Carry-Over** | Opening balance otomatis dari closing balance shift sebelumnya |
| **Audit Trail** | Global interceptor untuk semua mutating request |
| **CI Pipeline** | 8-job comprehensive (minus path bug) |
| **Dokumentasi** | PRD, API Contract, ADR, Runbook, Secrets Guide — sangat lengkap |

---

*Laporan ini dibuat berdasarkan analisis menyeluruh seluruh file dan folder project pada 2026-06-20.*
