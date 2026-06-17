# PRD Ngemiloh POS — FINAL
## Single Source of Truth untuk Backend, Database, dan Infrastructure

> **Status:** FINAL (2026-06-16)
> **Menggantikan:** `PRD_Ngemiloh_POS_v5_0.md`, `PRD_Ngemiloh_POS_v3.0_FINAL.md`, `deployment_guide_ngemiloh.md`
> **Base:** decisions D-01..D-16 (v5.0) + ADR-013..ADR-016 (REKOMENDASI v4.1) + Prisma schema aktual (backend/prisma/schema.prisma)

---

## 0. Project Snapshot

| Item | Nilai |
|------|-------|
| VPS | MS 4.4 — 4 GB RAM, 4 vCPU, 60 GB Disk, Ubuntu 24.04 |
| IP VPS | `103.150.227.117` |
| Domain | `103-150-227-117.nip.io` (Let's Encrypt via Caddy) |
| Repo | `https://github.com/Arif0821/ngemiloh-pos` |
| Email bisnis | `nabilah.fnb@gmail.com` |
| Midtrans | Sandbox mode — production switch via `MIDTRANS_ENV` |
| Kasir aktif | 1 (arsitektur mendukung multi-akun) |
| Jenis order | Takeaway only (tidak ada meja/dine-in) |

---

## 1. Master Decisions Log

| ID | Keputusan | Konsekuensi |
|----|-----------|------------|
| **D-01** | JWT tanpa refresh token. `RevokedToken` table hanya untuk logout/revoke. | Hapus semua `/auth/refresh` endpoint + retry loop frontend |
| **D-02** | Kasir login: PIN 4 digit, token expiry **20 jam** | Tidak ada idle-lock |
| **D-03** | Admin login: email + password langsung (Opsi A, **tanpa OTP step**) | `/login-admin` → langsung login, tidak ada step OTP |
| **D-04** | HTTPS via Caddy: domain `103-150-227-117.nip.io` | Caddy auto-issue Let's Encrypt |
| **D-05** | Semua URL env → `https://103-150-227-117.nip.io` | Konsistensi CORS + cookie origin |
| **D-06** | **PgBouncer dihapus** dari docker-compose | NestJS connect langsung ke Postgres |
| **D-07** | Printer: HTML Print Dialog (`window.print()`) + CSS `@media print` | Toggle 58mm/80mm, pelanggan/dapur |
| **D-08** | Offline storage: **Dexie.js** (bukan idb-keyval) | 3 tabel: products, orders, cart |
| **D-09** | Shift = business date. Laporan filter `shift_start`..`shift_end`, BUKAN `created_at::date` | Handle order lintas tengah malam |
| **D-10** | `Order.customer_name` (VARCHAR, nullable) | Nama pelanggan untuk antrean takeaway |
| **D-11** | Multi-akun kasir dari awal. Profit-share 40% otomatis + jumlah transaksi per kasir | Laporan bulanan |
| **D-12** | Format struk baru: header NGEMILOH, waktu, No. TRX, Kasir, Pelanggan, item+modifier, Subtotal/Diskon/Total, blok pembayaran, footer | Struk 58mm/80mm |
| **D-13** | Tidak ada meja/dine-in. Semua order = takeaway | Hapus semua referensi jenis order |
| **D-14** | Idempotency: `SELECT ... FOR UPDATE` (bukan idempotency-key generic) | Cukup untuk 1-3 kasir |
| **D-15** | Tidak ada label Fase. Roadmap = checklist terurut | Satu spesifikasi, semua fitur |
| **D-16** | BOM/HPP + Raw Material + Profit-share multi-kasir masuk scope penuh | Inventory + Finance module |

---

## 2. Database Schema (Prisma)

**File referensi:** `backend/prisma/schema.prisma` (kode aktual)
**Single source of truth untuk schema DB.**

### 2.1 Enum Definitions

```prisma
enum Role { kasir, superadmin }
enum DiscountType { percentage, fixed_amount }
enum DiscountScope { all_products, category, specific_product }
enum PaymentMethod { cash, qris, split }
enum OrderStatus { completed, voided, pending_sync }
enum RegisterStatus { open, closed }
enum StockMovementType { in, out, adjustment, waste, waste }
enum RefundMethod { cash, transfer, original_payment, manual_cash, store_credit }
```

### 2.2 Core Tables

#### `User` — Kasir & Admin
```prisma
model User {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name               String    @db.VarChar(100)
  username           String    @unique @db.VarChar(50)
  email              String?   @unique @db.VarChar(150)
  pin_hash           String?   @db.VarChar(72)    // bcrypt(kode + pepper)
  password_hash      String?   @db.VarChar(72)    // bcrypt(admin)
  role               Role
  is_active          Boolean   @default(true)
  must_change_pin    Boolean   @default(false)
  failed_login_count Int       @default(0) @db.SmallInt
  locked_until       DateTime? @db.Timestamptz
  last_login_at      DateTime? @db.Timestamptz
  created_at         DateTime @default(now()) @db.Timestamptz
  updated_at         DateTime @updatedAt

  // Relations
  orders             Order[] @relation("CashierOrders")
  orders_voided      Order[] @relation("VoidedOrders")
  cash_registers     CashRegister[]
  feature_flags      FeatureFlag[]
  audit_logs         AuditLog[]
  revoked_tokens     RevokedToken[]
  stock_movements    StockMovement[]
  // ... more relations

  @@index([role])
}
```

#### `Category`
```prisma
model Category {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name       String   @unique @db.VarChar(50)
  sort_order Int      @default(0) @db.SmallInt
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamptz
  updated_at DateTime @updatedAt

  products Product[]
}
```

#### `Product`
```prisma
model Product {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name            String   @db.VarChar(100)
  category_id     String   @db.Uuid
  base_price      Decimal  @db.Decimal(12, 2)
  image_url       String?  @db.VarChar(255)
  is_active       Boolean  @default(true)
  is_out_of_stock Boolean  @default(false)
  sort_order      Int      @default(0) @db.SmallInt
  created_by      String?  @db.Uuid
  created_at      DateTime @default(now()) @db.Timestamptz
  updated_at      DateTime @updatedAt

  category        Category @relation(fields: [category_id], references: [id])
  modifier_groups ProductModifierGroup[]
  bom_recipes     BomRecipe[]

  @@index([category_id, sort_order])
}
```

#### `ProductModifierGroup` + `ProductModifierOption`
```prisma
model ProductModifierGroup {
  id             String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id     String  @db.Uuid
  name           String  @db.VarChar(50)
  is_required    Boolean @default(true)
  max_selections Int     @default(1) @db.SmallInt
  sort_order     Int     @default(0) @db.SmallInt
  is_active      Boolean @default(true)

  product Product @relation(fields: [product_id], references: [id], onDelete: Cascade)
  options  ProductModifierOption[]

  @@index([product_id])
}

model ProductModifierOption {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  group_id         String   @db.Uuid
  name             String   @db.VarChar(100)
  additional_price Decimal  @default(0) @db.Decimal(12, 2)
  sort_order       Int      @default(0) @db.SmallInt
  is_active        Boolean  @default(true)
  created_at       DateTime @default(now()) @db.Timestamptz
  updated_at       DateTime @updatedAt

  group    ProductModifierGroup @relation(fields: [group_id], references: [id], onDelete: Cascade)
  bom_recipes BomRecipe[]

  @@index([group_id, sort_order])
}
```

#### `Discount` — dengan `max_discount` (ADR-013)
```prisma
model Discount {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String        @db.VarChar(100)
  type              DiscountType
  value             Decimal       @db.Decimal(10, 2)
  max_discount      Decimal?      @db.Decimal(12, 2)  // ADR-013: cap absolut diskon
  scope             DiscountScope
  target_id         String?       @db.Uuid
  valid_from        DateTime      @db.Timestamptz
  valid_until       DateTime?     @db.Timestamptz
  applicable_days   Int[]         // 1=Senin..7=Minggu
  is_active         Boolean       @default(true)
  manually_disabled Boolean       @default(false)  // TINGGI-02: cron tidak bisa re-aktivasi
  created_by        String?       @db.Uuid

  creator User? @relation(fields: [created_by], references: [id])
  order_items OrderItem[]

  @@index([is_active, valid_from, valid_until])
}
```

#### `Order` — dengan `customer_name` + `transaction_number` (D-10)
```prisma
model Order {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id           String        @db.Uuid
  client_uuid          String        @unique @db.Uuid  // Idempotency key dari frontend
  transaction_number  String?       @unique @db.VarChar(20) // Format: TRX-YYYYMMDD-A001
  customer_name       String?       @db.VarChar(100)        // D-10: nama pelanggan antrean
  total_amount         Decimal       @db.Decimal(12, 2)
  discount_total       Decimal       @default(0) @db.Decimal(12, 2)
  cogs_total           Decimal       @default(0) @db.Decimal(12, 2)
  payment_method       PaymentMethod @default(cash)
  cash_amount          Decimal       @default(0) @db.Decimal(12, 2)
  qris_amount          Decimal       @default(0) @db.Decimal(12, 2)
  payment_gateway      String?       @db.VarChar(20)
  payment_gateway_ref  String?       @db.VarChar(100)
  payment_status       String?       @db.VarChar(30)
  qris_expiry_at       DateTime?     @db.Timestamptz
  payment_settled_at   DateTime?     @db.Timestamptz
  payment_raw_response String?       @db.Text
  status               OrderStatus   @default(completed)
  voided_by            String?       @db.Uuid
  voided_at            DateTime?     @db.Timestamptz
  void_reason          String?       @db.Text
  synced_from_offline  Boolean       @default(false)
  verification_status  String?       @db.VarChar(20)
  client_created_at    DateTime      @db.Timestamptz
  created_at           DateTime      @default(now()) @db.Timestamptz

  cashier User @relation("CashierOrders", fields: [cashier_id], references: [id])
  voider  User? @relation("VoidedOrders", fields: [voided_by], references: [id])
  items   OrderItem[]

  // PERFORMANCE indexes
  @@index([cashier_id, status, created_at(sort: Desc)])
  @@index([cashier_id, client_created_at(sort: Desc)])
  @@index([client_created_at(sort: Desc)])
  @@index([status])
  @@index([payment_method])
  @@index([payment_status, status])
  @@index([created_at(sort: Desc), cashier_id])
}
```

#### `OrderItem` — dengan formula diskon TINGGI-04
```prisma
model OrderItem {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_id              String   @db.Uuid
  product_id            String   @db.Uuid
  product_name_snapshot String   @db.VarChar(100)
  base_price            Decimal  @db.Decimal(12, 2)   // Harga dasar SAAT order
  discount_amount       Decimal  @default(0) @db.Decimal(12, 2) // TINGGI-04: dari base_price saja
  discount_id           String?  @db.Uuid
  discounted_base       Decimal  @db.Decimal(12, 2)   // base_price - discount_amount
  modifier_total        Decimal  @default(0) @db.Decimal(12, 2) // TINGGI-04: TIDAK kena diskon
  final_price           Decimal  @db.Decimal(12, 2)   // (discounted_base + modifier_total) * qty
  quantity              Int      @db.SmallInt
  subtotal              Decimal  @db.Decimal(12, 2)

  order     Order @relation(fields: [order_id], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [product_id], references: [id], onDelete: Restrict)
  discount  Discount? @relation(fields: [discount_id], references: [id])
  modifiers OrderItemModifier[]

  @@index([order_id])
  @@index([product_id])
  @@index([discount_id])
}
```

#### `OrderItemModifier`
```prisma
model OrderItemModifier {
  id                       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_item_id            String  @db.Uuid
  option_id                String  @db.Uuid
  group_name_snapshot      String  @db.VarChar(50)
  option_name_snapshot     String  @db.VarChar(100)
  additional_price_at_time Decimal @db.Decimal(12, 2)

  order_item OrderItem @relation(fields: [order_item_id], references: [id], onDelete: Cascade)
  option     ProductModifierOption @relation(fields: [option_id], references: [id], onDelete: Restrict)

  @@index([order_item_id])
}
```

#### `CashRegister` — Shift (D-09)
```prisma
model CashRegister {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id        String         @db.Uuid
  shift_date        DateTime       @db.Date   // D-09: anchor ke tanggal buka shift
  shift_start       DateTime       @default(now()) @db.Timestamptz
  shift_end         DateTime?      @db.Timestamptz
  opening_balance   Decimal        @default(500000) @db.Decimal(12, 2)
  closing_balance   Decimal?       @db.Decimal(12, 2)
  system_cash_total Decimal?       @db.Decimal(12, 2)
  discrepancy       Decimal?       @db.Decimal(12, 2)
  status            RegisterStatus @default(open)
  notes             String?        @db.Text

  cashier User @relation(fields: [cashier_id], references: [id])

  @@index([cashier_id, shift_date(sort: Desc)])
  @@index([status])
  @@index([cashier_id, status])
  @@index([cashier_id, shift_date, status])
}
```

### 2.3 Inventory & BOM (D-16)

#### `RawMaterial` — Bahan Baku
```prisma
model RawMaterial {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String   @unique @db.VarChar(100)
  purchase_unit     String   @db.VarChar(20)
  purchase_qty      Decimal  @db.Decimal(10, 2)
  usage_unit        String   @db.VarChar(20)
  conversion_factor Decimal  @db.Decimal(10, 4)
  current_stock     Decimal  @default(0) @db.Decimal(10, 2)
  min_stock         Decimal  @default(0) @db.Decimal(10, 2)
  cost_per_unit     Decimal  @default(0) @db.Decimal(12, 2)
  supplier          String?  @db.VarChar(100)
  created_at        DateTime @default(now()) @db.Timestamptz
  updated_at        DateTime @updatedAt

  price_history RawMaterialPriceHistory[]
  bom_recipes   BomRecipe[]
  movements     StockMovement[]

  @@index([current_stock, min_stock])
}
```

#### `BomRecipe` — Bill of Materials
```prisma
model BomRecipe {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id           String?  @db.Uuid   // null = semua varian produk
  modifier_option_id   String?  @db.Uuid   // null = modifier default
  raw_material_id      String   @db.Uuid
  quantity_per_serving Decimal  @db.Decimal(10, 2)

  product         Product? @relation(fields: [product_id], references: [id], onDelete: Cascade)
  modifier_option ProductModifierOption? @relation(fields: [modifier_option_id], references: [id], onDelete: Cascade)
  raw_material    RawMaterial @relation(fields: [raw_material_id], references: [id], onDelete: Restrict)

  @@index([product_id])
  @@index([modifier_option_id])
}
```

#### `StockMovement`
```prisma
model StockMovement {
  id                 String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  raw_material_id    String            @db.Uuid
  type               StockMovementType
  quantity           Decimal           @db.Decimal(10, 2)
  reference_order_id String?           @db.Uuid
  notes              String?           @db.Text
  created_by         String?           @db.Uuid
  created_at         DateTime          @default(now()) @db.Timestamptz

  raw_material RawMaterial @relation(fields: [raw_material_id], references: [id], onDelete: Restrict)
  actor       User? @relation(fields: [created_by], references: [id])
  order       Order? @relation(fields: [reference_order_id], references: [id])

  @@index([raw_material_id, created_at(sort: Asc)])
  @@index([raw_material_id, type, created_at(sort: Desc)])
  @@index([reference_order_id])
}
```

### 2.4 Finance & Operational

#### `ProfitShareLog` — Profit Share (D-11)
```prisma
model ProfitShareLog {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  period_month        DateTime  @unique @db.Date
  total_revenue       Decimal   @db.Decimal(14, 2)
  total_hpp           Decimal   @default(0) @db.Decimal(14, 2)
  total_opex          Decimal   @default(0) @db.Decimal(14, 2)
  total_depreciation  Decimal   @default(0) @db.Decimal(14, 2)
  net_profit          Decimal   @db.Decimal(14, 2)
  owner_share         Decimal   @db.Decimal(14, 2)  // 60%
  cashier_share       Decimal   @db.Decimal(14, 2)  // 40%
  cashier_paid_amount Decimal?  @db.Decimal(14, 2)
  cashier_paid_at     DateTime? @db.Timestamptz
  cashier_paid_by     String?   @db.Uuid
  is_hpp_actual       Boolean   @default(false)
  is_paid             Boolean   @default(false)
  notes               String?   @db.Text

  payer User? @relation(fields: [cashier_paid_by], references: [id])
}
```

#### `OperationalExpense`
```prisma
model OperationalExpense {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  category     String   @db.VarChar(50)
  description  String?  @db.VarChar(200)
  amount       Decimal  @db.Decimal(12, 2)
  expense_date DateTime @db.Date
  created_by   String?  @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz

  creator User? @relation(fields: [created_by], references: [id])
}
```

#### `Asset` + `AuditLog` + `RevokedToken` + `FeatureFlag` + `Setting` + `IpLockout`
(Sama seperti schema aktual — tidak ada perubahan)

---

## 3. Business Rules

### 3.1 Kalkulasi Harga (TINGGI-04)

> **TINGGI-04:** Diskon dihitung dari `base_price` produk, modifier/topping TIDAK ikut kena diskon.

```
item.subtotal = (base_price - discount_amount + modifier_total) * quantity
item.final_price = item.subtotal
```

**Contoh:**
- Produk: Cimol Keju, base_price = Rp 15.000
- Modifier: +Keju Mozarella = Rp 3.000
- Diskon: 10%
- Kalkulasi:
  - discount_amount = 15.000 * 10% = Rp 1.500
  - discounted_base = 15.000 - 1.500 = Rp 13.500
  - modifier_total = Rp 3.000 (TIDAK kena diskon)
  - subtotal = (13.500 + 3.000) * 1 = Rp 16.500

### 3.2 Idempotency Pattern

Semua endpoint state-changing (`payment`, `void`, `closeShift`) menggunakan `SELECT ... FOR UPDATE`:

```sql
BEGIN;
SELECT ... FOR UPDATE WHERE id = $1 AND status = 'pending';
-- Jika status sudah target → ROLLBACK + return current state
-- Jika status belum target → proceed dengan update
COMMIT;
```

### 3.3 Shift = Business Date (D-09)

- `CashRegister.shift_date` di-set saat `openShift()` berdasarkan tanggal buka shift
- Semua laporan agregasi HARUS filter: `shift_start..shift_end/now`
- Order yang dibuat jam 01:00 (lintas tengah malam) tetap tercatat di hari shift dibuka (bukan hari pembuatan)

### 3.4 Format Nomor Transaksi (Format A)

```
TRX-YYYYMMDD-[cashier_letter][3digit]
Contoh: TRX-20260616-A001
```

- `cashier_letter`: A-Z (berdasarkan username kasir pertama karakter)
- `3digit`: 001-999 per kasir per hari, reset setiap hari
- Disimpan di `Order.transaction_number` (unique, nullable)

---

## 4. Architecture Decision Records

### ADR-001: Formula Diskon (TINGGI-04)
**Opsi A (Dipilih):** Diskon dihitung dari `base_price` SAJA. Modifier/topping TIDAK kena diskon.
**Alternatif:** Diskon dari total (base_price + modifier). Dianggap terlalu kompleks untuk warung.

### ADR-002: Frontend Framework
**Dipilih:** SvelteKit + `adapter-static`. Bundle kecil, Caddy serve static files langsung.

### ADR-003: Auth Strategy
**Dipilih:** JWT tanpa refresh token. RevokedToken table untuk logout/revoke saja.

### ADR-004: Printer Strategy
**Dipilih:** HTML Print Dialog (`window.print()`) + CSS `@media print`. 100% browser-compatible.

### ADR-005: Database Partitioning
**Dipilih:** Tidak partisi. Exit criteria: >5 juta baris ATAU P95 >500ms.

### ADR-006: PgBouncer
**Dipilih:** Dihapus. NestJS connect langsung ke Postgres. Skala 1-3 kasir tidak butuh pooling terpisah.

### ADR-013: Max Discount Cap
**Dipilih:** Tambahkan kolom `max_discount` (DECIMAL, nullable) ke tabel `Discount`. Jika null = tanpa cap.

### ADR-014: BOM Inventory
**Dipilih:** BOM per modifier-option level. Support varian produk + bahan baku terpisah.

### ADR-015: Shift-Anchor Date
**Dipilih:** `shift_date` di-anchor saat `openShift()`, bukan `created_at::date`.

### ADR-016: Audit Logging
**Dipilih:**Semua mutating request di-log via interceptor. Actor, action, entity, old/new value, IP, timestamp.

---

## 5. Infrastructure

### 5.1 Docker Compose (tanpa PgBouncer — D-06)

```yaml
version: '3.9'
networks:
  ngemiloh-net:
    driver: bridge
volumes:
  postgres-data:
  redis-data:
  caddy-data:
  caddy-config:

services:
  postgres:
    image: postgres:16-alpine
    container_name: ngemiloh-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ngemiloh_db
      POSTGRES_USER: ngemiloh
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ngemiloh-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ngemiloh -d ngemiloh_db"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1G

  redis:
    image: redis:7-alpine
    container_name: ngemiloh-redis
    restart: unless-stopped
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - ngemiloh-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 128M

  nestjs-api:
    image: ${API_IMAGE:-ngemiloh-api:latest}
    container_name: ngemiloh-api
    restart: unless-stopped
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://ngemiloh:${POSTGRES_PASSWORD}@postgres:5432/ngemiloh_db
      REDIS_URL: redis://redis:6379
    networks:
      - ngemiloh-net
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M

  caddy:
    image: caddy:2-alpine
    container_name: ngemiloh-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - ngemiloh-net
    depends_on:
      nestjs-api:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 64M
```

### 5.2 Caddyfile (D-04 + D-05)

```caddyfile
{
    email {$CADDY_EMAIL}
}

# ─── FRONTEND (SvelteKit Static) ───────────────────────────────
{$DOMAIN} {
    reverse_proxy ngemiloh-frontend:8080
    encode gzip zstd
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        -Server
    }
}

# ─── BACKEND (NestJS API) ──────────────────────────────────────
api.{$DOMAIN} {
    reverse_proxy nestjs-api:3000 {
        health_uri /health
        health_interval 30s
        health_timeout 5s
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # SSE: disable buffering
    @sse path /api/v1/orders/*/sse
    handle @sse {
        reverse_proxy nestjs-api:3000 {
            flush_interval -1
        }
    }

    encode gzip zstd
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        -Server
    }
}
```

### 5.3 Environment Variables

```bash
# ─── DOMAIN ─────────────────────────────────────────────────────
DOMAIN=103-150-227-117.nip.io
CADDY_EMAIL=nabilah.fnb@gmail.com

# ─── DATABASE ───────────────────────────────────────────────────
POSTGRES_PASSWORD=<strong-password-min32chars>
DATABASE_URL=postgresql://ngemiloh:${POSTGRES_PASSWORD}@postgres:5432/ngemiloh_db

# ─── REDIS ─────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── APP ───────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta
CORS_ORIGIN=https://103-150-227-117.nip.io

# ─── JWT (D-01: tanpa refresh token) ────────────────────────────
JWT_ACCESS_SECRET=<generate-64-hex>
JWT_ACCESS_EXPIRY=20h

# ─── SECURITY ─────────────────────────────────────────────────
PIN_PEPPER_SECRET=<generate-64-hex>

# ─── MIDTRANS ─────────────────────────────────────────────────
MIDTRANS_ENV=sandbox
QRIS_EXPIRY_SECONDS=900

# ─── EMAIL ─────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=nabilah.fnb@gmail.com
EMAIL_APP_PASSWORD=<gmail-app-password>
EMAIL_FROM="Ngemiloh POS <nabilah.fnb@gmail.com>"
```

---

## 6. Security

### 6.1 Auth Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/auth/login/cashier` | Login kasir: `{ pin }` → JWT 20h |
| POST | `/api/v1/auth/login` | Login admin: `{ username, pin }` → JWT 12h (Opsi A, tanpa OTP) |
| POST | `/api/v1/auth/logout` | Revoke token → insert ke `RevokedToken` |

### 6.2 Rate Limiting

- General: 100 req/menit
- Login: 5 req/10 menit per IP
- Setelah 5 failed attempts → IP lockout 15 menit

### 6.3 CSRF Protection

- Token CSRF di-generate saat login
- Header `X-CSRF-Token` wajib untuk semua mutating requests (POST/PUT/PATCH/DELETE)

---

## 7. NFR (Non-Functional Requirements)

| Requirement | Target |
|------------|--------|
| Uptime | 99.5% per bulan |
| Response time (API) | P95 < 200ms |
| Time to first byte | < 1s |
| Offline grace period | 15 menit tanpa transaksi |
| JS bundle size | < 200KB gzip |
| QRIS expiry | 15 menit |

---

## 8. Pending Items (Non-Blocking)

- Alamat outlet untuk header struk → placeholder `(menyusul)`
- Instagram resmi → placeholder `@ngemiloh.id`
- QR pengaduan → slot kosong di struk
- Konfirmasi "jenis pesanan" jika bukan takeaway

---

*Document generated: 2026-06-16*
*Sources: PRD v5.0 (D-01..D-16) + REKOMENDASI v4.1 (ADR-013..ADR-016) + Prisma schema aktual*
