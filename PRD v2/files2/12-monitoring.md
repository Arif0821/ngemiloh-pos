# 12. Maintenance & Monitoring

*[← 11-deployment.md](./11-deployment.md) | [→ 13-roadmap.md](./13-roadmap.md)*

---

## 16.1 Observability Stack

> **Filosofi:** Stack sengaja minimalis untuk tim 1–2 developer dan budget Rp 210rb/bulan. Tidak digunakan Prometheus/Grafana (butuh ~300–500MB RAM tambahan + setup overhead). Manfaat visibilitas yang diperlukan sudah tercukupi oleh tiga lapisan di bawah.

| Lapisan | Tool | Tujuan | Biaya |
|---------|------|--------|-------|
| External uptime monitoring | UptimeRobot | Monitor `/health` setiap 5 menit. Alert email/Telegram saat down. | Gratis (free tier cukup) |
| Error tracking | Sentry (cloud) | Capture exception backend (NestJS) + frontend (SvelteKit). Stack trace, breadcrumbs. | Gratis (free tier: 5K errors/bulan) |
| System visibility | Tabel `system_logs` + `/admin/system-health` | Row count orders, disk usage, Redis memory, active sessions, pending sync count. | Sudah termasuk infra |

**Re-evaluasi:** Pertimbangkan Prometheus/Grafana hanya jika Fase 3 (multi-outlet) menambahkan server/container sehingga `/admin/system-health` tidak lagi mencukupi untuk cross-server monitoring.

---

## 16.2 BullMQ Scheduled Jobs

| Job | Schedule (WIB) | Fungsi | Kegagalan |
|-----|----------------|--------|-----------|
| Scheduled price change | Setiap hari 00:01 | Apply `new_base_price` ke produk yang `new_price_effective_from = TODAY`. Invalidasi cache Redis. | Log `system_logs(error)` + email alert |
| Backup harian | Setiap hari 02:00 | PostgreSQL dump → compress → encrypt → upload Backblaze B2 | Log `system_logs(critical)` + email alert "Backup Gagal" |
| Cleanup log lama `[v4.1]` | Hari ke-1 setiap bulan 03:00 | Hapus `system_logs` severity='info' yang lebih tua dari 30 hari | Log hasil ke `system_logs(info)` |
| Auto-close shift | Dinamis (per shift) | Tutup shift saat `auto_close_at` tercapai. Invalidate session kasir. | Log `system_logs(critical)` + email alert |
| Warning auto-close | Dinamis (90 mnt sebelum) | Push notifikasi SSE ke POS kasir | Log saja jika SSE channel tidak tersedia |
| Upload foto cleanup | Mingguan Minggu 03:00 | Hapus file WebP di `/srv/static/products/` yang `image_url`-nya tidak ada di DB `products` | Log saja |

---

## 16.3 Log Retention Policy `[v4.1 — formal]`

| Log | Retensi Hot (DB) | Retensi Cold | Tindakan |
|-----|-----------------|--------------|---------|
| `system_logs` severity = `error`/`critical`/`warning` | **90 hari** | — (volume kecil, pertahankan) | — |
| `system_logs` severity = `info` | **30 hari** | Dihapus | BullMQ cleanup job bulanan |
| `audit_logs` | **Selamanya** (IMMUTABLE) | — | Tidak bisa dihapus (RLS policy) |
| Sentry events | 90 hari (free tier) | — | — |
| Docker container logs | Rotasi otomatis | `max-size: 50m`, `max-file: 3` | Set di docker-compose.yml (12.4) |

---

## 16.4 Alerting — Kapan & Bagaimana

| Alert | Trigger | Channel | Prioritas |
|-------|---------|---------|-----------|
| Backend down | UptimeRobot: `/health` tidak bisa dicapai selama 2 check berturut (10 menit) | Email + (opsional) Telegram | P0 — respons < 30 menit jam kerja |
| Backup gagal | BullMQ job error saat backup | Email "🔴 Backup Harian Gagal" | P1 — respons hari yang sama |
| Circuit breaker Midtrans | ≥3 kegagalan QRIS dalam 5 menit | Email "⚠️ QRIS Circuit Breaker" | P1 — respons < 2 jam |
| Void mencurigakan | >3 void dalam 10 menit | Email "⚠️ Alert Void Mencurigakan" | P1 — investigasi manual |
| Discrepancy kas >5% | Saat tutup shift | Email "⚠️ Discrepancy Kas" | P2 — review end-of-day |
| Login IP baru | Login SA dari IP yang belum pernah digunakan | Email "🔐 Login IP Baru" | P2 — review manual |
| Auto-close shift | Shift ditutup sistem otomatis | Email "ℹ️ Shift Auto-Closed" | Info saja |
| Disk > 80% | Pemeriksaan mingguan manual via `/admin/system-health` | — | P2 |

**On-call (Fase Go-Live):** Developer adalah on-call tunggal selama 2 minggu pertama go-live (sesuai checklist `15-appendix.md`). Target respons:
- P0 (down total): < 30 menit jam kerja, < 2 jam di luar jam kerja.
- P1 (critical tapi app masih jalan): hari yang sama.
- P2 (monitoring/investigasi): 1–2 hari kerja.

---

## 16.5 SLO Monitoring — Manual (Simplified)

Karena tidak ada Prometheus/Grafana, monitoring SLO dilakukan semi-manual:

```bash
# Script sederhana: cek P95 response time dari Nginx/Caddy access log
# Jalankan manual atau via cron harian

docker logs ngemiloh-caddy --since 24h 2>/dev/null | \
  awk '{print $NF}' |  # kolom response time (ms)
  sort -n | \
  awk 'BEGIN{c=0} {a[c++]=$1} END{print "P95:", a[int(c*0.95)], "ms"}'
```

Atau cukup pantau di Sentry: jika ada lonjakan error rate → review `/admin/system-health` untuk korelasi.

**Error Budget Review:** Setiap awal bulan, cek total downtime bulan sebelumnya (dari UptimeRobot dashboard) vs target 3,6 jam/bulan (99.5% SLO). Jika budget habis → freeze deploy fitur baru, focus stabilitas.

---

## 16.6 Postmortem Template

Simpan setiap postmortem di `/docs/postmortems/YYYY-MM-DD-judul.md`.

```markdown
# Postmortem: [Judul Singkat] — [Tanggal]

**Severity:** P0 / P1 / P2
**Impact:** [Siapa terdampak, berapa lama, estimasi transaksi yang tertunda]
**Status:** Resolved ✅ / Ongoing 🔄

## Timeline (WIB)
- HH:MM — [kejadian pertama terdeteksi]
- HH:MM — [investigasi dimulai]
- HH:MM — [root cause ditemukan]
- HH:MM — [fix diterapkan]
- HH:MM — [confirmed resolved]

## Root Cause (5 Whys)
1. [Gejala] mengapa? → [penyebab 1]
2. [Penyebab 1] mengapa? → [penyebab 2]
3. dst. (minimal 3 why, jangan berhenti di "human error")

## Dampak Nyata
- Transaksi yang gagal/tertunda: [N]
- Estimasi revenue terdampak: Rp [X]
- Kasir yang terdampak: [daftar nama/shift]

## Action Items
| Item | Assignee | Deadline | Status |
|------|----------|----------|--------|
| [tindakan spesifik, measurable] | [siapa] | [kapan] | [ ] |

## Lessons Learned
[Apa yang bisa dilakukan lebih baik? Apa yang berjalan baik?]
```

---

## 16.7 Profiling On-Demand

> Catatan: `clinic.js` / `node --prof` **tidak dipasang sebagai requirement** — ini tooling on-demand saat ada masalah performa nyata, bukan sesuatu yang "diimplementasikan" secara rutin.

```bash
# Jika P95 melampaui target (05-nonfunctional-reqs.md §5.1) secara konsisten:
# Hukum Knuth: profile dulu, optimasi kemudian

# Di container NestJS
docker exec -it ngemiloh-api sh -c "npx clinic doctor -- node dist/main.js"
# Atau
docker exec -it ngemiloh-api sh -c "node --prof dist/main.js"
```

Langkah setelah profiling: identifikasi hotspot → baru optimasi → ukur ulang → dokumentasikan di `/docs/performance-notes.md`.

---

## 16.8 Maintenance Window

Tidak ada maintenance window terjadwal formal. Alasan: single VPS, offline-first mitigates short downtime, Coolify zero-downtime deploy sudah meminimasi interruption.

Jika ada maintenance yang memerlukan downtime (mis. upgrade PostgreSQL major version):
1. Informasikan owner (Nabilah) minimal H-2.
2. Jadwalkan di luar jam sibuk operasional warung (sebelum 08:00 atau setelah 22:00 WIB).
3. Catat di CHANGELOG.md sebagai entry maintenance.

---

*Lanjut ke: [`13-roadmap.md`](./13-roadmap.md)*
