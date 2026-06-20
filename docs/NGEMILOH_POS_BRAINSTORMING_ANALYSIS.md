# NGEMILOH POS - BRAINSTORMING & ANALYSIS REPORT

**Generated:** June 19, 2026
**Purpose:** Brainstorming session untuk identifikasi gaps, risks, dan recommendations

---

## 1. KRITIS GAPS YANG PERLU SEGERA DITANGANI

### 1.1 Docker Containers Issue (CRITICAL)

**Problem:** Containers tidak berjalan dengan baik.

**Current Status:**
```
❌ ngemiloh_api - Redis NOAUTH error
⚠️ ngemiloh_redis - Redis password not set
✅ ngemiloh_db - Healthy
✅ ngemiloh_caddy - Healthy
```

**Root Cause:** Redis password tidak match antara docker-compose.yml dan redis-entrypoint.sh.

**Solutions:**

| Solution | Effort | Risk | Recommendation |
|-----------|--------|------|---------------|
| Fix REDIS_URL in compose | 5 min | Low | ✅ RECOMMENDED |
| Remove password auth (dev) | 2 min | Medium | Alternative |
| Use env file | 10 min | Low | Best Practice |

### 1.2 Missing Features (HIGH PRIORITY)

| Feature | Status | File Need Changes |
|---------|--------|------------------|
| Member Registration | ❌ Not Built | New tables + API + UI |
| Loyalty Tier System | ❌ Not Built | New tables + API + UI |
| Waste Tracking | ❌ Not Built | New tables + API + UI |
| BOM Recipes | ⚠️ Partial | 1 product seeded |
| Outlet Management | ⚠️ Partial | Multi-outlet not implemented |
| Check-in System | ⚠️ Partial | Kasir-outlet assignment not built |

---

## 2. RISK ANALYSIS

### 2.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Printer tidak compatible | MEDIUM | MEDIUM | Browser print fallback ready |
| Redis connection fails | LOW | HIGH | Already has error handling |
| Database corruption | LOW | CRITICAL | Backup system needed |
| API timeout | LOW | LOW | Already has retry logic |

### 2.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Kasir resign mid-month | MEDIUM | MEDIUM | Pro-rata calculation ready |
| Stockout sebelum reorder | MEDIUM | HIGH | 10-day alert system |
| Internet offline | MEDIUM | LOW | Offline mode ready |
| Kasir fraud | LOW | HIGH | Audit trail + discrepancy check |

### 2.3 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Owner tidak bisa pakai sistem | MEDIUM | HIGH | Training + docs |
| Kasir tidak bisa login | MEDIUM | MEDIUM | Simple 6-digit PIN |
| Printer macet | MEDIUM | LOW | Spare printer |

---

## 3. UNIQUE SELLING POINTS NGEMILOH POS

### 3.1 Model Bisnis yang Unik

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRANCHISE MODEL KHUSUS                        │
│                                                                  │
│    NGEMILOH HQ                                                   │
│        │                                                          │
│        │ Supplier Raw Materials                                    │
│        ▼                                                          │
│    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐               │
│    │ Outlet A │    │ Outlet B │    │ Outlet C │   ...        │
│    │ Kasir 1 │    │ Kasir 2 │    │ Kasir 3 │               │
│    │(Freelance)│   │(Freelance)│   │(Freelance)│              │
│    └─────────┘    └─────────┘    └─────────┘                   │
│         │              │              │                           │
│         └──────────────┼──────────────┘                           │
│                        ▼                                          │
│              ┌──────────────────────┐                            │
│              │   CENTRAL DASHBOARD   │                            │
│              │      (Owner)         │                            │
│              │  - Profit Tracking   │                            │
│              │  - Kasir Performance │                            │
│              │  - Inventory Alerts  │                            │
│              └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Fitur Diferensiasi

| Feature | Competitor POS | Ngemiloh POS |
|---------|---------------|--------------|
| Kasir Model | Full-time | Freelance ✓ |
| Shift | Fixed hours | Multiple/day ✓ |
| Loyalty | Points system | Frequency tier ✓ |
| Profit Share | Salary only | Pool bonus ✓ |
| Waste Tracking | None | BOM-based ✓ |
| Multi-Outlet | Per outlet | Centralized ✓ |

---

## 4. RECOMMENDED IMPLEMENTATION PRIORITY

### 4.1 : MVP Launch

```
Fix Critical Issues
├── Fix Docker containers
├── Fix Redis authentication
├── Test admin login
└── Test kasir login

Core POS Flow
├── Add sample products
├── Test cart operations
├── Test cash payment
└── Test receipt printing

Shift Management
├── Test open shift
├── Test close shift
├── Test cash reconciliation
└── Verify reports

Launch
├── Admin dashboard verified
├── POS flow working
├── Documentation complete
└── Training materials ready
```

### 4.2 : Member System

```
Phase 2A: Member Registration
├── Create member table
├── Create member registration API
├── Create QR code generation
└── Create member lookup UI

Phase 2B: Loyalty Tiers
├── Define tier thresholds
├── Calculate tier automatically
├── Apply tier benefits
└── Track tier history

Phase 2C: Integration
├── Add member to POS
├── Apply discount automatically
├── Update receipt with member
└── Test edge cases
```

### 4.3 : Advanced Features

```
Month 2: Inventory & HPP
├── Setup BOM recipes for all products
├── Configure waste tracking
├── Setup low stock alerts
└── Test reorder flow

Month 3: Online Integration
├── GoFood API integration (if available)
├── GrabFood API integration (if available)
├── Manual fee tracking
└── Consolidated reporting
```

### 4.4 : Scale

```
Phase 4: Multi-Outlet
├── Setup outlet management
├── Configure kasir-outlet assignment
├── Test check-in/check-out
└── Verify profit per outlet

Phase 5: Advanced Analytics
├── Dashboard customization
├── Automated reports
├── Export features
└── Mobile notifications
```

---

## 5. QUESTIONS UNTUK CLARIFICATION

### 5.1 Tier Benefits (URGENT)

**Q1:** Diskon tier (5%/10%/15%) - apakah:
- Per item atau per transaksi? =per transaksi

**Q2:** Free item - apakah:
- Gratis 1 item dari menu?
- Atau gratis 1 porsi lengkap? = ya gratis 1 porsi lengkap

**Q3:** Diskon dan free item bisa dipakai bersamaan? = tidak

### 5.2 Inventory (IMPORTANT)

**Q4:** Batch tracking untuk FIFO:
- Apakah perlu track per batch purchase?
- Atau cukup total stock saja? = total stock saja

**Q5:** Waste calculation:
- Apakah waste dihitung dari expired bahan baku saja? 
- Atau termasuk rejected food (masak gagal)? = dihitung dari expired bahan baku dan rejected food

### 5.3 Online Orders (FUTURE)

**Q6:** Platform fees:
- GoFood: ~20%?
- GrabFood: ~20%?
- ShopeeFood: ~15%?
- Atau variasi? = berikan fees ~25% saja paling tinggi

**Q7:** Order validation:
- Jika GoFood order tapi customer bukan member:
- Tetap masuk sistem tapi tanpa loyalty tracking? lihat dari nomor handphone jika customer menggunakan no handphone yang sama maka hitung loyalty nya

### 5.4 Reports (IMPORTANT)

**Q8:** Report format:
- PDF atau CSV atau keduanya? = csv saja

**Q9:** Scheduled reports:
- Auto-email daily/weekly? = tidak perlu, kegunaan email untuk notifikasi alert saja

---

## 6. ARCHITECTURE RECOMMENDATIONS

### 6.1 Database Design for Multi-Outlet

```sql
-- Outlet Table (NEW)
CREATE TABLE outlet (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Modify User untuk kasir-outlet assignment
ALTER TABLE user ADD COLUMN outlet_id UUID REFERENCES outlet(id);

-- Cashier-Outlet Assignment (Many-to-Many)
CREATE TABLE cashier_outlet_assignment (
    cashier_id UUID REFERENCES user(id),
    outlet_id UUID REFERENCES outlet(id),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (cashier_id, outlet_id)
);

-- Shift harus include outlet_id
ALTER TABLE cash_register ADD COLUMN outlet_id UUID REFERENCES outlet(id);
```

### 6.2 Member Table Design

```sql
CREATE TABLE member (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    current_tier member_tier DEFAULT 'bronze',
    transaction_count INT DEFAULT 0,
    tier_period_start DATE,
    tier_period_end DATE,
    is_active BOOLEAN DEFAULT true,
    registered_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE member_transaction (
    id UUID PRIMARY KEY,
    member_id UUID REFERENCES member(id),
    order_id UUID REFERENCES order(id),
    transaction_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE member_tier AS ENUM ('bronze', 'silver', 'gold');
```

### 6.3 Waste Tracking Design

```sql
CREATE TABLE waste_log (
    id UUID PRIMARY KEY,
    raw_material_id UUID REFERENCES raw_material(id),
    quantity DECIMAL(10,2) NOT NULL,
    reason waste_reason NOT NULL,
    notes TEXT,
    recorded_by UUID REFERENCES user(id),
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE waste_reason AS ENUM ('expired', 'processing_error', 'sample', 'damaged');
```

---

## 7. RECOMMENDED TECH IMPROVEMENTS

### 7.1 Current Issues

| Issue | File | Priority |
|-------|------|----------|
| Redis auth mismatch | docker-compose.yml | CRITICAL |
| Missing member tables | schema.prisma | HIGH |
| Missing loyalty logic | orders.service.ts | HIGH |
| Missing waste tables | schema.prisma | MEDIUM |

### 7.2 Code Quality

| Issue | File | Priority |
|-------|------|----------|
| Modals.svelte too large | Modals.svelte | MEDIUM |
| No unit tests | - | HIGH |
| Missing API docs | - | LOW |

### 7.3 Performance

| Issue | File | Priority |
|-------|------|----------|
| No caching strategy | - | MEDIUM |
| No query optimization | - | LOW |

---

## 8. CONCLUSION

### 8.1 What Makes Ngemiloh POS Special

1. **Freelance kasir model** - flexible, cost-effective
2. **Multi-shift dengan carry-over** - cocok untuk 24/7 operations
3. **Rolling loyalty tier** - fair untuk frequent customers
4. **Pro-rata profit sharing** - transparent, motivates kasir
5. **Waste tracking** - accurate HPP untuk food business
6. **Centralized dashboard** - owner visibility across outlets

### 8.2 Next Steps

1. ✅ Dokumentasi requirements - DONE
2. ⏳ Fix Docker containers - PENDING
3. ⏳ Test admin/kasir login - PENDING
4. ⏳ Build member system - PENDING
5. ⏳ Build loyalty tiers - PENDING
6. ⏳ Launch MVP

### 8.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Login success rate | 100% | Admin + kasir |
| POS transaction time | < 30 seconds | End-to-end |
| Receipt print success | > 95% | Bluetooth + browser |
| Report accuracy | 100% | vs actual |
| System uptime | > 99% | During hours |

---

**Report Status:** COMPLETE
**Ready for:** Implementation Planning
**Next Action:** User review and approval
