# MASTER PRD NGEMILOH POS - FINAL (SINGLE SOURCE OF TRUTH)

Dokumen ini adalah penggabungan (Master Document) dari seluruh tahap spesifikasi Frontend dan Backend yang telah disepakati melalui proses *brainstorming*. Jadikan file tunggal ini sebagai panduan utama Anda dalam mengeksekusi proyek.

---

# BAGIAN 1: TAHAP 1 FRONTEND (VERSI LENGKAP)

Berdasarkan penemuan dokumen di folder `Referensi` (`FRONTEND_ARCH_FINAL.md` dan `API_CONTRACT_FINAL.md`), dokumen ini merupakan spesifikasi **paling komprehensif** untuk Frontend, mencakup perbaikan *bug* krusial yang sebelumnya tertinggal.

## 1. Penambahan Krusial (Berdasarkan Audit Final)
1. **Hybrid Printer Fallback (Bug Krusial)**: Pada versi sebelumnya, jika koneksi Bluetooth Web API gagal, kasir tidak bisa mencetak struk sama sekali. Kita wajib menambahkan tombol "Print via Browser" di komponen `Modals.svelte`.
2. **Formula Diskon TINGGI-04**: Diskon dipastikan hanya memotong `base_price` (harga dasar), tanpa menyentuh harga modifier/topping.
3. **API Client Singleton**: Wajib memiliki penanganan 401 Unauthorized yang otomatis menghapus token dari `localStorage` dan melakukan redirect ke `/login`.

## 2. Kode Final yang Harus Diterapkan

### A. Perbaikan Hybrid Printer di `Modals.svelte` (Bagian Success Modal)
File: `src/lib/components/pos/Modals.svelte`

Untuk mengatasi kegagalan cetak Bluetooth, pada tampilan "Transaksi Berhasil" (Success Modal), ubah kode tombol cetak menjadi 2 tombol:

```svelte
<!-- Di dalam blok showSuccessModal -->
<div class="mt-8 flex flex-col sm:flex-row gap-3">
    <button
        onclick={() => { posStore.resetPos(); }}
        class="flex-1 py-4 px-6 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
    >
        PESANAN BARU
    </button>
    
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
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        PRINT BLUETOOTH
    </button>

    <!-- PENTING: Tombol Fallback HTML Print Dialog -->
    <a
        href="/pos/print"
        class="py-4 px-6 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 active:scale-95 transition-all flex justify-center items-center"
    >
        PRINT BROWSER
    </a>
</div>
```

### B. Singleton API Client (`src/lib/services/api.client.ts`)
Komponen HTTP Client ini sangat vital karena mengatur header CSRF, timeout, dan pencegatan error 401.

```typescript
export class ApiClient {
	private baseUrl = import.meta.env.VITE_API_URL || 'https://api.103-150-227-117.nip.io';
	private defaultTimeout = 30000;

	private getAuthToken(isAdminRoute: boolean): string | null {
		if (typeof window === 'undefined') return null;
		return isAdminRoute ? localStorage.getItem('admin_token') : localStorage.getItem('access_token');
	}

	async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeout);
		
		const isAdminRoute = endpoint.includes('/admin/');
		const token = this.getAuthToken(isAdminRoute);
		
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...options.headers
		};

		if (token) { headers['Authorization'] = `Bearer ${token}`; }

		// CSRF Token logic for mutating requests
		const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET');
		if (isMutating && typeof window !== 'undefined') {
			const csrf = this.getCookie('csrf_token');
			if (csrf) headers['X-CSRF-Token'] = csrf;
		}

		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers, signal: controller.signal });
			
			// Auto logout jika token expired / invalid
			if (response.status === 401 && typeof window !== 'undefined') {
				localStorage.removeItem(isAdminRoute ? 'admin_token' : 'access_token');
				window.location.href = isAdminRoute ? '/login-admin' : '/login';
			}
			return response;
		} catch (error: any) {
			// [TAMBAHAN BRAINSTORMING]: Offline Catch Interceptor
			if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
				if (isMutating && typeof window !== 'undefined') {
					console.warn('Network offline, saving to Dexie queue:', endpoint);
					// Logic: await db.syncQueue.add({ endpoint, payload: options.body });
					return new Response(JSON.stringify({ offline: true }), { status: 202 });
				}
			}
			if (error.name === 'AbortError') { throw new Error('Request Timeout'); }
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private getCookie(name: string): string | null {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
		return null;
	}
}

export const api = new ApiClient();
```

### C. Layout Penjaga Rute Admin (`src/routes/admin/+layout.svelte`)
Guard ini krusial untuk mencegah kasir mengakses halaman admin, membaca role langsung dari localStorage.

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let isAuthenticated = $state(false);

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
		}
	});
</script>

{#if isAuthenticated}
	<div class="flex h-screen bg-slate-50 overflow-hidden">
		<!-- Sidebar Komponen Admin di sini -->
		<main class="flex-1 overflow-y-auto">
			<slot />
		</main>
	</div>
{:else}
	<div class="h-screen w-full flex items-center justify-center bg-slate-50">
		<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
	</div>
{/if}
```

---

# BAGIAN 2: DESAIN REFACTORING MODALS (FRONTEND)

Spesifikasi Desain untuk mengeksekusi pemecahan file raksasa `Modals.svelte` (723 baris) menggunakan pendekatan **Centralized Modal Manager**.

## 1. Arsitektur Struktur Folder Baru
File tunggal `Modals.svelte` akan dihapus dan digantikan oleh struktur berikut di dalam `src/lib/components/pos/`:

```text
src/lib/components/pos/
├── ModalManager.svelte       (Pengganti Modals.svelte)
└── modals/                   (Folder baru khusus modal)
    ├── ShiftModal.svelte     (Gabungan Open & Close Shift)
    ├── ModifierModal.svelte
    ├── PaymentModal.svelte
    ├── QrisWaitModal.svelte
    ├── SuccessModal.svelte   (Dengan tombol Fallback HTML Print)
    └── HistoryModal.svelte
```

## 2. Alur Data (Data Flow)
1. Logika *State* tetap **TIDAK BERUBAH** di `pos.store.svelte.ts`. Flag seperti `posStore.showPaymentModal` tetap digunakan.
2. `ModalManager.svelte` akan bertugas membaca flag-flag tersebut secara reaktif.
3. Saat sebuah flag bernilai `true`, `ModalManager` akan memuat (mount) dan me-render komponen dari folder `modals/`.
4. Komponen anak (contoh: `PaymentModal`) langsung berinteraksi dengan `posStore` dan `api.client.ts` tanpa perlu proses *props drilling*.

## 3. Implementasi Kode Utama

### A. Komponen Pusat (`ModalManager.svelte`)
Buat file ini di `src/lib/components/pos/ModalManager.svelte`. File ini yang akan di-import ke `routes/pos/+page.svelte`.

```svelte
<script lang="ts">
	import { posStore } from '$lib/stores/pos.store.svelte';
	
	// Import pecahan modal
	import ShiftModal from './modals/ShiftModal.svelte';
	import ModifierModal from './modals/ModifierModal.svelte';
	import PaymentModal from './modals/PaymentModal.svelte';
	import QrisWaitModal from './modals/QrisWaitModal.svelte';
	import SuccessModal from './modals/SuccessModal.svelte';
	import HistoryModal from './modals/HistoryModal.svelte';
</script>

<!-- Centralized Logic: Render sesuai flag aktif dari posStore -->
{#if !posStore.hasOpenShift && !posStore.isCheckingShift}
	<ShiftModal mode="open" />
{/if}

{#if posStore.showCloseShiftModal}
	<ShiftModal mode="close" />
{/if}

{#if posStore.showModifierModal}
	<ModifierModal />
{/if}

{#if posStore.showPaymentModal}
	<PaymentModal />
{/if}

{#if posStore.isWaitingQris}
	<QrisWaitModal />
{/if}

{#if posStore.showSuccessModal}
	<SuccessModal />
{/if}

{#if posStore.showHistoryModal}
	<HistoryModal />
{/if}
```

### B. Contoh Pemecahan: `SuccessModal.svelte`
Buat di `src/lib/components/pos/modals/SuccessModal.svelte`. 

```svelte
<script lang="ts">
	import { posStore } from '$lib/stores/pos.store.svelte';
	import { printerService } from '$lib/services/printer.service';
	
	function close() {
		posStore.resetPos();
	}
	
	async function printBluetooth() {
		if (posStore.lastOrderDetails) {
			const receiptText = printerService.formatReceipt(posStore.lastOrderDetails);
			const printed = await printerService.connectAndPrint(receiptText);
			if (!printed) {
				alert("Koneksi Bluetooth gagal. Gunakan tombol 'Print Browser'.");
			}
		}
	}
</script>

<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
	<div class="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-8 text-center">
		
		<div class="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
			<svg class="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
		</div>
		
		<h3 class="text-3xl font-black text-slate-800 mb-2">Pembayaran Berhasil!</h3>
		<p class="text-slate-500 mb-8 font-bold">Transaksi telah tersimpan ke sistem.</p>
		
		<div class="flex flex-col sm:flex-row gap-3">
			<button onclick={close} class="flex-1 py-4 px-6 border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50">
				PESANAN BARU
			</button>
			
			<button onclick={printBluetooth} class="flex-1 py-4 px-6 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700">
				PRINT BLUETOOTH
			</button>
			
			<!-- FALLBACK HYBRID PRINTER -->
			<a href="/pos/print" class="py-4 px-6 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 flex justify-center items-center">
				PRINT BROWSER
			</a>
		</div>
	</div>
</div>
```

---

# BAGIAN 3: TAHAP 2 BACKEND (NESTJS) & DATABASE

Sesuai hasil *brainstorming*, dokumen ini telah diadaptasi khusus untuk mengakomodasi realitas operasional kasir fisik dengan pola **Trust but Verify**.

## 1. Arsitektur Infrastruktur Dasar
1. **Framework Utama**: NestJS.
2. **Database & ORM**: PostgreSQL diakses langsung menggunakan **Prisma ORM** (PgBouncer dihapus).
3. **Web Server/Proxy**: **Caddy Web Server** (VPS `103.150.227.117`). Caddy akan mengatur HTTPS otomatis via `nip.io`.

## 2. Pembaruan Skema Database (Prisma)
Sesuaikan file `schema.prisma` Anda untuk mengakomodasi *Split Payment* dan penanda diskrepansi.

```prisma
model Order {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id           String        @db.Uuid
  client_uuid          String        @unique @db.Uuid // [PENTING] Kunci Idempotency
  transaction_number   String?       @unique @db.VarChar(20)
  customer_name        String?       @db.VarChar(100) // Antrean
  total_amount         Decimal       @db.Decimal(12, 2)
  
  // Pembayaran
  payment_method       PaymentMethod @default(cash) // enum: cash, qris, split
  cash_amount          Decimal       @default(0) @db.Decimal(12, 2) 
  qris_amount          Decimal       @default(0) @db.Decimal(12, 2) 
  
  status               OrderStatus   @default(completed)
  synced_from_offline  Boolean       @default(false)
  verification_status  String?       @db.VarChar(20) // [KRUSIAL] Untuk "Trust but Verify"
  
  client_created_at    DateTime      @db.Timestamptz
  created_at           DateTime      @default(now()) @db.Timestamptz

  cashier User @relation("CashierOrders", fields: [cashier_id], references: [id])
  items   OrderItem[]
}
```

## 3. Aturan Bisnis & Validasi Layanan (Service Layer)

### A. Idempotency (Pencegah Duplikasi Data)
Backend harus mengecek `client_uuid` dari `Order` menggunakan `SELECT ... FOR UPDATE` dalam sebuah Transaction untuk mencegah *race condition*.

```typescript
// Contoh Logic di TransactionsService.ts
async function processOrderSync(data: CreateOrderDto, prismaTx: Prisma.TransactionClient) {
  try {
      // [TAMBAHAN BRAINSTORMING]: Langsung tembak INSERT
      const newOrder = await prismaTx.order.create({
          data: { /* mapping data dari frontend */ }
      });
      return newOrder;
  } catch (error: any) {
      // Prisma P2002 = Unique constraint failed
      if (error.code === 'P2002' && error.meta?.target?.includes('client_uuid')) {
          // Idempotent: Abaikan secara elegan karena data sudah ada
          return { status: 'already_synced', client_uuid: data.client_uuid };
      }
      throw error;
  }
}
```

### B. Validasi Formula Diskon (TINGGI-04)
Diskon HANYA memotong harga `base_price` (bukan modifier). Backend NestJS wajib melakukan kalkulasi ulang untuk memverifikasi hitungan Frontend.

```typescript
// Kalkulasi bayangan di Backend:
const baseTotal = item.base_price * item.quantity;
let discount_amount = 0;
if (discount_id) {
    discount_amount = discount.type === 'percentage' ? baseTotal * (discount.value / 100) : discount.value * item.quantity;
}
const modifier_total = item.modifiers.reduce((sum, mod) => sum + mod.additional_price, 0);
const server_subtotal = (baseTotal - discount_amount) + (modifier_total * item.quantity);
```

### C. Pola Sinkronisasi Offline: "Trust but Verify" 🌟
Inilah *core logic* untuk endpoint `/orders/sync-batch`. Backend **TIDAK BOLEH** menolak transaksi, melainkan menerima berapapun harga yang disubmit oleh kasir, untuk menjaga akurasi uang fisik di laci.

```typescript
// 1. Backend melakukan kalkulasi bayangan (seperti di atas)
const server_calculated_total = calculateTotal(orderItemsData);

// 2. Bandingkan dengan apa yang dilaporkan aplikasi Kasir (Frontend)
const client_reported_total = data.client_final_price;

// 3. Trust but Verify Logic
let vStatus = 'Valid';
if (server_calculated_total !== client_reported_total) {
    // Harga tidak cocok (mungkin master harga berubah saat kasir offline).
    // KITA MENGALAH pada Kasir (Trust), tapi ditandai (Verify).
    vStatus = 'Perlu Cek';
    
    // Opsional: Log alert untuk Admin
    this.logger.warn(`Discrepancy on Order ${data.client_uuid}. Server: ${server_calculated_total}, Client: ${client_reported_total}`);
}

// 4. Insert ke DB MENGGUNAKAN HARGA KASIR (Client)
await prismaTx.order.create({
    data: {
        total_amount: client_reported_total,
        verification_status: vStatus, // Terisi 'Valid' atau 'Perlu Cek'
        // ... sisa data
    }
});
```

### D. Pola Autentikasi Baru (Simplifikasi D-01)
* Jangan gunakan *Refresh Token*.
* `POST /api/v1/auth/login/cashier` (PIN 4 digit) → *Return* JWT (Kedaluwarsa 20 jam).
* `POST /api/v1/auth/login` (Admin: email & pass) → *Return* JWT (Kedaluwarsa 12 jam).

## 4. Rangkuman Endpoint Utama

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/api/v1/auth/login/cashier` | Auth Kasir |
| POST | `/api/v1/cash/open` | Buka Shift (Insert ke `CashRegister`) |
| POST | `/api/v1/orders/sync-batch` | Endpoint "Trust but Verify" untuk array transaksi. |
| GET | `/api/v1/orders/:id/status` | Polling Status QRIS dari Frontend. |

---

# BAGIAN 4: BLUEPRINT EKSEKUSI FINAL (LANGKAH BERTAHAP)

Bagian ini memuat tahapan eksekusi secara bertahap (Step-by-Step) berdasarkan hasil Code Audit dan Arsitektur Planning, mematuhi prinsip **Clean Architecture, MVC**, dan **KISS (Keep It Simple, Stupid)**.

## TAHAP 1: EKSEKUSI "HYBRID PRINTER FALLBACK" (PRIORITAS P0)
**Tujuan:** Memastikan kasir selalu bisa mencetak struk walaupun Web Bluetooth API gagal/terputus.

**Langkah Implementasi (Service Layer / Controller):**
1. Buka file atau buat file service `src/lib/services/printer.service.ts`.
2. Buat fungsi `connectAndPrint` yang menangani koneksi Bluetooth. Jika *promise* menghasilkan `false` atau *error*, tangkap *error* tersebut tanpa menghentikan aplikasi.

**Langkah Implementasi (View Layer):**
1. Pada komponen modal sukses transaksi (contoh: `SuccessModal.svelte`), siapkan dua tombol berjejer.
2. Tombol pertama: **PRINT BLUETOOTH**.
3. Tombol kedua: **PRINT BROWSER** (Fallback).
4. Tombol *Print Browser* akan melakukan `goto('/pos/print')` atau membuka jendela *print dialog* bawaan *browser* `window.print()` yang akan ditangkap oleh aplikasi *RawBT* di tablet Android.
5. **[TAMBAHAN BRAINSTORMING CSS PRINT]:** Wajib menggunakan Tailwind Print Modifiers di *route* `/pos/print` agar layar UI tidak ikut tercetak. Contoh:
   ```svelte
   <button class="print:hidden bg-blue-500" onclick={() => window.print()}>Cetak</button>
   <div class="print:block print:w-[80mm] print:m-0 print:p-0 text-black font-mono">
       <!-- Konten struk -->
   </div>
   ```

## TAHAP 2: EKSEKUSI "CENTRALIZED MODAL MANAGER"
**Tujuan:** Memecah `Modals.svelte` yang terlalu besar menjadi komponen-komponen kecil (*Single Responsibility Principle*).

**Langkah Implementasi:**
1. **Model (State):** Pastikan `src/lib/stores/pos.store.svelte.ts` memiliki *state* boolean untuk masing-masing modal.
   ```typescript
   export const posState = $state({
       showPayment: false,
       showShift: false,
       showHistory: false
   });
   ```
2. **Pembuatan Folder:** Buat direktori baru `src/lib/components/pos/modals/`.
3. **Pemisahan File:** Pindahkan blok kode spesifik dari `Modals.svelte` lama ke file baru (`PaymentModal.svelte`, `ShiftModal.svelte`, `HistoryModal.svelte`).
4. **View (Modal Manager):** Buat `src/lib/components/pos/ModalManager.svelte` sebagai pengontrol utama yang akan memuat pecahan file modal secara dinamis dan reaktif.

## TAHAP 3: STANDARISASI API CLIENT (SINGLETON)
**Tujuan:** Memusatkan logika *request* ke *Backend* agar penanganan *error* (seperti token *expired*) terjadi di satu tempat, bukan tersebar di komponen UI.

**Langkah Implementasi:**
1. Modifikasi atau buat `src/lib/services/api.client.ts`.
2. Gunakan *fetch API wrapper* dengan kemampuan otomatis mendeteksi status `401 Unauthorized`.
3. Jika `401` terdeteksi, hapus token dari `localStorage` (atau *cookie*) dan lakukan *redirect* ke halaman `/login` secara paksa untuk keamanan.
4. Pastikan `ApiClient` ini di-*export* sebagai satu *instance* (Singleton) agar digunakan oleh seluruh aplikasi.

## TAHAP 4: STRATEGI UNIT TESTING (TARGETED)
**Tujuan:** Melindungi logika bisnis krusial dari regresi (*bug*) saat ada penambahan fitur di masa depan.

**Langkah Implementasi:**
1. **Fokus pada Model (Store):** Buat file `src/lib/stores/pos.store.test.ts`.
2. Gunakan **Vitest** untuk menguji fungsi matematis (seperti logika keranjang dan diskon, memastikan Aturan TINGGI-04 terpenuhi).
3. Jangan membuat *test* redundan untuk aspek visual murni komponen UI. Fokus 100% pada keakuratan angka dan alur data (*Data Flow*).

---

# BAGIAN 5: HASIL CODE AUDIT & BLUEPRINT ARSITEKTUR FINAL (MVC)

Bagian ini ditambahkan berdasarkan audit langsung pada direktori codebase `ngemiloh-pos` (16 Juni 2026), untuk memastikan sinkronisasi antara perencanaan PRD dengan kondisi kode nyata, serta menetapkan panduan arsitektur MVC Pragmatis yang akan digunakan tim developer.

## 1. Kesimpulan Code Audit Aktual

1. **Frontend (SvelteKit)**
   - **Tech Stack**: Terverifikasi menggunakan **Svelte v5.55.2**, Vite v8.0.7, dan Node.js v20. Lingkungan ini sangat optimal dan diwajibkan untuk penggunaan deklarasi reaktif mutakhir berbasis *Runes* (seperti `$state`, `$derived`, `$effect`) yang dituntut dalam arsitektur pragmatis MVC.
   - **Monolith UI Ditemukan**: Terdapat file `src/lib/components/pos/Modals.svelte` berukuran raksasa (~25KB). File ini menyimpan seluruh logika modal secara tumpang tindih. Keadaan ini berisiko tinggi (*bug-prone*) dan memperlambat performa kompilasi Svelte. Pemecahan ke dalam pola **Centralized Modal Manager** bersifat **Wajib & Mendesak** (Lihat eksekusi Bagian 2, Tahap 2).

2. **Backend (NestJS & Prisma)**
   - **Tech Stack**: Terverifikasi menggunakan ekosistem modern **NestJS v11.0.1** dengan **Prisma ORM v5.22.0** dan NodeJS v24.
   - **Validasi Skema Database**: Berdasarkan `schema.prisma` yang diperiksa secara nyata, struktur skema sudah *production-ready*. Tabel `Order` telah memiliki kunci idempotensi `client_uuid` (mencegah transaksi terinput dua kali) serta kolom krusial `synced_from_offline` dan `verification_status` yang menjadi pondasi mutlak untuk sistem *Trust but Verify* saat Kasir tidak memiliki koneksi internet.

## 2. Blueprint Arsitektur: Opsi 1 (MVC Pragmatis Berbasis Svelte $state)

Disepakati secara mutlak bahwa pengembangan Frontend akan menggunakan pola **MVC (Model-View-Controller)** pragmatis. Pemisahan *concern* ini wajib diikuti oleh developer agar kode tetap sederhana (*simple*), mudah di-_maintenance_, dan mudah di-_testing_:

### A. Model (State Management Layer)
**Aturan Utama**: Hanya mendefinisikan struktur data (*state*) dan fungsi mutasi dasar (merubah *state* secara sinkron). **Dilarang** memanggil `fetch()` API atau menempatkan logika asinkron kompleks di dalam kelas ini.
**Contoh Penerapan** (`src/lib/stores/pos.store.svelte.ts`):
```typescript
export const posStore = $state({
    cart: [],
    showPaymentModal: false,
    
    // Mutasi sinkron murni
    addItems(item) { this.cart.push(item); },
    resetCart() { this.cart = []; }
});
```

### B. Controller (Service / Logic Layer)
**Aturan Utama**: Menangani interaksi dengan layanan eksternal (*Backend*), logika bisnis berat, dan integrasi antar Model. **Dilarang keras** menyematkan elemen UI (seperti manipulasi DOM atau referensi kelas CSS) di dalam Controller.
**Contoh Penerapan** (`src/lib/services/payment.service.ts`):
```typescript
import { api } from './api.client';
import { posStore } from '../stores/pos.store.svelte';

export const paymentController = {
    async processPayment(amount: number) {
        // Logika bisnis sinkronisasi luring
        const res = await api.request('/api/v1/orders/sync-batch', { 
            method: 'POST', 
            body: JSON.stringify({ amount, cart: posStore.cart }) 
        });
        
        if (res.ok) { 
             // Memperbarui Model
             posStore.showPaymentModal = false; 
             posStore.resetCart();
             
             // Trigger layanan lain secara independen
             // printerService.connectAndPrint(...);
        }
    }
};
```

### C. View (UI / Svelte Components)
**Aturan Utama**: Hanya membaca data (secara reaktif) dari Model, me-render tampilan UI dengan TailwindCSS, dan memicu aksi (*Action*) pada Controller berdasarkan *event* dari pengguna (klik, ketik). Logika kalkulasi bisnis wajib dipindahkan ke Controller/Model.
**Contoh Penerapan** (`src/lib/components/pos/modals/PaymentModal.svelte`):
```svelte
<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import { paymentController } from '$lib/services/payment.service';
</script>

<!-- View hanya bereaksi terhadap flag Model -->
{#if posStore.showPaymentModal}
  <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
    <div class="bg-white rounded-2xl w-full max-w-lg p-8">
       <!-- Binding reaktif murni dari Model -->
       <h2 class="text-2xl font-bold">Total: {posStore.cart.length} item</h2>
       
       <!-- View mendelegasikan tugas asinkron ke Controller -->
       <button 
          class="mt-4 w-full bg-brand-600 text-white py-4 rounded-xl font-bold"
          onclick={() => paymentController.processPayment(100000)}
       >
          KONFIRMASI PEMBAYARAN
       </button>
    </div>
  </div>
{/if}
```

## 3. Rencana Verifikasi Eksekusi (Verification Plan)

Setelah Blueprint ini diterapkan oleh tim developer ke dalam direktori `ngemiloh-pos`, kualitas kode harus divalidasi dengan cara:

1. **Unit Testing (Otomatis)**
   - **Frontend (Vitest)**: Mengeksekusi *test suite* khusus pada Model untuk menjamin fungsi kalkulasi harga dan diskon TINGGI-04 bekerja sempurna terlepas dari UI mana yang memanggilnya.
   - **Backend (Jest)**: Mengeksekusi `orders.service.spec.ts` dengan memasukkan *request payload* (*mock*) di mana `client_final_price` berbeda dari `server_calculated_total`. Pengujian wajib sukses (200 OK) dan DB harus menyimpan label `'Perlu Cek'`.
   
2. **End-to-End Testing (Manual Kasir)**
   - **Skenario Offline**: Pencabutan koneksi Wifi pada Kasir Tablet, pembuatan 2 pesanan baru, penyalaan ulang Wifi. Sistem kasir wajib melakukan sinkronisasi *background* tanpa menghalangi kasir melayani antrean berikutnya.
   - **Skenario Printer Gagal**: Menonaktifkan modul *Bluetooth* di perangkat. Mengeklik "PRINT BLUETOOTH". Aplikasi Svelte harus bertahan (tidak *crash*), menampilkan peringatan gagal yang ramah, dan membiarkan kasir menggunakan fallback "PRINT BROWSER".

---

# BAGIAN 6: AUDIT KRITIS & PENEMUAN BUG PADA BACKEND NESTJS

Berdasarkan analisis dan *brainstorming* pada berkas `backend/src/orders/application/services/orders.service.ts` di dalam direktori `ngemiloh-pos` (16 Juni 2026), telah ditemukan sebuah **PELANGGARAN KRITIKAL (BUG P0)** terhadap aturan arsitektur utama aplikasi kasir ini.

## 1. Kesalahan Fatal yang Ditemukan (Bug P0: Anti-Pattern Trust but Verify)

Pada file `orders.service.ts` (Fungsi `createOrderWithCache` baris 514-550), sistem Backend **masih melakukan penolakan transaksi** jika terdapat selisih harga (diskrepansi) antara kalkulasi server dengan harga final yang dilaporkan dari *client/kasir*.

```typescript
// KODE SALAH / EXISTING BUG DI orders.service.ts
if (diffPct > thresholdPct) {
  // SALAH: Sistem melempar exception 400 Bad Request
  throw new BadRequestException('Price calculation discrepancy exceeds threshold');
}

// Kemudian saat menyimpan ke database Prisma, sistem masih menggunakan harga Server
total_amount: orderItemsPayload.reduce((sum, item) => sum + Number(item.final_price), 0),
```

**Dampak Kegagalan:**
Aturan PRD (Pola *Trust but Verify*) dengan tegas mewajibkan: *"Backend TIDAK BOLEH menolak transaksi, melainkan menerima berapapun harga yang disubmit oleh kasir, untuk menjaga akurasi uang fisik di laci"*. 
Jika dibiarkan, di saat aplikasi kasir melakukan sinkronisasi *offline* (`sync-batch`), transaksi akan **ditolak mentah-mentah (Error 400)** oleh server jika terjadi perubahan harga (*master price*) saat kasir tidak terkoneksi internet. Hal ini menyebabkan hilangnya rekaman transaksi secara permanen dan memicu defisit uang fisik pada sistem tutup kasir (*shift*).

## 2. Solusi & Praktik Terbaik (Best Practice)

Untuk menyelesaikan anomali logika ini, logika fungsi `createOrderWithCache` dan penulisan skema `Prisma` wajib diganti total untuk mencerminkan pola **"Trust but Verify"** secara mutlak.

### A. Solusi Modifikasi Kode (`orders.service.ts`)
Hilangkan pelemparan *exception*, dan paksa penyimpanan data agar memprioritaskan harga *client* (*kasir*).

```typescript
// 1. Evaluasi Diskrepansi (TIDAK BOLEH MELEMPAR ERROR)
let vStatus = 'Valid';
if (diffPct > thresholdPct) {
  this.logger.warn(`[Trust but Verify] Discrepancy on Order ${data.client_uuid}. Server: ${calculatedFinalPrice}, Client: ${clientFinalPrice}`);
  // Berikan bendera kuning, tapi lanjutkan operasi
  vStatus = 'Perlu Cek'; 
}

// 2. Simpan ke DB MENGGUNAKAN HARGA KASIR (TRUST)
const order = await this.prisma.$transaction(async (tx) => {
  return tx.order.create({
    data: {
      client_uuid: data.client_uuid,
      cashier_id: kasirId,
      client_created_at: new Date(),
      
      // SOLUSI KRUSIAL: Gunakan Harga Final dari Kasir (Client)
      total_amount: clientFinalPrice, 
      payment_method: data.payment_method,
      cash_amount: data.cash_amount || 0,
      qris_amount: data.qris_amount || 0,
      
      // SOLUSI KRUSIAL: Set Verification Status 
      verification_status: vStatus, 
      synced_from_offline: true,
      
      items: { create: orderItemsPayload },
    },
    include: { items: true },
  });
});
```

### B. Arsitektur Tambahan (Solusi Bug QRIS Offline)
Pada berkas yang sama baris 420, sistem menolak sinkronisasi jika `payment_method === PaymentMethod.qris`. Secara bisnis QRIS membutuhkan internet, namun ada skenario fatal: internet mati tepat di mikro-detik kasir setelah pelanggan di-scan, sehingga Midtrans sukses memotong saldo pelanggan tetapi `Order` di SvelteKit tertahan di antrean Dexie.js (Offline Mode).

**Solusi Terbaik**:
1. Jangan menolak (*reject*) sinkronisasi QRIS *offline*. Izinkan masuk, tetapi tetapkan atribut `status` di tabel Order menjadi `OrderStatus.pending_sync`.
2. Integrasikan modul penjadwalan `Cron-Job` (`@nestjs/schedule`). Buat *service background* yang berjalan setiap 5 menit untuk mengecek (`polling`) status `transaction_id` milik *Order* yang berstatus `pending_sync` langsung ke server API Midtrans. Jika Midtrans mengembalikan status *Settlement*, ubah Order menjadi *Completed* di *Database*.

---

# BAGIAN 7: BLUEPRINT EKSEKUSI TINGKAT KODE (SUBAGENT-DRIVEN DEVELOPMENT)

Bagian ini memuat rencana implementasi terperinci (*Code-Level Blueprint*) beserta **KODE ASLI** yang wajib digunakan oleh *AI Subagents* maupun *Developer*. Pekerjaan dibagi menjadi tiga agen terpisah.

## 1. Tahap 1: Frontend Core (API & Printer Fallback)
**Fokus**: Membangun fondasi komunikasi dan fungsi *hardware* pencetak.

**A. [NEW] `frontend/src/lib/services/api.client.ts`**
```typescript
export class ApiClient {
  private baseUrl = import.meta.env.VITE_API_URL || '';
  private defaultTimeout = 30000;

  async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.defaultTimeout);
    
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, { ...options, headers, signal: controller.signal });
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
      }
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') throw new Error('Request Timeout');
      throw error;
    } finally {
      clearTimeout(id);
    }
  }
}
export const api = new ApiClient();
```

**B. [MODIFY] `frontend/src/lib/services/printer.service.ts`**
*(Tambahkan try-catch agar Svelte tidak mati saat Bluetooth menolak)*
```typescript
async connectAndPrint(receiptData: string): Promise<boolean> {
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }]
    });
    // ... logika print ...
    return true;
  } catch (err) {
    console.warn("Bluetooth Print Failed or Cancelled:", err);
    return false; // Jangan throw error!
  }
}
```

**C. [NEW] `frontend/src/routes/pos/print/+page.svelte`**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { posStore } from '$lib/stores/pos.store.svelte';
  
  onMount(() => {
    // Membuka dialog print OS sesaat setelah komponen dimuat
    setTimeout(() => window.print(), 500); 
  });
</script>

<div class="print:block print:m-0 print:w-[80mm] hidden text-black font-mono text-sm">
  <div class="text-center font-bold text-lg mb-2">NGEMILOH POS</div>
  <div class="border-b border-dashed border-black mb-2"></div>
  {#each posStore.lastOrderDetails.items as item}
     <div class="flex justify-between">
        <span>{item.quantity}x {item.name}</span>
        <span>Rp{item.price}</span>
     </div>
  {/each}
  <div class="border-b border-dashed border-black mt-2 mb-2"></div>
  <div class="flex justify-between font-bold">
     <span>TOTAL</span>
     <span>Rp{posStore.lastOrderDetails.total}</span>
  </div>
</div>
```

## 2. Tahap 2: Frontend UI (Centralized Modal Manager)
**Fokus**: Membedah *Monolith* `Modals.svelte` (25KB).

**A. [DELETE] `frontend/src/lib/components/pos/Modals.svelte`** (Dihapus Total)

**B. [NEW] `frontend/src/lib/components/pos/ModalManager.svelte`**
```svelte
<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import SuccessModal from './modals/SuccessModal.svelte';
  import PaymentModal from './modals/PaymentModal.svelte';
  import ShiftModal from './modals/ShiftModal.svelte';
</script>

{#if posStore.showPaymentModal} <PaymentModal /> {/if}
{#if posStore.showSuccessModal} <SuccessModal /> {/if}
{#if posStore.showShiftModal} <ShiftModal /> {/if}
<!-- Dan sub-modal lainnya... -->
```

**C. [NEW] `frontend/src/lib/components/pos/modals/SuccessModal.svelte`**
```svelte
<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import { printerService } from '$lib/services/printer.service';
</script>

<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl w-full max-w-md p-6 text-center">
    <h3 class="text-2xl font-black mb-4">Pembayaran Berhasil!</h3>
    <div class="flex flex-col gap-3">
      <button 
        onclick={async () => {
          const success = await printerService.connectAndPrint("STRUK_DATA");
          if(!success) alert("Bluetooth gagal! Gunakan Print Browser.");
        }} 
        class="py-3 bg-brand-600 text-white rounded-xl font-bold">
        PRINT BLUETOOTH
      </button>
      
      <a href="/pos/print" class="py-3 bg-slate-800 text-white rounded-xl font-bold block">
        PRINT BROWSER
      </a>
      
      <button onclick={() => posStore.resetPos()} class="py-3 border-2 text-slate-700 rounded-xl font-bold mt-2">
        PESANAN BARU
      </button>
    </div>
  </div>
</div>
```

## 3. Tahap 3: Backend (Trust but Verify Bugfix)
**Fokus**: Mengatasi penolakan transaksi (*Bug P0*) pada NestJS.

**A. [MODIFY] `backend/src/orders/application/services/orders.service.ts`**
*Cari fungsi `createOrderWithCache` dan ganti blok kodenya menjadi:*

```typescript
// --- 1. UBAH LOGIKA DISKREPANSI HARGA ---
let vStatus = 'Valid';
if (diffPct > thresholdPct) {
  this.logger.warn(`Discrepancy Order ${data.client_uuid}. Server: ${calculatedFinalPrice}, Client: ${clientFinalPrice}`);
  vStatus = 'Perlu Cek'; // Jangan gunakan throw new BadRequestException!
}

// --- 2. UBAH PAYLOAD PRISMA SAVE ---
const order = await this.prisma.$transaction(async (tx) => {
  return tx.order.create({
    data: {
      client_uuid: data.client_uuid,
      cashier_id: kasirId,
      client_created_at: new Date(),
      
      total_amount: clientFinalPrice, // WAJIB HARGA KASIR! BUKAN kalkulasi Server
      verification_status: vStatus,   // Status "Trust but Verify"
      synced_from_offline: true,
      status: OrderStatus.completed,
      
      payment_method: data.payment_method,
      cash_amount: data.cash_amount || 0,
      qris_amount: data.qris_amount || 0,
      items: { create: orderItemsPayload },
    },
    include: { items: true },
  });
});
```

*Pada fungsi `syncBatchOrders`, ubah blok validasi QRIS offline:*
```typescript
// --- 3. UBAH VALIDASI QRIS OFFLINE ---
if (orderData.payment_method === PaymentMethod.qris) {
  // Izinkan QRIS offline masuk agar tidak hilang, tapi tandai pending_sync
  orderData.status = OrderStatus.pending_sync;
}
```
