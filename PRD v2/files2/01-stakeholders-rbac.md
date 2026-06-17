# 01. Stakeholder, Persona & RBAC

*[← 00-overview.md](./00-overview.md) | [→ 02-business-rules.md](./02-business-rules.md)*

---

## 4.1 Stakeholder

| Stakeholder | Peran | Kepentingan Utama |
|-------------|-------|-------------------|
| **Nabilah** (Owner) | Superadmin, pemilik bisnis | Kontrol penuh atas bisnis: produk, harga, laporan keuangan, bagi hasil, monitoring kasir. Juga bisa menjadi backup kasir di POS. |
| **Kasir** | Operator POS | Memproses transaksi harian dengan cepat dan akurat, mengelola shift dan kas. |
| **Developer** | Tim pengembangan | Membangun dan memelihara sistem sesuai PRD. |
| **Pelanggan** | End-customer | Membeli jajanan dan menerima struk. Tidak berinteraksi langsung dengan sistem digital. |

> **`[v4.1 — OPEN-01]`** Nama Superadmin/Owner distandarkan ke **Nabilah** di seluruh dokumen. Lihat detail asumsi di `00-overview.md §OPEN-01`.

---

## 4.2 User Persona

### Persona 1: Nabilah — Superadmin (Owner)

| Atribut | Detail |
|---------|--------|
| **Nama** | Nabilah |
| **Peran** | Superadmin / Pemilik Usaha |
| **Usia** | 25–35 tahun |
| **Tech Literacy** | Menengah — familiar dengan smartphone dan aplikasi bisnis dasar |
| **Perangkat** | Laptop atau tablet untuk dashboard admin; kadang smartphone |
| **Email** | nabilah.fnb@gmail.com |
| **Tujuan Utama** | Memantau performa bisnis secara real-time, mengelola produk & harga (termasuk diskon dan jadwal harga), melihat laporan keuangan harian/bulanan, mengatur bagi hasil kasir |
| **Pain Points** | Tidak bisa memantau penjualan real-time saat tidak di lokasi; kesulitan menghitung HPP manual; perlu fleksibilitas mengubah harga tanpa tutup-buka toko; kadang perlu turun ke POS sebagai backup kasir |
| **Frekuensi Akses** | Dashboard admin: 1–3× per hari. POS: sesekali sebagai backup kasir. |
| **Skenario Utama** | Login dashboard → lihat KPI hari ini → review laporan produk terlaris → atur harga terjadwal untuk besok → logout |
| **Skenario Backup** | Kasir berhalangan hadir → Nabilah login ke POS dengan kredensial superadmin → proses transaksi langsung → transaksi tercatat dengan `cashier_id` milik akun superadmin |

---

### Persona 2: Rina — Kasir (Representatif)

| Atribut | Detail |
|---------|--------|
| **Nama** | Rina (nama representatif — bukan nama kasir aktual) |
| **Peran** | Kasir |
| **Usia** | 18–28 tahun |
| **Tech Literacy** | Dasar hingga menengah — terbiasa dengan smartphone, mungkin belum pernah pakai sistem POS |
| **Perangkat** | Tablet atau smartphone di meja kasir. Layar sentuh. |
| **Tujuan Utama** | Memproses pesanan dengan cepat tanpa error, menerima pembayaran (tunai/QRIS/split), mengelola shift dan kas awal/akhir |
| **Pain Points** | Antrian panjang saat jam ramai → butuh input cepat; koneksi internet tidak stabil → butuh offline mode yang tidak membingungkan; sistem yang terlalu kompleks meningkatkan risiko error |
| **Frekuensi Akses** | Sepanjang jam shift: 4–10 jam per hari |
| **Kebutuhan Khusus** | Interface sederhana & intuitif, tombol besar (tap target ≥44×44px), feedback visual jelas (badge ONLINE/OFFLINE, nomor antrian di layar), bisa beroperasi saat offline tanpa kehilangan data |
| **Skenario Utama** | Login PIN → modal kas awal → POS grid → tap produk → pilih modifier → keranjang → bayar tunai → cetak struk → kembali ke grid |

---

## 5.1 Definisi Role

| Role | Deskripsi | Metode Login | Session TTL |
|------|-----------|--------------|-------------|
| **Superadmin** | Pemilik usaha dengan akses penuh ke seluruh fitur — termasuk dashboard admin DAN POS (sebagai backup kasir). Satu-satunya yang bisa void transaksi, kelola kasir, lihat laporan, dan konfigurasi sistem. | Email + Password → `POST /auth/login/admin` | 24 jam. Perpanjang dengan login ulang. |
| **Kasir** | Operator POS untuk memproses transaksi harian. Hanya akses ke fitur operasional POS dan ringkasan shift sendiri. | PIN unik 4–6 digit → `POST /auth/login/cashier` | Tanpa batas — berakhir saat logout atau tutup shift. |

---

## 5.2 Permission Matrix

✅ = Diizinkan | ❌ = Tidak diizinkan

| Modul | Aksi | Superadmin | Kasir |
|-------|------|:----------:|:-----:|
| **Auth** | Login ke dashboard admin | ✅ | ❌ |
| **Auth** | Login ke POS | ✅ | ✅ |
| **Auth** | Logout | ✅ | ✅ |
| **Auth** | Ganti PIN sendiri | ❌ | ✅ |
| **Auth** | Reset PIN kasir lain | ✅ | ❌ |
| **Shift** | Buka shift / input kas awal | ✅ (saat di POS) | ✅ |
| **Shift** | Tutup shift | ✅ (saat di POS) | ✅ |
| **Shift** | Set waktu auto-close | ✅ (saat di POS) | ✅ |
| **Shift** | Lihat riwayat shift semua kasir | ✅ | ❌ |
| **Shift** | Lihat ringkasan shift sendiri | ✅ | ✅ |
| **Transaksi** | Buat order baru | ✅ (saat di POS) | ✅ |
| **Transaksi** | Pilih & ubah metode pembayaran | ✅ (saat di POS) | ✅ |
| **Transaksi** | Proses pembayaran tunai | ✅ (saat di POS) | ✅ |
| **Transaksi** | Proses pembayaran QRIS | ✅ (saat di POS) | ✅ |
| **Transaksi** | Proses split payment | ✅ (saat di POS) | ✅ |
| **Transaksi** | **Void transaksi** | ✅ | ❌ |
| **Transaksi** | Lihat semua transaksi (lintas kasir) | ✅ | ❌ |
| **Transaksi** | Lihat transaksi shift sendiri | ✅ | ✅ |
| **Transaksi** | Sync transaksi offline | ✅ (saat di POS) | ✅ |
| **Produk** | Tambah produk baru | ✅ | ❌ |
| **Produk** | Edit produk (nama, harga, deskripsi, foto) | ✅ | ❌ |
| **Produk** | Arsipkan / aktifkan produk | ✅ | ❌ |
| **Produk** | Jadwalkan perubahan harga | ✅ | ❌ |
| **Produk** | Lihat daftar produk di POS | ✅ | ✅ |
| **Modifier** | CRUD modifier group & item | ✅ | ❌ |
| **Modifier** | Lihat modifier di POS | ✅ | ✅ |
| **Diskon** | CRUD diskon | ✅ | ❌ |
| **Diskon** | Lihat diskon aktif (auto-apply di POS) | ✅ | ✅ |
| **Laporan** | Lihat laporan harian/periodik/shift | ✅ | ❌ |
| **Laporan** | Export laporan (CSV) | ✅ | ❌ |
| **Laporan** | Lihat ringkasan shift sendiri | ✅ | ✅ |
| **HPP** | Input `estimated_hpp` per produk (Fase 1A) | ✅ | ❌ |
| **HPP** | Kelola BOM & bahan baku (Fase 1B) | ✅ | ❌ |
| **HPP** | Lihat laporan HPP & profit margin | ✅ | ❌ |
| **Bagi Hasil** | Konfigurasi formula bagi hasil | ✅ | ❌ |
| **Bagi Hasil** | Hitung & mark-paid bagi hasil | ✅ | ❌ |
| **Bagi Hasil** | Lihat bagi hasil sendiri | ✅ | ✅ |
| **Kasir Management** | CRUD akun kasir | ✅ | ❌ |
| **Kasir Management** | Reset PIN kasir | ✅ | ❌ |
| **Kasir Management** | Nonaktifkan kasir | ✅ | ❌ |
| **Settings** | Konfigurasi umum (threshold, preset nominal, lebar struk, dll) | ✅ | ❌ |
| **Feature Flags** | Toggle fitur on/off | ✅ | ❌ |
| **System Logs** | Lihat system logs | ✅ | ❌ |
| **System Health** | Lihat system health | ✅ | ❌ |
| **Struk** | Cetak struk | ✅ (saat di POS) | ✅ |
| **Struk** | Konfigurasi lebar struk | ✅ | ❌ |

---

## 5.3 Catatan Penting RBAC

**1. Superadmin di POS:**
Saat superadmin login ke POS (via `/auth/login/admin` → navigasi ke `/pos`), sistem memperlakukan superadmin sebagai operator POS dengan kemampuan tambahan (void). Session superadmin tetap berlaku 24 jam. Transaksi yang dibuatnya tercatat dengan `cashier_id` milik akun superadmin — terlihat jelas di laporan.

**2. Multi-Kasir Ready:**
Meskipun saat ini hanya ada 1 kasir aktif, seluruh arsitektur (tabel, API, logika bisnis) dirancang untuk mendukung multiple kasir sejak awal. Setiap kasir memiliki `cashier_letter` unik (A–Z) yang terembed dalam nomor transaksi (TRX-01).

**3. Session Isolation:**
Session kasir dan session superadmin disimpan terpisah di Redis dengan prefix berbeda (`sess:cashier:` dan `sess:admin:`). Satu pengguna tidak bisa memiliki lebih dari satu session aktif sekaligus (AUTH-05 — session lama di-invalidate saat login baru).

**4. Defense-in-Depth untuk Void:**
Hak void dilindungi dua lapis: `@Roles('superadmin')` di NestJS (application layer) + CHECK constraint di tabel `orders` (database layer, via kolom `voided_by` & `void_reason` wajib diisi). Satu lapisan gagal → lapisan lain masih menjaga.

**5. Force-Logout oleh Superadmin:**
Saat SA menonaktifkan kasir atau mereset PIN, seluruh session kasir tersebut di-invalidate dari Redis secara instan via scan `user_sessions:{userId}:*`. Kasir yang sedang aktif akan langsung ditendang keluar.

---

*Lanjut ke: [`02-business-rules.md`](./02-business-rules.md)*
