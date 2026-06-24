# PRD NGEMILOH POS v8.0 - VERIFIKASI & PERTANYAAN

**Tanggal:** 2026-06-23
**Status:** ✅ SEMUA JAWABAN DITERIMA - SIAP UPDATE PRD

---

## RINGKASAN HASIL VERIFIKASI (FINAL)

| Area | PRD Says | Actual | Status |
|------|----------|--------|--------|
| Total Endpoints | ~98 | **93** | ❌ Koreksi |
| Backend Modules | 17 | **13** | ❌ Koreksi |
| Frontend Pages | 32 | **31** | ❌ Koreksi |
| Database Models | 30 | 30 | ✅ MATCH |
| Total Tests | 9 | 9 | ✅ MATCH |

---

## DAFTAR PERTANYAAN & JAWABAN

---

## PERTANYAAN 1: Backend Modules Count ✅ JAWABAN: OPSI B

**Situasi:** PRD Section 5.1 menuliskan **17 modules**, actual adalah **13 modules business logic**.

### Modules Business Logic (13):
```
audit, auth, discounts, finance, flags, inventory, 
members, orders, outlets, payment, products, receipts, users
```

### Folder BUKAN Business Module:
```
common/     → utilities
dto/        → shared DTOs
email/      → service only
jobs/       → queue processors
prisma/     → ORM setup
test/       → test helpers
types/      → TypeScript declarations
```

**Jawaban User: Opsi B** - Update PRD dari 17 → 13 modules.

---

## PERTANYAAN 2: AppController Endpoint Count ✅ JAWABAN: OPSI A

**Situasi:** PRD menulis 8 endpoints, actual adalah **9 endpoints**.

### Endpoints (9):
```
GET  /                           # Root health
GET  /health                     # Health check
GET  /_health                    # Internal health (Docker)
GET  /api/v1/store-info          # Store info (public)
GET  /api/v1/admin/settings      # Get settings
PATCH /api/v1/admin/settings     # Update settings
GET  /api/v1/admin/feature-flags       # List flags
PATCH /api/v1/admin/feature-flags/:id  # Toggle flag
GET  /api/v1/admin/audit-logs           # Audit logs
```

**Jawaban User: Opsi A** - Update PRD dari 8 → 9 endpoints.

---

## PERTANYAAN 3: Duplicate/Semantic Overlap Endpoints ✅ JAWABAN: OPSI C

**Situasi:** Terdapat endpoints yang serve resource yang sama tapi di path berbeda.

### Duplicates:
| Controller | Path | Service |
|------------|------|---------|
| `AuditController` | `admin/audit-logs` | AuditService |
| `AppController` | `api/v1/admin/audit-logs` | AppService |
| `FlagsController` | `flags`, `flags/admin` | FlagsService |
| `AppController` | `api/v1/admin/feature-flags` | FlagsService |

**Jawaban User: Opsi C** - Dead code removal. Hapus duplikasi di code kunci utama agar PRD tidak amburadul dan salah baca.

**Action:** Remove duplicate endpoints dari AppController, update PRD sesuai hasil.

---

## PERTANYAAN 4: ProductsController Endpoint Count ✅ JAWABAN: OPSI A

**Situasi:** PRD menulis 10 endpoints, actual adalah **9 endpoints**.

### Endpoints (9):
```
GET  /products                           # List products
GET  /categories                        # List categories
POST /admin/products                   # Create product
PATCH /admin/products/:id              # Update product
DELETE /admin/products/:id            # Delete product
POST /admin/products/:id/modifier-groups       # Add modifier group
POST /admin/modifier-groups/:id/options         # Add modifier option
PATCH /admin/modifier-groups/:id                # Update modifier group
PATCH /admin/modifier-options/:id              # Update modifier option
```

**Jawaban User: Opsi A** - Update PRD dari 10 → 9 endpoints.

---

## PERTANYAAN 5: InventoryController Endpoint Count ✅ JAWABAN: OPSI A

**Situasi:** PRD menulis 14 endpoints, actual adalah **13 endpoints**.

### Endpoints (13):
```
GET  /                             # List materials
GET  /low-stock                    # Low stock alert
POST /adjust                       # Stock adjustment
POST /opname                       # Stock opname
POST /materials                    # Create material
PATCH /materials/:id               # Update material
POST /bom                          # Create BOM
DELETE /bom/:id                   # Delete BOM
POST /waste                        # Record waste
GET  /waste                        # Get waste history
GET  /bom/:productId              # Get BOM by product
PATCH /bom/:id                    # Update BOM
GET  /bom-coverage                # BOM coverage report
```

**Jawaban User: Opsi A** - Update PRD dari 14 → 13 endpoints.

---

## PERTANYAAN 6: Customer Model & Endpoints ✅ JAWABAN: OPSI C + CLARIFICATION

**Situasi:** PRD Section 4.2 menuliskan `Customer` adalah **DEPRECATED**, tapi model masih aktif.

### Penjelasan Perbedaan:

| Model | Deskripsi |
|-------|-----------|
| **Customer** | Pelanggan yang membeli dagangan tapi TIDAK terdaftar member |
| **Member** | Pelanggan yang sudah pasti pernah membeli, INISIASI SENDIRI mendaftar untuk mendapatkan point (diskon/free item) |

**Jawaban User: Opsi C** - Ambos aktif dengan jelaskan perbedaan.

**Action:** Update PRD Section 4.2 dengan penjelasan:
```
| Customer | Pelanggan non-member (pembelian tanpa loyalty) | ✅ Active |
| Member   | Pelanggan dengan loyalty system (point & tier) | ✅ Active |
```

---

## PERTANYAAN 7: Total Endpoints Correction ✅ JAWABAN: OPSI A

**Situasi:** PRD menulis ~98 endpoints, actual adalah **93 endpoints**.

### Breakdown Final:

| # | Controller | PRD | Actual | Status |
|---|------------|-----|--------|--------|
| 1 | AuthController | 6 | 6 | ✅ |
| 2 | OrdersController | 13 | 13 | ✅ |
| 3 | ProductsController | 10 | 9 | ❌ -1 |
| 4 | InventoryController | 14 | 13 | ❌ -1 |
| 5 | FinanceController | 14 | 14 | ✅ |
| 6 | DiscountsController | 5 | 5 | ✅ |
| 7 | MemberController | 2 | 2 | ✅ |
| 8 | PosMemberController | 2 | 2 | ✅ |
| 9 | AdminMemberController | 3 | 3 | ✅ |
| 10 | ReceiptsController | 4 | 4 | ✅ |
| 11 | AuditController | 2 | 2 | ✅ |
| 12 | FlagsController | 3 | 3 | ✅ |
| 13 | UsersController | 7 | 7 | ✅ |
| 14 | OutletController | 1 | 1 | ✅ |
| 15 | AppController | 8 | 9 | ❌ +1 |
| | **TOTAL** | **~98** | **93** | ❌ -5 |

**Jawaban User: Opsi A** - Update PRD ke 93 endpoints.

---

## PERTANYAAN 8: Frontend Category Breakdown ✅ JAWABAN: OPSI B

**Situasi:** PRD menulis POS + Shift = 3 pages dengan kategorisasi yang berbeda.

### Alur Kasir (Clarification dari User):
```
1. Kasir login → input PIN
2. Otomatis masuk shift kerja
3. Input kas awal → terbuka fitur POS
4. Proses transaksi bisnis
5. Logout shift → input total uang hari ini
6. Jika batal logout → balik ke halaman entry transaksi
```

### Kategori Final:

| Kategori | Pages | Count |
|----------|-------|-------|
| Landing Page | `/` | 1 |
| Login & Auth | `/login`, `/login-admin`, `/login-admin/verify-otp` | 3 |
| **POS** | `/pos`, `/pos/print`, `/shift` | **3** |
| Outlet Selection | `/outlet-selection` | 1 |
| Member | `/member/register` | 1 |
| Admin Dashboard | 22 pages | 22 |
| **TOTAL** | | **31** |

> ⚠️ Total berkurang dari 32 → 31 karena `/change-pin` dihapus.

**Jawaban User: Opsi B** - POS = 3 pages (include `/shift`).

---

## PERTANYAAN 8B: Change PIN Clarification ✅ JAWABAN: HAPUS

**Situasi:** PRD Section 6.1 menuliskan `/change-pin` adalah bagian dari "Login & Auth".

### Analisis:
- `/change-pin` page = untuk kasir ubah PIN sendiri
- `/admin/cashiers` = admin bisa reset PIN kasir

### Keputusan:
PIN kasir hanya bisa di-reset oleh **ADMIN**, bukan self-service.

**Jawaban User:** Hapus `/change-pin` page.

**Action:**
1. Hapus file `frontend/src/routes/change-pin/+page.svelte`
2. Hapus endpoint `/auth/change-pin` dari backend (atau limit hanya untuk admin)
3. Update PRD Section 6.1

---

## PERTANYAAN 9: Missing Documentation ✅ JAWABAN: OPSI A

**Situasi:** PRD缺少 detail untuk:
- Database Indexes (49 indexes ditemukan)
- Offline Sync Details
- Constants

**Jawaban User: Opsi A** - Tambahkan Section 18 "Technical Specifications".

---

## PERTANYAAN 10: Module Structure ✅ JAWABAN: OPSI A

**Situasi:** PRD Section 5.2 hanya detail untuk 3 modules (Auth, Members, Orders).

**Jawaban User: Opsi A** - Tambahkan detail untuk semua 13 modules.

---

## RINGKASAN AKSI UPDATE PRD

| No | Item | Action |
|----|------|--------|
| 1 | Backend Modules | Update 17 → **13** |
| 2 | AppController | Update 8 → **9** |
| 3 | Duplicate Endpoints | **Dead code removal** - hapus dari AppController |
| 4 | ProductsController | Update 10 → **9** |
| 5 | InventoryController | Update 14 → **13** |
| 6 | Customer Model | **Coexist** dengan penjelasan |
| 7 | Total Endpoints | Update 98 → **93** |
| 8 | Frontend Categories | **POS = 3** (include shift) |
| 8B | Change PIN | **HAPUS** `/change-pin` page |
| 9 | Missing Documentation | **Add Section 18** |
| 10 | Module Structure | **Add all 13 modules** detail |

---

## NEXT STEPS

- [x] Semua pertanyaan dijawab user
- [x] Update PRD sesuai keputusan - COMPLETED 2026-06-24
- [x] Dead code removal (AppController duplicate endpoints) - sudah bersih
- [x] Delete `/change-pin` page - COMPLETED
- [ ] Review final PRD
- [ ] Approve dan merge

---

## UPDATE LOG

| Date | Action |
|------|--------|
| 2026-06-23 | Semua pertanyaan dijawab user |
| 2026-06-24 | PRD diupdate sesuai keputusan |

---

*Dokumen ini dibuat berdasarkan hasil verifikasi maksimal menggunakan agent-skills*
*Generated: 2026-06-23*
*Updated: Jawaban user diterima - siap proceed*
