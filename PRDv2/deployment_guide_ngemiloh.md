# Deployment Guide — Ngemiloh POS FINAL

> **Status:** FINAL (2026-06-16)
> **Canonical source:** PRD_Ngemiloh_POS_FINAL.md
> **Base:** PRD v3.1 Amendment + decisions D-01..D-16

---

## Ringkasan Perubahan dari v3.1

| # | Perubahan | Alasan |
|---|---------|--------|
| 1 | **Hapus PgBouncer** — langsung koneksi postgres | D-06: tidak ada PgBouncer; Prisma 6 + connection_limit=1 sudah cukup |
| 2 | **Domain nip.io** — `103-150-227-117.nip.io` | D-04/D-05: static IP tanpa domain custom |
| 3 | **`transaction_number`** — Format A (`TRX-YYYYMMDD-A001`) | ADR-002 |
| 4 | **`customer_name`** di Order | D-10: nama pelanggan di struk |
| 5 | **`max_discount`** di Discount | ADR-013 |
| 6 | **Non-partisi orders** — flat table, index tepat | ADR-005: exit criteria >5M baris ATAU P95>500ms |
| 7 | **BOM/RawMaterial schema** — sudah ada di codebase | D-16 |
| 8 | **Admin login TANPA OTP** (Opsi A) | D-03 |

---

## 1. Folder Structure

```
ngemiloh/
├── backend/
│   ├── src/
│   ├── prisma/
│   │   └── schema.prisma          ← Actual production schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── .env.example
│   ├── caddy/
│   │   └── Caddyfile
│   └── redis/
│       └── redis.conf
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 2. `docker-compose.yml` — TANPA PgBouncer

```yaml
version: '3.9'

networks:
  ngemiloh-net:
    driver: bridge

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  caddy-data:
    driver: local
  caddy-config:
    driver: local

services:

  # ─── DATABASE ──────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: ngemiloh-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ngemiloh_db
      POSTGRES_USER: ngemiloh
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - ngemiloh-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ngemiloh -d ngemiloh_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1G

  # ─── CACHE ─────────────────────────────────────────────────
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

  # ─── BACKEND ───────────────────────────────────────────────
  nestjs-api:
    image: ${API_IMAGE:-ngemiloh-api:latest}
    container_name: ngemiloh-api
    restart: unless-stopped
    env_file:
      - .env
    environment:
      # Langsung ke postgres — TANPA PgBouncer
      DATABASE_URL: postgresql://ngemiloh:${POSTGRES_PASSWORD}@postgres:5432/ngemiloh_db?connection_limit=1
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
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 512M

  # ─── FRONTEND (built static, served by Caddy) ───────────────
  ngemiloh-frontend:
    image: ${FRONTEND_IMAGE:-ngemiloh-frontend:latest}
    container_name: ngemiloh-frontend
    restart: unless-stopped
    networks:
      - ngemiloh-net
    deploy:
      resources:
        limits:
          memory: 64M

  # ─── REVERSE PROXY ─────────────────────────────────────────
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
    environment:
      DOMAIN: ${DOMAIN}
      CADDY_EMAIL: ${CADDY_EMAIL}
    deploy:
      resources:
        limits:
          memory: 64M
```

---

## 3. `Caddyfile` — nip.io Domain

```caddyfile
{
    email {$CADDY_EMAIL}
    servers {
        protocol {
            experimental_http3
        }
    }
}

# ─── FRONTEND ────────────────────────────────────────────────
{$DOMAIN} {
    reverse_proxy ngemiloh-frontend:8080

    encode gzip zstd

    header {
        X-Frame-Options            "DENY"
        X-Content-Type-Options     "nosniff"
        X-XSS-Protection           "1; mode=block"
        Referrer-Policy            "strict-origin-when-cross-origin"
        Strict-Transport-Security  "max-age=31536000; includeSubDomains; preload"
        -Server
    }
}

# ─── BACKEND API ─────────────────────────────────────────────
api.{$DOMAIN} {
    reverse_proxy nestjs-api:3000 {
        health_uri /health
        health_interval 30s
        health_timeout 5s

        header_up X-Real-IP       {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # SSE — disable buffering (flush_interval -1)
    @sse {
        path /api/v1/orders/*/sse
    }
    handle @sse {
        reverse_proxy nestjs-api:3000 {
            flush_interval -1
        }
    }

    encode gzip zstd

    header {
        X-Frame-Options        "DENY"
        X-Content-Type-Options "nosniff"
        -Server
    }
}
```

---

## 4. `.env.example`

```bash
# ─── DOMAIN (nip.io) ─────────────────────────────────────────
DOMAIN=103-150-227-117.nip.io
CADDY_EMAIL=nabilah.fnb@gmail.com

# ─── DATABASE ────────────────────────────────────────────────
POSTGRES_PASSWORD=GANTI_PASSWORD_KUAT_MIN_32_CHAR

# NestJS baca DATABASE_URL langsung (langsung ke postgres, tanpa PgBouncer)
DATABASE_URL=postgresql://ngemiloh:POSTGRES_PASSWORD@postgres:5432/ngemiloh_db?connection_limit=1

# ─── REDIS ───────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── APP ─────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
TZ=Asia/Jakarta
CORS_ORIGIN=https://103-150-227-117.nip.io

# ─── JWT (8h untuk kasir, 12h untuk admin) ───────────────────
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=GENERATE_RANDOM_64_HEX

# ─── SECURITY ────────────────────────────────────────────────
# ⚠️ PIN_PEPPER_SECRET JANGAN DIUBAH setelah production!
# Jika diubah, semua kasir tidak bisa login.
PIN_PEPPER_SECRET=GENERATE_RANDOM_64_HEX_LAGI

# ─── MIDTRANS QRIS ───────────────────────────────────────────
MIDTRANS_ENV=sandbox
MIDTRANS_SERVER_KEY_SANDBOX=<YOUR_SANDBOX_SERVER_KEY>
MIDTRANS_CLIENT_KEY_SANDBOX=<YOUR_SANDBOX_CLIENT_KEY>
MIDTRANS_SERVER_KEY_PRODUCTION=<YOUR_PRODUCTION_SERVER_KEY>
MIDTRANS_CLIENT_KEY_PRODUCTION=<YOUR_PRODUCTION_CLIENT_KEY>
QRIS_EXPIRY_SECONDS=900

# ─── EMAIL (OTP admin — TIDAK AKTIF, Opsi A tanpa OTP) ───────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=nabilah.fnb@gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
EMAIL_FROM="Ngemiloh POS <nabilah.fnb@gmail.com>"

# ─── BACKBLAZE B2 BACKUP ─────────────────────────────────────
B2_KEY_ID=XXXXXXXXXXXXXXXXXXXXXXXX
B2_APP_KEY=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
B2_BUCKET=ngemiloh-backup

# ─── UMAMI ANALYTICS (optional) ──────────────────────────────
# Comment out if not using Umami
# UMAMI_DB_PASSWORD=GENERATE_PASSWORD
# UMAMI_APP_SECRET=GENERATE_RANDOM_64_HEX
# UMAMI_WEBSITE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# ─── DOCKER IMAGES ───────────────────────────────────────────
API_IMAGE=ngemiloh-api:latest
FRONTEND_IMAGE=ngemiloh-frontend:latest
```

---

## 5. `redis.conf`

```conf
# ─── PERSISTENCE ─────────────────────────────────────────────
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no

save 3600 1
save 300 100

# ─── MEMORY ──────────────────────────────────────────────────
maxmemory 100mb
maxmemory-policy allkeys-lru

# ─── KEAMANAN ────────────────────────────────────────────────
bind 0.0.0.0
protected-mode no

# ─── PERFORMANCE ─────────────────────────────────────────────
tcp-keepalive 300
timeout 0
loglevel notice
```

---

## 6. Prisma `schema.prisma` — Production Schema

> Schema aktual dari `backend/prisma/schema.prisma`. Hanya kolom di schema ini yang valid.

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  kasir
  superadmin
}

enum DiscountType {
  percentage
  fixed_amount
}

enum DiscountScope {
  all_products
  category
  specific_product
}

enum PaymentMethod {
  cash
  qris
  split
}

enum OrderStatus {
  completed
  voided
  pending_sync
}

enum RegisterStatus {
  open
  closed
}

enum StockMovementType {
  in
  out
  adjustment
  waste
}

enum RefundMethod {
  cash
  transfer
  original_payment
  manual_cash
  store_credit
}

// ─── USERS ───────────────────────────────────────────────────
model User {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name               String    @db.VarChar(100)
  username           String    @unique @db.VarChar(50)
  email              String?   @unique @db.VarChar(150)
  pin_hash           String?   @db.VarChar(72)
  password_hash      String?   @db.VarChar(72)
  role               Role
  is_active          Boolean   @default(true)
  must_change_pin    Boolean   @default(false)
  failed_login_count Int       @default(0) @db.SmallInt
  locked_until       DateTime? @db.Timestamptz
  last_login_at      DateTime? @db.Timestamptz
  created_at         DateTime  @default(now()) @db.Timestamptz
  updated_at         DateTime  @updatedAt @db.Timestamptz

  orders             Order[]
  orders_voided      Order[]
  refunds            OrderRefund[]
  cash_registers     CashRegister[]
  expenses           OperationalExpense[]
  profit_shares_paid ProfitShareLog[]
  feature_flags      FeatureFlag[]
  settings           Setting[]
  audit_logs         AuditLog[]
  revoked_tokens     RevokedToken[]
  stock_movements    StockMovement[]
  price_histories    RawMaterialPriceHistory[]

  @@index([role])
}

// ─── CATEGORIES ──────────────────────────────────────────────
model Category {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name       String   @unique @db.VarChar(50)
  sort_order Int      @default(0) @db.SmallInt
  is_active  Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamptz
  updated_at DateTime @updatedAt @db.Timestamptz

  products Product[]
}

// ─── PRODUCTS ────────────────────────────────────────────────
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
  updated_at      DateTime @updatedAt @db.Timestamptz

  category        Category               @relation(fields: [category_id], references: [id])
  creator         User?                  @relation(fields: [created_by], references: [id])
  modifier_groups ProductModifierGroup[]
  order_items     OrderItem[]
  bom_recipes     BomRecipe[]

  @@index([category_id, sort_order])
}

// ─── MODIFIER GROUPS & OPTIONS ───────────────────────────────
model ProductModifierGroup {
  id             String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id     String  @db.Uuid
  name           String  @db.VarChar(50)
  is_required    Boolean @default(true)
  max_selections Int     @default(1) @db.SmallInt
  sort_order     Int     @default(0) @db.SmallInt
  is_active      Boolean @default(true)

  product Product                 @relation(fields: [product_id], references: [id], onDelete: Cascade)
  options ProductModifierOption[]

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
  updated_at       DateTime @updatedAt @db.Timestamptz

  group        ProductModifierGroup @relation(fields: [group_id], references: [id], onDelete: Cascade)
  order_item_modifiers OrderItemModifier[]
  bom_recipes          BomRecipe[]

  @@index([group_id, sort_order])
}

// ─── DISCOUNTS ───────────────────────────────────────────────
model Discount {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String        @db.VarChar(100)
  type              DiscountType
  value             Decimal       @db.Decimal(10, 2)
  max_discount      Decimal?      @db.Decimal(10, 2)  // ADR-013: cap untuk percentage discount
  scope             DiscountScope
  target_id         String?       @db.Uuid             // category/product ID jika scope != all_products
  valid_from        DateTime      @db.Timestamptz
  valid_until       DateTime?     @db.Timestamptz
  applicable_days   Int[]                              // [1..7], null = every day
  is_active         Boolean       @default(true)
  manually_disabled Boolean       @default(false)       // TINGGI-02: admin override
  created_by        String?       @db.Uuid

  creator     User?       @relation(fields: [created_by], references: [id])
  order_items OrderItem[]

  @@index([is_active, valid_from, valid_until])
}

// ─── ORDERS ──────────────────────────────────────────────────
// ⚠️ NON-PARTISI: flat table, index tepat. Partisi jika >5M baris ATAU P95>500ms (ADR-005)
// transaction_number: Format A = TRX-YYYYMMDD-A001 (prefix huruf increment per tanggal)
model Order {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id           String        @db.Uuid
  client_uuid          String        @unique @db.Uuid
  transaction_number   String?       @unique @db.VarChar(20)  // Format: TRX-YYYYMMDD-A001
  customer_name        String?       @db.VarChar(100)          // D-10: nama pelanggan
  total_amount         Decimal       @db.Decimal(12, 2)
  discount_total       Decimal       @default(0) @db.Decimal(12, 2)
  cogs_total           Decimal       @default(0) @db.Decimal(12, 2)  // HPP dari BOM
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
  verification_status  String?       @db.VarChar(20)   // 'Perlu Cek' | 'Valid'
  client_created_at    DateTime      @db.Timestamptz   // dari offline client
  created_at           DateTime      @default(now()) @db.Timestamptz

  cashier         User             @relation("CashierOrders", fields: [cashier_id], references: [id])
  voider          User?            @relation("VoidedOrders", fields: [voided_by], references: [id])
  items           OrderItem[]
  refunds         OrderRefund[]
  stock_movements StockMovement[]

  @@index([cashier_id, status, created_at(sort: Desc)])
  @@index([cashier_id, client_created_at(sort: Desc)])
  @@index([client_created_at(sort: Desc)])
  @@index([status])
  @@index([payment_method])
  @@index([payment_status, status])
  @@index([created_at(sort: Desc), cashier_id])
}

// ─── ORDER ITEMS ─────────────────────────────────────────────
// TINGGI-04: discount dihitung dari base_price, modifier TIDAK ikut didiskon
model OrderItem {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_id              String   @db.Uuid
  product_id            String   @db.Uuid
  product_name_snapshot String   @db.VarChar(100)
  base_price            Decimal  @db.Decimal(12, 2)
  discount_amount       Decimal  @default(0) @db.Decimal(12, 2)  // dari base_price saja
  discount_id           String?  @db.Uuid
  discounted_base       Decimal  @db.Decimal(12, 2)
  modifier_total        Decimal  @default(0) @db.Decimal(12, 2)  // TIDAK didiskon
  final_price           Decimal  @db.Decimal(12, 2)
  quantity              Int      @db.SmallInt
  subtotal              Decimal  @db.Decimal(12, 2)

  order     Order               @relation(fields: [order_id], references: [id], onDelete: Cascade)
  product   Product             @relation(fields: [product_id], references: [id], onDelete: Restrict)
  discount  Discount?           @relation(fields: [discount_id], references: [id])
  modifiers OrderItemModifier[]

  @@index([order_id])
  @@index([product_id])
  @@index([discount_id])
}

model OrderItemModifier {
  id                       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_item_id            String  @db.Uuid
  option_id                String  @db.Uuid
  group_name_snapshot      String  @db.VarChar(50)
  option_name_snapshot     String  @db.VarChar(100)
  additional_price_at_time Decimal @db.Decimal(12, 2)

  order_item OrderItem             @relation(fields: [order_item_id], references: [id], onDelete: Cascade)
  option     ProductModifierOption @relation(fields: [option_id], references: [id], onDelete: Restrict)

  @@index([order_item_id])
}

model OrderRefund {
  id            String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_id      String       @db.Uuid
  amount        Decimal      @db.Decimal(12, 2)
  refund_method RefundMethod @default(manual_cash)
  refunded_by   String       @db.Uuid
  refunded_at   DateTime     @default(now()) @db.Timestamptz
  notes         String?      @db.Text

  order    Order @relation(fields: [order_id], references: [id])
  refunder User  @relation(fields: [refunded_by], references: [id])
}

// ─── CASH REGISTER / SHIFT ───────────────────────────────────
// Shift = business date anchor (bukan created_at::date)
model CashRegister {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id        String         @db.Uuid
  shift_date        DateTime       @db.Date          // Business date (D-09)
  shift_start       DateTime       @default(now()) @db.Timestamptz
  shift_end         DateTime?      @db.Timestamptz
  opening_balance   Decimal        @default(500000) @db.Decimal(12, 2)
  closing_balance   Decimal?       @db.Decimal(12, 2)
  system_cash_total Decimal?       @db.Decimal(12, 2)
  discrepancy       Decimal?       @db.Decimal(12, 2)
  status            RegisterStatus @default(open)
  notes             String?        @db.Text

  cashier User @relation(fields: [cashier_id], references: [id])

  @@unique([cashier_id, shift_date])
  @@index([cashier_id, shift_date(sort: Desc)])
  @@index([status])
  @@index([cashier_id, status])
  @@index([cashier_id, shift_date, status])
}

// ─── OPERATIONAL EXPENSES ────────────────────────────────────
model OperationalExpense {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  category     String   @db.VarChar(50)
  description  String?  @db.VarChar(200)
  amount       Decimal  @db.Decimal(12, 2)
  expense_date DateTime @db.Date
  created_by   String?  @db.Uuid
  created_at   DateTime @default(now()) @db.Timestamptz

  creator User? @relation(fields: [created_by], references: [id])

  @@index([expense_date])
}

// ─── ASSETS ──────────────────────────────────────────────────
model Asset {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                 String   @db.VarChar(100)
  purchase_price       Decimal  @default(0) @db.Decimal(12, 2)
  useful_life_months   Int      @db.SmallInt
  monthly_depreciation Decimal  @db.Decimal(12, 2)
  purchase_date        DateTime @db.Date
  is_active            Boolean  @default(true)
  created_at           DateTime @default(now()) @db.Timestamptz
}

// ─── PROFIT SHARE ────────────────────────────────────────────
model ProfitShareLog {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  period_month        DateTime  @unique @db.Date
  total_revenue       Decimal   @db.Decimal(14, 2)
  total_hpp           Decimal   @default(0) @db.Decimal(14, 2)
  total_opex          Decimal   @default(0) @db.Decimal(14, 2)
  total_depreciation  Decimal   @default(0) @db.Decimal(14, 2)
  net_profit          Decimal   @db.Decimal(14, 2)
  owner_share         Decimal   @db.Decimal(14, 2)
  cashier_share       Decimal   @db.Decimal(14, 2)
  cashier_paid_amount Decimal?  @db.Decimal(14, 2)
  cashier_paid_at     DateTime? @db.Timestamptz
  cashier_paid_by     String?   @db.Uuid
  is_hpp_actual       Boolean   @default(false)
  is_paid             Boolean   @default(false)
  payment_proof       String?   @db.Text
  notes               String?   @db.Text

  payer User? @relation(fields: [cashier_paid_by], references: [id])
}

// ─── FEATURE FLAGS ───────────────────────────────────────────
model FeatureFlag {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @unique @db.VarChar(100)
  is_enabled  Boolean  @default(false)
  description String?  @db.Text
  updated_by  String?  @db.Uuid
  updated_at  DateTime @default(now()) @db.Timestamptz

  updater User? @relation(fields: [updated_by], references: [id])
}

// ─── SETTINGS ────────────────────────────────────────────────
model Setting {
  key        String   @id @db.VarChar(100)
  value      String   @db.Text
  updated_by String?  @db.Uuid
  updated_at DateTime @updatedAt @db.Timestamptz

  updater User? @relation(fields: [updated_by], references: [id])
}

// ─── AUDIT LOGS ──────────────────────────────────────────────
model AuditLog {
  id          BigInt   @id @default(autoincrement())
  actor_id    String?  @db.Uuid
  action      String   @db.VarChar(100)
  entity_type String?  @db.VarChar(50)
  entity_id   String?  @db.VarChar(100)
  old_value   Json?    @db.JsonB
  new_value   Json?    @db.JsonB
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now()) @db.Timestamptz

  actor User? @relation(fields: [actor_id], references: [id])

  @@index([actor_id, created_at(sort: Desc)])
  @@index([action, created_at(sort: Desc)])
  @@index([actor_id, action, created_at(sort: Desc)])
  @@index([entity_type, entity_id])
}

// ─── REVOKED TOKENS ──────────────────────────────────────────
model RevokedToken {
  jti        String   @id @db.VarChar(64)
  user_id    String   @db.Uuid
  expires_at DateTime @db.Timestamptz
  revoked_at DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [user_id], references: [id])

  @@index([expires_at])
}

// ─── FASE 2: LOYALTY & INVENTORY ─────────────────────────────

model Customer {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  phone          String   @unique @db.VarChar(20)
  name           String   @db.VarChar(100)
  loyalty_points Int      @default(0)
  registered_via String?  @db.VarChar(50)
  created_at     DateTime @default(now()) @db.Timestamptz

  @@index([phone])
}

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
  updated_at        DateTime @updatedAt @db.Timestamptz

  price_history RawMaterialPriceHistory[]
  bom_recipes   BomRecipe[]
  movements     StockMovement[]

  @@index([current_stock, min_stock])
}

model RawMaterialPriceHistory {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  raw_material_id String   @db.Uuid
  cost_per_unit   Decimal  @db.Decimal(12, 2)
  valid_from      DateTime @default(now()) @db.Timestamptz
  recorded_by     String?  @db.Uuid

  raw_material RawMaterial @relation(fields: [raw_material_id], references: [id], onDelete: Cascade)
  recorder     User?       @relation(fields: [recorded_by], references: [id])
}

model BomRecipe {
  id                   String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id           String?  @db.Uuid
  modifier_option_id   String?  @db.Uuid
  raw_material_id      String   @db.Uuid
  quantity_per_serving Decimal  @db.Decimal(10, 2)

  product        Product?               @relation(fields: [product_id], references: [id], onDelete: Cascade)
  modifier_option ProductModifierOption? @relation(fields: [modifier_option_id], references: [id], onDelete: Cascade)
  raw_material   RawMaterial            @relation(fields: [raw_material_id], references: [id], onDelete: Restrict)

  @@index([product_id])
  @@index([modifier_option_id])
}

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
  actor        User?       @relation(fields: [created_by], references: [id])
  order        Order?      @relation(fields: [reference_order_id], references: [id])

  @@index([raw_material_id, created_at(sort: Asc)])
  @@index([raw_material_id, type, created_at(sort: Desc)])
  @@index([reference_order_id])
}

model IpLockout {
  ip_address   String    @id @db.VarChar(50)
  failed_count Int       @default(0) @db.SmallInt
  locked_until DateTime? @db.Timestamptz
  created_at   DateTime  @default(now()) @db.Timestamptz
  updated_at   DateTime  @updatedAt @db.Timestamptz

  @@index([updated_at])
}
```

---

## 7. Seed Data

Di `backend/prisma/seed.ts`:

```typescript
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // ─── Superadmin ────────────────────────────────────────────
  // Opsi A: admin login langsung dengan email + password (TANPA OTP)
  const passwordHash = await bcrypt.hash('Nabil@Admin2026!', 12);
  await prisma.user.upsert({
    where: { email: 'nabilah.fnb@gmail.com' },
    update: {},
    create: {
      name: 'Super Admin',
      username: 'admin',
      email: 'nabilah.fnb@gmail.com',
      password_hash: passwordHash,
      role: Role.superadmin,
      is_active: true,
    },
  });

  // ─── Kasir (PIN 4 digit) ───────────────────────────────────
  const pinHash = await bcrypt.hash('1234', 12);
  await prisma.user.upsert({
    where: { username: 'kasir1' },
    update: {},
    create: {
      name: 'Kasir 1',
      username: 'kasir1',
      pin_hash: pinHash,
      role: Role.kasir,
      is_active: true,
    },
  });

  // ─── Kategori ──────────────────────────────────────────────
  const categories = ['Macaroni', 'Basreng', 'Mie', 'Tempe', 'Snack'];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, sort_order: categories.indexOf(name) },
    });
  }

  // ─── Feature Flags ─────────────────────────────────────────
  const flags = [
    { name: 'QRIS_PAYMENT',    description: 'Aktifkan pembayaran QRIS via Midtrans', is_enabled: true },
    { name: 'SPLIT_PAYMENT',   description: 'Aktifkan split payment (tunai + QRIS)', is_enabled: true },
    { name: 'DISCOUNT_SYSTEM', description: 'Aktifkan sistem diskon otomatis', is_enabled: true },
    { name: 'OFFLINE_MODE',    description: 'Aktifkan mode offline (Dexie)', is_enabled: true },
    { name: 'PROFIT_SHARE',    description: 'Aktifkan kalkulasi bagi hasil', is_enabled: false },
    { name: 'HPP_TRACKING',    description: 'Aktifkan tracking HPP bahan baku', is_enabled: false },
  ];
  for (const f of flags) {
    await prisma.featureFlag.upsert({
      where: { name: f.name },
      update: {},
      create: { ...f },
    });
  }

  // ─── Settings ──────────────────────────────────────────────
  const settings = [
    { key: 'store_name', value: 'Ngemiloh' },
    { key: 'store_address', value: '' },
    { key: 'store_phone', value: '' },
    { key: 'tax_rate', value: '0' },  // Include tax 0% (PB1)
    { key: 'opening_balance', value: '500000' },
    { key: 'qris_expiry_seconds', value: '900' },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log('Seed selesai');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

---

## 8. Deployment Steps

```bash
# 1. Clone repo
git clone https://github.com/YOUR_USERNAME/ngemiloh.git
cd ngemiloh/infra

# 2. Setup environment
cp .env.example .env
# Edit .env — isi semua nilai

# 3. Build images
docker build -t ngemiloh-api:latest ../backend
docker build -t ngemiloh-frontend:latest ../frontend

# 4. Start services (tanpa PgBouncer)
docker compose up -d

# 5. Run migrations
docker compose exec nestjs-api npx prisma migrate deploy

# 6. Seed data
docker compose exec nestjs-api npx prisma db seed

# 7. Verify
docker compose ps
curl https://api.103-150-227-117.nip.io/health
```

---

## 9. Troubleshooting

### `relation does not exist`
```bash
# Schema belum migrate
docker compose exec nestjs-api npx prisma migrate deploy
```

### Migration error
```bash
# Reset (HATI-HATI: hapus semua data!)
docker compose exec nestjs-api npx prisma migrate reset --force
docker compose exec nestjs-api npx prisma db seed
```

### Redis AOF error
```bash
docker compose exec redis redis-cli CONFIG SET stop-writes-on-bgsave-error no
# Permanent: chown -R 999:999 /var/lib/docker/volumes/infra_redis-data
```

### Caddy certificate error
```bash
# DNS belum propagate ke VPS IP
# Cek: https://dnschecker.org → A record untuk 103-150-227-117.nip.io
docker compose logs caddy
```

---

## 10. Go-Live Checklist

```bash
# Services healthy
docker compose ps  # Semua harus 'Up (healthy)'

# API healthy
curl https://api.103-150-227-117.nip.io/health

# HTTPS aktif
curl -I https://103-150-227-117.nip.io

# Database seeded
docker compose exec nestjs-api npx prisma studio

# Redis AOF
docker compose exec redis redis-cli CONFIG GET appendonly

# Admin login works
curl -X POST https://api.103-150-227-117.nip.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nabilah.fnb@gmail.com","pin":"Nabil@Admin2026!"}'
```

---

*Deployment Guide FINAL — Ngemiloh POS · 2026-06-16*
*Dokumen ini sinkron dengan PRD_Ngemiloh_POS_FINAL.md, API_CONTRACT_FINAL.md, FRONTEND_ARCH_FINAL.md*