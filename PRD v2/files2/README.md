# Ngemiloh POS — PRD v4.1

> **Single Source of Truth** untuk implementasi teknis Ngemiloh POS.  
> Versi ini adalah revisi konsistensi & pelengkap dari v4.0 — bukan perubahan keputusan bisnis besar.

---

## Cara Navigasi

Mulai dari **`docs/prd/00-overview.md`** — pintu masuk yang berisi changelog lengkap, CR log, glosarium, dan ringkasan keputusan arsitektur. Semua file lain saling terhubung dengan link navigasi `← sebelumnya | selanjutnya →`.

---

## Daftar File

```
docs/
├── prd/
│   ├── 00-overview.md            # Changelog, CR Log, Glosarium, Ringkasan Eksekutif
│   ├── 01-stakeholders-rbac.md   # Stakeholder, Persona, RBAC Permission Matrix
│   ├── 02-business-rules.md      # Business Rules Master List (AUTH, SHIFT, TRX, ...)
│   ├── 03-journeys-flows.md      # User Journey & App Flow/Navigasi
│   ├── 04-functional-reqs.md     # Functional Requirements (FR-AUTH..FR-SYS)
│   ├── 05-nonfunctional-reqs.md  # NFR, SLA/SLO, Kapasitas, DoR/DoD
│   ├── 06-architecture.md        # Modular Monolith, Caching, Circuit Breaker, Offline-First
│   ├── 07-database.md            # Schema SQL, ERD, Seed, Prisma Schema (20 tabel)
│   ├── 08-api-contract.md        # API Contract + Tabel Kode Error Lengkap
│   ├── 09-security.md            # Auth Flow, STRIDE Threat Model, Audit Events
│   ├── 10-testing.md             # Strategy, TC-01..TC-22, Load Test, Mutation Test
│   ├── 11-deployment.md          # Docker Compose, CI/CD, Env Vars, Backup
│   ├── 12-monitoring.md          # Observability, Log Retention, Postmortem Template
│   ├── 13-roadmap.md             # Sprint Roadmap Fase 0–3
│   ├── 14-risk-register.md       # R-01..R-18 + Technical Debt Register
│   └── 15-appendix.md            # Pre-Launch Checklist, Biaya, Kontak, Referensi
└── decisions/
    └── ADR-all.md                # ADR-001..ADR-016 (semua Architecture Decision Records)
```

---

## Ringkasan Perubahan v4.0 → v4.1

| # | Perubahan | File |
|---|-----------|------|
| CR-001 | Stack distandarkan ke **SvelteKit** (bukan Next.js) | 00, 06 |
| CR-002 | Format nomor transaksi distandarkan: `TRX-YYYYMMDD-[Huruf][Seq3]` | 02, 04, 07, 08, ADR-016 |
| CR-003 | **Partisi `orders` dihapus** untuk Fase 1–2 (exit criteria terdokumentasikan) | 04, 07, 13, ADR-005 |
| CR-004 | `outlet_id` dihapus dari seluruh FR & skema | 04, 07 |
| CR-005 | Format response API distandarkan ke pola Section 11 | 04, 08, ADR-015 |
| CR-006 | `settled_at` → `payment_settled_at` (sinkron kolom DB) | 04, 07 |
| CR-007 | Rate limit `POST /orders` distandarkan ke **30/menit** | 02, 09 |
| CR-008 | Tambah `discounts.max_discount` + CHECK constraint | 02, 07 |
| CR-009 | **BARU:** Non-Functional Requirements (dijanjikan TOC v4.0, hilang dari isi) | **05** |
| CR-010 | **BARU:** Architecture — Modular Monolith, Caching, Circuit Breaker, Offline-First | **06**, ADR-013, ADR-014 |
| CR-011 | Definisikan `raw_materials`/`bom_items` sekarang (bukan "supplement Fase 1B") | 07 |
| CR-012 | Tambah 4 kode error: `ORDER_ALREADY_VOIDED`, `QRIS_DEGRADED`, `DISCOUNT_EXCEEDS_SUBTOTAL`, `SHIFT_NOT_OPEN` | 08 |
| CR-013 | Tambah `sync_failed` ke enum `order_status` | 02, 04, 07 |
| CR-014 | PRD dipecah dari 1 file (4.482 baris) → **16 file + ADR folder** | Semua |
| CR-015 | Testing/security tambahan: STRIDE, Stryker, smoke test post-deploy, Gitleaks, UU PDP, a11y | 09, 10, 11 |

---

## Statistik Dokumen v4.1

| Metrik | Nilai |
|--------|-------|
| Total file | 17 (16 PRD + 1 ADR kompilasi) |
| Total baris | ~5.981 |
| Tabel database | 20 (18 v4.0 + `raw_materials` + `bom_items`) |
| Test cases | TC-01..TC-22 (22 kasus, +6 dari v4.0) |
| ADR | ADR-001..ADR-016 (16 keputusan, +5 dari v4.0) |
| Risk register | R-01..R-18 (+3 dari v4.0) |
| Tech debt | TD-01..TD-13 (+1, -1 resolved, -1 reclassified) |

---

*PRD Ngemiloh POS v4.1 — 15 Juni 2026*
