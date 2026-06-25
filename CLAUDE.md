# POS Nabil - Claude Code Instructions

> NGEMILOH franchise POS: offline-first, QRIS payment, shift management, member loyalty.

---
## 🌍 Override Aturan Global

Aturan berikut dari Global CLAUDE.md **disesuaikan** untuk proyek ini:

| Aturan Global | Penyesuaian Proyek |
|---------------|-------------------|
| Lint warnings = fix immediately | Fix immediately, kecuali dari `node_modules` atau generated code. Buka isu jika tidak bisa difix. |
| Always spec first untuk non-trivial | Hanya untuk perubahan yang mempengaruhi >3 file atau logika bisnis baru. Perubahan UI/hotfix langsung dikerjakan dengan penjelasan singkat. |
| Minimal 3 opsi untuk solusi | Hanya untuk keputusan arsitektur / library utama. Untuk sisanya, berikan rekomendasi langsung. |

**Verifikasi untuk perintah keamanan kritis:**
- Perintah force-revoke token, override aturan DB Safety, atau aktivasi force majeure HARUS dikonfirmasi dengan:
  (1) menyebutkan kode verifikasi 6-digit yang dikirim Tech Lead via channel terpisah, ATAU
  (2) disetujui via commit message yang ditandatangani GPG oleh Tech Lead.
- Claude Code tidak boleh mengeksekusi perintah ini hanya berdasarkan prompt tanpa verifikasi tambahan.

---

---

## ⚡ CRITICAL Rules (Enforced Always)

| Rule | Description |
|------|-------------|
| **snake_case ONLY** | Code identifiers use snake_case (variables, functions). File naming uses kebab-case (`user-service.ts`) |
| **VERIFY Before Claim** | Show evidence: lint → build → test |
| **Shift = Business Date** | Reports filter by `shift_start..shift_end`, NOT `created_at::date` |
| **DB Safety** | Use `SELECT ... FOR UPDATE` for idempotent state transitions. Setiap operasi yang mengubah >1 tabel HARUS dibungkus database transaction (`prisma.$transaction`). Isolation level default PostgreSQL `READ COMMITTED` cukup, gunakan `REPEATABLE READ` untuk laporan keuangan. **Transaksi database tidak boleh berlangsung >5 detik.** Jika butuh lebih lama, gunakan pola saga atau background job (BullMQ). |
| **Stop on Confusion** | STOP → Name it → Present tradeoff → Wait |
| **ADR wajib** | Keputusan library utama, perubahan arsitektur, atau trade-off kualitas (performa vs keamanan) WAJIB ada ADR di `docs/decisions/YYYY-MM-DD-judul.md`. |

---
## 🧠 Offline-First Mandatory Rules

> POS adalah nyawa toko. Koneksi mati ≠ transaksi berhenti.

- **Setiap mutasi data HARUS melalui queue lokal** sebelum dikirim ke server.
- Gunakan IndexedDB (frontend) sebagai source of truth sementara saat offline.
- Konfirmasi transaksi ke pengguna dilakukan setelah data tersimpan **lokal**, BUKAN setelah respons server.
- Sinkronisasi harus **idempoten**: gunakan UUID client-side, cek duplikasi di server dengan `SELECT ... FOR UPDATE` pada ID tersebut.
- Pengujian offline **wajib**: setiap fitur POS harus diuji dalam mode airplane.
- **Jangan pernah** asumsikan koneksi tersedia di fungsi transaksi utama (`checkout`, `payment`).
- Target sinkronisasi: < 60 detik / 100 orders.
- **Validasi server-side saat sync:** Setiap transaksi yang masuk dari queue lokal HARUS divalidasi ulang:
  - Diskon tidak melebihi batas maksimal (berdasarkan tier member).
  - Harga item sesuai dengan harga terkini di database (tolak jika berbeda >5%).
  - Tidak ada transaksi dengan nilai negatif atau nol (kecuali void yang sah).
  - Stok mencukupi (jika tidak, transaksi ditandai untuk review manual).
- Transaksi yang gagal validasi server TIDAK boleh langsung ditolak, tapi masuk ke queue `pending_review` dan notifikasi admin.
- Admin harus bisa melihat queue `pending_review` dari dashboard, dan memiliki opsi: Approve (paksa stok), Adjust (ubah item/harga), atau   Reject (refund ke member). Setiap aksi tercatat di audit log.
---


## 🚫 Larangan Keras

- ❌ Hardcode credential/secret/URL production
- ❌ `any` di TypeScript tanpa alasan
- ❌ Breaking change DB tanpa persetujuan eksplisit dari Tech Lead yang **terdokumentasi** di issue/PR
- ❌ Push ke main tanpa CI passing
- ❌ Empty catch block
- ❌ `db push` di production

---

## 🎯 Claude Code Roles

Claude Code assumes 8 roles based on task context. **BUKAN role aplikasi** (Kasir/Admin), tapi peran AI saat bekerja.

| Role | Kapan Aktif | Fokus Utama |
|------|-------------|-------------|
| **Solution Architect** | Desain sistem, arsitektur, ERD | Clean architecture, dependency injection |
| **Backend Developer** | Kode di `backend/` | NestJS, Prisma, JWT, Redis, BullMQ |
| **Frontend Developer** | Kode di `frontend/` | SvelteKit, Svelte 5 Runes |
| **DBA** | Schema, migrasi, query | Prisma, index, N+1 prevention |
| **DevOps Engineer** | Docker, CI/CD, Coolify | Multi-stage build, secrets |
| **Security Engineer** | Auth, environment, endpoint | JWT hardening, rate limiting |
| **QA Engineer** | Fitur baru, bugfix, deploy | Jest, Supertest, Playwright |
| **Product Owner** | Klarifikasi fitur, prioritas, status proyek | Kriteria selesai, scope, **wajib perbarui `PRD_STATUS.md` setelah issue selesai** |

---

## 🔄 Task → Skill Workflow

| Task Type | Primary Skill | Secondary Skill |
|-----------|---------------|----------------|
| Task unclear | `interview-me` | - |
| New feature | `spec-driven-development` | `planning-and-task-breakdown` |
| Fixing bugs | `debugging-and-error-recovery` | `test-driven-development` |
| Building UI | `frontend-ui-engineering` | `test-driven-development` |
| API design | `api-and-interface-design` | `source-driven-development` |
| Code review | `code-review-and-quality` | `security-and-hardening` |
| Performance | `performance-optimization` | `debugging-and-error-recovery` |
| Deploy | `shipping-and-launch` | `ci-cd-and-automation` |

**Auto-aktivasi role berdasarkan pemicu:**

| Pemicu | Role Auto-Aktif |
|--------|----------------|
| Menyelesaikan task dari issue `PRD_STATUS.md` | **Product Owner** |
| Membuat/ mengubah skema database | **DBA** |
| Membahas autentikasi/ endpoint | **Security Engineer** |
| Konfigurasi Docker/ CI/ CD | **DevOps Engineer** |

> **Note:** Full skill list and auto-activation rules available in Global CLAUDE.md.

---

## 📊 Business Rules

### Profit Share Formula
```
Gross Revenue = Total Penjualan (termasuk PPN)
PPN = Gross Revenue × 11%
Net Revenue = Gross Revenue - PPN

HPP = Total Biaya Pokok (from BOM)
Opex = Biaya Operasional
Depreciation = Total Depresiasi Aset

Net Profit = Net Revenue - HPP - Opex - Depreciation
Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%
Per Kasir = Kasir Pool × (Kasir Sales / Total Sales)
```

### Loyalty Tiers
| Tier | Min Points | Discount | Grace |
|------|------------|----------|-------|
| Bronze | 0 | 0% | - |
| Silver | 500 | 5% | 1 bulan |
| Gold | 1,500 | 10% | 1 bulan |
| Platinum | 5,000 | 15% | 1 bulan |

### Key Constants
| Constant | Value |
|----------|-------|
| `TAX_RATE` | 0.11 |
| `MIN_QRIS_AMOUNT` | 1000 |
| `VOID_REASON_MIN_LENGTH` | 10 |
| `MAX_EXPORT_ROWS` | 50000 |

---

## 🚦 Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Void expired QRIS | `false` |
| `FEATURE_JWT_REFRESH` | Silent token refresh | `false` |
| `FEATURE_VOID_APPROVAL` | 4-eyes void approval | `false` |
| `FEATURE_OFFLINE_RECEIPT` | Generate offline receipt | `true` |

---

## 🔐 Security

| Role | Token | Method |
|------|-------|--------|
| Kasir | 8-hour access token | PIN |
| Admin | 12-hour access token | Email + 6-digit OTP |

**No logout/revoke** - tokens expire automatically.  
**Mitigasi kebocoran token:**
- Access token HARUS disimpan di HttpOnly, Secure, SameSite cookie (bukan localStorage/sessionStorage).
- Refresh token rotation WAJIB diimplementasikan meski access token tidak bisa dicabut secara real-time.
- Backend harus menyediakan endpoint `POST /auth/revoke` untuk admin force-revoke token dengan memasukkan ID pengguna ke Redis blacklist (untuk keadaan darurat).
- Setiap permintaan yang menggunakan token harus divalidasi signature dan expiry.
- Token tidak boleh muncul di log, URL, atau respons API (kecuali endpoint login).

**CSRF Protection:**
- Endpoint mutasi (POST/PUT/DELETE) HARUS divalidasi dengan CSRF token.
- **Pola:** CSRF token dikirim sebagai **custom header (`X-CSRF-Token`)** dan disimpan di **localStorage** (terpisah dari access token).
- Access token TETAP di **HttpOnly, Secure, SameSite cookie** (tidak bisa dibaca JavaScript → kebal terhadap XSS, tidak bisa dipakai CSRF).
- Server memvalidasi bahwa access token (dari cookie) dan CSRF token (dari header) berasal dari sesi yang sama.
- Custom header `X-Requested-With: XMLHttpRequest` diperiksa sebagai lapisan tambahan.
- GET endpoint tidak butuh CSRF token (read-only).
- CSRF token HARUS dirotasi setiap 30 menit atau setiap transaksi berhasil (whichever comes first). Frontend mendengarkan respons 403 untuk 
  memicu refresh token via endpoint khusus (`POST /auth/refresh-csrf`).
---


---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11 + PostgreSQL 16 + Prisma **v5.22+** + Redis 7 + BullMQ |
| Frontend | SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4 |
| Infra | Docker + Caddy reverse proxy |

### Project Structure
```
backend/src/       # NestJS modules: auth, orders, products, inventory, finance, members, payment
backend/prisma/    # Schema + migrations
frontend/src/      # SvelteKit: routes/admin, routes/pos, routes/member
```

---

## 📈 Performance Targets

| Metric | Target |
|--------|--------|
| POS load time | < 2 detik |
| Payment processing | < 3 detik |
| Receipt print | < 5 detik |
| API response (p95) | < 200ms |
| Offline sync | < 60 detik / 100 orders |

- Sinkronisasi dilakukan dalam batch maksimal **200 transaksi per request**. Jika lebih, frontend harus memecah menjadi beberapa request sequential.
---

## 📚 Documentation

| Document | Location | Notes |
|----------|----------|-------|
| PRD Master Index | `PRD v2/PRD_MASTER_INDEX.md` | Titik masuk ke seluruh PRD |
| PRD Specs | `PRD v2/PRD_SPEC.md` | Feature specs, business rules, ERD |
| PRD Status | `PRD v2/PRD_STATUS.md` | Issue tracker & progress (19/20 done) |
| PRD API Contract | `PRD v2/PRD_API_CONTRACT.md` | API endpoints & contracts |
| PRD Red Team | `PRD v2/PRD_RED_TEAM.md` | Security findings & mitigations |
| Architecture | `PRD v2/PRD_SPEC.md` | Arsitektur ada di Section 1 PRD Spec |
| ADRs | `docs/decisions/` | 5 ADRs (NestJS, Prisma, Auth, Offline-first, SvelteKit) |
| Guides | `docs/guides/` | Runbook, Backup, Payment Testing, dll |
| API Docs | `docs/api/` | Auth API, Orders API |
| Audits | `docs/audits/` | 356 security findings (P1-P4) |
| Secrets | `docs/guides/SECRETS_MANAGEMENT.md` | Docker secrets setup |
| Tech Debt | `docs/guides/Technical_Debt_Register.md` | 4 open items |
| Memory | `memory/` | Session notes |

---

## ✅ Checklist Sebelum Commit

- [ ] Sudah baca file relevan?
- [ ] Sudah identifikasi file yang terpengaruh?
- [ ] Tidak ada duplikasi?
- [ ] Tidak ada typo?
- [ ] Build + lint passing?
- [ ] Test sudah diperbarui?
- [ ] Env variable didokumentasikan di `.env.example`?
- [ ] Prisma migration ada?
- [ ] Jika menyelesaikan issue dari `PRD_STATUS.md`, status issue sudah diperbarui (Done/In Progress) beserta tanggal?
- [ ] Jika path dokumentasi berubah, apakah `CLAUDE.md` sudah diperbarui?

---

## 📋 Verification Commands

```bash
# Backend (NestJS)
cd backend && npm run lint && npm run build && npm run test

# Frontend (SvelteKit)
cd frontend && npm run lint && npm run check && npm run test && npm run build
```

---

*Last Updated: 2026-06-26*
*Source: PRD v2 (Modular Documentation)*
