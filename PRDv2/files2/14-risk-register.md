# 14. Risk Register

*[← 13-roadmap.md](./13-roadmap.md) | [→ 15-appendix.md](./15-appendix.md)*

---

> **`[v4.1]`** Tambahan: R-16, R-17, R-18 (risiko baru dari proses penyusunan v4.1). TD-08 diperbarui (partisi bukan lagi "resolved", tapi "deferred by design"). TD-11 diperbarui (smoke test otomatis tersedia di v4.1).

## Risk Register

| # | Risiko | Probabilitas | Impact | Mitigasi | Owner |
|---|--------|-------------|--------|----------|-------|
| R-01 | **Data hilang: IndexedDB di-clear browser** | Medium | Kritis | Max 500 pending (OFFL-10). Edukasi kasir: jangan gunakan mode incognito, jangan clear data browser. Warning popup saat >100 pending (badge kuning). State `sync_failed` menandai order yang perlu intervensi (CR-013). | Dev |
| R-02 | **Duplikasi order saat sync retry** | High | Kritis | `client_uuid` UNIQUE constraint di DB. Endpoint `sync-batch` idempotent: cek UNIQUE lalu return data order yang sudah ada jika ada konflik — bukan error 500. | Dev |
| R-03 | **Webhook Midtrans dipalsukan** | Medium | Kritis | SHA512 signature verifikasi wajib. `timingSafeEqual` (anti timing attack). Selalu return 200 ke Midtrans. Log ke `system_logs(security_alert)` + email alert jika signature salah. `audit_logs(WEBHOOK_FRAUD_ATTEMPT)`. | Dev |
| R-04 | **Formula harga salah (diskon + modifier)** | High | Tinggi | Server recalculate ulang — tidak trust nilai dari client. Unit test semua kombinasi (TC-01). Mutation testing modul pricing (Stryker, score ≥70%) `[v4.1]`. Audit trail perubahan harga di `audit_logs`. | Dev |
| R-05 | **QRIS offline — kasir bingung** | High | Sedang | Tombol QRIS disabled saat offline (navigator.onLine + heartbeat 30s). Circuit breaker Midtrans (ADR-014): QRIS juga di-disable saat ≥3 kegagalan dalam 5 menit `[v4.1]`. Tooltip informatif. Badge OFFLINE merah mencolok. Edukasi kasir saat briefing. | Dev + Owner |
| R-06 | **VPS down** | Low | Kritis | Offline mode aktif otomatis (Dexie.js + 2-layer retry). UptimeRobot alert <10 menit. Coolify auto-restart container. DR plan terdokumentasi di `/docs/runbook.md`. | Dev |
| R-07 | **Timeline terlalu optimis (Fase 1A 14 hari)** | High | Sedang | Soft Launch strategy — MVP tunai saja di Hari 14. Feature flags untuk enable fitur bertahap. Buffer 2 hari per fase. Modular Monolith (ADR-013) mengurangi boilerplate vs Clean Architecture penuh. | Dev |
| R-08 | **Bagi hasil tidak akurat (HPP=0 di Fase 1A)** | High | Sedang | Disclaimer wajib di UI dashboard: "HPP belum akurat — menggunakan estimasi manual". `estimated_hpp` sebagai fallback yang bisa diisi kapan saja. BOM+HPP akurat di Fase 1B (Minggu 6). | Dev + Owner |
| R-09 | **Akun SA diretas (no 2FA)** | Low | Kritis | Password ≥16 karakter wajib (4 jenis karakter). Email alert login dari IP baru. Rate limit login 5/10 menit per IP. Audit log semua aksi SA (immutable). Session TTL 24 jam. Review 2FA di Fase 3 (TD-04). | Dev |
| R-10 | **Redis crash → semua session hilang** | Low | Tinggi | Redis AOF persistence (data tidak hilang di disk meski crash). Kasir: login ulang mudah (PIN 4–6 digit, <10 detik). SA: login ulang (password). Data transaksi tidak hilang — hanya session state. | Dev |
| R-11 | **Midtrans sandbox → production migration gagal** | Medium | Tinggi | Checklist migrasi production di `15-appendix.md §A`. Test endpoint production sebelum go-live resmi. Fallback: sementara tunai-only jika QRIS production belum aktif. | Dev + Owner |
| R-12 | **Disk penuh (VPS 60GB)** | Low | Tinggi | Monitoring disk via `/admin/system-health`. Alert manual saat >80% (`05-nonfunctional-reqs.md §5.4` — estimasi 10 tahun hanya ~15–20GB). Log rotation di Docker (max-size 50m, max-file 3). Backup + cleanup foto orphan (upload cleanup job mingguan). | Dev |
| R-13 | **Session hijacking** | Low | Kritis | HttpOnly + Secure + SameSite=Strict cookie. HTTPS enforced (Caddy auto-SSL). Session tidak disimpan di localStorage/sessionStorage. Helm.js security headers (CSP, HSTS, X-Frame-Options). | Dev |
| R-14 | **Kasir berhenti mendadak** | Medium | Tinggi | SA bisa deactivate user + force logout semua session instan (scan `user_sessions:{userId}:*`). SA bisa login POS dan proses transaksi. Buat kasir baru + onboarding <10 menit. | Owner |
| R-15 | **Perubahan harga bahan baku** | High | Sedang | `estimated_hpp` bisa diupdate kapan saja dari dashboard. BOM recalculate otomatis saat harga bahan baku diubah (Fase 1B). Tidak ada alert otomatis margin turun (Fase 2). | Owner |
| **R-16** | **`[v4.1]` PRD makin besar & tidak terbaca seiring waktu** | Tinggi | Sedang | Struktur multi-file (CR-014, 16 file tematik + ADR terpisah). Setiap file punya scope topik terbatas. Index di `00-overview.md`. | Dev |
| **R-17** | **`[v4.1]` Inkonsistensi spek baru muncul lagi di iterasi berikutnya** | Sedang | Sedang | CR Log di `00-overview.md` sebagai mandatory step sebelum finalisasi perubahan. Checklist konsistensi: cek format nomor transaksi, nama kolom, enum values sebelum merge perubahan PRD. | Dev |
| **R-18** | **`[v4.1]` Feature flag debt — 12 flag tanpa tanggal cabut** | Sedang | Rendah | Review kuartalan flag yang sudah di-enable 100%. Pertimbangkan hardcode dan hapus flag yang sudah tidak diperlukan. Tambahkan kolom `target_removal_at` (opsional) jika jumlah flag bertambah signifikan. | Dev |

---

## Technical Debt Register

| ID | Deskripsi | Severity | Target | Detail |
|----|-----------|----------|--------|--------|
| TD-01 | UUID v4 (bukan ULID sortable) | Low | Fase 3 jika >500K rows | UUID v4 tidak sortable secara natural → index pada `created_at` diperlukan. ULID menggabungkan timestamp + random. Migrasi hanya jika terjadi degradasi performa query. |
| TD-02 | Polling 60 detik untuk dashboard | Medium | Fase 1.5 (Minggu 9–10) | `setInterval` 60s → SSE. Sudah planned (13-roadmap). Feature flag `SSE_REALTIME`. |
| TD-03 | HPP = 0 atau estimasi kasar di Fase 1A | High | Fase 1B (Minggu 6) | Bagi hasil tidak akurat tanpa HPP aktual. Disclaimer wajib di UI. `estimated_hpp` sebagai fallback. BOM HPP di Fase 1B. |
| TD-04 | Tidak ada 2FA superadmin | Medium | Review Fase 3 | Accepted risk yang terdokumentasi. Kompensasi: password ≥16 char + email alert IP baru + rate limit + TTL 24 jam. |
| TD-05 | Rate limit belum granular per-endpoint | Low | Fase 2 jika ada abuse | Saat ini: per-session sliding window. Tabel limit sudah ada di 6.10. Implementasi granular hanya jika ada pola abuse nyata. |
| TD-06 | DR test manual bulanan | Low | Fase 2 | Idealnya automated DR test via CI. Untuk sekarang: manual + catat di `/docs/DR_log.md`. |
| TD-07 | No API versioning selain /v1/ | Low | Fase 3 jika public API | Internal API saja, tidak perlu versioning sekarang. Deprecation policy terdokumentasi di `08-api-contract.md §11.13`. |
| ~~TD-08~~ | ~~Partisi baru dibuat manual~~ | — | — | **`[v4.1 — CR-003]`** Bukan lagi "resolved via BullMQ cron" — keputusan berubah: **partisi tidak diimplementasikan** di Fase 1–2 (bukan overhead yang dibutuhkan). Exit criteria terdokumentasikan untuk Fase 3+. |
| TD-09 | Session tidak di-persist ke PostgreSQL | Low | Jika traffic tinggi atau multi-server | Session hanya di Redis. Jika Redis crash = semua user re-login. Mitigasi: Redis AOF persistence. |
| TD-10 | Transaction number sequence bisa gap | Low | Fase 2 | Jika transaksi gagal/rollback, sequence number bisa skip. Tidak masalah secara bisnis, tapi tampak kurang rapi. Dokumentasikan sebagai "by design". |
| ~~TD-11~~ | ~~Tidak ada smoke test otomatis post-deploy~~ | — | — | **`[v4.1 — CR-015]`** RESOLVED — smoke test otomatis ditambahkan ke CI/CD pipeline (`11-deployment.md §12.9`). |
| TD-12 | Backup encryption key di env variable | Low | Fase 2 | Idealnya di external secret manager (HashiCorp Vault). Untuk sekarang: Coolify Secrets sudah cukup aman untuk skala ini. |
| TD-13 | `raw_materials`/`bom_items` skema ada, implementasi Fase 1B | Low | Fase 1B (Minggu 6) | Skema sudah di-migrate Fase 0 (v4.1 CR-011). Endpoint FR-HPP-02 belum diimplementasi di Fase 1A. Feature flag `BOM_HPP = false`. |

---

*Lanjut ke: [`15-appendix.md`](./15-appendix.md)*
