# NGEMILOH POS - SYSTEM WORKFLOW DOCUMENTATION
**Versi:** 2.0 (Enterprise Multi-Outlet)
**Berdasarkan:** Ketetapan Wawancara Arsitektur (114 Keputusan Mutlak)

Dokumen ini menjelaskan alur kerja (*Workflow*) dari sistem Ngemiloh POS. Gunakan dokumen ini sebagai acuan logika bagi *Developer* saat menulis *Source Code* agar aplikasi berjalan sesuai standar kelas *Enterprise*.

---

## 1. ALUR TRANSAKSI KASIR (ORDER WORKFLOW)

### A. Skenario Normal (Online & Lunas)
1. **Input:** Kasir memasukkan item ke keranjang di UI SvelteKit (Tablet Android).
2. **Auto-Save:** Setiap kali item ditambah, keranjang otomatis disimpan ke `LocalStorage` browser. (Mencegah hilang jika aplikasi *crash* atau mati lampu).
3. **Checkout:** Kasir menekan "Bayar". Sistem mengekstrak PPN (Tax Inclusive) dari harga kotor, dan menjumlahkan total.
4. **Pembulatan:** Total belanja + PPN dibulatkan secara matematis ke **kelipatan Rp 500 terdekat** di *backend*. (Cegah uang receh).
5. **Pemotongan Stok:** Sistem memvalidasi stok lokal (*Outlet level*). Jika stok tersedia, potong stok `RawMaterial`.
6. **Snapshot HPP:** HPP bahan baku di detik tersebut di-*copy* mentah dan disimpan ke tabel Order.
7. **Penyelesaian:** Print Struk. Keranjang di-*clear*. Data dikirim ke PostgreSQL via NestJS.

### B. Skenario Split Payment Gagal (Saga Pattern Fallback)
1. Pelanggan membayar Rp 100.000 menggunakan Poin Member (Rp 30.000) dan QRIS Midtrans (Rp 70.000).
2. Kasir menekan bayar. Poin Member (Rp 30.000) langsung dipotong di *database* pusat.
3. Pelanggan men-scan QRIS. Tiba-tiba Midtrans RTO (*Request Time-Out*).
4. **Alur Fallback:** Sistem menyadari QRIS gagal. *Backend* (NestJS) otomatis memicu *Auto-Revert* untuk mengembalikan Poin Member Rp 30.000 ke saldo pelanggan secara diam-diam.
5. Transaksi dibatalkan di layar Kasir. Pelanggan dipersilakan membayar ulang.

### C. Skenario Force Success Anomaly (Optimistic UI)
1. Pelanggan men-scan QRIS. Uang di HP pelanggan berhasil terpotong.
2. Jaringan internet warung putus sedetik, *Database* Gudang gagal merespons.
3. Struk tidak keluar, aplikasi kasir menampilkan pesan "Error/Stok Habis".
4. **Alur Manual:** Demi kepuasan pelanggan, Kasir tetap memberikan makanan pesanan tersebut kepada pelanggan agar pelanggan bisa segera pergi.
5. Owner membuka HP (Aplikasi Midtrans Dashboard) secara manual untuk memverifikasi uang masuk, dan menandai pesanan ini sebagai **"Anomali Jaringan"** agar laporan stok disesuaikan secara manual esok harinya.

---

## 2. ALUR SINKRONISASI OFFLINE-TO-ONLINE (DELTA SYNC)

Aplikasi dirancang **Offline-First**. *Dexie.js* (IndexedDB) digunakan sebagai penyimpanan utama di Tablet.

### A. Mode Offline Aktif
1. Internet warung mati. Kasir tetap bisa menekan "Bayar".
2. Struk langsung keluar (Bluetooth Printer).
3. Transaksi disimpan di *IndexedDB* Tablet dengan `sync_status = false` dan ID transaksi menggunakan **UUIDv4** acak panjang (misal: `123e4567-e89...`).
4. Kuota Stok Lokal dikurangi langsung di memori Tablet.

### B. Mode Recovery (Sinyal Kembali)
1. Internet kembali menyala.
2. *Service Worker* di SvelteKit mendeteksi status `online`.
3. Aplikasi menarik antrean 500 transaksi yang belum di-*sync*.
4. **Queueing Chunk:** Data dikirim ke server pusat secara *Chunking* (Kirim 10 baris per *request*). Jika putus lagi, 10 baris itu batal, namun sisa 490 aman menunggu sinyal stabil.
5. Server pusat (NestJS) menerima UUIDv4 dari cabang, lalu memasukkannya ke PostgreSQL. Tidak akan pernah ada bentrok ID antar cabang.

### C. Resolusi Konflik Master Data
1. Jika Owner merubah harga "Es Kopi" di rumah (Online).
2. Kasir menjual "Es Kopi" di warung (Offline) dengan harga lama.
3. Saat *sync*, data dari Kasir tetap masuk menggunakan **harga lama yang sudah di-snapshot** di struk. Namun, layar master menu di Kasir akan langsung di-timpa (di-*replace*) oleh Master Data dari pusat untuk transaksi selanjutnya. (Pusat = *Source of Truth*).

---

## 3. ALUR LOGIKA FRAUD & KEAMANAN KASIR

### A. The Keep & Steal Prevention (Log Print Count)
1. Kasir rombongan minta "Draft Struk Sementara". Kasir menekan tombol *Print Draft*.
2. `print_count` di keranjang naik menjadi 1.
3. Kasir menerima uang dari pelanggan, lalu menekan tombol **"Clear Cart"** (Hapus Keranjang) agar transaksi hilang. Uang masuk kantong kasir.
4. **Alur Alert:** Sistem NestJS melihat keranjang yang di-*clear* memiliki `print_count > 0`. Sistem otomatis mengirim Email Peringatan ke Owner bahwa terjadi indikasi pencurian oleh kasir terkait.

### B. Employee Sweet-Hearting (Rate Limit Poin Member)
1. Kasir menscan Barcode Member miliknya sendiri ke semua pelanggan reguler.
2. **Alur Proteksi:** NestJS membatasi ID Member maksimal dipakai **3x dalam 1 Shift**.
3. Transaksi ke-4 dengan member yang sama akan ditolak secara diam-diam. Sistem memberi tanda *Flag Merah* ke ID Kasir tersebut di Dashboard Owner.

### C. The Zombie Cashier (Pencabutan Akses Realtime)
1. Kasir dipecat jam 12:00 Siang melalui Dashboard Superadmin.
2. **Alur Revokasi:** NestJS langsung menuliskan ID JWT Kasir tersebut ke dalam *Blocklist / Denylist* di **RAM Redis**.
3. Jam 12:01, HP kasir di rumah mencoba mem-*void* transaksi. NestJS menolak mentah-mentah (*Unauthorized*) meskipun tanggal *Expired* Token-nya belum habis.

### D. Single Device Enforcer
1. Kasir login di Tablet Warung. Sistem mencatat `Device_ID` ke DB.
2. Kasir login meminjamkan PIN-nya ke HP temannya.
3. **Alur Logout:** Saat HP teman *login*, *Socket.io* (atau polling) di Tablet Warung otomatis memaksa aplikasi untuk membuang sesi (Force Logout). 1 PIN = 1 Perangkat aktif secara bersamaan.

---

## 4. ALUR AKUNTANSI & LAPORAN EKSTREM

### A. Stock Opname & Discrepancy Shrinkage (Hantu Stok)
1. Sistem mencatat Beras 10 Kg. Gudang aslinya 8 Kg.
2. Owner **dilarang keras** mengedit angka 10 jadi 8 langsung di DB.
3. Owner wajib membuat Dokumen **Stock Opname**.
4. Owner memasukkan "Hilang 2 Kg" dengan alasan "Disusutkan/Dimakan Tikus".
5. 2 Kg ini dikonversi nilainya menggunakan WAC (Weighted Average Cost), lalu dimasukkan ke *Laporan Rugi/Laba* sebagai *Loss / Opex*, sehingga neraca keuangan tetap seimbang (Balance).

### B. HPP Retroactive Changes (Jurnal Penyesuaian)
1. Owner sadar tagihan *Supplier* bulan lalu salah input (kurang Rp 50.000).
2. Owner **tidak boleh** mengedit *Invoice* bulan lalu karena Laporan Pajak/Laba sudah tercetak.
3. Owner memasukkan nominal Rp 50.000 ini ke sistem di bulan ini sebagai **Adjusting Entry (Jurnal Penyesuaian)**. Laporan bulan lalu tetap abadi (*Immutable*).

### C. Ekspor Data Raksasa (The Exit Strategy)
1. Investor meminta data 1.000.000 baris transaksi 5 tahun terakhir.
2. Owner menekan tombol *Export CSV* di Dashboard.
3. **Alur Streaming:** NestJS menggunakan **CSV Streaming** (Membaca database per 500 baris dan langsung melemparnya ke *Download Stream* Browser).
4. RAM VPS tetap aman dan stabil 60fps melayani kasir yang sedang berjualan.

### D. Noisy Neighbor Prevention
1. Dashboard Utama dibatasi (di-filter paksa) maksimal menampilkan rentang waktu **30 Hari**.
2. Jika Owner memaksa melihat data 5 Tahun sekaligus, sistem akan mengalihkannya ke fitur *Background Report Generation*.

---
*(Dokumen Alur Kerja ini adalah fondasi resmi untuk fase penulisan kode di Front-End SvelteKit dan Back-End NestJS Anda)*
