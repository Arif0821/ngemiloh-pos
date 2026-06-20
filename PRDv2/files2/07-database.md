# 07. Database Schema Final

*[← 06-architecture.md](./06-architecture.md) | [→ 08-api-contract.md](./08-api-contract.md)*

---

> **Versi:** 4.1 — Perubahan dari v4.0 ditandai **`[v4.1]`** + nomor CR.

## Konvensi

- `snake_case` untuk semua nama tabel dan kolom
- UUID v4 via `gen_random_uuid()` sebagai primary key
- `NUMERIC(12,2)` untuk kolom uang; `NUMERIC(14,2)` untuk `profit_share_*`
- Soft delete via `is_active` — hard delete **DILARANG** untuk entitas yang sudah berelasi transaksi
- `audit_logs` bersifat **IMMUTABLE** (enforced via Row Level Security)
- Semua `TIMESTAMPTZ` default `NOW()` — disimpan UTC, di-render WIB di frontend
- Foreign key `ON DELETE RESTRICT` kecuali junction table atau child yang eksplisit `CASCADE`
- Tidak ada tabel `revoked_tokens` (hapus v4.0) dan tidak ada `sessions` di PostgreSQL — auth sepenuhnya Redis

---

## Ringkasan Perubahan Schema v4.0 → v4.1

| Perubahan | Tabel / Kolom | Nomor CR | Detail |
|-----------|--------------|----------|--------|
| **UPDATE** | `discounts` — tambah kolom `max_discount` | CR-008 | Cap nominal untuk diskon persentase |
| **UPDATE** | `orders.order_status` — tambah nilai `sync_failed` | CR-013 | State offline yang melebihi 2 jam retry |
| **UPDATE** | `orders.transaction_number` — perbarui comment/contoh format | CR-002 | `TRX-YYYYMMDD-[cashier_letter][seq3]` (bukan `K01-0042`) |
| **UPDATE** | `cash_registers` — hapus referensi `outlet_id` dari komentar | CR-004 | Multi-outlet ditambahkan saat Fase 3 via migration |
| **HAPUS** | Partisi `orders_2026/2027/2028` + `PARTITION BY RANGE` | CR-003 | Tabel `orders` tidak dipartisi di Fase 1–2 |
| **BARU** | `raw_materials` | — | Tabel bahan baku untuk BOM (Fase 1B) |
| **BARU** | `bom_items` | — | Junction BOM: produk ↔ bahan baku |
| **UPDATE** | `users.seed` — nama superadmin distandarkan ke Nabilah | OPEN-01 | Lihat `00-overview.md` |

---

## Total Tabel: 20 (v4.1)

```
users · categories · products · product_modifier_groups · product_modifier_options ·
discounts · discount_products · orders · order_items · order_item_modifiers ·
order_refunds · cash_registers · operational_expenses · assets ·
profit_share_logs · profit_share_details · feature_flags · settings ·
audit_logs · system_logs · raw_materials · bom_items
```

*(+2 dari v4.0: `raw_materials` & `bom_items` — sebelumnya "akan didefinisikan di PRD Fase 1B supplement")*

---

## 10.1 `users`

```sql
CREATE TABLE users (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(100) NOT NULL,
  username           VARCHAR(50)  NOT NULL UNIQUE,
  email              VARCHAR(150) UNIQUE,
  pin_hash           VARCHAR(72),          -- kasir: wajib. superadmin: opsional (login POS)
  password_hash      VARCHAR(72),          -- superadmin: wajib. kasir: NULL
  cashier_letter     CHAR(1)      UNIQUE,  -- kasir: A-Z unik. superadmin: NULL
  role               VARCHAR(20)  NOT NULL CHECK (role IN ('kasir', 'superadmin')),
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  must_change_pin    BOOLEAN      DEFAULT false,
  failed_login_count SMALLINT     DEFAULT 0,
  locked_until       TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_credentials CHECK (
    (role = 'kasir'      AND pin_hash IS NOT NULL) OR
    (role = 'superadmin' AND password_hash IS NOT NULL)
  ),
  CONSTRAINT chk_cashier_letter CHECK (
    (role = 'kasir'      AND cashier_letter IS NOT NULL) OR
    (role = 'superadmin' AND cashier_letter IS NULL)
  )
);
```

> **v4.1:** Kolom `cashier_letter` dipindah dari komentar ke definisi tabel eksplisit (sebelumnya hanya disebut di FR-CSH-01, tidak ada di schema v4.0). Digunakan untuk format nomor transaksi TRX-01 (CR-002).

---

## 10.2 `categories`

```sql
CREATE TABLE categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50) NOT NULL UNIQUE,
  sort_order SMALLINT    DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 10.3 `products`

```sql
CREATE TABLE products (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(100)  NOT NULL,
  category_id              UUID          NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  base_price               NUMERIC(12,2) NOT NULL CHECK (base_price > 0),
  image_url                VARCHAR(255),
  is_active                BOOLEAN       NOT NULL DEFAULT true,
  is_out_of_stock          BOOLEAN       NOT NULL DEFAULT false,
  sort_order               SMALLINT      DEFAULT 0,
  description              TEXT,

  -- HPP (Harga Pokok Penjualan)
  estimated_hpp            NUMERIC(12,2) DEFAULT 0 CHECK (estimated_hpp >= 0),
  hpp_notes                TEXT,
  hpp_source               VARCHAR(20)   NOT NULL DEFAULT 'manual_estimate'
                           CHECK (hpp_source IN ('manual_estimate', 'bom_calculated')),

  -- Scheduled price change
  new_base_price           NUMERIC(12,2) CHECK (new_base_price > 0),
  new_price_effective_from DATE,

  created_by               UUID          REFERENCES users(id),
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_price_schedule CHECK (
    (new_base_price IS NULL AND new_price_effective_from IS NULL) OR
    (new_base_price IS NOT NULL AND new_price_effective_from IS NOT NULL)
  )
);
```

---

## 10.4 `product_modifier_groups` & `product_modifier_options`

```sql
CREATE TABLE product_modifier_groups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name           VARCHAR(50) NOT NULL,
  is_required    BOOLEAN     NOT NULL DEFAULT true,
  max_selections SMALLINT    NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  sort_order     SMALLINT    DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE product_modifier_options (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID          NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name             VARCHAR(100)  NOT NULL,
  additional_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (additional_price >= 0),
  sort_order       SMALLINT      DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## 10.5 `discounts` `[v4.1 — CR-008]`

```sql
CREATE TABLE discounts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100)  NOT NULL,
  type            VARCHAR(10)   NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value           NUMERIC(12,2) NOT NULL CHECK (value > 0),

  -- [v4.1 — CR-008] Kolom baru: cap nominal untuk diskon persentase
  -- NULL = tidak ada cap. Hanya relevan jika type='percentage'.
  -- Contoh: diskon 10% dengan max_discount=5000 → potongan maks Rp 5.000
  max_discount    NUMERIC(12,2) CHECK (max_discount IS NULL OR max_discount > 0),

  scope           VARCHAR(10)   NOT NULL DEFAULT 'all'
                  CHECK (scope IN ('all', 'product')),

  -- Bitmask hari berlaku: 1=Sen, 2=Sel, 4=Rab, 8=Kam, 16=Jum, 32=Sab, 64=Min
  -- 127 = semua hari
  applicable_days SMALLINT      NOT NULL DEFAULT 127
                  CHECK (applicable_days >= 1 AND applicable_days <= 127),

  valid_from      TIMESTAMPTZ   NOT NULL,
  valid_to        TIMESTAMPTZ,             -- NULL = tanpa batas akhir
  is_active       BOOLEAN       NOT NULL DEFAULT false,
  created_by      UUID          REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_percentage_max CHECK (
    type != 'percentage' OR value <= 100
  ),
  -- max_discount hanya bermakna untuk type='percentage'
  CONSTRAINT chk_max_discount_type CHECK (
    max_discount IS NULL OR type = 'percentage'
  )
);
```

**Kalkulasi diskon (DISC-08 v4.1):**
```
type='percentage':
  raw = item_subtotal × (value / 100)
  discount_amount = IF max_discount IS NULL THEN raw ELSE MIN(raw, max_discount)

type='fixed':
  discount_amount = value

Keduanya: discount_amount = MIN(discount_amount, item_subtotal)  -- tidak boleh melebihi subtotal
```

---

## 10.6 `discount_products`

```sql
CREATE TABLE discount_products (
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (discount_id, product_id)
);
```

---

## 10.7 `orders` `[v4.1 — CR-002, CR-003, CR-013]`

```sql
CREATE TABLE orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id            UUID          NOT NULL REFERENCES users(id),
  client_uuid           UUID          NOT NULL UNIQUE,   -- idempotency offline (TC-08)

  -- [v4.1 — CR-002] Format: TRX-YYYYMMDD-[cashier_letter][seq3digit]
  -- Contoh: TRX-20260615-A001, TRX-20260615-A002, TRX-20260615-B001
  -- Berfungsi sekaligus sebagai nomor antrian pelanggan
  transaction_number    VARCHAR(25)   NOT NULL,

  total_amount          NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  discount_total        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),

  -- Flexible payment: method NULL saat order baru dibuat, diisi saat bayar
  payment_method        VARCHAR(10)
                        CHECK (payment_method IS NULL OR
                               payment_method IN ('cash', 'qris', 'split')),
  cash_amount           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cash_amount >= 0),
  qris_amount           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (qris_amount >= 0),
  cash_received         NUMERIC(12,2) DEFAULT 0 CHECK (cash_received >= 0),
  cash_change           NUMERIC(12,2) DEFAULT 0 CHECK (cash_change >= 0),

  -- Payment gateway fields (Midtrans)
  payment_gateway       VARCHAR(20),
  payment_gateway_ref   VARCHAR(100),
  qris_expiry_at        TIMESTAMPTZ,
  payment_settled_at    TIMESTAMPTZ,         -- [v4.1 — CR-006] nama kolom final
  payment_raw_response  TEXT,

  -- [v4.1 — CR-013] Tambah 'sync_failed' ke enum order_status
  order_status          VARCHAR(20)   NOT NULL DEFAULT 'completed'
                        CHECK (order_status IN (
                          'completed',    -- order selesai diproses kasir
                          'voided',       -- dibatalkan oleh superadmin
                          'cancelled',    -- dibatalkan sebelum selesai
                          'pending_sync', -- offline, belum sync ke server
                          'sync_failed'   -- [v4.1] retry >2 jam, butuh intervensi manual
                        )),

  payment_status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN (
                          'pending',      -- menunggu pembayaran
                          'settled',      -- pembayaran selesai
                          'expired',      -- QRIS expired
                          'failed',       -- pembayaran gagal
                          'not_required'  -- void/cancel
                        )),

  -- Void fields (wajib diisi saat void)
  voided_by             UUID          REFERENCES users(id),
  voided_at             TIMESTAMPTZ,
  void_reason           TEXT,

  -- Sync fields
  synced_from_offline   BOOLEAN       NOT NULL DEFAULT false,
  synced_at             TIMESTAMPTZ,

  -- Timestamps
  client_created_at     TIMESTAMPTZ   NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- [v4.1 — CR-003] TIDAK ada PARTITION BY RANGE
  -- Tabel biasa dengan index optimal — lihat 10.19 dan ADR-005 revisi

  CONSTRAINT chk_payment_amounts CHECK (
    (payment_status IN ('pending', 'expired', 'failed', 'not_required'))
    OR
    (payment_status = 'settled' AND (
      (payment_method = 'cash'  AND cash_amount  = total_amount AND qris_amount = 0) OR
      (payment_method = 'qris'  AND qris_amount  = total_amount AND cash_amount = 0) OR
      (payment_method = 'split' AND cash_amount + qris_amount  = total_amount
                                AND cash_amount > 0 AND qris_amount > 0)
    ))
  ),

  CONSTRAINT chk_void_fields CHECK (
    (order_status != 'voided')
    OR
    (order_status = 'voided'
     AND voided_by IS NOT NULL
     AND voided_at IS NOT NULL
     AND void_reason IS NOT NULL
     AND char_length(void_reason) >= 10)
  ),

  CONSTRAINT chk_cash_received CHECK (
    cash_received IS NULL OR cash_received >= cash_amount
  )
);
```

> **[v4.1 — CR-003]** Klausa `PARTITION BY RANGE (client_created_at)` **dihapus**. Tabel `orders` adalah tabel biasa (non-partitioned) di Fase 1–2. Exit criteria untuk re-evaluasi partisi di masa depan didokumentasikan di `05-nonfunctional-reqs.md §5.3` dan ADR-005 (revisi).

---

## 10.8 `order_items` & `order_item_modifiers`

```sql
CREATE TABLE order_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Snapshot saat order dibuat — tidak berubah meski produk diedit/diarsip
  product_name_snapshot VARCHAR(100)  NOT NULL,
  base_price            NUMERIC(12,2) NOT NULL CHECK (base_price > 0),
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_id           UUID          REFERENCES discounts(id),
  discounted_base       NUMERIC(12,2) NOT NULL,    -- = base_price - discount_amount
  modifier_total        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (modifier_total >= 0),
  final_price           NUMERIC(12,2) NOT NULL,    -- = discounted_base + modifier_total
  quantity              SMALLINT      NOT NULL CHECK (quantity >= 1 AND quantity <= 50),
  subtotal              NUMERIC(12,2) NOT NULL      -- = final_price × quantity
);

CREATE TABLE order_item_modifiers (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id            UUID          NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id                UUID          NOT NULL
                           REFERENCES product_modifier_options(id) ON DELETE RESTRICT,
  group_name_snapshot      VARCHAR(50)   NOT NULL,
  option_name_snapshot     VARCHAR(100)  NOT NULL,
  additional_price_at_time NUMERIC(12,2) NOT NULL CHECK (additional_price_at_time >= 0)
);
```

---

## 10.9 `order_refunds`

```sql
CREATE TABLE order_refunds (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  refund_method VARCHAR(30)   NOT NULL DEFAULT 'manual_cash',
  refunded_by   UUID          NOT NULL REFERENCES users(id),
  refunded_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes         TEXT,
  refund_status VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (refund_status IN ('pending', 'completed'))
);
```

---

## 10.10 `cash_registers` `[v4.1 — CR-004]`

```sql
CREATE TABLE cash_registers (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id        UUID          NOT NULL REFERENCES users(id),
  -- [v4.1 — CR-004] outlet_id DIHAPUS — akan ditambahkan via migration Fase 3
  shift_date        DATE          NOT NULL,
  shift_number      SMALLINT      NOT NULL DEFAULT 1,   -- shift ke-berapa hari ini
  opening_balance   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  closing_balance   NUMERIC(12,2),
  system_cash_total NUMERIC(12,2),
  actual_cash       NUMERIC(12,2),                      -- input kasir saat tutup shift
  discrepancy       NUMERIC(12,2),                      -- actual_cash - closing_balance
  status            VARCHAR(10)   NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  notes             TEXT,
  opened_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  closed_at         TIMESTAMPTZ,
  planned_close_at  TIMESTAMPTZ,
  auto_close_at     TIMESTAMPTZ,
  is_auto_closed    BOOLEAN       NOT NULL DEFAULT false,
  carry_over_from_shift_id UUID   REFERENCES cash_registers(id),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()

  -- Application-level constraint: hanya 1 shift 'open' per kasir sekaligus
  -- (enforced di service layer, tidak bisa via SQL CHECK karena subquery)
);
```

---

## 10.11 `operational_expenses`

```sql
CREATE TABLE operational_expenses (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category     VARCHAR(50)   NOT NULL
               CHECK (category IN ('sewa','listrik','gas','kemasan','lainnya')),
  description  VARCHAR(200),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE          NOT NULL,
  created_by   UUID          REFERENCES users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## 10.12 `assets`

```sql
CREATE TABLE assets (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(100)  NOT NULL,
  purchase_price       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  useful_life_months   SMALLINT      NOT NULL CHECK (useful_life_months > 0),
  monthly_depreciation NUMERIC(12,2) NOT NULL CHECK (monthly_depreciation >= 0),
  purchase_date        DATE          NOT NULL,
  is_active            BOOLEAN       NOT NULL DEFAULT true
);
```

---

## 10.13 `profit_share_logs`

```sql
CREATE TABLE profit_share_logs (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month       DATE          NOT NULL,   -- selalu tanggal 1 bulan bersangkutan
  total_revenue      NUMERIC(14,2) NOT NULL,
  total_hpp          NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_opex         NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_depreciation NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit         NUMERIC(14,2) NOT NULL,
  owner_share        NUMERIC(14,2) NOT NULL,
  cashier_share      NUMERIC(14,2) NOT NULL,
  is_hpp_actual      BOOLEAN       NOT NULL DEFAULT false,
  is_paid            BOOLEAN       NOT NULL DEFAULT false,  -- saat true: lock dari recalculation
  notes              TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## 10.14 `profit_share_details`

```sql
CREATE TABLE profit_share_details (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_share_id UUID          NOT NULL REFERENCES profit_share_logs(id) ON DELETE CASCADE,
  cashier_id      UUID          NOT NULL REFERENCES users(id),
  transaction_count INTEGER     NOT NULL CHECK (transaction_count >= 0),
  proportion_pct  NUMERIC(5,2)  NOT NULL
                  CHECK (proportion_pct >= 0 AND proportion_pct <= 100),
  cashier_share   NUMERIC(14,2) NOT NULL,
  paid_amount     NUMERIC(14,2),
  paid_at         TIMESTAMPTZ,
  paid_by         UUID          REFERENCES users(id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

## 10.15 `feature_flags`

```sql
CREATE TABLE feature_flags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_enabled  BOOLEAN      NOT NULL DEFAULT false,
  description TEXT,
  updated_by  UUID         REFERENCES users(id),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 10.16 `settings`

```sql
CREATE TABLE settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_by UUID         REFERENCES users(id),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 10.17 `audit_logs` (IMMUTABLE)

```sql
CREATE TABLE audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  actor_id    UUID         REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_update ON audit_logs AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY no_delete ON audit_logs AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);
```

---

## 10.18 `system_logs`

```sql
CREATE TABLE system_logs (
  id         BIGSERIAL    PRIMARY KEY,
  log_type   VARCHAR(30)  NOT NULL
             CHECK (log_type IN (
               'rate_limit', 'sync_failure', 'payment_error',
               'security_alert', 'system_error', 'shift_event',
               'circuit_breaker', 'price_change', 'backup'  -- tambahan v4.1
             )),
  severity   VARCHAR(10)  NOT NULL DEFAULT 'info'
             CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message    TEXT         NOT NULL,
  metadata   JSONB,
  user_id    UUID         REFERENCES users(id),
  ip_address INET,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## 10.19 `raw_materials` & `bom_items` (Fase 1B) `[v4.1 — baru]`

```sql
-- Tabel bahan baku untuk Bill of Materials
-- Implementasi di Fase 1B, definisi schema tersedia sejak v4.1
-- agar migration Fase 1B tidak mengejutkan developer Fase 1A
CREATE TABLE raw_materials (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100)  NOT NULL UNIQUE,
  unit           VARCHAR(20)   NOT NULL,      -- 'gram', 'ml', 'pcs', 'liter', dst
  price_per_unit NUMERIC(12,4) NOT NULL CHECK (price_per_unit >= 0),
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Junction table: produk ↔ bahan baku
CREATE TABLE bom_items (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_material_id   UUID          NOT NULL REFERENCES raw_materials(id) ON DELETE RESTRICT,
  quantity_per_unit NUMERIC(12,4) NOT NULL CHECK (quantity_per_unit > 0),
  UNIQUE (product_id, raw_material_id)
);
-- HPP dari BOM: SUM(bom_items.quantity_per_unit × raw_materials.price_per_unit)
-- saat BOM aktif: products.hpp_source = 'bom_calculated'
```

---

## 10.20 Index Wajib

```sql
-- Products
CREATE INDEX idx_products_category_active
  ON products(category_id, sort_order) WHERE is_active = true;
CREATE INDEX idx_products_price_schedule
  ON products(new_price_effective_from) WHERE new_price_effective_from IS NOT NULL;

-- Categories
CREATE INDEX idx_categories_active
  ON categories(sort_order) WHERE is_active = true;

-- Modifiers
CREATE INDEX idx_modifier_groups_product
  ON product_modifier_groups(product_id) WHERE is_active = true;
CREATE INDEX idx_modifier_options_group
  ON product_modifier_options(group_id, sort_order) WHERE is_active = true;

-- Discounts
CREATE INDEX idx_discounts_active
  ON discounts(is_active, valid_from) WHERE is_active = true;
CREATE INDEX idx_discount_products_product
  ON discount_products(product_id);

-- Orders — [v4.1 — CR-003] index ini menggantikan fungsi partisi untuk query laporan
CREATE INDEX idx_orders_cashier_date
  ON orders(cashier_id, client_created_at DESC);
CREATE INDEX idx_orders_date
  ON orders(client_created_at DESC);
CREATE INDEX idx_orders_date_month
  ON orders(DATE_TRUNC('month', client_created_at));  -- untuk query laporan bulanan
CREATE INDEX idx_orders_order_status
  ON orders(order_status);
CREATE INDEX idx_orders_payment_status_pending
  ON orders(payment_status) WHERE payment_status = 'pending';
CREATE INDEX idx_orders_sync_failed
  ON orders(order_status) WHERE order_status IN ('pending_sync', 'sync_failed');
CREATE INDEX idx_orders_transaction_number
  ON orders(transaction_number);

-- Order Items & Modifiers
CREATE INDEX idx_order_items_order
  ON order_items(order_id);
CREATE INDEX idx_order_item_modifiers_item
  ON order_item_modifiers(order_item_id);

-- Cash Registers
CREATE INDEX idx_cash_registers_cashier_date
  ON cash_registers(cashier_id, shift_date DESC);
CREATE INDEX idx_cash_registers_open
  ON cash_registers(cashier_id) WHERE status = 'open';

-- Audit & System Logs
CREATE INDEX idx_audit_logs_actor
  ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_system_logs_type
  ON system_logs(log_type, created_at DESC);
CREATE INDEX idx_system_logs_severity_error
  ON system_logs(severity, created_at DESC)
  WHERE severity IN ('error', 'critical');

-- Profit Share
CREATE INDEX idx_profit_share_logs_period
  ON profit_share_logs(period_month DESC);
CREATE INDEX idx_profit_share_details_share
  ON profit_share_details(profit_share_id);
CREATE INDEX idx_profit_share_details_cashier
  ON profit_share_details(cashier_id);

-- Order Refunds
CREATE INDEX idx_order_refunds_order
  ON order_refunds(order_id);

-- BOM (Fase 1B)
CREATE INDEX idx_bom_items_product
  ON bom_items(product_id);
```

---

## 10.21 Seed Data

### Categories

```sql
INSERT INTO categories (name, sort_order) VALUES
  ('Macaroni',     1),
  ('Basreng',      2),
  ('Mie Kremes',   3),
  ('Tempe Goreng', 4),
  ('Pilus',        5);
```

### Feature Flags

```sql
INSERT INTO feature_flags (name, is_enabled, description) VALUES
  ('QRIS_PAYMENT',      false, 'Aktifkan pembayaran QRIS via Midtrans'),
  ('SPLIT_PAYMENT',     false, 'Aktifkan split payment tunai+QRIS'),
  ('MODIFIER_POPUP',    false, 'Aktifkan popup varian bumbu/saus di POS'),
  ('DISCOUNT_MODULE',   false, 'Aktifkan sistem diskon'),
  ('BLUETOOTH_PRINTER', false, 'Aktifkan cetak struk via Web Bluetooth'),
  ('SSE_REALTIME',      false, 'Aktifkan SSE realtime (ganti polling 60s)'),
  ('BOM_HPP',           false, 'Aktifkan Bill of Materials & kalkulasi HPP (Fase 1B)'),
  ('FLEXIBLE_PAYMENT',  false, 'Aktifkan flexible payment flow'),
  ('PRICE_SCHEDULING',  false, 'Aktifkan scheduled price change'),
  ('MULTI_SHIFT',       false, 'Aktifkan multi-shift per kasir per hari'),
  ('LOYALTY_MODULE',    false, 'Loyalitas pelanggan (Fase 2)'),
  ('DELIVERY_CHANNEL',  false, 'Channel delivery online (Fase 3)');
```

### Settings Default

```sql
INSERT INTO settings (key, value) VALUES
  ('business_name',           'Ngemiloh'),
  ('store_address',           ''),
  ('receipt_logo_url',        ''),
  ('receipt_paper_width',     '58mm'),
  ('default_opening_balance', '500000'),
  ('qris_expiry_seconds',     '900'),
  ('max_pending_offline',     '500'),
  ('profit_share_owner_pct',  '60'),
  ('profit_share_kasir_pct',  '40'),
  ('session_sa_ttl_hours',    '24'),
  ('shift_late_threshold',    '30'),
  ('cash_presets',            '[5000,10000,20000,50000,100000]'),
  ('timezone',                'Asia/Jakarta');
```

### Superadmin Default `[v4.1 — OPEN-01]`

```sql
-- [v4.1 — OPEN-01] Distandarkan ke "Nabilah" sesuai mayoritas dokumen.
-- Jika "Arif" adalah admin teknis terpisah, tambahkan record kedua (lihat OPEN-01 di 00-overview.md).
-- Password di-hash saat seed via application layer (bcrypt cost=12)
INSERT INTO users (name, username, email, password_hash, role, is_active)
VALUES (
  'Nabilah',
  'nabilah',
  'nabilah.fnb@gmail.com',
  '<bcrypt_hash_from_seed_script>',
  'superadmin',
  true
);
```

---

## 10.22 Redis Structure

### Session

```
Key:   session:{sessionId}           (UUID v4, di-generate server)
Type:  Hash
TTL:   kasir = tanpa batas | superadmin = 86400 detik (24 jam)

Fields:
  userId          UUID
  role            'kasir' | 'superadmin'
  name            string
  cashier_letter  CHAR(1) | null   -- hanya kasir
  loginType       'pin' | 'password'
  ipAddress       string
  userAgent       string
  createdAt       ISO 8601
  lastActivityAt  ISO 8601
```

### Secondary Index (Force-Logout)

```
Key:   user_sessions:{userId}:{sessionId}  → "1"
Gunaan: scan semua session aktif user, untuk force-logout saat reset PIN / nonaktifkan kasir
```

### Circuit Breaker Midtrans

```
Key:   midtrans:fail_count    → INCR counter, TTL 300s (5 menit)
Key:   midtrans:degraded      → "1", TTL 300s (auto-recovery tanpa intervensi)
```

### Cache

```
Key:   cache:products         → JSON string, TTL 300s (5 menit)
Key:   cache:settings         → JSON string, TTL 600s (10 menit)
```

---

## 10.23 ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    users ||--o{ orders             : "cashier_id"
    users ||--o{ cash_registers     : "cashier_id"
    users ||--o{ audit_logs         : "actor_id"
    users ||--o{ system_logs        : "user_id"
    users ||--o{ profit_share_details : "cashier_id"

    categories ||--o{ products      : "category_id"
    products   ||--o{ product_modifier_groups : "product_id"
    product_modifier_groups ||--o{ product_modifier_options : "group_id"

    discounts ||--o{ discount_products : "discount_id"
    products  ||--o{ discount_products : "product_id"

    orders ||--o{ order_items         : "order_id"
    orders ||--o{ order_refunds       : "order_id"
    order_items ||--o{ order_item_modifiers : "order_item_id"
    order_items }o--||  products      : "product_id (ON DELETE RESTRICT)"
    order_item_modifiers }o--|| product_modifier_options : "option_id"

    profit_share_logs ||--o{ profit_share_details : "profit_share_id"

    products ||--o{ bom_items         : "product_id"
    raw_materials ||--o{ bom_items    : "raw_material_id"
```

---

## 10.24 Prisma Schema (v4.1)

```prisma
// prisma/schema.prisma
// Diperbarui untuk sinkron dengan schema v4.1 final
// Connection string: DATABASE_URL?pgbouncer=true&connection_limit=1 (WAJIB untuk PgBouncer)

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name              String    @db.VarChar(100)
  username          String    @unique @db.VarChar(50)
  email             String?   @unique @db.VarChar(150)
  pinHash           String?   @map("pin_hash") @db.VarChar(72)
  passwordHash      String?   @map("password_hash") @db.VarChar(72)
  cashierLetter     String?   @unique @map("cashier_letter") @db.Char(1)
  role              String    @db.VarChar(20)
  isActive          Boolean   @default(true) @map("is_active")
  mustChangePin     Boolean   @default(false) @map("must_change_pin")
  failedLoginCount  Int       @default(0) @map("failed_login_count") @db.SmallInt
  lockedUntil       DateTime? @map("locked_until") @db.Timestamptz
  lastLoginAt       DateTime? @map("last_login_at") @db.Timestamptz
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  orders            Order[]
  cashRegisters     CashRegister[]
  auditLogs         AuditLog[]
  systemLogs        SystemLog[]
  profitShareDetails ProfitShareDetail[]

  @@map("users")
}

model Category {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String    @unique @db.VarChar(50)
  sortOrder Int       @default(0) @map("sort_order") @db.SmallInt
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  products  Product[]

  @@map("categories")
}

model Product {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                  String    @db.VarChar(100)
  categoryId            String    @map("category_id") @db.Uuid
  basePrice             Decimal   @map("base_price") @db.Decimal(12, 2)
  imageUrl              String?   @map("image_url") @db.VarChar(255)
  isActive              Boolean   @default(true) @map("is_active")
  isOutOfStock          Boolean   @default(false) @map("is_out_of_stock")
  sortOrder             Int       @default(0) @map("sort_order") @db.SmallInt
  description           String?   @db.Text
  estimatedHpp          Decimal   @default(0) @map("estimated_hpp") @db.Decimal(12, 2)
  hppNotes              String?   @map("hpp_notes") @db.Text
  hppSource             String    @default("manual_estimate") @map("hpp_source") @db.VarChar(20)
  newBasePrice          Decimal?  @map("new_base_price") @db.Decimal(12, 2)
  newPriceEffectiveFrom DateTime? @map("new_price_effective_from") @db.Date
  createdBy             String?   @map("created_by") @db.Uuid
  createdAt             DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  category        Category               @relation(fields: [categoryId], references: [id])
  modifierGroups  ProductModifierGroup[]
  discounts       DiscountProduct[]
  orderItems      OrderItem[]
  bomItems        BomItem[]

  @@map("products")
}

model ProductModifierGroup {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId     String   @map("product_id") @db.Uuid
  name          String   @db.VarChar(50)
  isRequired    Boolean  @default(true) @map("is_required")
  maxSelections Int      @default(1) @map("max_selections") @db.SmallInt
  sortOrder     Int      @default(0) @map("sort_order") @db.SmallInt
  isActive      Boolean  @default(true) @map("is_active")

  product Product                  @relation(fields: [productId], references: [id], onDelete: Cascade)
  options ProductModifierOption[]

  @@map("product_modifier_groups")
}

model ProductModifierOption {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  groupId         String   @map("group_id") @db.Uuid
  name            String   @db.VarChar(100)
  additionalPrice Decimal  @default(0) @map("additional_price") @db.Decimal(12, 2)
  sortOrder       Int      @default(0) @map("sort_order") @db.SmallInt
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  group           ProductModifierGroup  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  orderModifiers  OrderItemModifier[]

  @@map("product_modifier_options")
}

model Discount {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String    @db.VarChar(100)
  type          String    @db.VarChar(10)
  value         Decimal   @db.Decimal(12, 2)
  maxDiscount   Decimal?  @map("max_discount") @db.Decimal(12, 2)  // [v4.1 — CR-008]
  scope         String    @default("all") @db.VarChar(10)
  applicableDays Int      @default(127) @map("applicable_days") @db.SmallInt
  validFrom     DateTime  @map("valid_from") @db.Timestamptz
  validTo       DateTime? @map("valid_to") @db.Timestamptz
  isActive      Boolean   @default(false) @map("is_active")
  createdBy     String?   @map("created_by") @db.Uuid
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  products   DiscountProduct[]
  orderItems OrderItem[]

  @@map("discounts")
}

model DiscountProduct {
  discountId String @map("discount_id") @db.Uuid
  productId  String @map("product_id") @db.Uuid

  discount Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)
  product  Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@id([discountId, productId])
  @@map("discount_products")
}

model Order {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashierId           String    @map("cashier_id") @db.Uuid
  clientUuid          String    @unique @map("client_uuid") @db.Uuid
  transactionNumber   String    @map("transaction_number") @db.VarChar(25)
  totalAmount         Decimal   @map("total_amount") @db.Decimal(12, 2)
  discountTotal       Decimal   @default(0) @map("discount_total") @db.Decimal(12, 2)
  paymentMethod       String?   @map("payment_method") @db.VarChar(10)
  cashAmount          Decimal   @default(0) @map("cash_amount") @db.Decimal(12, 2)
  qrisAmount          Decimal   @default(0) @map("qris_amount") @db.Decimal(12, 2)
  cashReceived        Decimal   @default(0) @map("cash_received") @db.Decimal(12, 2)
  cashChange          Decimal   @default(0) @map("cash_change") @db.Decimal(12, 2)
  paymentGateway      String?   @map("payment_gateway") @db.VarChar(20)
  paymentGatewayRef   String?   @map("payment_gateway_ref") @db.VarChar(100)
  qrisExpiryAt        DateTime? @map("qris_expiry_at") @db.Timestamptz
  paymentSettledAt    DateTime? @map("payment_settled_at") @db.Timestamptz  // [v4.1 — CR-006]
  paymentRawResponse  String?   @map("payment_raw_response") @db.Text
  orderStatus         String    @default("completed") @map("order_status") @db.VarChar(20)
  paymentStatus       String    @default("pending") @map("payment_status") @db.VarChar(20)
  voidedBy            String?   @map("voided_by") @db.Uuid
  voidedAt            DateTime? @map("voided_at") @db.Timestamptz
  voidReason          String?   @map("void_reason") @db.Text
  syncedFromOffline   Boolean   @default(false) @map("synced_from_offline")
  syncedAt            DateTime? @map("synced_at") @db.Timestamptz
  clientCreatedAt     DateTime  @map("client_created_at") @db.Timestamptz
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz

  cashier    User        @relation(fields: [cashierId], references: [id])
  items      OrderItem[]
  refunds    OrderRefund[]

  @@map("orders")
}

model OrderItem {
  id                  String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId             String  @map("order_id") @db.Uuid
  productId           String  @map("product_id") @db.Uuid
  productNameSnapshot String  @map("product_name_snapshot") @db.VarChar(100)
  basePrice           Decimal @map("base_price") @db.Decimal(12, 2)
  discountAmount      Decimal @default(0) @map("discount_amount") @db.Decimal(12, 2)
  discountId          String? @map("discount_id") @db.Uuid
  discountedBase      Decimal @map("discounted_base") @db.Decimal(12, 2)
  modifierTotal       Decimal @default(0) @map("modifier_total") @db.Decimal(12, 2)
  finalPrice          Decimal @map("final_price") @db.Decimal(12, 2)
  quantity            Int     @db.SmallInt
  subtotal            Decimal @db.Decimal(12, 2)

  order     Order               @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product             @relation(fields: [productId], references: [id])
  discount  Discount?           @relation(fields: [discountId], references: [id])
  modifiers OrderItemModifier[]

  @@map("order_items")
}

model OrderItemModifier {
  id                    String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderItemId           String  @map("order_item_id") @db.Uuid
  optionId              String  @map("option_id") @db.Uuid
  groupNameSnapshot     String  @map("group_name_snapshot") @db.VarChar(50)
  optionNameSnapshot    String  @map("option_name_snapshot") @db.VarChar(100)
  additionalPriceAtTime Decimal @map("additional_price_at_time") @db.Decimal(12, 2)

  orderItem OrderItem            @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  option    ProductModifierOption @relation(fields: [optionId], references: [id])

  @@map("order_item_modifiers")
}

model OrderRefund {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId      String   @map("order_id") @db.Uuid
  amount       Decimal  @db.Decimal(12, 2)
  refundMethod String   @default("manual_cash") @map("refund_method") @db.VarChar(30)
  refundedBy   String   @map("refunded_by") @db.Uuid
  refundedAt   DateTime @default(now()) @map("refunded_at") @db.Timestamptz
  notes        String?  @db.Text
  refundStatus String   @default("pending") @map("refund_status") @db.VarChar(20)

  order Order @relation(fields: [orderId], references: [id])

  @@map("order_refunds")
}

model CashRegister {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashierId            String    @map("cashier_id") @db.Uuid
  shiftDate            DateTime  @map("shift_date") @db.Date
  shiftNumber          Int       @default(1) @map("shift_number") @db.SmallInt
  openingBalance       Decimal   @default(0) @map("opening_balance") @db.Decimal(12, 2)
  closingBalance       Decimal?  @map("closing_balance") @db.Decimal(12, 2)
  systemCashTotal      Decimal?  @map("system_cash_total") @db.Decimal(12, 2)
  actualCash           Decimal?  @map("actual_cash") @db.Decimal(12, 2)
  discrepancy          Decimal?  @db.Decimal(12, 2)
  status               String    @default("open") @db.VarChar(10)
  notes                String?   @db.Text
  openedAt             DateTime  @default(now()) @map("opened_at") @db.Timestamptz
  closedAt             DateTime? @map("closed_at") @db.Timestamptz
  plannedCloseAt       DateTime? @map("planned_close_at") @db.Timestamptz
  autoCloseAt          DateTime? @map("auto_close_at") @db.Timestamptz
  isAutoClosed         Boolean   @default(false) @map("is_auto_closed")
  carryOverFromShiftId String?   @map("carry_over_from_shift_id") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  cashier User @relation(fields: [cashierId], references: [id])

  @@map("cash_registers")
}

model ProfitShareLog {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  periodMonth      DateTime @map("period_month") @db.Date
  totalRevenue     Decimal  @map("total_revenue") @db.Decimal(14, 2)
  totalHpp         Decimal  @default(0) @map("total_hpp") @db.Decimal(14, 2)
  totalOpex        Decimal  @default(0) @map("total_opex") @db.Decimal(14, 2)
  totalDepreciation Decimal @default(0) @map("total_depreciation") @db.Decimal(14, 2)
  netProfit        Decimal  @map("net_profit") @db.Decimal(14, 2)
  ownerShare       Decimal  @map("owner_share") @db.Decimal(14, 2)
  cashierShare     Decimal  @map("cashier_share") @db.Decimal(14, 2)
  isHppActual      Boolean  @default(false) @map("is_hpp_actual")
  isPaid           Boolean  @default(false) @map("is_paid")
  notes            String?  @db.Text
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz

  details ProfitShareDetail[]

  @@map("profit_share_logs")
}

model ProfitShareDetail {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profitShareId  String    @map("profit_share_id") @db.Uuid
  cashierId      String    @map("cashier_id") @db.Uuid
  transactionCount Int     @map("transaction_count")
  proportionPct  Decimal   @map("proportion_pct") @db.Decimal(5, 2)
  cashierShare   Decimal   @map("cashier_share") @db.Decimal(14, 2)
  paidAmount     Decimal?  @map("paid_amount") @db.Decimal(14, 2)
  paidAt         DateTime? @map("paid_at") @db.Timestamptz
  paidBy         String?   @map("paid_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz

  profitShare ProfitShareLog @relation(fields: [profitShareId], references: [id], onDelete: Cascade)
  cashier     User           @relation(fields: [cashierId], references: [id])

  @@map("profit_share_details")
}

model FeatureFlag {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @unique @db.VarChar(100)
  isEnabled   Boolean   @default(false) @map("is_enabled")
  description String?   @db.Text
  updatedBy   String?   @map("updated_by") @db.Uuid
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@map("feature_flags")
}

model Setting {
  key       String   @id @db.VarChar(100)
  value     String   @db.Text
  updatedBy String?  @map("updated_by") @db.Uuid
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("settings")
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  actorId    String?  @map("actor_id") @db.Uuid
  action     String   @db.VarChar(100)
  entityType String?  @map("entity_type") @db.VarChar(50)
  entityId   String?  @map("entity_id") @db.VarChar(100)
  oldValue   Json?    @map("old_value")
  newValue   Json?    @map("new_value")
  ipAddress  String?  @map("ip_address") @db.Inet
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  actor User? @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
}

model SystemLog {
  id        BigInt   @id @default(autoincrement())
  logType   String   @map("log_type") @db.VarChar(30)
  severity  String   @default("info") @db.VarChar(10)
  message   String   @db.Text
  metadata  Json?
  userId    String?  @map("user_id") @db.Uuid
  ipAddress String?  @map("ip_address") @db.Inet
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  user User? @relation(fields: [userId], references: [id])

  @@map("system_logs")
}

// Fase 1B — definisi schema tersedia sejak v4.1 agar migration tidak mengejutkan
model RawMaterial {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name         String    @unique @db.VarChar(100)
  unit         String    @db.VarChar(20)
  pricePerUnit Decimal   @map("price_per_unit") @db.Decimal(12, 4)
  isActive     Boolean   @default(true) @map("is_active")
  updatedAt    DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  bomItems BomItem[]

  @@map("raw_materials")
}

model BomItem {
  id              String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId       String  @map("product_id") @db.Uuid
  rawMaterialId   String  @map("raw_material_id") @db.Uuid
  quantityPerUnit Decimal @map("quantity_per_unit") @db.Decimal(12, 4)

  product     Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  rawMaterial RawMaterial @relation(fields: [rawMaterialId], references: [id])

  @@unique([productId, rawMaterialId])
  @@map("bom_items")
}
```

> **Penting (deployment):** Koneksi string ke PgBouncer **wajib** menggunakan `?pgbouncer=true&connection_limit=1` untuk mencegah Prisma membuka koneksi langsung melewati pool:
> ```env
> DATABASE_URL="postgresql://user:pass@localhost:6432/ngemiloh?pgbouncer=true&connection_limit=1"
> ```
> Tanpa parameter ini, Prisma akan membuka koneksi langsung ke PostgreSQL dan melewati PgBouncer.

---

*Lanjut ke: [`08-api-contract.md`](./08-api-contract.md) — API Contract final dengan tabel kode error lengkap (Tahap 5).*
