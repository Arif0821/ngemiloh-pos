# 03. User Journey & App Flow

*[← 02-business-rules.md](./02-business-rules.md) | [→ 04-functional-reqs.md](./04-functional-reqs.md)*

---

> **`[v4.1]`** Seluruh contoh nomor transaksi menggunakan format yang sudah distandarkan: `TRX-YYYYMMDD-[cashier_letter][seq3]` (CR-002, ADR-016). Referensi `outlet_id` dihapus (CR-004).

---

## 7.1 Journey: Kasir — Shift Pagi (Shift Pertama Hari Itu)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. BUKA BROWSER                                                             │
│    Kasir buka browser di tablet/smartphone, akses URL POS: {domain}/pos    │
│                              ↓                                              │
│ 2. LOGIN                                                                    │
│    Halaman login kasir. Input PIN (4–6 digit). Tekan "Masuk".              │
│    → POST /auth/login/cashier → Session dibuat di Redis, cookie di-set     │
│    → cashier_letter = 'A' (contoh, unik per kasir)                        │
│                              ↓                                              │
│ 3. MODAL KAS AWAL (WAJIB — tidak bisa di-dismiss)                          │
│    Shift pertama hari ini → input kas awal manual.                          │
│    Kasir input: Rp 200.000 → Tekan "Mulai Shift"                           │
│    → POST /shift/open → shift_number=1, opening_balance=200000             │
│                              ↓                                              │
│ 4. DASHBOARD POS                                                            │
│    Header: "Rina | 🟢 Online | Hari ini: 0 transaksi"                      │
│    Grid produk: foto, nama, harga, badge HABIS jika is_out_of_stock         │
│    Keranjang kosong di sisi kanan (landscape tablet)                        │
│                              ↓                                              │
│ 5. BUAT PESANAN                                                             │
│    a. Tap "Macaroni Mateng" → Popup modifier:                              │
│       Required: "Pilih Bumbu" → Pilih "Bumbu Keju" (+Rp 1.500)            │
│       Optional: "Pilih Saus" → Pilih "Saus BBQ" (+Rp 2.500)               │
│       Qty: 2 → Tap "Tambah ke Keranjang"                                   │
│    b. Tap "Basreng" (tidak ada modifier wajib) → Qty: 1 → Tambah          │
│    c. Keranjang:                                                            │
│       • 2× Macaroni Mateng (Bumbu Keju, Saus BBQ) — Rp 24.200            │
│       • 1× Basreng — Rp 5.000                                              │
│       • Diskon weekday 10% — −Rp 1.800 (capped at max_discount jika ada)  │
│       TOTAL: Rp 27.400                                                      │
│                              ↓                                              │
│ 6. (OPSIONAL) EDIT KERANJANG                                                │
│    Tap item → popup modifier ulang / ubah qty / hapus item                  │
│                              ↓                                              │
│ 7. TEKAN "BAYAR"                                                            │
│    → POST /orders → order_status='completed', payment_status='pending'     │
│    → Nomor transaksi: TRX-20260615-A001                                    │
│                              ↓                                              │
│ 8. PILIH METODE PEMBAYARAN                                                  │
│    [TUNAI]  [QRIS]  [SPLIT]  ← sesuai flag qris_available                 │
│                              ↓                                              │
│    8A. TUNAI:                                                               │
│        Preset: [5K] [10K] [20K] [50K] [100K] + input manual + [Uang Pas]  │
│        Tap [50K] → cash_received=50.000 → Kembalian: Rp 22.600            │
│        Tekan "Selesai" → POST /orders/A001/pay/cash → settled               │
│                                                                             │
│    8B. QRIS:                                                                │
│        → POST /payment/qris/create → QR code + countdown 15 menit         │
│        → Pelanggan scan & bayar → webhook Midtrans → settled               │
│        → Jika expired: [Buat QR Baru] atau [Ganti Metode]                  │
│                                                                             │
│    8C. SPLIT: (lihat Journey 7.5)                                           │
│                              ↓                                              │
│ 9. STRUK & ANTRIAN                                                          │
│    → Tampil: "Pembayaran Selesai — Antrian A-001"                          │
│    → Opsi: [CETAK STRUK] [SELESAI]                                         │
│    → Kembali ke grid POS                                                    │
│    → Header update: "Hari ini: 1 transaksi"                                │
│                              ↓                                              │
│ 10. TUTUP SHIFT (akhir sesi)                                                │
│     → Menu → "Tutup Shift"                                                  │
│     → Ringkasan shift:                                                      │
│       Kas awal:        Rp 200.000                                           │
│       Penjualan tunai: Rp 850.000                                           │
│       Penjualan QRIS:  Rp 300.000                                           │
│       Kas akhir (exp): Rp 1.050.000                                         │
│     → Input kas fisik aktual: Rp 1.049.500                                 │
│     → Selisih: −Rp 500 (tampil dengan warna oranye)                        │
│     → Tekan "Konfirmasi Tutup Shift" → POST /shift/close → logged          │
│                              ↓                                              │
│ 11. LOGOUT                                                                  │
│     → Session dihapus dari Redis → Redirect ke /pos (login screen)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.2 Journey: Kasir — Shift Sore (Carry-Over + Auto-Close)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LOGIN (17:30 WIB)                                                        │
│    Kasir login dengan PIN → sistem deteksi login ≥ 17:00 WIB               │
│                              ↓                                              │
│ 2. MODAL KAS AWAL — CARRY-OVER                                              │
│    Sistem deteksi: ada shift sebelumnya hari ini (closing_balance=1.049.500)│
│    Modal tampil: "Kas Awal dari Shift Sebelumnya: Rp 1.049.500 (otomatis)" │
│    Field kas awal = READONLY (tidak bisa diubah)                            │
│    WAJIB: Input "Waktu Rencana Tutup Shift": pilih 22:00 WIB               │
│    → auto_close_at = 22:00 + 1 jam = 23:00 WIB                            │
│    → BullMQ schedule: warning job (20:30) + auto-close job (23:00)         │
│                              ↓                                              │
│ 3. OPERASI SHIFT SORE (sama seperti shift pagi)                             │
│                              ↓                                              │
│ 4. 20:30 WIB — NOTIFIKASI WARNING (via SSE push)                            │
│    Banner persistent merah: "Shift akan ditutup otomatis pukul 23:00 WIB.  │
│    Selesaikan transaksi dan tutup shift segera."                            │
│    [Tutup Sekarang] [Dismiss (30 menit)]                                    │
│                              ↓                                              │
│ 5A. Kasir tutup shift manual sebelum 23:00 → normal flow                    │
│     → BullMQ auto-close job dibatalkan                                      │
│                                                                             │
│ 5B. Kasir TIDAK tutup shift → 23:00 → AUTO-CLOSE:                          │
│     → BullMQ job: closing_balance dihitung otomatis (actual_cash = NULL)   │
│     → is_auto_closed = true → session kasir di-invalidate dari Redis        │
│     → system_logs: severity=warning, log_type=shift_event                  │
│     → email ke nabilah.fnb@gmail.com: "Shift Auto-Closed"                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.3 Journey: Kasir — Offline Mode

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ONLINE → OFFLINE                                                            │
│   → navigator.onLine = false ATAU heartbeat 30s gagal 3× berturut          │
│   → Badge header berubah: 🟢 Online → 🔴 Offline                           │
│   → Tombol QRIS/Split disabled (tombol abu-abu, tooltip: "Tidak tersedia") │
│   → QRIS & Split payment tidak bisa dipilih                                 │
│                              ↓                                              │
│ TRANSAKSI OFFLINE (tunai saja):                                             │
│   → Buat order → simpan ke IndexedDB (Dexie.js) dengan:                    │
│     - Full order detail (items, modifiers, harga, diskon, timestamp)       │
│     - client_uuid unik (idempotency saat sync)                             │
│     - client_created_at = waktu sekarang di client                         │
│     - order_status = 'pending_sync'                                         │
│   → transaction_number di-generate lokal: TRX-20260615-A003               │
│   → Badge header: 🔴 Offline | ⏳ 1 belum sync (kuning)                    │
│   → Tambah transaksi lagi → badge: ⏳ 2 belum sync                         │
│                              ↓                                              │
│ ONLINE KEMBALI:                                                             │
│   → heartbeat berhasil ATAU navigator.onLine = true                        │
│   → Modal "Sinkronisasi Tertunda": "2 transaksi menunggu sync (Rp 45.800)" │
│     Detail: TRX-A003 Rp 24.200, TRX-A004 Rp 21.600                        │
│     [Sync Sekarang] [Lihat Detail]                                          │
│   → Kasir tap "Sync Sekarang"                                              │
│   → POST /orders/sync-batch (2 order) → response per-order                 │
│   → Sukses: badge hilang, order_status='completed', synced_at=now          │
│   → Jika 1 gagal: badge merah untuk yang gagal, detail error tampil        │
│                              ↓                                              │
│ JIKA SYNC GAGAL > 2 JAM:                                                   │
│   → order_status = 'sync_failed' (badge merah, berbeda dari kuning)        │
│   → UI: "Transaksi A003 gagal sync — tap untuk coba ulang atau hubungi SA" │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.4 Journey: Superadmin — Dashboard Harian

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LOGIN ADMIN                                                              │
│    Akses {domain}/admin → form email + password                             │
│    → POST /auth/login/admin → session 24 jam → redirect ke /admin/dashboard│
│                              ↓                                              │
│ 2. DASHBOARD                                                                │
│    KPI Cards (hari ini):                                                    │
│    ┌──────────────┬──────────────┬──────────────┬──────────────┐            │
│    │ Revenue      │ Transaksi    │ Avg. Order   │ Top Produk   │            │
│    │ Rp 1.250.000 │ 47           │ Rp 26.595    │ Macaroni     │            │
│    └──────────────┴──────────────┴──────────────┴──────────────┘            │
│    Grafik 7 hari terakhir (tren penjualan)                                  │
│    Shift aktif: Rina (buka 08:00, transaksi: 23)                           │
│                              ↓                                              │
│ 3. MANAJEMEN PRODUK                                                         │
│    a. Tambah produk baru: nama, foto, harga, kategori, HPP estimasi        │
│    b. Jadwalkan perubahan harga: pilih produk → input harga baru + tanggal │
│       (minimal H+1) → BullMQ schedule                                       │
│    c. Arsipkan produk: produk tidak muncul di POS, data historis terjaga   │
│    d. CRUD modifier groups & options                                         │
│                              ↓                                              │
│ 4. MANAJEMEN DISKON                                                         │
│    Buat diskon: nama, tipe (persentase/nominal), max_discount (opsional),   │
│    scope (semua/per-produk), hari berlaku (bitmask), periode, status        │
│                              ↓                                              │
│ 5. LAPORAN                                                                  │
│    a. Laporan harian → breakdown per produk, per metode bayar              │
│    b. Laporan periodik → tren + growth MoM/WoW                             │
│    c. Laporan shift → per kasir, per tanggal, discrepancy kas              │
│    d. P&L → revenue − HPP − opex − depresiasi = net profit                │
│    e. Export CSV (rate limit: 5/jam)                                        │
│                              ↓                                              │
│ 6. HPP & BAGI HASIL                                                         │
│    Fase 1A: input estimated_hpp per produk                                  │
│    Fase 1B: kelola BOM (bahan baku + komposisi) → hpp_source=bom_calculated│
│    Hitung bagi hasil periode → lihat proporsi per kasir → mark paid         │
│                              ↓                                              │
│ 7. VOID TRANSAKSI                                                           │
│    Cari transaksi → klik Void → konfirmasi: input alasan (≥10 karakter)    │
│    → POST /admin/orders/:id/void → order_status='voided'                   │
│    → audit_logs(ORDER_VOIDED, immutable) → email alert jika >3 void/10mnt  │
│                              ↓                                              │
│ 8. SETTINGS & KASIR                                                         │
│    Kelola akun kasir: tambah, reset PIN (kasir ter-logout paksa), deactivate│
│    Settings: threshold shift, preset nominal, lebar struk, nama toko        │
│    Feature flags: toggle on/off per fitur                                   │
│                              ↓                                              │
│ 9. MONITORING                                                               │
│    System logs: filter by severity/type/date → audit security events        │
│    System health: DB pool, Redis, disk, memory, uptime, row count orders   │
│    (visibilitas terhadap exit criteria partisi — v4.1)                      │
│                              ↓                                              │
│ 10. BACKUP KE POS (jika kasir berhalangan)                                  │
│     SA navigasi ke {domain}/pos → buka shift → proses transaksi            │
│     Transaksi tercatat dengan cashier_id milik akun superadmin             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.5 Journey: Split Payment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Total pesanan: Rp 85.000                                                    │
│                              ↓                                              │
│ 1. Kasir tekan [BAYAR] → POST /orders → payment_status='pending'           │
│                              ↓                                              │
│ 2. Pilih [SPLIT]                                                            │
│                              ↓                                              │
│ 3. PORSI TUNAI                                                              │
│    "Berapa yang dibayar tunai?"                                             │
│    → Input: Rp 50.000                                                       │
│    → Sisa QRIS: Rp 35.000 (otomatis) → validasi: 0 < 50K < 85K ✅         │
│                              ↓                                              │
│ 4. INPUT UANG DITERIMA (untuk porsi tunai)                                  │
│    Preset: [50K] [100K] [Uang Pas] + input manual                          │
│    → Tap [50K] → cash_received=50.000 → Kembalian: Rp 0                    │
│                              ↓                                              │
│ 5. GENERATE QR UNTUK SISA Rp 35.000                                         │
│    → POST /orders/:id/pay/split → QR code muncul + countdown 15 menit      │
│    → Pelanggan scan & bayar                                                  │
│                              ↓                                              │
│ 6. WEBHOOK MIDTRANS → payment_status='settled'                               │
│    → "Pembayaran Selesai" → opsi cetak struk                                │
│                                                                             │
│ STRUK menampilkan:                                                          │
│   Pembayaran: Split                                                         │
│   - Tunai  : Rp 50.000 (Diterima: Rp 50.000, Kembalian: Rp 0)            │
│   - QRIS   : Rp 35.000                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.6 Journey: QRIS Expired & Regenerate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Order dibuat → Kasir pilih [QRIS] → QR generated                        │
│                              ↓                                              │
│ 2. Countdown: 15:00 → ... → 00:00                                           │
│                              ↓                                              │
│ 3. QR EXPIRED: payment_status='expired'                                     │
│    "QR Code kedaluwarsa"                                                    │
│    [Buat QR Baru]  [Ganti Metode Bayar]  [Batalkan]                        │
│                              ↓                                              │
│    A. [Buat QR Baru]                                                        │
│       → POST /payment/qris/create (order_id sama, transaction_id baru)     │
│       → payment_status kembali 'pending' → countdown 15 menit ulang        │
│                                                                             │
│    B. [Ganti Metode Bayar]                                                  │
│       → Kembali ke pilihan [TUNAI] [QRIS] [SPLIT]                         │
│                                                                             │
│    C. [Batalkan]                                                            │
│       → order_status='cancelled', payment_status='failed'                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7.7 Journey: Circuit Breaker QRIS Aktif `[v4.1 — baru, ADR-014]`

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Midtrans mengalami gangguan → 3 kegagalan create QR dalam 5 menit          │
│ → Redis: midtrans:degraded = '1' (TTL 5 menit)                             │
│ → email alert ke nabilah.fnb@gmail.com: "QRIS Circuit Breaker Aktif"       │
│                              ↓                                              │
│ GET /products → "qris_available": false                                     │
│                              ↓                                              │
│ UI POS:                                                                     │
│ → Tombol [QRIS] dan [SPLIT] disembunyikan (tidak hanya disabled)           │
│ → Banner kuning: "QRIS sedang gangguan. Gunakan Tunai sementara."          │
│                              ↓                                              │
│ RECOVERY (otomatis setelah 5 menit):                                        │
│ → Redis key expire → midtrans:degraded hilang                               │
│ → GET /products → "qris_available": true                                    │
│ → Tombol QRIS muncul kembali, banner hilang                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. App Flow & Navigasi

### 8.1 POS (Kasir)

```
/pos                     ← halaman utama POS
├── /pos/login           ← login kasir (PIN)
├── /pos/shift           ← modal kas awal (redirect dari login jika belum)
├── /pos/dashboard       ← grid produk + keranjang
│   ├── Popup Modifier   ← overlay saat tap produk
│   ├── Keranjang        ← sidebar atau bottom sheet
│   ├── /pos/payment     ← pilih metode + input
│   │   ├── /pos/payment/cash    ← input tunai + kembalian
│   │   ├── /pos/payment/qris    ← tampil QR code + countdown
│   │   └── /pos/payment/split   ← input porsi tunai → QR sisa
│   └── /pos/receipt     ← success screen + cetak struk
├── /pos/history         ← riwayat transaksi shift aktif
└── /pos/sync            ← status sinkronisasi offline
```

### 8.2 Dashboard Admin (Superadmin)

```
/admin                   ← redirect ke /admin/dashboard
├── /admin/login         ← login SA (email + password)
├── /admin/dashboard     ← KPI + grafik
├── /admin/transactions  ← list semua transaksi + filter + void
│   └── /admin/transactions/:id  ← detail transaksi
├── /admin/products      ← list produk + CRUD
│   ├── /admin/products/new      ← tambah produk
│   └── /admin/products/:id/edit ← edit + foto + jadwal harga + BOM
├── /admin/categories    ← CRUD kategori
├── /admin/discounts     ← CRUD diskon
├── /admin/shifts        ← riwayat shift + rekonsiliasi
├── /admin/cashiers      ← CRUD kasir + reset PIN
├── /admin/reports       ← laporan harian/periodik/profit
│   └── /admin/reports/export    ← export CSV
├── /admin/profit-share  ← HPP + bagi hasil
├── /admin/settings      ← settings + feature flags
├── /admin/system-logs   ← system logs
└── /admin/system-health ← system health
```

### 8.3 Navigasi Superadmin ↔ POS

Superadmin bisa beralih dari dashboard admin ke POS via tombol "Masuk ke POS" (navigasi ke `/pos/dashboard` tanpa login ulang — session yang sama berlaku untuk keduanya karena role superadmin memiliki akses ke semua area).

---

*Lanjut ke: [`04-functional-reqs.md`](./04-functional-reqs.md)*
