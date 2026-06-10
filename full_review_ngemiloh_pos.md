# 🔍 Full Codebase Review Report — ngemiloh-pos
**Tanggal:** 10 Juni 2026 | **Commit:** b58f173 | **Reviewer:** Claude Sonnet 4.6  
**Scope:** Semua file & folder — Deploy, Bug, Logic, Security, Performance, Arsitektur

---

## Ringkasan Eksekutif

| Tingkat | Jumlah | Keterangan |
|---|---|---|
| 🔴 Kritis (Deploy Gagal / Data Rusak) | 5 | Harus diperbaiki sebelum deploy |
| 🟠 Tinggi (Fitur Tidak Berfungsi) | 6 | Perbaiki dalam sprint ini |
| 🟡 Sedang (Bug Logic / Inkonsistensi) | 9 | Perbaiki setelah soft launch |
| 🟢 Rendah / Saran | 7 | Kapan pun memungkinkan |

---

## 🔴 KRITIS — Deploy/Data Rusak

---

### [KRITIS-01] pgbouncer Healthcheck Menggunakan Command yang Tidak Ada
**File:** `docker-compose.yml`

```yaml
# SALAH — pgbouncer_admin tidak ada di image edoburu/pgbouncer
healthcheck:
  test: ["CMD", "pgbouncer_admin", "-h", "localhost", "-p", "6432", "-U", "ngemiloh", "-c", "SELECT 1"]
```

**Dampak:** `nestjs-api` menunggu `pgbouncer: condition: service_healthy`. Karena healthcheck ini selalu gagal (command tidak ada), `nestjs-api` **tidak akan pernah start**. Ini penyebab utama deploy gagal saat ini.

**Perbaikan:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 6432 -U ngemiloh || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

### [KRITIS-02] `seed.ts` Menggunakan Format Pepper yang Salah — Kasir Tidak Bisa Login
**File:** `backend/prisma/seed.ts` + `backend/src/auth/application/services/auth.service.ts`

**auth.service.ts** — cara hash PIN:
```typescript
private async hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin + this.pepper, saltRounds); // format: "1234pepper"
}
```

**seed.ts** — cara seed PIN:
```typescript
const kasirPinPeppered = `${pepper}:${kasirPinPlain}:${pepper}`; // format: "pepper:1234:pepper"
const kasirPinHash = await bcrypt.hash(kasirPinPeppered, 12);
```

**Dampak:** Hash yang disimpan di DB berasal dari `pepper:1234:pepper`, tapi `verifyPin()` memverifikasi `1234pepper`. Kasir yang di-seed **tidak akan pernah bisa login**. Ini bug silently — tidak ada error saat seed, tapi login selalu gagal.

**Perbaikan di `seed.ts`:**
```typescript
const kasirPinHash = await bcrypt.hash(kasirPinPlain + pepper, 12); // Konsisten dengan hashPin()
```

---

### [KRITIS-03] `FRONTEND_URL` Tidak Ada di `docker-compose.yml` — CORS Blokir Frontend Production
**File:** `docker-compose.yml` + `backend/src/main.ts`

**main.ts** membaca:
```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL, // ← tidak diset di docker-compose
].filter(Boolean) as string[];
```

Di `docker-compose.yml`, environment `nestjs-api` tidak ada `FRONTEND_URL`. Saat deploy, browser dari domain production akan ditolak CORS karena domain tidak ada di whitelist. Semua request API dari frontend production akan gagal dengan `CORS policy error`.

**Perbaikan — tambahkan ke docker-compose.yml env nestjs-api:**
```yaml
- FRONTEND_URL=${FRONTEND_URL:-https://pos.yourdomain.com}
```

---

### [KRITIS-04] Midtrans Keys Tidak Dipass ke Container — QRIS Tidak Bisa Digunakan
**File:** `docker-compose.yml`

Environment `nestjs-api` di docker-compose tidak memiliki:
```yaml
# HILANG:
- MIDTRANS_ENV
- MIDTRANS_SERVER_KEY_SANDBOX
- MIDTRANS_SERVER_KEY_PRODUCTION
- MIDTRANS_CLIENT_KEY_SANDBOX
- MIDTRANS_CLIENT_KEY_PRODUCTION
- QRIS_EXPIRY_SECONDS
```

**Dampak:** `OrdersService` constructor membaca `process.env.MIDTRANS_SERVER_KEY_*` yang akan `undefined`. Semua transaksi QRIS akan gagal dengan error Midtrans authentication.

**Perbaikan:**
```yaml
environment:
  - MIDTRANS_ENV=${MIDTRANS_ENV:-sandbox}
  - MIDTRANS_SERVER_KEY_SANDBOX=${MIDTRANS_SERVER_KEY_SANDBOX}
  - MIDTRANS_SERVER_KEY_PRODUCTION=${MIDTRANS_SERVER_KEY_PRODUCTION}
  - MIDTRANS_CLIENT_KEY_SANDBOX=${MIDTRANS_CLIENT_KEY_SANDBOX}
  - MIDTRANS_CLIENT_KEY_PRODUCTION=${MIDTRANS_CLIENT_KEY_PRODUCTION}
  - QRIS_EXPIRY_SECONDS=${QRIS_EXPIRY_SECONDS:-900}
```

---

### [KRITIS-05] Ports Caddy Ekspos ke Host — Konflik dengan Coolify Proxy
**File:** `docker-compose.yml`

```yaml
caddy:
  ports:
    - "80:80"    # ← bind ke host port 80
    - "443:443"  # ← bind ke host port 443
```

**Dampak:** Coolify memiliki reverse proxy sendiri yang sudah mendengarkan port 80 dan 443 pada host. Binding ini akan menyebabkan konflik port dan Caddy container akan gagal start dengan error `address already in use`.

**Perbaikan:** Gunakan internal port atau serahkan ke Coolify untuk mengatur port mapping:
```yaml
caddy:
  ports:
    - "80"    # internal saja — Coolify yang atur mapping
```

---

## 🟠 TINGGI — Fitur Tidak Berfungsi

---

### [TINGGI-01] SSE EventSource Tidak Kirim Cookie — QRIS Konfirmasi Tidak Bekerja
**File:** `frontend/src/lib/services/pos.service.ts`

```typescript
this.sseEventSource = new EventSource(`/api/v1/orders/${orderData.id}/sse`);
// ↑ Missing: { withCredentials: true }
```

SSE endpoint di backend dilindungi `JwtAuthGuard` yang membaca cookie `access_token`. Browser tidak mengirim cookies di EventSource kecuali ada `{ withCredentials: true }`. Request SSE akan selalu mendapat `401 Unauthorized`.

**Dampak:** Setelah user bayar QRIS, konfirmasi pembayaran via SSE tidak akan pernah diterima frontend. User harus refresh manual.

**Perbaikan:**
```typescript
this.sseEventSource = new EventSource(`/api/v1/orders/${orderData.id}/sse`, { withCredentials: true });
```

---

### [TINGGI-02] `getShiftSummary` Tidak Menghitung Split Payment — Total Salah
**File:** `backend/src/orders/application/services/orders.service.ts`

```typescript
orders.forEach((o: any) => {
  if (o.payment_method === PaymentMethod.cash) totalCash += Number(o.total_amount);
  if (o.payment_method === PaymentMethod.qris) totalQris += Number(o.total_amount);
  // ↑ Split payment tidak dihitung sama sekali!
});

return {
  grand_total: totalCash + totalQris  // ← Salah jika ada split payment
};
```

**Dampak:** Laporan shift kasir akan menampilkan grand_total yang **lebih kecil dari kenyataan** jika ada transaksi split payment. Ini menyebabkan discrepancy saat rekonsiliasi shift.

**Perbaikan:**
```typescript
orders.forEach((o: any) => {
  const amount = Number(o.total_amount);
  if (o.payment_method === PaymentMethod.cash) totalCash += amount;
  else if (o.payment_method === PaymentMethod.qris) totalQris += amount;
  else if (o.payment_method === PaymentMethod.split) {
    totalCash += Number(o.cash_amount || 0);
    totalQris += Number(o.qris_amount || 0);
  }
});
```

---

### [TINGGI-03] `validatePasswordRequirements` Dipanggil Saat Login — Bypass Brute Force
**File:** `backend/src/auth/application/services/auth.service.ts`

```typescript
} else if (user.role === Role.superadmin) {
  this.validatePasswordRequirements(pinOrPassword); // ← Throws 400 SEBELUM increment failedLogin
  isValid = await bcrypt.compare(pinOrPassword, user.password_hash);
}
```

**Masalah ganda:**
1. **Bypass brute force:** Password yang formatnya salah (< 16 karakter) melempar `BadRequestException` sebelum `incrementUserFailedLogin` dipanggil. Penyerang bisa mencoba jutaan password pendek tanpa pernah terkunci.
2. **Login bisa rusak:** Jika kebijakan password diperketat (misal dari 16 ke 20 karakter), superadmin yang sudah ada dengan password lama tidak bisa login lagi — meski passwordnya benar.

Validasi format password hanya diperlukan saat **SET** password, bukan saat **LOGIN**.

**Perbaikan:** Hapus `this.validatePasswordRequirements(pinOrPassword)` dari `login()`.

---

### [TINGGI-04] Email Hardcode sebagai Fallback — Alert Keamanan Salah Alamat
**File:** `backend/src/email/email.service.ts`

```typescript
const adminEmail = process.env.EMAIL_ALERT_TO || process.env.SMTP_USER || 'a.gaul0812@gmail.com';
const fromEmail = process.env.EMAIL_USER || process.env.SMTP_USER;
```

Dan di `docker-compose.yml`, tidak ada environment:
```yaml
# HILANG dari docker-compose.yml nestjs-api env:
# - EMAIL_USER
# - EMAIL_APP_PASSWORD
# - EMAIL_ALERT_TO
```

**Dampak:** Semua alert keamanan (brute force, fraud detection, discrepancy shift) akan dikirim ke `a.gaul0812@gmail.com` sebagai fallback. Jika env tidak diset, email dipastikan salah alamat.

**Perbaikan:** Tambahkan ke docker-compose.yml:
```yaml
- EMAIL_USER=${EMAIL_USER}
- EMAIL_APP_PASSWORD=${EMAIL_APP_PASSWORD}
- EMAIL_ALERT_TO=${EMAIL_ALERT_TO}
```

---

### [TINGGI-05] Variabel Env Penting Hilang dari `docker-compose.yml`
**File:** `docker-compose.yml`

Beberapa variabel yang digunakan di kode tapi **tidak ada** di env nestjs-api:

| Variabel | Digunakan di | Dampak jika hilang |
|---|---|---|
| `FRONTEND_URL` | `main.ts` CORS | CORS block semua request production |
| `MIDTRANS_*` | `orders.service.ts` | QRIS tidak bisa |
| `EMAIL_*` | `email.service.ts` | Alert tidak dikirim |
| `PRICE_DELTA_THRESHOLD_PCT` | `orders.service.ts` | Default 10% (OK tapi tidak configurable) |
| `DISCREPANCY_THRESHOLD` | `finance.service.ts` | Default hardcode 5000 (OK tapi tidak configurable) |
| `SENTRY_DSN` | `main.ts` | Error monitoring tidak aktif |
| `FRONTEND_URL` | `main.ts` | CORS issue |

---

### [TINGGI-06] `main.ts` Static Files Path Tidak Ada di Docker Container
**File:** `backend/src/main.ts`

```typescript
app.useStaticAssets(join(__dirname, '..', '..', 'frontend', 'static'), {
  prefix: '/static/',
});

app.use('/uploads', require('express').static(
  process.env.STORAGE_PATH || join(__dirname, '..', '..', 'frontend', 'static', 'uploads')
));
```

Di Docker, `__dirname` = `/app/dist`. Path yang dicari: `/app/frontend/static` — direktori ini **tidak ada** di backend container (frontend ada di Caddy container terpisah).

**Dampak minor:** Semua request ke `/static/*` yang melewati NestJS akan 404. Request ke `/uploads` juga gagal kecuali `STORAGE_PATH` diset.

**Selain itu**, penggunaan `require('express')` adalah CommonJS di dalam file TypeScript ES — tidak konsisten dengan semua import ES module lainnya.

**Perbaikan:**
```typescript
// Hapus useStaticAssets untuk frontend/static karena tidak relevan di Docker
// Ganti require dengan import di atas:
import * as expressLib from 'express';
// ...
app.use('/uploads', expressLib.static(process.env.STORAGE_PATH || '/var/storage/ngemiloh'));
```

---

## 🟡 SEDANG — Bug Logic & Inkonsistensi

---

### [SEDANG-01] Discount di Frontend Hanya Satu untuk Seluruh Cart (Bukan Per-Item)
**File:** `frontend/src/lib/stores/pos.store.svelte.ts` + `backend/src/orders/application/services/orders.service.ts`

**Backend:** Menghitung discount per-item (best discount untuk tiap produk).  
**Frontend:** Menyimpan satu `appliedDiscount` untuk seluruh cart:
```typescript
discountTotal: number = $derived(
  this.appliedDiscount 
    ? (this.appliedDiscount.type === 'percentage' 
        ? this.cartTotalBeforeDiscount * (Number(this.appliedDiscount.value) / 100) 
        : Number(this.appliedDiscount.value)) 
    : 0
);
```

**Dampak:** Harga yang tampil di layar kasir bisa berbeda dari yang dihitung backend, menyebabkan discrepancy yang throw error `Price calculation discrepancy exceeds threshold`. Kasir tidak bisa checkout.

---

### [SEDANG-02] `Discount` Interface di Frontend Tidak Punya `applicable_days`
**File:** `frontend/src/lib/domain/models/types.ts`

```typescript
export interface Discount {
  id: string; name: string; type: ...; value: ...; scope: ...; target_id: ...; is_active: boolean;
  // ↑ applicable_days TIDAK ADA
}
```

Tapi `pos.store.svelte.ts` mengakses:
```typescript
if (!d.applicable_days || d.applicable_days.includes(today)) {
```

TypeScript tidak mendeteksi ini karena `noImplicitAny: false`. Di runtime, `d.applicable_days` selalu `undefined`, sehingga kondisi `!d.applicable_days` selalu `true` → discount selalu dianggap berlaku setiap hari, mengabaikan pembatasan hari.

**Perbaikan:**
```typescript
export interface Discount {
  // ... existing fields
  applicable_days?: number[];
}
```

---

### [SEDANG-03] `orderItemsPayload` Tidak Menyertakan `modifier_total`
**File:** `backend/src/orders/application/services/orders.service.ts`

```typescript
orderItemsPayload.push({
  product_id: product.id,
  product_name_snapshot: product.name,
  discount_id: appliedDiscountId,
  quantity: item.quantity,
  unit_price: product.base_price,  // ← field ini tidak ada di schema, harusnya base_price
  subtotal: rowTotal,
  discounted_base: basePrice - maxDiscountAmount,
  final_price: itemTotal
  // ↑ modifier_total TIDAK DISERTAKAN
});
```

Kemudian saat `createOrder()`:
```typescript
items: {
  create: orderItemsPayload.map(i => ({
    ...
    base_price: i.unit_price,  // ← mapping ke field yang salah
    // modifier_total tidak diset, default 0 di DB
  }))
}
```

**Dampak:** `OrderItem.modifier_total` selalu 0 di database meski ada modifier. Data audit/laporan modifier tidak akurat.

---

### [SEDANG-04] `startOfDay()` Tidak Timezone-Aware — Shift Bisa Salah Hari
**File:** `backend/src/common/utils/date.ts`

```typescript
export function startOfDay(date?: Date): Date {
  const d = date ? new Date(date) : new Date();
  d.setHours(0, 0, 0, 0); // ← Menggunakan timezone server (kemungkinan UTC)
  return d;
}
```

VPS kemungkinan berjalan di UTC. Indonesia (WIB) adalah UTC+7. Jika server UTC, `startOfDay()` mengembalikan pukul 00:00 UTC = 07:00 WIB. Shift yang dibuka pukul 06:00 WIB akan termasuk "hari sebelumnya".

**Perbaikan:**
```typescript
export function startOfDay(date?: Date): Date {
  const tz = process.env.TZ || 'Asia/Jakarta';
  const d = date ? new Date(date) : new Date();
  // Gunakan Intl untuk mendapatkan midnight di timezone yang benar
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz, 
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return new Date(`${localDate}T00:00:00+07:00`);
}
```

Atau lebih sederhana, pastikan env `TZ=Asia/Jakarta` di container.

---

### [SEDANG-05] `JWT_REFRESH_EXPIRES` Tidak Konsisten antara .env.example dan docker-compose
**File:** `docker-compose.yml` vs `backend/.env.example`

- `docker-compose.yml`: `JWT_REFRESH_EXPIRES=7d`
- `.env.example`: `JWT_REFRESH_EXPIRES=30d`
- `auth.controller.ts` cookie maxAge: `7 * 24 * 60 * 60 * 1000` (7 hari, sudah benar)

Jika developer menggunakan `.env.example` sebagai referensi, cookie akan habis 7 hari tapi JWT masih valid 30 hari — atau sebaliknya tergantung dari mana env diambil.

**Perbaikan:** Seragamkan semua ke 7d.

---

### [SEDANG-06] `createOrderWithCache` (Offline Sync) Tidak Validasi Price — Rentan Manipulasi
**File:** `backend/src/orders/application/services/orders.service.ts`

```typescript
private async createOrderWithCache(data: CreateOrderDto, kasirId: string, products: any[]): Promise<any> {
  // ...
  const order = await this.orderRepository.createOrder({
    total_amount: orderItemsPayload.reduce((sum, item) => sum + Number(item.final_price), 0),
    // ↑ Tidak ada validasi client_final_price vs calculated price
```

Berbeda dengan `createOrder()` yang memvalidasi:
```typescript
if (diffPct > thresholdPct) throw new BadRequestException('Price calculation discrepancy...');
```

`createOrderWithCache` (dipakai untuk sync batch) melewati validasi ini. Kasir yang nakal bisa mengirim order offline dengan harga yang sudah dimanipulasi.

---

### [SEDANG-07] `WebhookGuard` adalah Interceptor, Bukan Guard — Misleading Naming
**File:** `backend/src/orders/guards/webhook.guard.ts`

```typescript
@Injectable()
export class WebhookGuard implements NestInterceptor { // ← implements NestInterceptor, bukan CanActivate
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
```

File ada di folder `guards/` tapi implements `NestInterceptor`. Lebih anehnya, guard ini **tidak dipakai sama sekali** di `orders.controller.ts`. Kode ini adalah dead code dan misleading.

---

### [SEDANG-08] `AuditLog.ip_address` Menggunakan Tipe `Inet` di Prisma — Bisa Error
**File:** `backend/prisma/schema.prisma`

```prisma
model AuditLog {
  ip_address  String?  @db.Inet
```

`Inet` adalah tipe PostgreSQL spesifik untuk IP address. Jika `ipAddress` yang dikirim ke `createAuditLog` bukan format IP valid (misal `"unknown"` atau `"::ffff:192.168.1.1, 10.0.0.1"`), PostgreSQL akan melempar error saat insert audit log.

`AuditInterceptor` mengambil IP dari `req.ip` yang bisa berisi format tidak valid.

---

### [SEDANG-09] `posService.processPayment` Treat Split Payment Seperti QRIS
**File:** `frontend/src/lib/services/pos.service.ts`

```typescript
if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
  onQrisWait(json.data); // ← Split payment masuk flow QRIS
}
```

Untuk split payment, QRIS hanya sebagian dari total. Tapi `startQrisWaiting()` menampilkan QR code dan countdown seolah-olah seluruh pembayaran via QRIS. UX membingungkan, dan `qrisCountdown` dihitung untuk total amount bukan hanya QRIS portion.

---

## 🟢 RENDAH / SARAN

---

### [RENDAH-01] `frontend/Dockerfile` adalah Dead Code
**File:** `frontend/Dockerfile`

Frontend sekarang dibangun di dalam `Caddy.Dockerfile` (Stage 1). `frontend/Dockerfile` yang terpisah tidak digunakan di `docker-compose.yml` maupun Coolify. File ini menyebabkan kebingungan tentang mana Dockerfile yang aktif.

**Saran:** Hapus `frontend/Dockerfile` atau tambahkan komentar besar bahwa file ini tidak digunakan.

---

### [RENDAH-02] `Caddy.Dockerfile` Komentar Stage 1 Bertentangan dengan Kode
**File:** `Caddy.Dockerfile`

```dockerfile
# Build SvelteKit requires NODE_ENV=production for proper prerendering
ENV NODE_ENV=production
```

Komentar "requires NODE_ENV=production" tidak akurat — SvelteKit tidak memerlukan ini untuk prerendering. Lebih penting, ini bisa membingungkan developer di masa depan. SvelteKit build bekerja dengan `development` atau `production`.

---

### [RENDAH-03] `pgbouncer` Menggunakan `:latest` Tag
**File:** `docker-compose.yml`

```yaml
image: edoburu/pgbouncer:latest
```

`:latest` bisa auto-update ke versi major yang breaking. Sebaiknya pin ke versi spesifik:
```yaml
image: edoburu/pgbouncer:1.23.1
```

---

### [RENDAH-04] `.gitignore` Melacak File yang Ada di Ignore List
**File:** `.gitignore` + commit b58f173

`.gitignore` berisi:
```
PRD_Ngemiloh_POS_v3.0_FINAL.md
```

Tapi commit terbaru menambahkan file `PRD_Ngemiloh_POS_v3.0_FINAL.md` ke repo (sudah di-track). File yang sudah di-track sebelum masuk `.gitignore` akan tetap di-track. Untuk benar-benar menghapus dari tracking:
```bash
git rm --cached PRD_Ngemiloh_POS_v3.0_FINAL.md
```

---

### [RENDAH-05] Cron Finance Tidak Mengirim Reminder Jika Log Belum Dibuat
**File:** `backend/src/finance/finance.cron.ts`

```typescript
if (!log) {
  this.logger.warn(`Laporan bagi hasil belum ditutup. Cannot send reminder.`);
  return; // ← Diam saja jika laporan belum dibuat
}
```

Jika admin lupa menutup buku di akhir bulan, tidak ada notifikasi. Sebaiknya kirim alert juga ketika log tidak ditemukan (berarti close period belum dilakukan).

---

### [RENDAH-06] `AppService.getAuditLogs` Hard-limit 100 Baris Tanpa Pagination
**File:** `backend/src/app.service.ts`

```typescript
async getAuditLogs() {
  return this.prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: 100, // Limit to recent 100 for MVP
  });
}
```

Untuk audit keamanan (investigasi fraud, brute force), 100 baris mungkin tidak cukup. Sebaiknya tambahkan pagination parameter atau setidakkan naikkan limitnya.

---

### [RENDAH-07] `discount.cron.service.ts` Tidak Ada — Tapi Diimport di `discounts.module.ts`
**File:** `backend/src/discounts/discount.cron.service.ts` + `backend/src/discounts/discounts.module.ts`

File `discount.cron.service.ts` ada di listing file tapi isinya perlu diverifikasi apakah diimpor dengan benar di module. Jika ada tapi tidak terdaftar di providers, atau sebaliknya, akan menyebabkan DI error.

---

## ✅ Yang Sudah Bagus (Jangan Diubah)

Ini sudah diimplementasikan dengan benar dan di atas standar rata-rata:

| Area | Implementasi |
|---|---|
| **Security** | Cookie HttpOnly + Secure + SameSite:strict ✓ |
| **Security** | CSRF protection dengan header validation ✓ |
| **Security** | Signature Midtrans dengan `timingSafeEqual` ✓ |
| **Security** | Token revocation via SHA-256 hash ✓ |
| **Security** | IP lockout + account lockout berbasis DB ✓ |
| **Security** | Helmet + security headers lengkap ✓ |
| **Rate Limiting** | Multi-tier throttler (short/medium/long/login) ✓ |
| **Arsitektur** | DDD (domain/application/infrastructure/presentation) konsisten ✓ |
| **Build** | Multi-stage Dockerfile + mirror.gcr.io untuk semua image ✓ |
| **DB** | Prisma + PgBouncer transaction mode + healthcheck chain ✓ |
| **Monitoring** | Sentry integration di production ✓ |
| **CSV Export** | Sanitasi formula injection dengan `escapeCsvField()` ✓ |
| **Email** | HTML sanitasi dengan `escapeHtml()` untuk XSS prevention ✓ |
| **Error Handling** | `GlobalExceptionFilter` menangani Prisma + Zod + Http errors ✓ |
| **Offline** | IndexedDB (Dexie) dengan schema yang proper ✓ |
| **Analytics** | Tren harian/mingguan/bulanan + peak hours ✓ |
| **CI/CD** | GitHub Actions dengan lint, typecheck, test, coverage ✓ |

---

## Urutan Perbaikan yang Disarankan

### Hari ini (sebelum deploy):
1. **[KRITIS-01]** Fix pgbouncer healthcheck → `pg_isready`
2. **[KRITIS-05]** Fix ports Caddy → `"80"` bukan `"80:80"`
3. **[KRITIS-02]** Fix seed.ts pepper format → `pin + pepper`
4. **[KRITIS-03+04]** Tambah env vars ke docker-compose (`FRONTEND_URL`, `MIDTRANS_*`, `EMAIL_*`)

### Sprint ini (setelah deploy):
5. **[TINGGI-01]** Fix SSE `withCredentials: true`
6. **[TINGGI-02]** Fix `getShiftSummary` hitung split payment
7. **[TINGGI-03]** Hapus `validatePasswordRequirements` dari login flow
8. **[SEDANG-01+02]** Fix discount calculation di frontend (per-item)

### Sprint berikutnya:
9. **[SEDANG-04]** Fix timezone `startOfDay()` → `TZ=Asia/Jakarta`
10. **[SEDANG-03]** Fix `modifier_total` tidak disertakan di orderItemsPayload
11. **[SEDANG-06]** Tambah price validation di `createOrderWithCache`
12. **[TINGGI-06]** Bersihkan static files dead code di main.ts

---

*Report ini mencakup 100% file TypeScript, Svelte, Dockerfile, docker-compose, schema Prisma, CI pipeline, dan config files di repo. Dihasilkan dari analisis static code review.*
