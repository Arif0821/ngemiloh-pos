# NGEMILOH POS - SENIOR ENGINEER COMPREHENSIVE INTERVIEW
*(Fase 3: Multi-Outlet & Production Hardening)*

Dokumen ini berisi 70 pertanyaan strategis terkait arsitektur, keamanan, dan logika bisnis. Sesuai permintaan Anda, setiap pertanyaan dilengkapi dengan opsi *Best Practice* beserta kelebihan dan kekurangannya untuk membantu Anda mengambil keputusan.

Silakan isi jawaban Anda pada kolom **"Pilihan/Jawaban Anda"** di bawah setiap opsi.

---

## A. Ekspansi & Transisi Multi-Outlet (Fase 3)

### 1. Pembagian Shift Kasir Lintas Outlet
Saat ekspansi, apakah 1 kasir bisa beroperasi di 2 outlet yang berbeda di hari yang sama?
*   **Opsi A (Strict - 1 Kasir 1 Outlet/Hari):** Sistem mengunci kasir hanya untuk 1 outlet per hari.
    *   *Kelebihan:* Pelacakan *discrepancy* kas sangat akurat. Mencegah manipulasi.
    *   *Kekurangan:* Kurang fleksibel jika ada kasir yang sakit dan butuh pengganti mendadak dari cabang lain di hari yang sama.
*   **Opsi B (Flexible - Multi-Login):** Kasir bisa login di cabang mana saja, shift dihitung per outlet.
    *   *Kelebihan:* Fleksibel untuk operasional darurat.
    *   *Kekurangan:* Sulit melacak kecurangan jika kasir mondar-mandir antar cabang. Logika perhitungan profit share menjadi kompleks.

**Pilihan/Jawaban Anda:** Opsi A (Strict - 1 Kasir 1 Outlet/Hari)


### 2. Supply Chain: Distribusi Bahan Baku
Apakah gudang pusat (HQ) mengatur distribusi pengiriman ke outlet, atau tiap outlet belanja mandiri?
*   **Opsi A (Centralized HQ Distribution):** Pusat membeli semua stok, lalu mendistribusikan via fitur "Surat Jalan" (Stock Transfer).
    *   *Kelebihan:* HPP stabil, kualitas rasa terjaga seragam, kontrol stok terpusat.
    *   *Kekurangan:* Harus membangun fitur Transfer Gudang yang cukup rumit. Biaya logistik lebih tinggi.
*   **Opsi B (Decentralized - Belanja Mandiri):** Tiap outlet diberi kas (petty cash) untuk belanja bahan baku sendiri.
    *   *Kelebihan:* Sistem lebih simpel, tidak perlu fitur logistik.
    *   *Kekurangan:* Kualitas bahan baku bisa berbeda, HPP tiap outlet akan berbeda-beda (fluktuatif).

**Pilihan/Jawaban Anda:** Opsi A (Centralized HQ Distribution) Pusat membeli semua stok, lalu mendistribusikan langsung ke outlet/kasir


### 3. Transfer Bahan Baku Antar Cabang
Saat Outlet A kehabisan stok, apakah diizinkan mentransfer bahan baku langsung dari/ke Outlet B?
*   **Opsi A (Diizinkan dengan Approval):** Boleh transfer dengan validasi Manager.
    *   *Kelebihan:* Outlet tidak kehilangan potensi *sales* akibat kehabisan bahan.
    *   *Kekurangan:* Membutuhkan UI khusus pencatatan "Barang Keluar/Masuk Antar Outlet" agar sinkronisasi gudang tidak berantakan.
*   **Opsi B (Tidak Diizinkan Mutlak):** Tiap outlet berdiri sendiri. Kurang = *Sold Out*.
    *   *Kelebihan:* Integritas data stok 100% terjaga. Mencegah kasir menutupi barang hilang dengan alasan "ditransfer ke cabang lain".
    *   *Kekurangan:* Berpotensi kehilangan pendapatan saat *demand* sedang tinggi.

**Pilihan/Jawaban Anda:** Opsi B (Tidak Diizinkan Mutlak) Tiap outlet berdiri sendiri. Kurang = *Sold Out*.


### 4. Harga Jual Produk Lintas Cabang
Apakah harga jual dibedakan per outlet atau seragam?
*   **Opsi A (Centralized Pricing):** Satu harga untuk seluruh cabang (Global).
    *   *Kelebihan:* Setup database sangat sederhana (kolom harga tetap di tabel produk).
    *   *Kekurangan:* Tidak bisa menaikkan harga khusus di cabang dengan biaya sewa mahal (misal cabang Mall).
*   **Opsi B (Outlet-Specific Pricing):** Tabel harga dipisah (Relasi `Product` - `OutletPricing`).
    *   *Kelebihan:* Fleksibilitas tinggi untuk menyesuaikan margin berdasarkan UMK/biaya lokasi.
    *   *Kekurangan:* Sinkronisasi offline (Dexie.js) lebih berat karena data pricing harus diload spesifik per outlet.

**Pilihan/Jawaban Anda:** Opsi A (Centralized Pricing) Satu harga untuk seluruh cabang (Global).


### 5. Pool Profit Sharing 40% Kasir
Bagaimana perhitungan 40% profit pool kasir pada sistem Multi-Outlet?
*   **Opsi A (Pool Per Cabang):** Kasir hanya mendapat 40% dari profit *cabang tempat ia bekerja*.
    *   *Kelebihan:* Adil. Kasir di cabang ramai otomatis mendapat bonus lebih besar. Memotivasi kasir untuk berjualan lebih keras.
    *   *Kekurangan:* Terjadi ketimpangan penghasilan kasir, kasir mungkin menolak dipindah ke cabang sepi.
*   **Opsi B (Pool Nasional/Global):** Semua profit digabung, lalu dibagi rata ke semua kasir.
    *   *Kelebihan:* Solidaritas terjaga, mudah me-rotasi kasir ke cabang manapun.
    *   *Kekurangan:* "Free rider problem", kasir malas akan mendapat porsi yang sama dengan kasir yang bekerja keras di cabang ramai.

**Pilihan/Jawaban Anda:** Opsi A (Pool Per Cabang)


### 6. Diskon Spesifik Cabang
Apakah scope `outlet` perlu ditambahkan ke fitur diskon?
*   **Opsi A (Tambah Scope Outlet):** Promo bisa diset hanya untuk cabang tertentu.
    *   *Kelebihan:* Berguna untuk marketing lokal (misal promo ulang tahun cabang A).
    *   *Kekurangan:* Database skema `Discount` butuh tabel mapping `DiscountOutlet`.
*   **Opsi B (Global Discount Only):** Semua promo berlaku di semua cabang.
    *   *Kelebihan:* Skema database murni PRD v7 (sederhana).
    *   *Kekurangan:* Sulit melakukan kampanye pemasaran lokal yang *targeted*.

**Pilihan/Jawaban Anda:** Opsi B (Global Discount Only)


### 7. Notifikasi Bahan Baku Kedaluwarsa Lintas Cabang
Bagaimana menangani bahan baku (misal: Sosis) yang hampir kedaluwarsa?
*   **Opsi A (Sistem Cross-Selling Notif):** Jika Outlet A punya barang *near-expired*, sistem notif ke Outlet B untuk bantu ambil stok.
    *   *Kelebihan:* Menekan angka kerugian (*waste*) secara signifikan.
    *   *Kekurangan:* Development *effort* besar, butuh cron job spesifik dan *push notification* ke dashboard kasir.
*   **Opsi B (Isolasi Cabang + Pemusnahan):** Tiap cabang tanggung jawab masing-masing. Jika expired, catat di *Waste Log*.
    *   *Kelebihan:* Simpel, tidak menambah *load* backend.
    *   *Kekurangan:* Tingkat kerugian finansial/waste akan lebih tinggi.

**Pilihan/Jawaban Anda:** Opsi A (Sistem Cross-Selling Notif)


### 8. Laporan Opex (Pengeluaran Operasional)
Siapa yang berhak menginput Opex (pengeluaran harian seperti es batu/listrik) yang mengurangi uang laci?
*   **Opsi A (Kasir via Mesin POS):** Kasir diizinkan input nominal Opex dan ambil uang laci langsung.
    *   *Kelebihan:* Operasional mulus tanpa harus menunggu owner turun tangan.
    *   *Kekurangan:* Risiko *fraud* (penggelapan) tinggi. Butuh fitur upload foto nota di POS.
*   **Opsi B (Hanya Superadmin via Dashboard):** Kasir talangi dulu/minta owner, Opex diinput backend.
    *   *Kelebihan:* 100% aman dan terkontrol.
    *   *Kekurangan:* Superadmin repot harus selalu siaga mengurus *petty cash* kecil setiap hari.

**Pilihan/Jawaban Anda:** Opsi A (Kasir via Mesin POS) tambahkan  fitur upload foto nota/struk pembelian di POS


### 9. Sinkronisasi Member & Loyalty
Apakah riwayat transaksi dan tier loyalty member harus *real-time sync* antar cabang?
*   **Opsi A (Real-time Global Sync):** Ya, tier dihitung global.
    *   *Kelebihan:* *User experience* pelanggan sempurna (beli di mana saja poin masuk).
    *   *Kekurangan:* Jika internet cabang sedang down (offline mode), update poin tertunda dan bisa menyebabkan komplain tier belum naik.
*   **Opsi B (Isolated Loyalty per Outlet):** Poin dan tier member dihitung terpisah per cabang (Jarang Dipakai).
    *   *Kelebihan:* Tidak ada masalah sinkronisasi *offline/online*.
    *   *Kekurangan:* Pelanggan akan sangat kecewa karena harus mulai dari 0 jika belanja di cabang lain.

**Pilihan/Jawaban Anda:**Opsi A (Real-time Global Sync)


### 10. Laporan Komparasi (Leaderboard)
Apakah dibutuhkan dashboard laporan komparasi omzet antar cabang?
*   **Opsi A (Leaderboard Real-time):** Dashboard Superadmin menampilkan ranking cabang.
    *   *Kelebihan:* Sangat berguna bagi *business owner* untuk memantau performa dan ROI tiap lokasi.
    *   *Kekurangan:* Agregasi data besar secara *real-time* memakan resource DB tinggi (butuh *Redis caching* untuk query ini).
*   **Opsi B (Standard Report):** Laporan biasa per cabang, owner membandingkan secara manual.
    *   *Kelebihan:* Performa database terjaga ringan.
    *   *Kekurangan:* Kurang representatif secara visual.

**Pilihan/Jawaban Anda:**Opsi B (Standard Report) cukup visualisasi data saja


---

## B. Keamanan, Konfigurasi & Infrastruktur Docker

### 11. Manajemen Secret (CSRF, JWT, Midtrans)
Bagaimana Anda akan menyimpan kredensial sensitif saat production?
*   **Opsi A (Menggunakan Coolify Secrets / .env):** Semua keys di-inject saat deploy lewat Coolify.
    *   *Kelebihan:* Cepat, mudah, standar industri startup.
    *   *Kekurangan:* Jika server Coolify diretas, semua key bocor bersamaan.
*   **Opsi B (HashiCorp Vault / AWS Secrets):** Menggunakan server kunci eksternal terpisah.
    *   *Kelebihan:* Sangat aman, rotasi otomatis, audit log siapa yang akses kunci.
    *   *Kekurangan:* Biaya ekstra, menambah kerumitan arsitektur. (*Overkill* untuk UMKM, namun aman).

**Pilihan/Jawaban Anda:**Opsi A (Menggunakan Coolify Secrets / .env)


### 12. Password Database di docker-compose
Audit menemukan password DB PostgreSQL terlihat di file `docker-compose.yml`.
*   **Opsi A (Gunakan Docker Secrets):** Menyimpan password dalam format rahasia Docker Swarm/Secrets.
    *   *Kelebihan:* Keamanan tertinggi di level container. Password tidak ada di file konfigurasi.
    *   *Kekurangan:* Setup docker lebih rumit, *learning curve* tinggi.
*   **Opsi B (Gunakan File .env yang di-gitignore):** Ubah `docker-compose.yml` untuk memanggil `${POSTGRES_PASSWORD}` dari file `.env`.
    *   *Kelebihan:* Jauh lebih aman dari kondisi saat ini, mudah diimplementasi.
    *   *Kekurangan:* Kalau developer salah push, file `.env` masih bisa bocor.

**Pilihan/Jawaban Anda:**Opsi B (Gunakan File .env yang di-gitignore)


### 13. Konfigurasi Redis (Eviction Policy)
Redis saat ini diset `allkeys-lru` (menghapus data terlama saat RAM penuh). Ini berisiko menghapus token *session* yang masih aktif.
*   **Opsi A (Ubah ke `noeviction`):** Redis akan *error* kalau penuh, tapi tidak akan menghapus data apapun.
    *   *Kelebihan:* Data kasir/session dijamin aman.
    *   *Kekurangan:* Kalau memori kepenuhan, aplikasi akan macet sampai ada yang di-restart atau RAM ditambah.
*   **Opsi B (Ubah ke `volatile-lru`):** Hanya menghapus data yang diset memiliki masa kedaluwarsa (TTL).
    *   *Kelebihan:* *Sweet spot*. Session yang aktif tetap aman, tapi cache yang tidak penting bisa dibuang saat penuh.
    *   *Kekurangan:* Developer harus disiplin memberi TTL pada setiap key Redis yang dibuat.

**Pilihan/Jawaban Anda:**Opsi A (Ubah ke `noeviction`), mungkin bisa kita bahas lebih lanjut opsi ini.


### 14. Endpoint Health Check (/health)
Endpoint ini bisa terkena *Rate Limit*, membuat Docker mengira NestJS mati lalu di-*restart* paksa.
*   **Opsi A (Whitelist IP Docker):** Membebaskan IP internal Docker dari rate limiting.
    *   *Kelebihan:* Tidak perlu membuat route baru.
    *   *Kekurangan:* Konfigurasi deteksi IP internal (*reverse proxy* Caddy) seringkali bermasalah.
*   **Opsi B (Buat `/health-internal` Tanpa Guard):** Membuat endpoint khusus yang sama sekali tidak dipasangi module Rate Limiter/Throttler.
    *   *Kelebihan:* Sangat stabil, Docker *health check* tidak akan pernah kena *block*.
    *   *Kekurangan:* Jika URL ini terekspos ke publik (bocor dari Caddy), bisa jadi celah *DDoS kecil-kecilan* pada endpoint tersebut.

**Pilihan/Jawaban Anda:** saya masih ragu, bisa kita bahas lebih rinci dan lanjut terkait 2 opsi diatas.


### 15. Rotasi API Key Midtrans
*   **Opsi A (Rotasi Berkala 3 Bulan):** Key diganti rutin.
    *   *Kelebihan:* Meminimalkan risiko *hijacking* transaksi.
    *   *Kekurangan:* Jika terlewat jadwal rotasi, pembayaran pelanggan akan mati seketika.
*   **Opsi B (Tidak Ada Rotasi, Kecuali Bocor):** Set & Forget.
    *   *Kelebihan:* Operasional damai, tidak ada risiko *downtime* keteledoran update key.
    *   *Kekurangan:* Risiko besar jika mantan pegawai yang tahu key tersebut masih memilikinya.

**Pilihan/Jawaban Anda:** Opsi B (Tidak Ada Rotasi, Kecuali Bocor)


### 16. Migrasi ke Kubernetes (K8s)
Jika cabang mencapai 20 outlet, VPS tunggal mungkin tak kuat.
*   **Opsi A (Migrasi ke K8s/EKS/GKE):**
    *   *Kelebihan:* Skalabilitas luar biasa, *auto-scaling* jika ada promo kilat. *Zero-downtime deploy*.
    *   *Kekurangan:* *Cloud billing* akan bengkak (minimal $100+/bulan). Butuh keahlian DevOps tinggi.
*   **Opsi B (Scale Up VPS Biasa + Load Balancer):** Cukup tambah RAM VPS dan pasang 2 VPS di belakang 1 NGINX/Caddy.
    *   *Kelebihan:* Murah, mudah di-maintenance, masuk akal untuk sistem POS.
    *   *Kekurangan:* Harus setting replikasi database (Master-Slave) secara manual yang rentan *split-brain*.

**Pilihan/Jawaban Anda:** Opsi B (Scale Up VPS Biasa + Load Balancer) Cukup tambah RAM VPS dan tambah 2 core  gpu lagi


### 17. Enkripsi Backup Database
*   **Opsi A (Enkripsi GPG AES-256 Sebelum Dikirim ke B2):**
    *   *Kelebihan:* Kalau Backblaze B2 kebobolan, data Anda 100% aman (berupa *ciphertext*).
    *   *Kekurangan:* Jika Anda lupa *passphrase/key* GPG-nya, database tidak akan bisa di-*restore* (hilang selamanya).
*   **Opsi B (Upload Plain/Tanpa Enkripsi Ekstra):** Mengandalkan enkripsi bawaan *Server-Side* Backblaze B2.
    *   *Kelebihan:* Mudah me-*restore* data saat panik.
    *   *Kekurangan:* Kurang aman jika kredensial Backblaze Anda jatuh ke tangan hacker.

**Pilihan/Jawaban Anda:**Opsi B (Upload Plain/Tanpa Enkripsi Ekstra)


### 18. RTO (Recovery Time Objective)
Berapa lama toleransi server mati karena bencana?
*   **Opsi A (RTO < 2 Jam - Active/Passive Failover):**
    *   *Kelebihan:* Bisnis nyaris tidak terganggu.
    *   *Kekurangan:* Biaya server 2x lipat (karena harus sewa VPS *standby*).
*   **Opsi B (RTO 24 Jam - Manual Restore):** Install ulang VPS dari awal saat bencana terjadi.
    *   *Kelebihan:* Sangat hemat biaya. Mode *Offline-first* (Dexie) POS menolong agar warung tetap bisa jualan.
    *   *Kekurangan:* Kasir panik, fitur QRIS mati total selama 24 jam.

**Pilihan/Jawaban Anda:**Opsi A (RTO < 2 Jam - Active/Passive Failover)


### 19. Notifikasi & Alerting
Sistem saat ini pakai Email.
*   **Opsi A (Integrasi Telegram/WhatsApp Bot):**
    *   *Kelebihan:* *Owner* langsung tahu jika ada void mencurigakan atau kas minus saat itu juga.
    *   *Kekurangan:* Biaya bulanan WhatsApp API (jika pakai WA resmi). Telegram gratis tapi harus buka aplikasinya.
*   **Opsi B (Tetap Pakai Email Saja):**
    *   *Kelebihan:* Gratis (Resend free tier).
    *   *Kekurangan:* Sering masuk spam, *owner* telat membaca.

**Pilihan/Jawaban Anda:**Opsi B (Tetap Pakai Email Saja)


### 20. CI/CD Testing Pipeline
Apakah wajib lolos tes sebelum *merge* kode?
*   **Opsi A (Strict - Block Merge if Tests Fail):** Gagal Unit/Mutation test = Kode tidak bisa masuk Production.
    *   *Kelebihan:* Mencegah *bug* mematikan (seperti salah hitung uang) naik ke production.
    *   *Kekurangan:* Memperlambat developer men-deploy *hotfix* (perbaikan darurat).
*   **Opsi B (Lenient - Test hanya Notifikasi):** Tetap bisa di-merge meski ada tes yang gagal, developer diingatkan.
    *   *Kelebihan:* Gerak cepat saat *hotfix*.
    *   *Kekurangan:* Disiplin tim bisa kendor, *tech debt* menumpuk.

**Pilihan/Jawaban Anda:** Opsi A (Strict - Block Merge if Tests Fail)


---

## C. Business Logic: Profit Sharing & Finansial

### 21. Transisi Estimasi HPP ke BOM Aktual
Jika di tengah bulan kita transisi dari estimasi HPP ke hitungan aktual (Fase 1B).
*   **Opsi A (Cut-off Proporsional):** Hitung profit Tgl 1-15 pakai Estimasi, Tgl 16-30 pakai Aktual.
    *   *Kelebihan:* Keuangan sangat presisi.
    *   *Kekurangan:* Logika query laporan akhir bulan akan luar biasa rumit.
*   **Opsi B (Backdate / Recalculate):** Saat BOM aktif, sistem menghitung ulang mundur (recalculate) semua HPP dari awal bulan.
    *   *Kelebihan:* Laporan akhir bulan sangat rapi dengan metode tunggal.
    *   *Kekurangan:* Akan ada *spike load* (berat di database) saat perhitungan ulang massal terjadi.

**Pilihan/Jawaban Anda:**Opsi B (Backdate / Recalculate)


### 22. Kasir Resign dengan Discrepancy Minus Besar
Kasir berhenti tengah bulan, tapi punya selisih laci (minus) yang melebihi bagi hasilnya.
*   **Opsi A (Auto-Potong Profit Share + Tagih Sisa):** Sistem otomatis menjadikan profit share-nya 0 dan memunculkan laporan Piutang Pegawai.
    *   *Kelebihan:* *Owner* tidak rugi, uang perusahaan aman.
    *   *Kekurangan:* Secara hukum/kekeluargaan butuh proses penagihan manual.
*   **Opsi B (Potong Sebatas Profit Share Saja):** Sisa minus di-ikhlaskan (write-off) perusahaan.
    *   *Kelebihan:* Sistem backend tidak perlu fitur "Piutang Pegawai".
    *   *Kekurangan:* Perusahaan rugi. Kasir nakal bisa memanfaatkan ini sebelum resign.

**Pilihan/Jawaban Anda:**Opsi A (Auto-Potong Profit Share + Tagih Sisa)


### 23. Opex Besar Memotong Pool Kasir
Opex perbaikan (misal Rp 3 Juta) mengurangi *Net Profit*.
*   **Opsi A (Opex Dipisah: Beban Owner vs Beban Warung):** Opex dikategori. Perbaikan atap beban owner (tidak potong *net profit* kasir).
    *   *Kelebihan:* Sangat adil bagi kasir. Pool 40% mereka aman dari musibah tak terduga.
    *   *Kekurangan:* Butuh tabel `OpexCategory` dan perhitungan yang dibedakan (*Gross vs Net vs Net-Owner*).
*   **Opsi B (Semua Opex Memotong Net Profit):** Sistem sapu rata.
    *   *Kelebihan:* Simpel, hitungan sesuai realitas arus kas murni.
    *   *Kekurangan:* Kasir bisa protes jika mendadak gaji/profit share mereka turun karena AC toko rusak.

**Pilihan/Jawaban Anda:**Opsi A (Opex Dipisah: Beban Owner vs Beban Warung)


### 24. Penanganan Net Profit Minus (Rugi)
Bulan sepi, operasional minus. Kasir *freelance* tidak ada *base salary*.
*   **Opsi A (Pool Kasir Rp 0):** Sesuai kesepakatan, tidak ada profit = tidak ada bayaran.
    *   *Kelebihan:* Bisnis *owner* aman secara hukum kontrak *freelance*.
    *   *Kekurangan:* Kasir tidak punya uang makan bulan itu dan berpotensi kabur semua.
*   **Opsi B (Sistem Safety Net / Kasbon Otomatis):** Sistem meminjamkan minimum *payout* dari saldo bulan depan (Gali lubang).
    *   *Kelebihan:* Pegawai terjamin.
    *   *Kekurangan:* Sangat rumit diimplementasi. Sistem jadi memiliki fitur Bank/Kreditur. *(Saran: Gunakan Opsi A, beri bonus manual dari kantong owner di luar sistem jika iba).*

**Pilihan/Jawaban Anda:** Opsi A (Pool Kasir Rp 0), tapi mungkin saya berikan gaji iba karena sudah menjalankan bisnis saya


### 25. Discrepancy Plus (Uang Berlebih > Rp 10.000)
*   **Opsi A (Uang Masuk Kas Perusahaan):** Dicatat sebagai "Other Income".
    *   *Kelebihan:* Sesuai kaidah akuntansi. Selisih lebih biasanya uang kembalian pelanggan yang tidak diambil.
    *   *Kekurangan:* Kasir mungkin menyembunyikan uang lebih tersebut daripada memasukkannya ke laci.
*   **Opsi B (Diberikan sebagai Tip Kasir):** Sistem mengabaikan kelebihannya (kasir bawa pulang).
    *   *Kelebihan:* Kasir senang.
    *   *Kekurangan:* Berbahaya. Kasir bisa dengan sengaja menipu/kurang memberi kembalian pelanggan untuk memperbesar tip pribadinya.

**Pilihan/Jawaban Anda:** Opsi A (Uang Masuk Kas Perusahaan)


### 26. Tax Inclusive (PPN 11%)
*   **Opsi A (Ekstrak PPN dari Harga Jual):** Fitur Laporan memisahkan 11% dari omzet ke akun "Tax Liability".
    *   *Kelebihan:* Anda siap jadi Pengusaha Kena Pajak (PKP) kapan saja, laporan *ready*.
    *   *Kekurangan:* Laba bersih (Net Profit) akan terlihat turun drastis karena 11% dipotong, yang mana memotong jatah profit pool kasir secara besar-besaran.
*   **Opsi B (Abaikan PPN Dulu):** Seluruh omzet dianggap murni tanpa pajak sampai diwajibkan oleh DJP.
    *   *Kelebihan:* Pool kasir utuh 40%, sistem gampang.
    *   *Kekurangan:* Harus rombak sistem total di masa depan jika diwajibkan.

**Pilihan/Jawaban Anda:**Opsi A (Ekstrak PPN dari Harga Jual), walaupun mungkin saat ini saya masih tidak dikenakan pajak, tetapi dengan bantuan laporan perpajakan kita bisa mempersiapkan dini ketika sudah dikenakan pajak. tapi saya masih bingung untuk perhitungan pajak ini, bisa kamu jelaskan secara rinci?


### 27. Manual Cash Refund
Pelanggan menolak penggantian barang, ingin uang kembali.
*   **Opsi A (Buat Fitur Cash Refund dengan PIN Manager):**
    *   *Kelebihan:* Hak konsumen terpenuhi, menghindari komplain viral.
    *   *Kekurangan:* Mempengaruhi laporan kas dan merusak HPP (stok masuk kembali tapi mungkin sudah basi).
*   **Opsi B (Mutlak Hanya Replacement/Void, Tanpa Refund Tunai):** (Sesuai PRD Saat Ini)
    *   *Kelebihan:* Alur uang masuk aman, anti kasir nakal yang pura-pura refund padahal ambil uang.
    *   *Kekurangan:* Kaku jika berhadapan dengan pelanggan marah besar.

**Pilihan/Jawaban Anda:** Opsi B (Mutlak Hanya Replacement/Void, Tanpa Refund Tunai)


---

## D. Program Loyalitas & Manajemen Member

### 28. Aturan UU PDP (Penghapusan Data Member)
*   **Opsi A (Anonimisasi - *Soft Delete*):** Data diubah jadi (Nama: User_Deleted, HP: 000xxx).
    *   *Kelebihan:* Laporan riwayat transaksi dan demografi belanja masa lalu tidak *error* atau hilang.
    *   *Kekurangan:* Jika *salt* enkripsi diketahui, berisiko ditebak.
*   **Opsi B (Hard Delete Data Row):** Hapus baris data member sepenuhnya.
    *   *Kelebihan:* 100% *compliant* dengan UU PDP.
    *   *Kekurangan:* Semua *order* yang berelasi dengan member ini akan ter-NULL-kan kolom relasinya, memecah integritas laporan. *(Saran Senior Eng: Gunakan Opsi A)*.

**Pilihan/Jawaban Anda:**Opsi A (Anonimisasi - *Soft Delete*) untuk nama customer sebenarnya tidak masalah, tetapi nomor handphone perlu disembunyikan karena itu yang krusial


### 29. Grace Period Saat Server Downtime
*   **Opsi A (Otomatis Tambah X Hari ke Semua Member):** Script massal menambah masa aktif *tier*.
    *   *Kelebihan:* Sangat profesional dan pelanggan merasa dihargai.
    *   *Kekurangan:* Harus bikin script darurat/cron job spesifik saat terjadi insiden.
*   **Opsi B (Abaikan, Masa Aktif Tetap Berjalan):**
    *   *Kelebihan:* Sistem tidak usah dirubah.
    *   *Kekurangan:* Berpotensi mendapat keluhan dari pelanggan loyalis.

**Pilihan/Jawaban Anda:**Opsi B (Abaikan, Masa Aktif Tetap Berjalan) bisa kamu jelaskan lebih rinci?


### 30. Validasi Pendaftaran Member (Cegah Fraud)
*   **Opsi A (Kirim OTP ke WhatsApp Pelanggan):**
    *   *Kelebihan:* 100% nomor asli. Kasir tidak bisa mendaftarkan 10 nomor fiktif demi mendapat diskon diam-diam.
    *   *Kekurangan:* Anda harus membayar biaya API WhatsApp per pesan OTP.
*   **Opsi B (Tanpa Validasi OTP):** Cukup *scan* dan daftar.
    *   *Kelebihan:* Mulus dan gratis.
    *   *Kekurangan:* Celah *fraud* besar. Kasir bisa *scan* struk pelanggan yang dibuang, dan mendaftarkan nomor temannya.

**Pilihan/Jawaban Anda:**Opsi B (Tanpa Validasi OTP), menurut saya jika Kasir bisa *scan* struk pelanggan yang dibuang, dan mendaftarkan nomor temannya. tidak masalah karena 1 ID/member 1 nomor handphone


### 31. Promo No-Stacking (Resolusi Bentrok Diskon)
Gold (15%) VS Promo Event (20%).
*   **Opsi A (Auto-Select Highest):** Sistem otomatis memilih diskon terbesar (20%).
    *   *Kelebihan:* Pelanggan paling untung, otomatis.
    *   *Kekurangan:* Secara teknis, member Gold merasa tier-nya tidak berguna saat ada event besar.
*   **Opsi B (Manual Choice):** Kasir/Sistem bertanya: Mau pakai Gold atau Promo Event?
    *   *Kelebihan:* Member merasa punya kontrol atas *benefit*-nya.
    *   *Kekurangan:* Menambah 1 step extra UI yang memperlambat antrean. *(Saran: Opsi A)*.

**Pilihan/Jawaban Anda:**Opsi A (Auto-Select Highest) menurut saya diskon terbesar hanya diberikan kepada member tier gold, dan untuk promo event tertentu diskonnya tidak sebesar member gold


### 32. Free Item Benefit & Waste Log
Pemberian bonus barang dari *Loyalty Tier*.
*   **Opsi A (Dicatat sebagai Marketing Expense (Opex)):**
    *   *Kelebihan:* Laporan rugi-laba sangat akurat secara akuntansi.
    *   *Kekurangan:* Butuh *trigger* database yang ribet (Tiap keluar free item, otomatis bikin Jurnal Opex).
*   **Opsi B (Hitung Normal Harga 0):** Barang diproses di *Orders* tapi harganya di-nol-kan (Diskon 100%).
    *   *Kelebihan:* Sangat gampang, PRD saat ini sudah *support*. HPP tetap tercatat tanpa repot ke Jurnal Opex.
    *   *Kekurangan:* Laporan Diskon akan terlihat membengkak besar.

**Pilihan/Jawaban Anda:**Opsi B (Hitung Normal Harga 0) tapi bisa kamu jelaskan lebih rinci lagi?


---

## E. Transaksi, Offline Mode & Edge Cases

### 33. Circuit Breaker QRIS saat Koneksi Toko Down
Midtrans Normal, tapi WiFi Cabang mati total.
*   **Opsi A (Nonaktifkan UI QRIS Saat Offline):**
    *   *Kelebihan:* Mencegah kasir mencoba transaksi yang pasti akan gagal karena tidak ada internet.
    *   *Kekurangan:* Kasir tidak bisa mencoba ulang.
*   **Opsi B (Tetap Buka, Deteksi Error Timeout):**
    *   *Kelebihan:* Jika koneksi mati-nyala (intermiten), kasir bisa *spam* tekan bayar sampai tembus.
    *   *Kekurangan:* Rawan *false-positive* pembayaran ter-potong di HP pelanggan tapi time-out di POS. *(Saran mutlak: Opsi A - Disable QRIS kalau Offline).*

**Pilihan/Jawaban Anda:**Opsi A (Nonaktifkan UI QRIS Saat Offline)


### 34. Batas Limit 50 Sync Offline (Dexie.js)
Pemadaman internet > 24 jam. Limit 50 transaksi tercapai.
*   **Opsi A (Hard Limit - POS Terkunci):** Tidak bisa transaksi sampai sync berhasil.
    *   *Kelebihan:* Mencegah tabrakan data (Crash IndexedDB) memori HP/Tablet penuh.
    *   *Kekurangan:* Warung lumpuh.
*   **Opsi B (Increase Limit to 500, Background Warn):** Naikkan jadi 500 struk, tapi munculkan *alert* merah besar.
    *   *Kelebihan:* Bisa bertahan offline seminggu penuh.
    *   *Kekurangan:* Risiko *sync conflict* saat internet nyala (seperti *timestamp* berantakan) sangat tinggi.

**Pilihan/Jawaban Anda:**Opsi A (Hard Limit - POS Terkunci) limit transaksi saya 100 transaksi perhari maksimal.


### 35. Cash Drawer Kick (Membuka Laci Otomatis)
*   **Opsi A (Implementasi ESC/POS Command):** Backend mengirim byte command khusus Bluetooth untuk menendang (*kick*) laci.
    *   *Kelebihan:* Kasir tidak usah pakai anak kunci, sistem otomatis buka saat bayar CASH.
    *   *Kekurangan:* Membutuhkan riset mendalam pada Bluetooth Web API agar sesuai dengan driver PUTIAN802.
*   **Opsi B (Abaikan, Manual Pakai Kunci):**
    *   *Kelebihan:* Development printer lebih cepat rampung.
    *   *Kekurangan:* Kasir capek/lambat saat jam sibuk karena harus memutar kunci manual.

**Pilihan/Jawaban Anda:**Opsi B (Abaikan, Manual Pakai Kunci)


### 36. Double-Tap Blocker UI
*   **Opsi A (Full Screen Overlay Blocker):** Layar digelapkan 100% dengan *spinner loading* sampai Midtrans/DB selesai.
    *   *Kelebihan:* Anti-*race condition* paling efektif.
    *   *Kekurangan:* Transisi UI terasa agak kaku.
*   **Opsi B (Disable Button Saja):** Tombol "Bayar" berubah jadi abu-abu.
    *   *Kelebihan:* UI modern, elegan.
    *   *Kekurangan:* User masih bisa klik-klik area lain di POS yang mungkin memicu re-render atau merusak *state*. *(Saran: Opsi A).*

**Pilihan/Jawaban Anda:**Opsi A (Full Screen Overlay Blocker)


### 37. Penulisan Nama Kasir di Struk
*   **Opsi A (Format `Nama Kasir + [Kode Huruf]`):** Misal: "Kasir: Rina [C]"
    *   *Kelebihan:* Sangat mudah dicocokkan dengan kode struk `TRX-20231010-C-001`.
    *   *Kekurangan:* Bentuknya sedikit teknis (kaku) di mata pelanggan.
*   **Opsi B (Hanya Nama Panggilan Asli):** Misal: "Kasir: Rina"
    *   *Kelebihan:* Ramah, elegan.
    *   *Kekurangan:* Kalau ada 2 kasir bernama Rina, Owner bingung melacak *discrepancy* via struk kertas.

**Pilihan/Jawaban Anda:**Opsi A (Format `Nama Kasir + [Kode Huruf]`)


### 38. Split Payment - QRIS Kadaluarsa
Sudah terima Cash Rp 10.000, tapi QRIS (Rp 15.000) *expired* karena pelanggan lama isi saldo Dana.
*   **Opsi A (Regenerate QRIS Only):** Sistem membatalkan QRIS lama dan membuat QRIS baru.
    *   *Kelebihan:* Uang cash Rp 10.000 tidak usah di-refund. Cepat.
    *   *Kekurangan:* Flow *state machine* di backend jadi sangat rumit (transaksi berstatus *Partially Paid - Regenerating*).
*   **Opsi B (Auto-Void Keseluruhan, Buat Order Ulang):** Sistem menggagalkan total order. Kasir kembalikan cash, lalu buat pesanan baru.
    *   *Kelebihan:* Backend aman dan *stateless*.
    *   *Kekurangan:* Kasir & pelanggan frustrasi. *(Saran Senior Eng: Wajib buat Opsi A demi pengalaman pengguna).*

**Pilihan/Jawaban Anda:**Opsi A (Regenerate QRIS Only)


### 39. Auto-Close Shift (BullMQ Cron Stuck)
Jam 23:59 Cron Job mati, shift kasir masih "Buka" sampai esok siangnya.
*   **Opsi A (Force Close di Login Berikutnya):** Saat kasir besoknya mau buka shift, sistem mendeteksi shift kemarin masih nyala, lalu otomatis menutupnya *under-the-hood*.
    *   *Kelebihan:* *Fail-safe* anti gagal. Tidak bergantung mutlak pada BullMQ.
    *   *Kekurangan:* *Timestamp* penutupan shift kemarin akan tercatat "Hari ini jam 08:00 Pagi", merusak presisi laporan durasi shift.
*   **Opsi B (Manual Superadmin Override):** Muncul error "Shift Sebelumnya Menggantung", Kasir harus menelepon Superadmin untuk menutup paksa dari *dashboard*.
    *   *Kelebihan:* Integritas data *timestamp* terkontrol manual dan akurat.
    *   *Kekurangan:* Menyebalkan bagi kasir kalau Superadmin belum bangun tidur.

**Pilihan/Jawaban Anda:**Opsi A (Force Close di Login Berikutnya), bagaimana jika kasir masih buka hingga pukul 02.00 subuh/pagi ? logicnya seperti apa saran kamu?


### 40. Partisi Tabel Orders (Persiapan Scale-Up)
Ekspansi 10 cabang akan membuat baris tabel meledak dari 36 ribu ke 360 ribu baris per tahun.
*   **Opsi A (Implementasi Partisi PostgreSQL Bulanan Sejak Awal Fase 3):**
    *   *Kelebihan:* Database sangat ringan saat mengeksekusi laporan per bulan (*partition pruning*). Tahan sampai jutaan baris.
    *   *Kekurangan:* Setup awal di Prisma agak merepotkan (Prisma tidak men-*support* Native Partition sepenuhnya secara deklaratif, butuh SQL mentah).
*   **Opsi B (Tunda sampai Fase 4 - Gunakan Index Saja):** Percayakan pada `B-Tree Indexing` di PostgreSQL 17.
    *   *Kelebihan:* PostgreSQL 17 mampu menghandle hingga 5 Juta baris data transaksi tanpa partisi asalkan index kolom `created_at` dan `outlet_id` dikonfigurasi sempurna. Cepat di-develop.
    *   *Kekurangan:* Setelah 3 tahun, *query* bulanan mungkin akan mulai terasa lemot (> 500ms). *(Saran: Opsi B, Postgres 17 sudah sangat powerful).*

**Pilihan/Jawaban Anda:**Opsi B (Tunda sampai Fase 4 - Gunakan Index Saja)


## F. Audit Trail, Hardware & Advanced Edge Cases

### 41. Audit Trail (Log Aktivitas Admin)
Ketika harga produk atau resep HPP diubah, perlukah sistem melacak "Siapa yang mengubah" dan "Kapan diubah"?
*   **Opsi A (Full Audit Log di Database):** Semua tabel master punya relasi ke tabel `AuditLogs`.
    *   *Kelebihan:* Transparan, Anda bisa melacak jika ada *Superadmin/Manager* nakal yang mengubah harga secara diam-diam.
    *   *Kekurangan:* Data membengkak lebih cepat. Butuh *effort* ekstra di *backend* (menggunakan *Prisma Middleware/Extension*).
*   **Opsi B (Simple Updated_At):** Hanya melacak waktu terakhir diubah tanpa tahu siapa yang mengubah.
    *   *Kelebihan:* Sangat mudah dan ringan.
    *   *Kekurangan:* Tidak ada pertanggungjawaban personal jika terjadi insiden kesalahan harga fatal.

**Pilihan/Jawaban Anda:**  perlukah sistem melacak "Siapa yang mengubah" dan "Kapan diubah"? = menurut saya cukup log kapan diubah saja karena sudah pasti saya sendiri yang mengubah harga produk atau resep HPP sebagai admin dan owner


### 42. Timezone (Zona Waktu Lintas Daerah)
Jika kelak cabang Ngemiloh buka di Bali (WITA) sementara pusat di Jakarta (WIB).
*   **Opsi A (UTC Terpusat + Konversi Frontend):** Database hanya menyimpan waktu UTC. Frontend mengonversi ke jam lokal cabang masing-masing.
    *   *Kelebihan:* Laporan pergantian hari per cabang sangat presisi sesuai matahari terbenam di kota masing-masing.
    *   *Kekurangan:* Rumit saat menarik laporan gabungan (Konsolidasi Nasional) karena *cut-off* jam 00:00 berbeda-beda tiap wilayah.
*   **Opsi B (Sapu Rata Pakai Jam WIB):** Semua cabang ikut jam operasional server pusat di Jakarta.
    *   *Kelebihan:* Sangat mudah bagi developer. Laporan harian sinkron 100%.
    *   *Kekurangan:* Kasir di Bali akan bingung melihat jam struknya telat 1 jam dari jam dinding mereka. *(Saran: Gunakan Opsi A sejak awal agar tahan banting).*

**Pilihan/Jawaban Anda:**Opsi B (Sapu Rata Pakai Jam WIB)


### 43. Fractional Inventory (Stok Desimal)
Apakah resep HPP akan sangat detail hingga gram? (Misal: 1 porsi butuh 0.015 Kg Garam).
*   **Opsi A (Simpan dalam Satuan Terkecil / Gramase):** Konversi 1 Kg jadi 1000 Gram di database (Tipe *Integer*).
    *   *Kelebihan:* Sangat akurat, tidak ada isu pembulatan desimal komputer (Floating Point Error).
    *   *Kekurangan:* Angka laporan gudang (UI) seringkali terlalu besar (Misal: Stok Garam 15.000 Gram).
*   **Opsi B (Gunakan Tipe Decimal/Float):** Simpan 15 Kg sebagai `15.000` di database.
    *   *Kelebihan:* Membaca laporan lebih masuk akal.
    *   *Kekurangan:* Rawan *bug* pembulatan di JavaScript (Misal: 0.1 + 0.2 = 0.30000000004). *(Saran: Gunakan Opsi A untuk backend, konversi ke Kg hanya di sisi UI).*

**Pilihan/Jawaban Anda:**Opsi A (Simpan dalam Satuan Terkecil / Gramase)


### 44. Hardware (Printer Auto-Cut)
Apakah printer Bluetooth PUTIAN802 yang Anda pilih punya fitur pemotong kertas otomatis?
*   **Opsi A (Printer Mendukung Auto-Cut):**
    *   *Kelebihan:* Pelayanan super cepat, kertas rapi.
    *   *Kekurangan:* Harus meriset kode HEX spesifik `ESC i` atau `ESC m` untuk dikirim via Web Bluetooth API.
*   **Opsi B (Hanya Tear-Bar / Sobek Manual):**
    *   *Kelebihan:* Tidak butuh *coding* tambahan.
    *   *Kekurangan:* Ujung kertas sering sobek berantakan kalau kasir menariknya tidak hati-hati.

**Pilihan/Jawaban Anda:**Opsi B (Hanya Tear-Bar / Sobek Manual)


### 45. Refund Midtrans via Core API
Jika ada refund pembatalan, apakah pengembalian saldo (Dana/Gopay/Shopeepay) diproses sistematis?
*   **Opsi A (Integrasi Midtrans Refund API):** Sistem memanggil API Refund ke Midtrans, uang otomatis kembali ke e-wallet pelanggan.
    *   *Kelebihan:* Terlihat sangat canggih dan profesional di mata pelanggan.
    *   *Kekurangan:* Beberapa metode pembayaran QRIS/e-Wallet di Midtrans butuh *approval* manual dari pihak bank maksimal 14 hari kerja. Pelanggan bisa emosi menunggu.
*   **Opsi B (Manual Transfer Bank oleh Owner):** Anda men-transfer manual uang tersebut dari BCA/Mandiri Anda langsung ke rekening pelanggan, lalu menandai "Refunded" di POS.
    *   *Kelebihan:* Pelanggan langsung menerima uang dalam 5 menit, *brand image* naik.
    *   *Kekurangan:* Repot bagi Anda karena harus bolak-balik buka M-Banking.

**Pilihan/Jawaban Anda:** lebih baik pengembalian dana tunai langsung dari kasir, tetapi buat laporannya refund pembatalan


### 46. WebSockets vs Long Polling (Real-time Dashboard)
Apakah Dashboard Superadmin Anda butuh *real-time push* kalau ada omzet/transaksi masuk dari cabang?
*   **Opsi A (Gunakan WebSockets/Socket.io):**
    *   *Kelebihan:* Angka omzet di layar bergerak *real-time* seperti saham. Sangat memuaskan dilihat.
    *   *Kekurangan:* Mengurus *Socket connections* di VPS yang pakai Caddy butuh konfigurasi *header upgrade* yang rumit, rawan memory leak di NestJS.
*   **Opsi B (SWR / Polling tiap 60 detik):** Halaman *refresh* data di *background* setiap 1 menit.
    *   *Kelebihan:* Sangat stabil, *stateless*, 0 konfigurasi *server*.
    *   *Kekurangan:* Ada *delay* 1 menit dari saat kasir jualan sampai laporannya muncul di HP Anda. *(Saran Senior Eng: Gunakan Opsi B untuk sistem POS)*.

**Pilihan/Jawaban Anda:**Opsi B (SWR / Polling tiap 120 detik)


### 47. Fallback Payment Gateway
Jika Midtrans mati total secara nasional seharian (Server Down).
*   **Opsi A (Pasang Xendit sebagai Fallback):**
    *   *Kelebihan:* Warung Anda kebal badai. Transaksi non-tunai tetap berjalan.
    *   *Kekurangan:* Implementasi kode jadi 2x lipat lebih tebal. Harus merekonsiliasi (mencocokkan) uang dari 2 laporan *dashboard* yang berbeda.
*   **Opsi B (Alihkan ke Cash / Transfer Manual Manual Saja):** Kasir suruh pelanggan transfer ke rekening toko (BCA).
    *   *Kelebihan:* Simpel, tidak perlu koding integrasi Gateway kedua.
    *   *Kekurangan:* Rawan salah input/verifikasi mutasi palsu (struk m-banking editan).

**Pilihan/Jawaban Anda:**Opsi B (Alihkan ke Cash)


### 48. Penghapusan Produk (Soft-Delete vs Hard-Delete)
Bagaimana jika produk "Es Teh Manis" dihapus dari menu untuk selamanya?
*   **Opsi A (Soft-Delete):** Tambahkan kolom `deleted_at`. Produk hilang dari UI kasir tapi tetap ada di database.
    *   *Kelebihan:* Riwayat penjualan Es Teh Manis tahun lalu tidak rusak (Tetap bisa dihitung HPP & Omzetnya).
    *   *Kekurangan:* Data master menjadi "kotor", *query* harus selalu ditambah `WHERE deleted_at IS NULL`.
*   **Opsi B (Hard-Delete):** Langsung *Drop/Delete Row*.
    *   *Kelebihan:* Database bersih.
    *   *Kekurangan:* Mustahil dilakukan. PostgreSQL akan *error* (Foreign Key Constraint) karena produk ini terkait dengan ribuan struk lama di tabel `orders`. *(Saran Mutlak: Opsi A).*

**Pilihan/Jawaban Anda:**Opsi A (Soft-Delete)


### 49. Batas Limit Hardware Perangkat Kasir
Aplikasi berbasis *Web* (*SvelteKit/Dexie*) memakan RAM HP/Tablet.
*   **Opsi A (Wajibkan Tablet Minimal RAM 4GB):**
    *   *Kelebihan:* POS dijamin *smooth* 60fps, IndexedDB berjalan lancar.
    *   *Kekurangan:* Modal buka cabang (*CapEx*) lebih tinggi untuk beli alat.
*   **Opsi B (Optimasi Ekstrim untuk RAM 2GB):**
    *   *Kelebihan:* Bisa pakai HP Android bekas murahan.
    *   *Kekurangan:* Butuh optimasi kode Svelte 5 (*virtual scrolling* list menu, pembersihan *garbage collection*) yang memakan waktu lama saat *development*.

**Pilihan/Jawaban Anda:**Opsi B (Optimasi Ekstrim untuk RAM 2-3GB)


### 50. SLA (Service Level Agreement) Internal
Berapa komitmen *uptime* yang Anda janjikan ke para manajer cabang Anda?
*   **Opsi A (Target 99.9% Uptime):** Boleh mati maksimal 43 menit per bulan.
    *   *Kelebihan:* Standar profesional kelas *Enterprise*.
    *   *Kekurangan:* Butuh infrastruktur mahal (Auto-scaling, Load Balancer, Multi-region DB).
*   **Opsi B (Target 99.0% Uptime):** Boleh mati maksimal 7 jam per bulan (Umumnya saat tengah malam untuk *maintenance*).
    *   *Kelebihan:* Masuk akal untuk *startup/UMKM* dengan budget VPS di bawah Rp 200rb/bulan.
    *   *Kekurangan:* Jika *down* di siang hari sibuk, kasir terpaksa bergantung total pada mode *Offline* (yang punya limitasi 50 struk).

**Pilihan/Jawaban Anda:**Opsi B (Target 99.0% Uptime):** Boleh mati maksimal 7 jam per bulan (Umumnya saat tengah malam untuk *maintenance*).kasir terpaksa bergantung total pada mode *Offline* melalui pembayaran tunai saja


## G. Ojek Online, Akuntansi Gudang & POS Fraud (The Ultimate Edge Cases)

### 51. Integrasi Ojek Online (GrabFood / GoFood)
Saat ini PRD menetapkan "Takeaway Only". Bagaimana jika Ngemiloh didaftarkan ke GrabFood/ShopeeFood?
*   **Opsi A (Buat Tipe Order Khusus dengan Harga Mark-up):** Sistem POS memiliki tombol "Order GrabFood" yang otomatis menaikkan harga jual 20% untuk menutupi potongan aplikasi.
    *   *Kelebihan:* Kasir tidak pusing menghitung manual, HPP dan Laba bersih terekam akurat.
    *   *Kekurangan:* Harus menambah tabel `OrderTypes` dan modifikasi logika *Pricing*.
*   **Opsi B (Input Manual / Samakan Harga):** Harga jual online dianggap sama dengan harga *offline*, atau selisihnya diabaikan.
    *   *Kelebihan:* PRD saat ini sudah *support* 100% tanpa ubahan.
    *   *Kekurangan:* Laporan margin keuntungan (Laba Bersih) Anda akan palsu dan terlihat lebih besar dari aslinya (karena potongan 20% Grab tidak tercatat).

**Pilihan/Jawaban Anda:**Opsi A (Buat Tipe Order Khusus dengan Harga Mark-up)


### 52. Metode Perhitungan HPP (Costing Method)
Jika kemarin Anda belanja Tepung seharga Rp 10.000/kg, dan hari ini harga tepung naik jadi Rp 12.000/kg. Saat kasir menjual makanan, modal (HPP) mana yang dipakai sistem?
*   **Opsi A (WAC - Weighted Average Cost / Harga Rata-rata):** Sistem otomatis mencari nilai tengah (Rp 11.000).
    *   *Kelebihan:* Laporan laba/rugi sangat stabil dan *smooth*. Standar emas industri F&B.
    *   *Kekurangan:* Rumus *query* di *backend* cukup rumit.
*   **Opsi B (FIFO - First In First Out):** Sistem menghabiskan dulu stok lama (modal Rp 10.000), baru memakai stok baru (modal Rp 12.000).
    *   *Kelebihan:* Sangat akurat secara fisik gudang nyata.
    *   *Kekurangan:* Query database jauh lebih berat karena harus *tracking batch* pembelian bahan baku satu per satu. *(Saran: Gunakan WAC - Opsi A).*

**Pilihan/Jawaban Anda:**Opsi A (WAC - Weighted Average Cost / Harga Rata-rata)


### 53. POS Fraud: "The Ghost Order"
Bagaimana mencegah Kasir curang: Kasir menginput pesanan, mencetak struk (untuk diberikan ke dapur & pelanggan), lalu dengan cepat melakukan *Void/Delete* pesanan tersebut agar uangnya bisa ia kantongi?
*   **Opsi A (Void Memerlukan PIN Manager):** Setiap pembatalan *wajib* meminta 6 digit PIN dari *Supervisor/Owner*.
    *   *Kelebihan:* Celah *fraud* ini tertutup mati.
    *   *Kekurangan:* Mengganggu jika *owner* sedang tidak ada di toko (harus via telepon).
*   **Opsi B (Log Print Count & Void Alerts):** Sistem membiarkan kasir melakukan Void, tapi jika terdeteksi struk sudah pernah di-print > 0 kali, *alert* Telegram/Email otomatis terkirim ke Owner berisi foto transaksi.
    *   *Kelebihan:* Operasional mulus tanpa hambatan, namun *owner* tetap bisa memecat kasir curang besok harinya.
    *   *Kekurangan:* Uang terlanjur hilang pada hari kejadian.

**Pilihan/Jawaban Anda:**Opsi B (Log Print Count & Void Alerts)Sistem membiarkan kasir melakukan Void, tapi jika terdeteksi struk sudah pernah di-print > 0 kali, *alert* Email otomatis terkirim ke Owner berupa pemberitahuan saja. saya cukup bingung dengan opsi B ini, bisa kamu jelaskan lebih rinci


### 54. Metode Pembayaran EDC Fisik (BCA / Mandiri)
Selain QRIS Midtrans, apakah Anda memiliki mesin gesek kartu (EDC) fisik di warung?
*   **Opsi A (Sediakan Tipe Pembayaran EDC/Debit):** Kasir harus memilih bank EDC yang dipakai.
    *   *Kelebihan:* Pelaporan *Settlement* harian EDC fisik tidak tercampur dengan QRIS Midtrans atau Cash.
    *   *Kekurangan:* Kasir harus mengetik manual "Nomor Reff" EDC ke sistem POS.
*   **Opsi B (Tidak Pakai EDC Fisik, Hanya Midtrans QRIS & Cash):**
    *   *Kelebihan:* Setup sistem simpel sesuai PRD saat ini.
    *   *Kekurangan:* Pelanggan yang hanya membawa Kartu ATM Debit/Kredit mungkin tidak bisa belanja.

**Pilihan/Jawaban Anda:**Opsi B (Tidak Pakai EDC Fisik, Hanya Midtrans QRIS & Cash)


### 55. Retur Bahan Baku ke Supplier (Purchase Returns)
Bagaimana jika bahan baku yang baru tiba dari *supplier* ternyata busuk/rusak dan harus dikembalikan?
*   **Opsi A (Buat Modul Retur Gudang):** Sistem punya fitur mencatat barang keluar karena *Retur*.
    *   *Kelebihan:* Stok gudang tetap sinkron, pencatatan uang keluar-masuk supplier rapi.
    *   *Kekurangan:* Menambah *scope* pekerjaan di Fase 3 secara signifikan.
*   **Opsi B (Gunakan Modul Waste/Spoilage Saja):** Barang dianggap "Rusak" (Waste), dan uang ganti dari supplier dimasukkan manual sebagai *Other Income*.
    *   *Kelebihan:* Menghemat waktu *development*.
    *   *Kekurangan:* Laporan *Waste* bulanan akan terlihat sangat besar padahal bukan salah pegawai (tapi salah supplier).

**Pilihan/Jawaban Anda:** lebih baik saya sendiri sebagai owner yang menerima langsung memberi tahu supplier bahwa barang rusak tanpa dimasukan kesistem. sistem berguna untuk menyimpan data barang baru masuk saja khusus bahan baku dan atribut lainnya.


### 56. Handover Shift (Serah Terima Fisik)
Saat Shift Pagi selesai dan Shift Malam masuk, apakah uang fisik di laci benar-benar dihitung dan dipisah?
*   **Opsi A (Blind Closing / Blind Handover):** Kasir Shift Pagi harus mengetik total uang laci *tanpa* tahu berapa angka yang seharusnya ada di sistem.
    *   *Kelebihan:* Memaksa kasir jujur 100%. Mencegah kasir menutupi uang hilang.
    *   *Kekurangan:* Kasir akan sangat tegang saat tutup shift.
*   **Opsi B (Sistem Menampilkan Angka Target):** Layar kasir menampilkan "Uang seharusnya Rp 500.000".
    *   *Kelebihan:* Tutup shift sangat cepat.
    *   *Kekurangan:* Jika uangnya hanya Rp 490.000, kasir bisa diam-diam nombok 10rb dari dompetnya tanpa melapor, menyembunyikan masalah yang sebenarnya.

**Pilihan/Jawaban Anda:**Opsi A (Blind Closing / Blind Handover)


### 57. Data Retention (Penyimpanan Data Lama)
Jika bisnis sudah berjalan 5 tahun, database Anda akan membesar. Berapa lama struk transaksi dipertahankan?
*   **Opsi A (Simpan 1 Tahun, Sisanya di-Archive):** Data transaksi > 1 tahun dipindah ke S3/Backblaze (Cold Storage), dihapus dari PostgreSQL.
    *   *Kelebihan:* Performa database PostgreSQL selalu super kilat sampai kapanpun.
    *   *Kekurangan:* Jika Anda ingin melihat laporan penjualan tahun 2023, Anda harus men-*download* file CSV lama.
*   **Opsi B (Keep Forever):** Simpan terus selamanya di PostgreSQL.
    *   *Kelebihan:* Dashboard analitik bisa membandingkan "Januari 2026 vs Januari 2023" dalam sekejap.
    *   *Kekurangan:* Ukuran file `.bak` database akan membengkak jadi puluhan Gigabyte (biaya VPS naik).

**Pilihan/Jawaban Anda:**Opsi B (Keep Forever) tapi kemungkinan saya akan backup manual untuk data lama, dan juga bisa menghapus data lama jika sudah dibackup guna membuat database ringan


### 58. Promo Voucher Manual (Kode Diskon)
Selain Diskon Tier Member (Gold) dan Event (Weekend), apakah Anda butuh Kupon/Voucher khusus? (Misal: Kode `NABILAHSPECIAL10` disebar di Instagram).
*   **Opsi A (Sistem Voucher Spesifik):**
    *   *Kelebihan:* Sangat *powerful* untuk mengukur efektivitas *marketing campaign* di media sosial.
    *   *Kekurangan:* Butuh tabel `Vouchers`, validasi *usage limit* (1 kupon cuma boleh dipakai 100 orang), dan validasi masa kedaluwarsa.
*   **Opsi B (Hanya Diskon Event Otomatis):**
    *   *Kelebihan:* Simpel. Sesuai PRD.
    *   *Kekurangan:* Tidak bisa melacak apakah pembeli datang dari Iklan Instagram atau organik.

**Pilihan/Jawaban Anda:**Opsi B (Hanya Diskon Event Otomatis)


### 59. Auto-Scaling saat Jam Buka Puasa (Peak Hour Spike)
Di bulan Ramadhan, 80% transaksi per hari bisa terjadi hanya dalam *window* waktu 2 jam (Jam 4 - 6 sore).
*   **Opsi A (Siapkan Database Connection Pooling Khusus):** Menggunakan PgBouncer atau Prisma Accelerate.
    *   *Kelebihan:* Server kebal dari *crash* walau ditekan ratusan query bersamaan dari semua cabang.
    *   *Kekurangan:* Setup arsitektur DevOps tambahan.
*   **Opsi B (Andalkan Offline-First Dexie.js 100% saat Peak):** Secara sengaja mematikan sinkronisasi kasir selama jam 4 - 6 sore. Kasir dipaksa masuk *offline mode*, lalu data di-sync massal jam 7 malam.
    *   *Kelebihan:* 0 biaya infrastruktur tambahan. Transaksi dijamin kilat (karena simpan di RAM HP).
    *   *Kekurangan:* Dashboard Superadmin akan mati/buta total (laporan 0) selama jam sibuk tersebut. *(Saran: Opsi A).*

**Pilihan/Jawaban Anda:**Opsi A (Siapkan Database Connection Pooling Khusus)


### 60. Keamanan Akses Superadmin
Dashboard Superadmin mengendalikan nyawa bisnis Anda (Harga, HPP, Cabang).
*   **Opsi A (Wajibkan Two-Factor Authentication / 2FA Authenticator):**
    *   *Kelebihan:* Kalau *password* Superadmin Anda bocor, *hacker* tetap tidak bisa masuk tanpa HP Anda.
    *   *Kekurangan:* Anda harus login pakai Google Authenticator setiap saat.
*   **Opsi B (Cukup Password + Whitelist IP Rumah Anda):**
    *   *Kelebihan:* Gampang masuk tanpa buka HP.
    *   *Kekurangan:* Jika IP internet rumah Anda dinamis (Indihome/Biznet), Anda sering gagal login sendiri.

**Pilihan/Jawaban Anda:**Opsi B (Cukup Password + Whitelist IP Rumah Anda), atau bisa juga menciptakan kode OTP sendiri dimana sistem mengirimnya ke email kita otomatis. tapi muncul pertanyaan apakah perlu bayar tambahan layanan khusus?


## H. Distributed Systems, Enterprise Accounting & Core Security (The "Billion Dollar" Edge Cases)

### 61. Sinkronisasi Mutasi Bank (T+1 Settlement Delay)
Pencairan dana Midtrans masuk ke rekening bank Anda pada H+1 atau H+2.
*   **Opsi A (Rekonsiliasi Otomatis via API):** Sistem secara rutin menarik data "Settlement" dari Midtrans API dan mencocokkannya secara otomatis dengan struk penjualan di POS, sehingga Anda tahu persis struk mana yang uangnya sudah masuk BCA Anda hari ini.
    *   *Kelebihan:* 100% akurat. Anda tidak perlu menebak-nebak apakah selisih Rp 50.000 di rekening itu dari transaksi yang mana.
    *   *Kekurangan:* Membutuhkan *cron job* dan pemahaman tingkat dewa terkait Midtrans Settlement API.
*   **Opsi B (Manual Bank Reconciliation):** POS hanya mencatat "Lunas Midtrans". Urusan uang masuk ke BCA, Anda hitung sendiri manual tiap pagi pakai kalkulator dan mutasi M-Banking.
    *   *Kelebihan:* Sangat mudah di-develop.
    *   *Kekurangan:* Sangat menguras waktu *owner* tiap pagi. Rawan keliru baca laporan.

**Pilihan/Jawaban Anda:**Opsi B (Manual Bank Reconciliation)


### 62. Masalah "Noisy Neighbor" pada Database Multi-Outlet
Jika Anda menggabungkan semua data cabang ke dalam satu tabel tunggal `orders` (berbeda hanya di `outlet_id`).
*   **Opsi A (Isolasi Schema per Tenant / Cabang):** Setiap cabang memiliki "ruangan" (schema) database terpisah (misal: schema `cbg_bali`, schema `cbg_jakarta`).
    *   *Kelebihan:* Data 100% terisolasi secara *security*. Jika Cabang Bali menarik *report* tahunan raksasa, mesin kasir Cabang Jakarta tidak akan melambat/nge-lag.
    *   *Kekurangan:* Migrasi database sangat kompleks (*Prisma Multi-Schema*).
*   **Opsi B (Shared Table dengan Index Khusus):** Semua numpuk di satu tabel.
    *   *Kelebihan:* Sederhana dan cepat dibangun.
    *   *Kekurangan:* Rawan kiamat *Noisy Neighbor* (satu cabang narik data berat, semua cabang lain aplikasinya nge-lag/blank). *(Saran: Gunakan Opsi B namun optimalkan Index dan batasi filter tanggal maksimal 30 hari).*

**Pilihan/Jawaban Anda:**Opsi B (Shared Table dengan Index Khusus): optimalkan Index dan batasi filter tanggal maksimal 30 hari dan filter percabang saja. tapi saya bingung dengan metode ini karena sekalipun banyak outlet atau cabang tapi yang memiliki nya saya sendiri, bukannya pemborosan fitur?


### 63. State Rollback (Void & Refund Batal)
Jika sebuah pesanan di-Void, apakah bahan baku gudang yang sudah terpakai otomatis dikembalikan utuh ke dalam angka persediaan sistem?
*   **Opsi A (Rollback Otomatis):** Sistem akan me-*reverse* jurnal stok, misal Garam kembali menjadi 15 Kg.
    *   *Kelebihan:* Gudang kembali sinkron seperti sedia kala.
    *   *Kekurangan:* Bagaimana jika barang itu di-Void karena jatuh ke lantai dan hancur? Sistem akan mengira garamnya masih ada, padahal secara fisik sudah terbuang.
*   **Opsi B (Pilih Alasan Void: "Kembali ke Gudang" vs "Buang/Waste"):** Saat kasir mem-Void, layar memunculkan tombol (Barang kembali utuh ATAU Barang rusak).
    *   *Kelebihan:* Akuntansi gudang sangat presisi di segala skenario.
    *   *Kekurangan:* Menambah 1 langkah interaksi di UI Kasir saat membatalkan struk. *(Saran Mutlak: Gunakan Opsi B).*

**Pilihan/Jawaban Anda:**Opsi B (Pilih Alasan Void: "Kembali ke Gudang" vs "Buang/Waste")


### 64. Idempotency Key (Mencegah Bayar Midtrans Double)
Kasir berada di area susah sinyal. Saat ia menekan "Generate QRIS", aplikasinya muter-muter. Karena panik, ia menekan tombol itu 5x dengan cepat.
*   **Opsi A (Implementasi Idempotency-Key Header):** Backend hanya merespons *request* pertama dan mengabaikan 4 *request* sisanya (walaupun tanpa respon/putus di tengah jalan).
    *   *Kelebihan:* Aman dari duplikasi tagihan Midtrans.
    *   *Kekurangan:* Developer harus paham implementasi *Idempotency* dengan Redis Cache.
*   **Opsi B (Andalkan Frontend Button Disable Saja):** Tombol dikunci (abu-abu) saat di-klik.
    *   *Kelebihan:* Mudah dibuat.
    *   *Kekurangan:* Jika internet mati di detik yang sama tombol diklik, status UI akan macet tak berkesudahan, dan saat di-refresh, *request* bisa terkirim ulang tanpa disadari. *(Saran: Wajib Opsi A untuk semua API Keuangan).*

**Pilihan/Jawaban Anda:**Opsi A (Implementasi Idempotency-Key Header)


### 65. Rounding Consistency (Beda Rp 1 Bikin Gagal Bayar)
JavaScript Frontend menggunakan *Floating Point* (0.1 + 0.2 = 0.30004), sedangkan Backend (Prisma) menggunakan *Decimal*. Saat pajak 11% dan diskon 15% dihitung, bisa terjadi selisih Rp 1 (misal Total di Frontend Rp 15.000, tapi hitungan Backend Rp 14.999). Midtrans akan menolak transaksi (Error Mismatch) jika angka keranjang beda dengan Total Bayar.
*   **Opsi A (Single Source of Truth - Server Side Calculation):** Frontend hanya mengirim "Daftar Barang". Hitungan akhir dikembalikan oleh backend, frontend dilarang keras menghitung total sendiri.
    *   *Kelebihan:* Bebas dari *bug* selisih Rp 1.
    *   *Kekurangan:* UI keranjang kerasa *laggy* (ada jeda 0.5 detik tiap nambah barang karena nunggu hitungan server).
*   **Opsi B (Gunakan Library Big.js di Frontend):** Frontend diwajibkan memakai library matematika khusus, bukan `+` atau `-` bawaan JS.
    *   *Kelebihan:* UI Instan dan *real-time*.
    *   *Kekurangan:* Harus *refactor* (merombak) semua logika hitungan harga di Svelte. *(Saran: Gunakan Opsi B).*

**Pilihan/Jawaban Anda:**Opsi B (Gunakan Library Big.js di Frontend), jangan gunakan angka desimal, lebih baik di rounding saja / dibulatkan nominalnya


### 66. Employee Sweet-Hearting (Pencurian Poin Tipe Halus)
Kasir secara diam-diam menggunakan Nomor HP (Member Gold) miliknya sendiri setiap kali ada pelanggan anonim yang belanja pakai Cash, agar si kasir mendapat poin ratusan ribu gratis.
*   **Opsi A (Fraud Detection Algorithm):** Sistem mem-blokir otomatis akun Member yang ter-scan lebih dari 3x dalam 1 jam di shift yang sama, lalu mengirim notifikasi ke *Owner*.
    *   *Kelebihan:* Pencurian tertutup rapat secara sistem.
    *   *Kekurangan:* Harus merancang algoritma spesifik di NestJS (*rate limit per user ID per day*).
*   **Opsi B (Owner Cek Laporan Manual):** Membiarkan saja dan berharap owner teliti mengecek "Top Member" tiap bulan.
    *   *Kelebihan:* Tidak ada beban *coding*.
    *   *Kekurangan:* Poin telanjur dicuri dan *free item* melayang sebelum ketahuan.

**Pilihan/Jawaban Anda:**psi A (Fraud Detection Algorithm), bisa jelaskan lebih rinci terkait opsi ini?


### 67. Limit Uang Laci (Safe Drop Lockout)
Untuk mencegah perampokan fisik di warung malam hari.
*   **Opsi A (Auto-Lockout jika Cash Laci > Rp 3 Juta):** Sistem POS terkunci (tidak bisa terima order Cash) jika laci mendeteksi uang > Rp 3 Juta. Kasir dipaksa mencatat "Setor ke Brankas/Bank" (*Safe Drop*) terlebih dahulu.
    *   *Kelebihan:* Standar operasional F&B Internasional. Keamanan uang fisik sangat terjamin.
    *   *Kekurangan:* Menghambat operasional kalau kasir sedang ramai antrean tapi POS mendadak ngunci minta *Safe Drop*.
*   **Opsi B (Tergantung SOP Manual Kasir Saja):**
    *   *Kelebihan:* POS simpel.
    *   *Kekurangan:* Jika warung dirampok jam 11 malam, kerugian bisa belasan juta karena uang numpuk di laci kasir.

**Pilihan/Jawaban Anda:**Opsi B (Tergantung SOP Manual Kasir Saja) ini merupakan tanggung jawab kasir bukan saya


### 68. Versioning Resep (HPP Immutability)
Bulan Januari, Resep Kopi Susu butuh 20gr Gula. Bulan Februari, resep diubah jadi 15gr Gula (Lebih hemat).
Jika Anda menarik ulang laporan laba-rugi bulan Januari, apakah HPP-nya dihitung pakai resep baru (15gr) atau resep lama (20gr)?
*   **Opsi A (Snapshot/Immutability per Transaksi):** Saat transaksi terjadi, sistem me-*copy-paste* nilai harga HPP final ke tabel `order_items`. Perubahan resep ke depannya tidak akan pernah merusak/mengubah laporan lama.
    *   *Kelebihan:* Prinsip akuntansi absolut (Immutable Ledger).
    *   *Kekurangan:* Tabel `order_items` menjadi sedikit lebih gemuk karena menyimpan *snapshot* angka.
*   **Opsi B (Dynamic Calculation):** Sistem selalu menghitung HPP secara *real-time* dengan memanggil rumus resep terbaru (relasi ke tabel `Ingredients`).
    *   *Kelebihan:* Sangat mudah, database ramping.
    *   *Kekurangan:* Bencana besar. Laba-rugi bulan Januari Anda akan berubah drastis dan "rusak" saat resep Februari di-update. *(Saran Mutlak: Wajib Opsi A).*

**Pilihan/Jawaban Anda:**Opsi A (Snapshot/Immutability per Transaksi)


### 69. Conflict Resolution pada Offline-First
Kasir 1 di tablet A mengubah harga diskon manual (kondisi Offline). Kasir 2 di tablet B mengubah data pelanggan yang sama (kondisi Online). Saat tablet A kembali online, data mana yang menang?
*   **Opsi A (Server is Authoritative / LWW):** *Last Write Wins*, atau server selalu membuang data offline yang konflik dengan database pusat.
    *   *Kelebihan:* Mudah dibangun.
    *   *Kekurangan:* Pekerjaan kasir A hilang total.
*   **Opsi B (Pemisahan Tanggung Jawab / No-Conflict Design):** Desain aplikasi dilarang melakukan operasi mutasi data master saat offline (hanya boleh *Create Order*).
    *   *Kelebihan:* Tidak akan pernah terjadi *conflict resolution*. Sangat aman.
    *   *Kekurangan:* Jika POS offline, kasir tidak bisa mengganti harga produk atau mengubah nama menu. Harus menunggu online. *(Saran: Gunakan Opsi B).*

**Pilihan/Jawaban Anda:**Opsi B (Pemisahan Tanggung Jawab / No-Conflict Design)


### 70. Crash Recovery (Listrik Padam Tiba-tiba)
Kasir sedang menginput 20 daftar barang belanjaan, belum sempat memencet bayar. Tiba-tiba mati lampu, komputer/tablet mati mendadak.
*   **Opsi A (Auto-Save Cart State to LocalStorage):** Setiap kali barang ditambahkan ke keranjang, UI otomatis menyimpannya ke memori HP. Saat tablet nyala lagi, 20 barang itu masih mejeng di layar (persis sebelum listrik mati).
    *   *Kelebihan:* UX (Pengalaman Pengguna) kelas dunia. Kasir akan takjub.
    *   *Kekurangan:* Harus menulis logika *state re-hydration* di Svelte 5.
*   **Opsi B (Keranjang Kosong / Mulai dari Awal):**
    *   *Kelebihan:* *Stateless*, tidak usah memikirkan *cache browser*.
    *   *Kekurangan:* Kasir emosi karena harus men-scan/menginput ulang 20 item saat listrik nyala.

**Pilihan/Jawaban Anda:**Opsi A (Auto-Save Cart State to LocalStorage)


*Silakan jawab 5 pertanyaan konfirmasi terakhir ini. Setelah ini selesai, kita punya fondasi arsitektur besi yang tak tertembus!*

## J. PERTANYAAN LANJUTAN (RONDE 2: THE FINAL REFINEMENT)
Jawaban Anda memicu beberapa skenario tajam baru yang butuh keputusan Anda:

### 71. Masalah Upload Foto Opex (Follow-up Soal 8)
Anda ingin kasir bisa upload foto struk/nota pengeluaran. Aplikasi POS Anda berbasis Web (SvelteKit) di Tablet RAM 2-3GB (Soal 49). Memfoto dari kamera HP/Tablet rata-rata ukurannya besar (3MB - 5MB). Jika kasir upload langsung, aplikasi kasir bisa *Crash/Out of Memory*, dan biaya *Storage* VPS Anda bengkak.
*   **Opsi A (Auto-Compress di Frontend):** Menggunakan library JS untuk mengecilkan foto jadi 100KB sebelum dikirim ke server.
    *   *Kelebihan:* Hemat biaya server, aplikasi tidak crash.
    *   *Kekurangan:* Tulisan di nota mungkin agak buram saat Anda periksa.
*   **Opsi B (Catat Nominal Saja, Nota Disimpan Manual):** Kasir hanya ketik angka Opex di POS, kertas nota fisiknya dijepit di laci untuk Anda periksa saat kunjungan/tutup buku bulanan.
    *   *Kelebihan:* Aplikasi luar biasa ringan dan cepat dibuat.
    *   *Kekurangan:* Anda harus cek fisik kertas secara manual.

**Pilihan/Jawaban Anda:**Opsi B (Catat Nominal Saja, Nota Disimpan Manual) dan kasir berikan bukti fisik kepada owner


### 72. Refund Tunai Lintas Metode Pembayaran (Follow-up Soal 45)
Anda memilih agar kasir melakukan *Refund* dengan memberikan uang Tunai fisik dari laci untuk pesanan yang batal. BAGAIMANA JIKA pesanan aslinya dibayar menggunakan QRIS Midtrans? Jika kasir mengambil uang fisik di laci untuk mengganti saldo QRIS, uang fisik laci akan MINUS/kurang saat tutup shift.
*   **Opsi A (Sistem Menyesuaikan "Expected Cash"):** Sistem otomatis mengurangi target uang fisik laci di laporan akhir shift jika terjadi Refund Tunai dari QRIS.
    *   *Kelebihan:* Hitungan kasir saat tutup shift (*Blind Closing*) tetap balance.
    *   *Kekurangan:* Rumit dalam rekonsiliasi akuntansi.
*   **Opsi B (Larangan Keras Refund Lintas Metode):** Bayar pakai QRIS = Wajib ditransfer manual oleh Owner ke rekening pelanggan. Bayar pakai Tunai = Refund ambil dari laci Kasir.
    *   *Kelebihan:* Sangat rapi secara aliran arus kas.
    *   *Kekurangan:* Pelanggan QRIS harus menunggu Owner mentransfer.

**Pilihan/Jawaban Anda:**Opsi A (Sistem Menyesuaikan "Expected Cash")


### 73. Server VPS Pakai GPU? (Follow-up Soal 16)
Anda menyebutkan ingin "menambah RAM VPS dan 2 core GPU lagi". NestJS, SvelteKit, dan PostgreSQL sama sekali tidak bisa menggunakan GPU (Graphic Processing Unit). Teknologi ini murni bergantung pada CPU. 
*   **Opsi A (Maksud Anda adalah CPU Core/vCPU):** Kita tambah spesifikasi VPS menjadi misal 4 vCPU & 8GB RAM.
*   **Opsi B (Memang Butuh GPU):** Apakah Anda berencana memasukkan fitur *Artificial Intelligence* (AI) seperti CCTV pengenal wajah kasir atau Analisa Prediksi Menu menggunakan Machine Learning di server yang sama?

**Pilihan/Jawaban Anda:**Opsi A (Maksud Anda adalah CPU Core/vCPU) maaf saya typo


### 74. Fitur Archive Tool Dashboard (Follow-up Soal 57)
Anda ingin membersihkan/menghapus data transaksi lama secara berkala agar database ringan. Menghapus ratusan ribu baris data langsung via *Database SQL* sangat berbahaya (bisa bikin database *Lock* / Macet saat jam sibuk).
*   **Opsi A (Buat Tombol "Archive" di Dashboard):** Fitur Superadmin di mana Anda bisa memilih "Arsipkan Tahun 2024". Sistem akan otomatis mengekspornya jadi file CSV/Excel untuk di-download, lalu menghapus data di DB secara perlahan (*chunking* per 500 baris) di tengah malam.
    *   *Kelebihan:* Sangat aman, tidak akan membuat warung nge-lag.
    *   *Kekurangan:* Menambah daftar pekerjaan *coding* backend di Fase 3.
*   **Opsi B (Biar Saya Hapus Manual Saja via DBeaver/TablePlus):** Anda yang akan mengeksekusi *query SQL Delete* sendiri kapan-kapan kalau server mulai penuh.

**Pilihan/Jawaban Anda:**Opsi B (Biar Saya Hapus Manual Saja via DBeaver/TablePlus) saya bisa query sendiri


### 75. Status Keuangan "Gaji Iba" (Follow-up Soal 24)
Jika Laba bersih rugi, pool kasir = Rp 0. Tapi Anda ingin memberi "Gaji Iba".
*   **Opsi A (Catat sebagai Pengeluaran Resmi di Sistem):** Gaji iba dimasukkan sebagai Opex khusus (Owner Expense) di POS.
    *   *Kelebihan:* Terekam jelas.
    *   *Kekurangan:* Membuat metrik Laba Rugi warung Anda terlihat semakin "Berdarah-darah" (semakin minus besar).
*   **Opsi B (Off-the-Books / Uang Pribadi Murni):** Sistem POS menolak mencatatnya (di sistem tetap tertulis gaji kasir Rp 0). Uang santunan Anda transfer manual dari dompet pribadi di luar urusan laporan POS.
    *   *Kelebihan:* Laporan performa bisnis murni dan obyektif.

**Pilihan/Jawaban Anda:**Opsi B (Off-the-Books / Uang Pribadi Murni)


---

## K. RONDE 3: THE BILLION-DOLLAR ENTERPRISE EDGE CASES
Anda meminta *brainstorming* maksimal. Berikut adalah 25 studi kasus tingkat lanjut (Skala *Enterprise / Startup Unicorn*) yang sering meruntuhkan sistem POS bernilai miliaran rupiah jika tidak dirancang dengan benar. Silakan jawab untuk menguji ketahanan arsitektur Anda!

### 76. Event Sourcing vs CRUD (Jejak Transaksi)
Bagaimana Anda melacak riwayat mutasi sebuah pesanan? Misalnya: Pesanan dibuat -> Dibayar Sebagian -> Ditambah Item -> Di-Void Sebagian -> Dilunasi.
*   **Opsi A (CRUD Biasa):** Database hanya menyimpan hasil akhir pesanan (Status: Lunas).
*   **Opsi B (Event Sourcing / Ledger):** Database mencatat setiap ketukan tombol kasir dalam tabel log riwayat secara berurutan.

**Pilihan/Jawaban Anda:**berikan saya opsi terbaik kamu beserta penjelasan rinci


### 77. Delta Syncing (Bencana Sinkronisasi Offline)
Sinyal kembali menyala, tablet kasir mencoba men-sync 500 transaksi offline ke server secara bersamaan.
*   **Opsi A (Bulk Insert):** Kirim 500 data sekaligus dalam 1 *request* JSON raksasa. (Risiko: Jika koneksi putus di tengah jalan, seluruh request gagal).
*   **Opsi B (Chunking / Queueing):** Kirim data per 10 baris. Jika gagal, coba lagi dari baris terakhir yang sukses.

**Pilihan/Jawaban Anda:**Opsi B (Chunking / Queueing)


### 78. Resolusi Konflik Tingkat Lanjut
Anda di rumah mengubah nama "Es Kopi" menjadi "Kopi Susu". Di detik yang sama, POS Kasir yang sedang *Offline* menjual "Es Kopi" tersebut. Saat tablet kasir online, apa yang terjadi pada struk transaksi tersebut?
*   **Opsi A:** Nama di struk berubah otomatis jadi "Kopi Susu" mengikuti Master Data terbaru.
*   **Opsi B:** Nama di struk tetap "Es Kopi" (karena nama *di-snapshot/di-copy* secara mentah saat transaksi terjadi).

**Pilihan/Jawaban Anda:**Opsi A


### 79. Saga Pattern (Kegagalan Microservice)
Pelanggan membayar via QRIS. API Midtrans berkata "BERHASIL", tapi saat sistem memotong stok gudang, ternyata database Gudang sedang *Down/Error*. 
*   **Opsi A:** Biarkan transaksi menggantung (Uang masuk, tapi stok tidak terpotong). Owner harus perbaiki manual besoknya.
*   **Opsi B (Compensating Transaction):** Sistem otomatis mengirim perintah pembatalan (Refund) ke Midtrans karena gagal memotong gudang.

**Pilihan/Jawaban Anda:***Opsi A: saya setuju opsi A tapi perbaiki manual yang kamu maksud seperti apa? berikan penjelasan rinci


### 80. Penyalahgunaan Multi-Login Kasir
Kasir membagikan PIN/Password miliknya ke temannya. Mereka login dari Tablet Warung dan dari HP Pribadi di rumah secara bersamaan.
*   **Opsi A (Single Device Enforcer):** Jika HP di rumah login, Tablet di warung otomatis *Logout* (terpental) seketika.
*   **Opsi B (Biarkan Multi-login):** Kasir bebas login di 5 HP sekaligus.

**Pilihan/Jawaban Anda:**Opsi A (Single Device Enforcer) = 1 pin kasir jika sedang login = hanya 1 akun yang bisa login jika ada yang mencoba login menggunakan perangkat lain sedangkan kasir sedang online/login, langsung tolak otomatis


### 81. Zero-Downtime Database Migration
Warung sedang sangat ramai. Anda sebagai *Developer* harus menambahkan kolom baru `customer_age` di tabel `Orders` siang itu juga.
*   **Opsi A:** Matikan server 5 menit (Maintenance Mode), kasir dipaksa offline sebentar, *Deploy*, nyalakan lagi.
*   **Opsi B:** Gunakan teknik *Zero-Downtime Migration* (Prisma Expand/Contract). Server tetap hidup, transaksi tetap masuk saat kolom ditambahkan.

**Pilihan/Jawaban Anda:**Opsi B: saya tidak akan menambahkan kolom baru `customer_age` di tabel `Orders` 


### 82. Pencurian Data Pelanggan (Data Leak)
Seorang kasir nakal yang kebetulan tahu password Manager mencoba men-download data (Nomor HP) 10.000 pelanggan dari Dashboard untuk dijual ke *Pinjaman Online*.
*   **Opsi A:** Biarkan saja (Sistem berasumsi Manager berhak melihat semua data).
*   **Opsi B (Rate Limiting Export + Alert):** Sistem membatasi export data maksimal 100 baris, jika lebih, butuh verifikasi OTP ke HP Owner.

**Pilihan/Jawaban Anda:**Opsi A , tidak logis kasir tau email + password admin. karena saya tidak share hal seperti itu kesembarangan orang


### 83. Hardware Printer Terputus di Tengah Jalan
Printer Bluetooth mencetak struk berisi 50 item menu. Tiba-tiba di item ke-10, kertas habis atau Bluetooth terputus.
*   **Opsi A:** Kasir harus memencet "Re-print" dan printer akan mencetak ulang dari awal item ke-1 sampai 50.
*   **Opsi B:** Aplikasi menyimpan *State* baris yang terpotong, lalu setelah kertas diisi, printer melanjutkan hanya dari item ke-11. (Sangat sulit di-*coding*).

**Pilihan/Jawaban Anda:**Opsi A


### 84. Race Condition Stok Terakhir (Flash Sale)
Sisa stok Nasi Goreng di database tinggal 1 porsi. Dua kasir di dua terminal berbeda memencet tombol "Bayar" secara bersamaan di detik dan milidetik yang sama.
*   **Opsi A:** Database kecolongan, stok menjadi -1 (Minus Satu) karena dua-duanya tembus. Dapur akan bingung.
*   **Opsi B (Pessimistic Locking):** Row database "Nasi Goreng" dikunci selama 0.1 detik oleh kasir 1. Kasir 2 akan mendapat pesan *Error: Barang kehabisan saat diproses*.

**Pilihan/Jawaban Anda:** sebenarnya opsi kamu berikan bagus hanya saja stok disetiap outlet berbeda-beda karena tergantung jumlah transaksinya hari itu. misal setiap kasir mendapatkan porsi bahan baku untuk dijual 50 porsi, ternyata kasir 1 sudah menghabiskan/terjual habis, sedangkan kasir 2 masih tersisa 20 porsi. dari sini kita bisa tau siapa yang jelas sudah sold out dan yang belum sold out.


### 85. Pencurian via Refund Kasir (The Keep & Steal)
Pelanggan komplain makanan basi, kasir mem-Void/Refund pesanan di sistem. Tapi kasir tidak mengembalikan uang tunai Rp 50.000 ke pelanggan tersebut (pelanggan sudah pergi). Kasir mengambil Rp 50.000 itu untuk masuk kantongnya sendiri, sementara di laporan uang laci sudah *Balance* (karena sistem mencatat uang itu keluar untuk Refund).
*   **Opsi A:** Sulit dideteksi. Andalkan rekaman CCTV fisik saja.
*   **Opsi B (SMS Konfirmasi Refund):** Saat Void terjadi, sistem otomatis mengirim SMS/WA ke pelanggan: *"Maaf pesanan Anda batal, apakah Anda sudah menerima uang kembali Rp 50.000?"*.

**Pilihan/Jawaban Anda:**Opsi A:


### 86. Idempotency pada Tombol VOID
Koneksi internet nge-lag. Kasir emosi dan memencet tombol "VOID ORDER" sebanyak 5 kali berturut-turut dengan cepat.
*   **Opsi A:** Sistem memproses 5 Void sekaligus, stok gudang bertambah 5x lipat dari yang seharusnya.
*   **Opsi B (Idempotent Key):** Backend menyadari itu adalah *Request Void* yang sama (berdasarkan ID Transaksi yang sama), dan hanya memprosesnya 1 kali saja.

**Pilihan/Jawaban Anda:**Opsi B (Idempotent Key)


### 87. Dynamic / Surge Pricing (Harga Jam Sibuk)
Anda mengatur jam 17:00 - 19:00 harga semua menu naik Rp 2.000. Pelanggan mulai mengantri jam 16:55. Kasir baru memproses pesanannya jam 17:02. Harga mana yang berlaku?
*   **Opsi A (Harga saat ditekan "Bayar"):** Pelanggan kena harga mahal (Rp 2.000 lebih tinggi) dan mungkin protes karena dia antri sebelum jam 17:00.
*   **Opsi B (Harga saat kasir membuat *Draft* keranjang):** Harga dikunci mengikuti waktu pertama kali barang dimasukkan ke keranjang (16:55), sehingga tetap harga murah.

**Pilihan/Jawaban Anda:** saya tidak akan mengubah harga ketika kasir bekerja dijam operasional bisa saya lihat didashboard sistem admin apakah ada kasir yang online atau tidak. saya akan update harga ketika mereka offline saja


### 88. HPP (COGS) Retroactive Changes
Supplier merevisi tagihan bulan lalu: Harga gula yang sudah Anda beli ternyata lebih mahal Rp 50.000 karena salah hitung.
*   **Opsi A:** Ubah HPP bulan lalu. Laporan Laba Rugi bulan lalu ikut berubah seketika.
*   **Opsi B (Jurnal Penyesuaian / Adjusting Entry):** Laporan bulan lalu dikunci permanen. Rp 50.000 dimasukkan sebagai pengeluaran tambahan (*Opex/Loss*) di bulan ini.

**Pilihan/Jawaban Anda:**Opsi B (Jurnal Penyesuaian / Adjusting Entry)


### 89. Gagal Sebagian pada Split Payment
Tagihan Rp 100.000. Pelanggan bayar pakai Poin Member (Rp 30.000) dan QRIS (Rp 70.000). Saat QRIS di-scan, sistem Midtrans *Error Time-Out*. Poin member telanjur terpotong di database.
*   **Opsi A (Auto-Revert):** Poin otomatis dikembalikan jika transaksi Midtrans tidak kunjung sukses dalam 10 menit.
*   **Opsi B (Manual CS):** Kasir harus melaporkan ke Superadmin untuk mengembalikan poin pelanggan secara manual via Dashboard.

**Pilihan/Jawaban Anda:**Opsi A (Auto-Revert)


### 90. Time Travel Exploit (Manipulasi Jam HP)
Kasir mengganti jam kalender di Tablet Android menjadi jam 23:00 untuk memicu Diskon "Midnight Sale" di siang bolong.
*   **Opsi A (Andalkan Jam Lokal/Tablet):** Sistem tertipu dan memberikan diskon.
*   **Opsi B (Validasi Server Time):** Meski jam di tablet menipu, saat memencet bayar, Server mengecek jam aslinya (UTC). Transaksi ditolak karena manipulasi jam.

**Pilihan/Jawaban Anda:**Opsi B (Validasi Server Time) jangan tolak transaksinya cukup gunakan waktu server atau WIB.


### 91. Sinkronisasi KDS (Kitchen Display System)
Anda memakai layar sentuh di Dapur. Kasir sudah "LUNAS", tapi WiFi di dapur tiba-tiba mati sesaat. Koki tidak melihat pesanan masuk.
*   **Opsi A (Fire and Forget):** Kasir menganggap tugasnya selesai. Koki kebingungan saat pelanggan menagih makanan.
*   **Opsi B (Acknowledge Ping):** POS kasir baru mau mencetak struk JIKA layar Dapur sudah merespons balik "Pesanan Diterima". Jika dapur Offline, layar kasir akan memperingatkan: "DAPUR OFFLINE, TERIAKKAN PESANAN MANUAL".

**Pilihan/Jawaban Anda:**saya tidak butuh fitur dapur karena kasir melihat sendiri pesanan customer dari struk yang diprint 2x ketika pembeli bayar lunas


### 92. Pencurian Uang Tip
Pelanggan memberikan uang Tip tunai Rp 10.000 ke kasir, tapi kasir memasukannya ke dalam Laci POS agar tidak hilang. Saat tutup shift, uang fisik di laci *Over* (lebih) Rp 10.000 dari angka di sistem.
*   **Opsi A:** Sistem mengklaim kelebihan uang itu sebagai *Other Income* milik Perusahaan. Kasir kehilangan Tip-nya.
*   **Opsi B:** Buat tombol "Input Tip Masuk Laci" di POS agar kasir bisa mencatat titipan uang pribadinya tanpa merusak neraca warung.

**Pilihan/Jawaban Anda:** biarkan saja TIP tersebut. intinya disistem balance, jika uang lebih biarkan saja bisa saya berikan kepada kasir kelebihan tersebut manual


### 93. API Key Hardcoding (Keteledoran Developer)
Anda menyewa Developer magang untuk membantu UI. Dia tidak sengaja mem-push *Midtrans Server Key* Anda secara *hardcoded* ke Github Publik.
*   **Opsi A (Secret Scanning):** Anda menggunakan Github Advanced Security yang otomatis menolak (block) *commit* jika mendeteksi ada teks yang bentuknya mirip API Key.
*   **Opsi B (Manual Review):** Berharap tidak ada *Hacker* yang men-scan Github Anda sebelum Anda menyadarinya.

**Pilihan/Jawaban Anda:**Opsi A (Secret Scanning) bantu saya apa saja yang tidak boleh dipush ke github


### 94. The Exit Strategy (Eksport Data Raksasa)
Suatu hari Anda menjual *Franchise/Sistem* POS ini ke Investor senilai Rp 10 Miliar. Mereka meminta *Dump* (Eksport) seluruh data transaksi 5 tahun terakhir (1 Juta baris) dalam bentuk format `.csv` yang rapi.
*   **Opsi A (Streaming Export):** Sistem membangun CSV sedikit demi sedikit (Streaming) agar RAM Server tidak meledak saat menarik 1 Juta baris.
*   **Opsi B:** Tarik semua data ke RAM, *convert* ke CSV. (Dijamin 100% Server Crash Out-of-Memory).

**Pilihan/Jawaban Anda:**Opsi A (Streaming Export)


### 95. The Zombie Cashier (Akses Mantan Pegawai)
Kasir sudah dipecat siang ini, namun token *Login/JWT* miliknya di HP Android-nya masih memiliki masa aktif (*expired*) 24 jam ke depan. Dia iseng mem-Void transaksi dari rumahnya malam harinya.
*   **Opsi A (Stateless JWT):** Sistem tidak bisa menolak selama token belum expired. Kasir berhasil mem-Void.
*   **Opsi B (Redis Blocklist / Session Revocation):** Saat dipecat di Dashboard, ID Kasir langsung dimasukkan ke daftar Hitam (*Blacklist*) di RAM Redis. Permintaan Void ditolak mentah-mentah meski Token masih valid.

**Pilihan/Jawaban Anda:**Opsi B (Redis Blocklist / Session Revocation) saya juga akan menghapus langsung akun/PIN nya disistem ketika dipecat


### 96. Fractional Tax Bracket (Pajak Pecahan)
Tiga item masing-masing seharga Rp 3.333,33. Total harga Rp 10.000. Jika dihitung PPN 11% secara total (11% x 10rb) = Rp 1.100. TAPI jika PPN dihitung per item (11% x Rp 3.333,33 = Rp 366.66). Dikalikan 3 item = Rp 1.099,98. Ada selisih Rp 0.02.
*   **Opsi A:** Hitung PPN dari Baris Total Akhir Keranjang (Lebih presisi untuk Akuntansi Negara).
*   **Opsi B:** Hitung PPN di masing-masing item, lalu dijumlahkan. (Mudah dikoding, tapi rawan selisih pembulatan).

**Pilihan/Jawaban Anda:**Opsi A, jangan masukan pajak ke struk pelanggan, cukup hitung di belakang layar 


### 97. Pendaftaran Member Offline Palsu
POS sedang Offline. Kasir Rina membuat "Member Baru" (Budi - 081122). Budi langsung belanja. Karena offline, DB lokal memberikan ID sementara (Misal: `temp_ID_1`). Kasir mencatatnya. Bagaimana nasib ID ini saat Online nanti?
*   **Opsi A (UUIDv4):** Sejak awal aplikasi (meski offline) menghasilkan ID Acak panjang (`123e4567-e89b-12d3...`) agar tidak akan pernah bentrok dengan ID dari server pusat saat *sync*.
*   **Opsi B (Auto-Increment Lokal):** Aplikasi membuat ID angka `1` atau `2`. Sangat dijamin akan bentrok / menimpa data member cabang lain saat *sync* ke server. *(Saran Mutlak: Gunakan UUID).*

**Pilihan/Jawaban Anda:**Opsi A (UUIDv4) mungkin ketika sudah terhubung kembali sistem dapat meekstraksi ID acak menjadi ID baru yang sesuai, tapi ingat untuk pendaftaran member dilakukan VIA form bukan manual kasir.


### 98. Serangan DDoS Internal (Virus di Tablet Kasir)
Tablet Android kasir tidak sengaja terinstall aplikasi malware. Malware tersebut secara diam-diam me- *spam* klik tombol "Cek Stok" 1000 kali per detik ke server VPS Anda.
*   **Opsi A:** VPS Anda *Down* karena dibombardir oleh perangkat Anda sendiri dari cabang.
*   **Opsi B (IP + JWT Rate Limiting):** Server cerdas membatasi setiap kasir (berdasarkan Token JWT-nya) maksimal hanya boleh mengirim 50 *Request* per menit. Malware akan terkena *Block* 429 Too Many Requests.

**Pilihan/Jawaban Anda:**Opsi B (IP + JWT Rate Limiting)maksimal hanya boleh mengirim 20 *Request* per menit/ 1 menit


### 99. The God Mode (Audit Superadmin)
Anda sebagai Owner memiliki akses tak terbatas. Anda mengubah HPP bahan baku di bulan lalu untuk menutupi kesalahan pajak. Apakah sistem harus melaporkan hal ini ke sistem audit pihak ketiga (Log eksternal) untuk menghindari penggelapan internal perusahaan (seperti skandal Enron)?
*   **Opsi A (Write-Only Immutable Log Eksternal):** Semua aksi Superadmin dikirim diam-diam ke log terpisah yang bahkan Superadmin tidak bisa menghapusnya (Misalnya: Datadog / AWS CloudWatch).
*   **Opsi B (Log di Database Sendiri):** Cukup catat di PostgreSQL. (Risikonya: Superadmin yang jago SQL bisa menghapus jejaknya sendiri).

**Pilihan/Jawaban Anda:**Opsi B (Log di Database Sendiri)


### 100. Discrepancy Shrinkage (Hantu Stok)
Sistem (Software) mengatakan sisa Beras = 10 Kg.
Sisa fisik di gudang dihitung manual = 8 Kg.
Kemana hilangnya 2 Kg tersebut? Apakah dimakan tikus (Waste) atau dicuri karyawan (Theft)?
*   **Opsi A (Input Langsung Penyesuaian Angka):** Anda langsung mengedit kolom stok dari 10 menjadi 8. Sistem kehilangan jejak.
*   **Opsi B (Fitur Stock Opname Terdedikasi):** Anda harus membuat dokumen *Stock Opname* resmi. Sistem akan memaksa Anda memilih alasan "Penyusutan" untuk 2 Kg tersebut, dan nilainya akan otomatis dikalkulasi sebagai kerugian di Laporan Rugi-Laba agar metrik bisnis Anda tetap imbang.

**Pilihan/Jawaban Anda:**Opsi B (Fitur Stock Opname Terdedikasi)
---

## III. ANALISA & JAWABAN DARI SENIOR ENGINEER (Atas Keraguan Anda)
Berdasarkan 10 keraguan/pertanyaan yang Anda ajukan sebelumnya, berikut adalah penjabaran Opsi beserta Saran dan Solusi Terbaik dari kacamata arsitektur skala Enterprise:

### 101. Penjelasan Grace Period Member (Follow-up Soal 29)
Jika server down seharian, masa aktif tier "Gold" pelanggan hangus tanpa kompensasi.
*   **Opsi A (Abaikan/Masa Bodoh):** Pelanggan gagal mendapat diskon keesokan harinya. (Hemat resource server, tapi berisiko komplain besar).
*   **Opsi B (Script Tambah Hari Otomatis):** Server otomatis menambah masa aktif +1 hari ke seluruh member saat server menyala kembali.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Biaya komplain dan pelanggan yang *churn* (pindah ke kompetitor) jauh lebih mahal daripada baris kode *cron-job* sederhana ini.

**Pilihan/Jawaban Anda:**Opsi B (Script Tambah Hari Otomatis)


### 102. Penjelasan Free Item Harga Rp 0 (Follow-up Soal 32)
Bagaimana mencatat barang gratisan secara akuntansi di sistem POS?
*   **Opsi A (Beban Marketing/Opex):** Barang diproses normal dengan harga asli, tapi biayanya otomatis dipotongkan ke Jurnal Opex (Biaya Marketing). Sangat presisi secara akuntansi murni, tapi luar biasa rumit dibuat.
*   **Opsi B (Diskon 100% / Harga Rp 0):** Barang diproses dengan Harga 0. Stok barang berkurang, tapi omzetnya 0. Laba Bersih otomatis berkurang secara alami mengikuti keluarnya HPP barang tersebut.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Skema database PRD Anda saat ini sudah sangat mendukung pendekatan ini, cepat dibuat dan cukup akurat secara bisnis F&B.

**Pilihan/Jawaban Anda:**Opsi B (Diskon 100% / Harga Rp 0)


### 103. Shift Kasir Buka Sampai Jam 02:00 Pagi (Follow-up Soal 39)
Bagaimana memutus dan menutup shift kasir jika warung beroperasi melewati pergantian hari (tengah malam)?
*   **Opsi A (Cut-off Kalender Jam 00:00):** Sistem memutus paksa transaksi tepat jam 23:59. Struk yang dicetak jam 00:01 masuk ke hari berikutnya. (Kaku dan membingungkan laporan harian warung).
*   **Opsi B (Idle Timeout / Max Duration):** Jangan gunakan jam kalender 00:00. Shift otomatis ditutup jika POS "menganggur" (tidak ada transaksi) selama 4 jam berturut-turut, atau telah mencapai batas maksimum 16 jam sejak kasir *login*.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Penjualan jam 01:00 Pagi tetap akan masuk ke Laporan Omzet Hari H-1 (mengikuti *business day* warung Anda).

**Pilihan/Jawaban Anda:**Opsi B (Idle Timeout / Max Duration)


### 104. Deteksi Fraud "Ghost Order" (Follow-up Soal 53)
Bagaimana cara sistem (Opsi B) mendeteksi Kasir yang mencetak struk tapi mengantongi uangnya?
*   **Opsi A (Void dengan PIN):** Cara konvensional. Kasir tidak bisa membatalkan/menghapus pesanan tanpa diketikkan PIN oleh Manager.
*   **Opsi B (Log Print Count + Anomaly Alert):** Sistem mencatat berapa kali printer mengeluarkan struk. Jika sebuah pesanan sudah pernah di-Print (Print Count = 1), namun di akhir hari pesanan tersebut dibatalkan (Clear Cart) oleh kasir, sistem menilainya sebagai "Anomali Uang Masuk Kantong" dan mengirim laporan email ke Owner.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Kasir bebas bergerak cepat melayani pelanggan tanpa harus teriak-teriak minta PIN Manager, namun pencurian uang 100% akan selalu ketahuan di laporan pagi hari Anda.

**Pilihan/Jawaban Anda:**Opsi B (Log Print Count + Anomaly Alert)


### 105. Biaya OTP Email untuk Superadmin (Follow-up Soal 60)
Apakah Anda perlu membayar biaya tambahan/layanan khusus untuk OTP Email?
*   **Opsi A (Layanan Email Berbayar AWS/Mailgun):** Sangat tangguh, namun Anda harus membayar biaya bulanan (sekitar $1 per 1000 email).
*   **Opsi B (Layanan Free-Tier Resend.com / SendGrid):** Menggunakan API gratis yang memberikan jatah 3.000 email per bulan (100 email per hari) selamanya tanpa bayar.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Kebutuhan OTP hanya untuk Owner dan Manager Cabang (Sangat sedikit). 3.000 email gratis per bulan sudah lebih dari cukup. Anda tidak perlu bayar sepeser pun.

**Pilihan/Jawaban Anda:**Opsi B (Layanan Free-Tier Resend.com / SendGrid) buat juga opsi matikan alert email ini di sistem admin karena terkadang saya lebih dominan liat dashboard admin.


### 106. Noisy Neighbor pada Shared Table (Follow-up Soal 62)
Kenapa harus repot membatasi filter tanggal pencarian di Database, padahal semua cabangnya milik Anda sendiri?
*   **Opsi A (Tanpa Batasan Filter):** Anda bisa iseng men-download laporan seluruh cabang selama 5 tahun ke belakang sekaligus lewat HP Anda. Akibatnya: CPU VPS melonjak 100%. Kasir yang saat itu sedang melayani pelanggan akan mengalami *Error/Timeout/Lag* karena Server sibuk melayani *request* Anda.
*   **Opsi B (Filter Tanggal Ketat Maksimal 30 Hari):** Dashboard mencegah tarikan data raksasa di UI utama. 
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Jika Anda butuh men-download data 5 tahun, sistem harus diarahkan memakai fitur *Background Task* (seperti ekspor ke CSV lambat di latar belakang), agar Server Kasir Utama tetap ringan 60fps setiap saat.

**Pilihan/Jawaban Anda:**Opsi B (Filter Tanggal Ketat Maksimal 30 Hari)


### 107. Algoritma Employee Sweet-Hearting (Follow-up Soal 66)
Bagaimana mencegah Kasir menscan Nomor HP Member miliknya sendiri ke semua pelanggan cash?
*   **Opsi A (Validasi Manual / Audit Mata):** Anda selaku Owner memelototi laporan "Top Member" setiap bulan dan menebak-nebak mana yang mencurigakan.
*   **Opsi B (Rate Limiting per ID):** Sistem cerdas di NestJS otomatis memblokir nomor member yang terdeteksi berbelanja lebih dari 3x dalam 1 shift. Nomor tersebut tidak akan mendapat poin lagi hari itu, dan ditandai merah (*flagged*) di Dashboard Superadmin.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Mengamankan stok hadiah/poin Anda dari "Pencurian Halus" tanpa perlu menambah *workload* pengecekan manual Anda.

**Pilihan/Jawaban Anda:**Opsi B (Rate Limiting per ID)


### 108. Kebijakan Redis Eviction (Follow-up Soal 13)
Apa bedanya parameter `noeviction` dan `volatile-lru` di Redis saat memori RAM penuh?
*   **Opsi A (`noeviction`):** Jika penuh, Redis menolak semua data baru. **Efek:** Kasir baru gagal *login*, transaksi macet total, sistem lumpuh.
*   **Opsi B (`volatile-lru`):** Jika penuh, Redis akan secara otomatis menghapus data "sampah sementara" (misal: *Cache Menu Makanan*) demi mengosongkan ruang agar kasir bisa login dan transaksi (*Session*) tetap hidup.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B (`volatile-lru`)**. Ini adalah sabuk pengaman yang memastikan operasional lapangan warung Anda tidak akan pernah lumpuh secara mendadak.

**Pilihan/Jawaban Anda:**Opsi B (`volatile-lru`)


### 109. Endpoint Health Check Docker (Follow-up Soal 14)
Kenapa Docker butuh rute khusus untuk mengecek apakah aplikasi masih hidup?
*   **Opsi A (Pengecekan lewat API Publik `/health`):** Rute publik diawasi oleh modul Keamanan Anti-Spam (Rate Limiting). Karena Docker nge-ping setiap 30 detik, Docker bisa dianggap sebagai *Spammer* dan diblokir oleh aplikasinya sendiri! Lalu Docker mengira aplikasinya mati dan me-*restart* Server Anda sia-sia.
*   **Opsi B (Buat Rute VIP `/health-internal`):** Membuat pintu belakang khusus yang tidak dipasangi alat *Anti-Spam*, eksklusif hanya untuk di-cek oleh Docker.
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi B**. Praktik wajib untuk *Containerized App* agar VPS Anda sangat stabil dan tidak *restart-looping*.

**Pilihan/Jawaban Anda:**Opsi B (Buat Rute VIP `/health-internal`)


### 110. Perhitungan PPN 11% Tax Inclusive (Follow-up Soal 26)
Bagaimana rumus matematika sistem memecah harga yang sudah termasuk PPN?
*   **Opsi A (Ekstrak PPN Otomatis dari Harga Jual):** Harga Es Teh di menu Rp 11.100. Pelanggan bayar Rp 11.100. Di balik layar, sistem membelahnya menjadi: **Omzet Asli Perusahaan = Rp 10.000**, dan **Titipan Pajak Negara = Rp 1.100**. Pembagian Bonus/Profit Kasir 40% HANYA dihitung dari Omzet Asli (Rp 10.000).
*   **Opsi B (Abaikan PPN):** Laporan Omzet tercatat kotor Rp 11.100. Kasir menuntut bonus 40% dari angka tersebut (meskipun sebagian uang itu nantinya milik negara).
    *   **Rekomendasi Senior Engineer:** **Gunakan Opsi A**. Wajib dirancang dari hari pertama agar ketika bisnis Anda resmi menjadi PKP (Pengusaha Kena Pajak), Anda tidak *collapse* karena membayari pajak dari kantong pribadi.

**Pilihan/Jawaban Anda:**Opsi A (Ekstrak PPN Otomatis dari Harga Jual), untuk mekanisme pajak ini saya ingin pembulatan angka nya diangka RP.500 paling kecil karena mengembalikan uang RP.100,RP.200 cukup membuat kasir kesusahan. saya menghindari uang pecah/ kembalian dibawah 500 rupiah 

---




---
---
*Selesai! 100 Pertanyaan Arsitektur Tingkat Dewa. Jika sistem POS Anda bisa menjawab dan menangani sebagian besar studi kasus ini, Anda benar-benar sedang membangun Mahakarya Software yang siap digunakan oleh Ribuan Cabang!*

## L. KLARIFIKASI FINAL DARI SENIOR ENGINEER (Follow-up Ronde 3)
Berikut adalah penjelasan untuk 4 poin yang Anda tanyakan kembali di Ronde 3. Silakan berikan konfirmasi atau jawaban akhir Anda:

### 111. Penjelasan Soal 76 (Event Sourcing vs CRUD)
Anda meminta opsi terbaik. **Saran Terbaik:** Gunakan **CRUD Biasa** (Opsi A).
*Penjelasan:* *Event Sourcing* itu seperti buku tabungan Bank (menyimpan riwayat setiap detik perubahan uang). Ini membuat *database* raksasa dan rumit. Untuk aplikasi POS, kita hanya butuh hasil akhir pesanan (Status Lunas/Batal). Pendekatan CRUD (memperbarui data secara langsung) jauh lebih ringan, cepat, dan masuk akal untuk warung/franchise.

**Pilihan/Jawaban Anda:** saya setuju


### 112. Penjelasan "Perbaiki Manual" di Soal 79 (Saga Pattern)
Anda meminta penjelasan tentang perbaikan manual di Opsi A.
*Penjelasan:* Pelanggan *scan* QRIS dan uangnya terpotong. Midtrans melempar sinyal ke server Anda. Tiba-tiba server *database* Anda putus sedetik, sehingga sistem gagal memotong stok gudang dan struk tidak keluar. Di layar kasir tertulis "Gagal". Pelanggan akan marah karena uangnya sudah terpotong. **"Perbaiki Manual"** berarti Anda (Owner) harus membuka aplikasi *dashboard Midtrans* di HP Anda, mencari transaksi tersebut, lalu menekan tombol **"Refund"** secara manual agar uangnya dikembalikan oleh sistem bank ke pelanggan.

**Pilihan/Jawaban Anda:** sepertinya ini sedikit ambigu, bagaimana jika uang costumer sudah terbayar dari layar HPnya maka kasir langsung saja membuatkan pesanannya. tapi jadikan pesanan pelanggan notif/alert/ ditandai karena anomali karena kesalahan database/jaringan. bagaimana saran saya? apakah masuk akal?


### 113. Daftar File yang "HARAM" Di-Push ke GitHub (Follow-up Soal 93)
Anda meminta bantuan apa saja yang tidak boleh di-push. Agar sistem Anda aman dari peretas, **jangan pernah** mem-push hal berikut ke repositori GitHub Publik:
1. File `.env` (Semua file yang mengandung kata `.env`).
2. **Midtrans Server Key** dan **Client Key**.
3. **JWT Secret Key** (Kunci rahasia untuk membuat token kasir).
4. Password dan *Connection String* database PostgreSQL/Redis.
5. *Private Keys* (.pem / .ppk / ssh keys) untuk masuk ke VPS Anda.

**Pilihan/Jawaban Anda:** saya paham


### 114. Logika Pembulatan Rp 500 (Follow-up Soal 110)
Ide Anda soal pembulatan ke kelipatan Rp 500 terdekat (*Rounding to nearest 500*) ini sangat jenius secara operasional. Nantinya, sistem akan menghitung harga barang + pajak di belakang layar (Misal: Total = Rp 14.150). Sistem akan secara otomatis membulatkannya menjadi Rp 14.000 atau Rp 14.500 sebelum muncul di QRIS / layar kasir, agar kasir tidak pusing mencari uang kembalian receh. 
*Apakah Anda setuju logika pembulatan otomatis ini diterapkan sebagai standar mutlak di backend?*

**Pilihan/Jawaban Anda:** ya saya setuju, jangan lupa logic programnya


---
*Setelah Anda menjawab bagian L ini, sistem POS Ngemiloh benar-benar 100% siap dieksekusi tanpa ada satupun celah abu-abu yang tersisa!*

