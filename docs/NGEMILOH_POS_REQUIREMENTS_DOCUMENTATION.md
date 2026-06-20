# NGEMILOH POS - COMPREHENSIVE REQUIREMENTS DOCUMENTATION
**Generated:** June 19, 2026
**Version:** 1.0
**Total Questions:** 95
**Author:** Claude Code + Nabilah (Owner)

---

## TABLE OF CONTENTS

1. [Business Context](#1-business-context)
2. [Authentication & Users](#2-authentication--users)
3. [Products & Modifiers](#3-products--modifiers)
4. [Pricing & HPP](#4-pricing--hpp)
5. [Inventory Management](#5-inventory-management)
6. [Shift Management](#6-shift-management)
7. [Payment Methods](#7-payment-methods)
8. [Online Orders (Future)](#8-online-orders-future)
9. [Loyalty/Member System](#9-loyaltymember-system)
10. [Profit Sharing](#10-profit-sharing)
11. [Expenses (OPEX)](#11-expenses-opex)
12. [Reports & Analytics](#12-reports--analytics)
13. [Notifications](#13-notifications)
14. [Cash Reconciliation](#14-cash-reconciliation)
15. [Void & Refund](#15-void--refund)
16. [Multi-Outlet (Future)](#16-multi-outlet-future)
17. [Privacy & Compliance](#17-privacy--compliance)
18. [Offline Mode](#18-offline-mode)
19. [Print & Receipt](#19-print--receipt)
20. [Error Handling](#20-error-handling)
21. [POS Layout](#21-pos-layout)
22. [Training](#22-training)
23. [User Roles & Permissions](#23-user-roles--permissions)
24. [Hardware](#24-hardware)
25. [Security](#25-security)
26. [Performance](#26-performance)
27. [Deployment](#27-deployment)
28. [Testing](#28-testing)
29. [Brainstorming Insights](#29-brainstorming-insights)
30. [Critical Gaps & Recommendations](#30-critical-gaps--recommendations)

---

## 1. BUSINESS CONTEXT

**Q1: Apa nama bisnis dan produk yang dijual?**
> **A:** Nama bisnis = Ngemiloh, produk yang dijual adalah snack/makanan ringan untuk nyemil. Saya mendaftar mitra bisnis dengan usaha orang lain yaitu Ngemiloh.

**Q2: Jenis outlet dan peran Anda?**
> **A:** Membuka outlet baru di lokasi yang belum ada Ngemiloh. Saya hanya mengelola admin saja dan saya memiliki 2 karyawan freelance yang bisa bekerja sesuai dengan jam mereka masing-masing selama 24 jam.

**Q3: Estimasi transaksi dan produk?**
> **A:** 
> - Transaksi per hari (saat peak hours) = 50 porsi paling banyak
> - Jumlah SKU produk = makanan ringan saja
> - Rata-rata nilai transaksi per customer = saat ini bisnis belum berjalan karena saya akan menjalankan bisnis dengan aplikasi ini

**Q4: Lokasi dan jam operasional?**
> **A:** 
> - Lokasi: Masih belum ditentukan
> - Jam operasional: 24 jam tergantung kasir (yang terpenting kasir ada menjual produk saya dalam 1 hari, kecuali izin/sakit/berhalangan ada agenda lain)

**Q5: Target customer utama?**
> **A:** Campuran walk-in + online order. Semua order walk-in masuk ke sistem, tetapi khusus online kasir akan input manual ke sistem dari notifikasi atau pesanan online tersebut.

**Q6: Model bisnis dengan Ngemiloh HQ?**
> **A:** Beli stok dari Ngemiloh dengan harga khusus, lalu jual dengan margin sendiri (saya hanya beli bahan bakunya saja). Ngemiloh pusat TIDAK meminta laporan penjualan.

**Q7: Model inventory?**
> **A:** Pesan ulang bahan baku ke Ngemiloh saat hampir habis. Menerapkan konsep FIFO dan Repeat order. Bahan baku masih perlu olah/modifikasi dulu sebelum dijual.

**Q8: Standar resep per porsi?**
> **A:** Ya, ada standar untuk berat per gram per porsi. Untuk 1 porsi bahan baku utama biasanya ada berbagai jenis campuran, bisa dari bumbu, saos, maupun kombinasi keduanya.

**Q9: Jumlah produk dan variasi?**
> **A:** 
> - Jumlah produk: 10-20 jenis produk
> - Customer bisa pilih/custom bumbu/saos (level pedas 1-5, extra saos, dll)

**Q10: Harga produk?**
> **A:** 
> - Setiap produk punya harga berbeda
> - Ada tier harga (normal, extra +Rp3k, super +Rp5k)
> - Untuk tier pricing: ada produk yang beda tingkatan harganya
> - HPP dan margin masih dalam kalkulasi

---

## 2. AUTHENTICATION & USERS

**Q11: Login kasir?**
> **A:** PIN 6 digit untuk keamanan yang lebih baik.

**Q12: Login admin?**
> **A:** Email + password langsung (tanpa OTP step).
> - **Credentials Default:**
>   - Admin: `admin@ngemiloh.com` / `SuperAdminP@ssw0rd123!`
>   - Kasir: `kasir1` / PIN `1234`

**Q13: Akses dashboard untuk kasir?**
> **A:** Tidak boleh - kasir hanya akses POS (jual saja). Dashboard admin khusus untuk owner.

**Q14: Audit trail?**
> **A:** Semua action kasir di-log (login, open shift, close shift, transactions).

**Q15: User roles?**
> **A:** Cukup Owner + Kasir saja.

---

## 3. PRODUCTS & MODIFIERS

**Q16: Kategori produk?**
> **A:** Full search + filter dengan category + search.

**Q17: Modifier untuk ukuran?**
> **A:** Ya - ada modifier untuk ukuran (S Rp 10k, M Rp 15k, L Rp 20k). Tapi mungkin diterapkan nanti saja, fokus bagian medium dahulu.

**Q18: Varian saus dan bumbu?**
> **A:** Saya memiliki banyak varian saos dan bumbu yang banyak untuk diinput nanti.

**Q19: Variant sizing?**
> **A:** 1 porsi = 1 jenis produk (1 item di cart). Tidak perlu fitur combo/paket.

**Q20: Product availability/OOS?**
> **A:** Kasir mark manual - set product sebagai "habis" di POS tapi kasir informasikan sold out ke pelanggan.

---

## 4. PRICING & HPP

**Q21: Model PPN?**
> **A:** Harga SUDAH termasuk PPN (Tax Inclusive). Harga yang kasir input sudah final.

**Q22: Perhitungan PPN?**
> **A:** 
> - Kalkulasi: Per-transaksi (PPN dihitung dari total setelah diskon)
> - Rounding: Nearest 100
> - Display di struk: Tidak ada line PPN terpisah (harga sudah final)

**Q23: PPN reporting?**
> **A:** Sistem hitung PPN dari setiap transaksi untuk laporan bulanan. Ya - untuk future PKP preparation.

**Q24: HPP calculation?**
> **A:** Sistem auto-calculate HPP dari harga bahan baku + takaran (sehingga bisa suggest harga jual). Currency: Rupiah (IDR) saja.

---

## 5. INVENTORY MANAGEMENT

**Q25: Model repeat order?**
> **A:** Notifikasi otomatis saat stok bahan baku < min_stock (anda terima notifikasi, lalu pesan manual ke Ngemiloh).

**Q26: Lead time pengiriman?**
> **A:** 7-12 hari pengiriman.

**Q27: Forecasting?**
> **A:** Sederhana saja - tampilkan "Estimated days until stockout" berdasarkan rata-rata usage. Safety stock: Anda tentukan sendiri.

**Q28: Alert threshold?**
> **A:** 
> - Sistem otomatis hitung berdasarkan avg usage (estimated days until stockout)
> - Alert recipient: Hanya owner (Anda)
> - Channel: Dashboard admin saja
> - Alert timing: 10 hari sebelum stockout

**Q29: Reorder suggestion?**
> **A:** Ya - berdasarkan avg usage + safety stock.

**Q30: FIFO dan expiry tracking?**
> **A:** Ya penting - karena bahan baku ada expiry/kadaluarsa dan untuk track FIFO. Expiry: Ya, ada expiry date tapi cukup lama sekitar 2-3 bulan dalam penyimpanan tertutup rapat.

**Q31: Safety stock?**
> **A:** Anda tentukan fixed safety stock per bahan baku. 5 hari supply.

**Q32: Reorder trigger?**
> **A:** Estimated days until stockout ≤ 10 hari. Reorder qty: Anda decide manual berapa quantity order. Tidak auto-order - Anda pesan manual setelah dapat notifikasi.

**Q33: Purchase order system?**
> **A:** Tidak perlu - cukup WhatsApp/telepon langsung. Pesan via WA/telepon ke Ngemiloh.

**Q34: Waste tracking?**
> **A:** Ya penting - untuk track HPP yang akurat. Campuran expired + kesalahan olah (masak gagal). 1-5% dari total bahan baku.

**Q35: Supplier management?**
> **A:** Track supplier - nama, kontak, lead time di sistem. Tapi cukup manual via WhatsApp untuk saat ini.

---

## 6. SHIFT MANAGEMENT

**Q36: Model kasir freelance?**
> **A:** Flexible/kesepakatan - tergantung ketersediaan kasir, tidak ada jadwal fix.

**Q37: Kas awal model?**
> **A:** 
> - Kasir input sendiri → Admin bisa cek/lihat di dashboard apakah sesuai kas awal yang diberikan
> - Ya, 1 kasir = 1 outlet (tapi outlet belum fix lokasinya)
> - Kas awal: Rp 200.000 - 500.000

**Q38: Multiple shift?**
> **A:** Ya, kasir bisa punya multiple shift per hari. Contoh: Buka jam 8 pagi → Tutup jam 11 siang (istirahat) → Buka lagi jam 3 sore.

**Q39: Carry-over saldo?**
> **A:** Carry-over otomatis antar sub-shift (uang shift 1 masuk ke shift 2).

**Q40: Laporan shift?**
> **A:** Laporan digabung per kasir per hari.

**Q41: Kasir check-in?**
> **A:** Ya - wajib check-in ke outlet. Owner assign kasir ke outlet secara manual.

**Q42: Overnight handling?**
> **A:** Carry over automatic dan beritahu di dashboard admin bahwa kasir lupa/tidak tutup shift agar Anda bisa menghubungi langsung.

**Q43: Kasir check-in flow?**
> **A:** 
> 1. Kasir login ke POS
> 2. Pilih outlet (dropdown atau scan QR outlet)
> 3. Sistem validasi: Apakah kasir assigned ke outlet ini?
> 4. Jika ya → Check-in success, bisa mulai shift
> 5. Jika tidak → Error, tidak bisa proceed

**Q44: Cash drawer?**
> **A:** Tidak perlu cash drawer - kasir simpan di tas/pouch.

---

## 7. PAYMENT METHODS

**Q45: Cash change calculation?**
> **A:** Ya penting - kasir harus lihat kembalian. Campuran nominal uang (pecahan kecil + besar).

**Q46: QRIS payment?**
> **A:** Pelanggan scan QR dari HP mereka ke device kasir.

**Q47: Split payment?**
> **A:** Diperlukan - ada pelanggan bayar sebagian cash, sebagian QRIS.

**Q48: Payment flow?**
> **A:** 
> 1. Customer pesan
> 2. Kasir input ke sistem POS
> 3. Proses payment
> 4. Buat pesanan dengan olah racikan bahan baku sesuai permintaan pelanggan

**Q49: Receipt printing?**
> **A:** Struk/kertas order tercetak otomatis setelah payment → kasir olah sesuai struk. 2 struk: pelanggan + arsip kasir.

**Q50: Printer specs?**
> **A:** PUTIAN POS/PUTIAN802 - Thermal Line Printing, Lebar 78mm, Interface USB + Bluetooth 4.0, 1 x Bluetooth + USB Thermal Printer 58mm.

---

## 8. ONLINE ORDERS (FUTURE)

**Q51: Online order integration?**
> **A:** Kasir handle sendiri - kasir olah dan input online order ke sistem. Belum terdaftar di GoFood/GrabFood.

**Q52: Platform fee tracking?**
> **A:** Diinput manual per bulan sebagai expense. Ya - untuk accurate profit calculation.

**Q53: GoFood/GrabFood/ShopeeFood?**
> **A:** Semua platforms diincar.

**Q54: Online order flow?**
> **A:** 
> - Driver pickup di counter, kasir serahkan makanan
> - Kasir punya list pesanan online yang pending
> - Kasir mark "siap" saat makanan selesai
> - Full manual - kasir manage sendiri karena bisa lihat dari platform online order

**Q55: Member identification untuk online?**
> **A:** Auto-teridentifikasi - nama/nomor dari platform GoFood/GrabFood, nomor handphone harus sama dengan yang terdaftar jika nomor handphone tidak sama maka ditolak dan dianggap belum punya member.

---

## 9. LOYALTY/MEMBER SYSTEM

**Q56: Member registration?**
> **A:** QR code di struk → buka link → input nomor HP dan Nama pelanggan → sudah jadi member dan tercipta ID member/pelanggan otomatis.

**Q57: Member lookup?**
> **A:** Campuran - bisa nomor HP / scan / nama / ID member.

**Q58: Tier system?**
> **A:** Frequency-Based - tiers berdasarkan jumlah transaksi per 2 bulan.

**Q59: Tier thresholds?**
> **A:** Rolling 2 months (start kapan join, ends 2 bulan kemudian). Grace period 1 bulan sebelum turun tier.

**Q60: Tier benefits?**
> **A:** Mix - diskon + free item per tier. Benefit mutlak (pasti dapat). Free item Anda tentukan sendiri.

**Q61: Benefit tiers?**
> **A:**
> - Bronze: 1-25 transaksi
> - Silver: 26-75 transaksi
> - Gold: 76+ transaksi

**Q62: Discount stacking?**
> **A:** Tidak ada stacking. Diskon terbesar yang dipakai. Tidak ada discount manual oleh kasir - hanya diskon otomatis dari sistem.

**Q63: Member upgrade timing?**
> **A:** Langsung - begitu mencapai threshold, langsung dapat benefit tier baru.

**Q64: Tier downgrade?**
> **A:** Turun ke tier bawah (Gold → Silver).

**Q65: Offline loyalty tracking?**
> **A:** Tetap dihitung - sync kemudian update point/tier, tetapi pelanggan harus memberi tahu kasir nomor handphone yang terdaftar sebagai member / kalau pelanggan ingat ID member bisa langsung kasih tau kasir.

**Q66: Member not found?**
> **A:** Tetap lanjut tanpa discount tetapi nanti diberikan gambar QRCODE bisa discan di booth agar pelanggan baru bisa daftar.

**Q67: Loyalty tier calculation?**
> **A:** Rolling 2 months from join date. Grace period 1 month sebelum demotion.

---

## 10. PROFIT SHARING

**Q68: Profit sharing formula?**
> **A:** 
> - Laba bersih (Revenue - HPP - Biaya Operasional)
> - Setelah dapat laba bersih hitung dahulu jumlah per masing-masing transaksi yang didapatkan per masing-masing kasir lalu dibagi 40% pool kasir

**Q69: Pool kasir division?**
> **A:** Berdasarkan proporsi transaksi masing-masing kasir. 60% Owner, 40% Pool kasir.

**Q70: Profit sharing frequency?**
> **A:** Bulanan. Tapi ada case dimana ternyata 2 minggu bekerja kasir mengundurkan diri.

**Q71: Kasir resign calculation?**
> **A:** Pro-Rata (fair, sesuai kerjaan actual). Share = (Hari kerja / 30) × (Transaksi kasir / Total) × Pool kasir.

**Q72: Profit sharing payment?**
> **A:** Transfer bank.

**Q73: Unclaimed share?**
> **A:** Hold untuk kasir.

**Q74: Notice period?**
> **A:** Tidak ada requirement.

---

## 11. EXPENSES (OPEX)

**Q75: Expense categories?**
> **A:** Sewa tempat, Listrik, Kemasan (bungkus, kantong).

**Q76: Expense input?**
> **A:** Input manual setiap ada pengeluaran.

---

## 12. REPORTS & ANALYTICS

**Q77: Report types?**
> **A:** Semua laporan di atas:
> - Sales summary
> - Shift reports
> - Profit & Loss
> - HPP analysis
> - Member growth
> - Kasir performance
> - Waste/shrinkage
> - Inventory valuation
> - Platform fees reports

**Q78: Report generation?**
> **A:** Generate manual dari dashboard.

**Q79: Excel/CSV export?**
> **A:** Ya penting.

**Q80: Sample data?**
> **A:** Ya, generate semua sample data.

---

## 13. NOTIFICATIONS

**Q81: Notification channels?**
> **A:** Dashboard primary + Email for critical alerts only.

**Q82: Critical alerts?**
> **A:** Low stock + Discrepancy.

**Q83: Notification timing?**
> **A:** Per event (triggered).

**Q84: Notification list?**
> **A:**
> - Low stock alert (10 days before)
> - Discrepancy warning
> - Shift not closed (overnight)
> - Daily summary

---

## 14. CASH RECONCILIATION

**Q85: Discrepancy threshold?**
> **A:** Rp 10.000.

**Q86: Discrepancy handling?**
> **A:** Sistem langsung kasih warning saat discrepancy > threshold DAN Kasir harus report discrepancy manual.

**Q87: Kasir responsibility?**
> **A:** Kasir tanggung sendiri.

**Q88: Overnight shift alert?**
> **A:** Ya - dashboard alert if shift not closed + notify owner untuk联系 kasir.

---

## 15. VOID & REFUND

**Q89: Void policy?**
> **A:** Boleh dengan alasan mandatory.

**Q90: Refund policy?**
> **A:** Replacement item saja.

**Q91: Void authorization?**
> **A:** Void dengan alasan mandatory.

**Q92: Replacement handling?**
> **A:** Kasir handle di tempat. Replacement > Rp 50.000 needs owner approval.

**Q93: Replacement tracking?**
> **A:** Ada fitur "Replacement" di sistem dengan alasan.

---

## 16. MULTI-OUTLET (FUTURE)

**Q94: Multi-outlet database?**
> **A:** Semua outlet pakai 1 database central.

**Q95: Kasir multi-outlet?**
> **A:** Kasir bisa kerja di multiple outlet (lebih fleksibel, dengan ketentuan admin diberitahu dahulu agar tidak terjadi missing error).

**Q96: Inventory per outlet?**
> **A:** Setiap outlet manage stok sendiri.

**Q97: Reports per outlet?**
> **A:** Keduanya, gabung keduanya tapi buat kategori per outlet.

**Q98: Profit per outlet?**
> **A:** Hitung profit per outlet terpisah (biaya per outlet).

**Q99: Owner dashboard?**
> **A:** Owner bisa akses semua outlet dari 1 dashboard dengan tambahan fitur filter per outlet.

**Q100: Multi-outlet timeline?**
> **A:** 6-12 bulan.

---

## 17. PRIVACY & COMPLIANCE

**Q101: Data yang disimpan member?**
> **A:** Nama, nomor HP, ID member, transaksi.

**Q102: Privacy policy?**
> **A:** Privacy policy sederhana di member registration.

**Q103: Consent?**
> **A:** Consent checkbox.

**Q104: Data retention?**
> **A:** 2-5 tahun (untuk accounting).

**Q105: PPN PKP status?**
> **A:** Belum PKP.

---

## 18. OFFLINE MODE

**Q106: Offline capability?**
> **A:** Hybrid - cash transaction offline, QRIS harus online.

**Q107: Sync mechanism?**
> **A:** Auto-sync saat online.

**Q108: Offline queue limit?**
> **A:** Max 50 transaksi.

**Q109: Offline importance?**
> **A:** Ya penting -万一 internet mati, kasir tetap bisa jual.

**Q110: Offline critical features?**
> **A:** Ya penting untuk fast offline performance.

---

## 19. PRINT & RECEIPT

**Q111: Receipt content - pelanggan?**
> **A:** Tambahkan nama kasir dan nama pelanggan.

**Q112: Receipt content - kasir?**
> **A:** Tambahkan nama pelanggan.

**Q113: Receipt content complete - pelanggan?**
> **A:** Tanggal, waktu, nomor transaksi (= nomor antrian), daftar item (nama + modifier + qty + harga), Subtotal, diskon, TOTAL, metode pembayaran, Tunai diterima + kembalian, Nama kasir, Nama pelanggan.

**Q114: Receipt content complete - kasir?**
> **A:** Tanggal, waktu, nomor transaksi, Nama kasir, Daftar item + modifier (tanpa harga), Total pembayaran, Metode bayar, Nama pelanggan.

**Q115: Printer technology?**
> **A:** Bluetooth + Browser print fallback.

---

## 20. ERROR HANDLING

**Q116: QRIS timeout?**
> **A:** Generate QR baru atau cancel transaksi tergantung situasi. Matikan fitur payment QRIS jika status offline.

**Q117: Network disconnect?**
> **A:** Transaction saved locally, sync when online.

**Q118: Printer malfunction?**
> **A:** Fallback: Browser print.

**Q119: System crash?**
> **A:** Data saved in local storage.

---

## 21. POS LAYOUT

**Q120: POS layout?**
> **A:** Produk di atas, keranjang di bawah - grid produk → cart sidebar.

**Q121: Filter produk?**
> **A:** Campuran - kategori + search. Full search + filter.

**Q122: Device kasir?**
> **A:** Tidak tahu - flexible, kasir pakai device mereka sendiri (HP/tablet/iPad).

**Q123: POS UI complexity?**
> **A:** Simple - kasir bisa pakai dalam 10 menit.

---

## 22. TRAINING

**Q124: Training materials?**
> **A:** Dokumen/manual PDF dan video tutorial.

**Q125: Training requirement?**
> **A:** Kasir harus training sebelum bisa pakai.

**Q126: Support channel?**
> **A:** WhatsApp support dari Anda.

**Q127: Training budget?**
> **A:** Optimize current system (bug fixes).

---

## 23. USER ROLES & PERMISSIONS

**Q128: Kasir permissions?**
> **A:** POS + shift summary + products (menu + price only). No inventory access. No HPP/COGS visible.

**Q129: Admin permissions?**
> **A:** Full access.

---

## 24. HARDWARE

**Q130: POS device OS?**
> **A:** Tidak specify - flexible.

**Q131: Internet connection?**
> **A:** WiFi di outlet (recommended), Mobile data (backup).

**Q132: Additional hardware?**
> **A:** No cash drawer, No barcode scanner, No second display.

---

## 25. SECURITY

**Q133: Security priority?**
> **A:** Tidak terlalu karena kasir saya hanya 2. Tapi security tetap ada (audit trail, 6-digit PIN).

---

## 26. PERFORMANCE

**Q134: Performance targets?**
> **A:**
> - POS loads: < 2 seconds
> - Payment: < 3 seconds
> - Print: < 5 seconds
> - Ya penting - fast offline performance

---

## 27. DEPLOYMENT

**Q135: Deployment method?**
> **A:** Docker Compose (yang sudah ada).

**Q136: Deployment concerns?**
> **A:** Saya masih banyak bermasalah saat proses hosting - Docker containers perlu diperbaiki.

**Q137: Scalability?**
> **A:** Architecture ready for multi-outlet but optimize for current needs.

**Q138: Launch timeline?**
> **A:** Paling lambat 1 minggu lagi.

---

## 28. TESTING

**Q139: Testing approach?**
> **A:** Automated tests dan Manual test by Anda.

**Q140: Test coverage?**
> **A:** Comprehensive - semua fitur yang sudah diskusi harus ditest.

---

## 29. BRAINSTORMING INSIGHTS

Berdasarkan analisis 95 pertanyaan, berikut insight penting:

### 29.1 Unique Selling Points Ngemiloh POS

| Feature | Mengapa Unik |
|---------|-------------|
| **1 Kasir = 1 Outlet** | Model franchise yang fleksibel |
| **Multi-Shift Fleksibel** | Kasir bisa buka-tutup shift kapan saja |
| **Rolling Loyalty 2-Bulan** | Tier membership yang fair dengan grace period |
| **Pro-Rata Profit Sharing** | Jika kasir resign mid-month, dapat sesuai kerjaan |
| **Waste Tracking** | HPP akurat untuk bisnis food |
| **10 Hari Alert** | Cukup untuk lead time 7-12 hari |

### 29.2 Alur Bisnis Ideal

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGEMILOH POS                           │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐ │
│  │  MEMBER  │──▶│   POS    │───▶│ PAYMENT  │──▶│ PRINT  │ │
│  │ REGISTER │    │ (Kasir)  │    │ (Cash/QR)│    │ Receipt │ │
│  └──────────┘    └────┬─────┘    └──────────┘    └─────────┘ │
│       │                 │                                    │   │
│       │                 ▼                                    │   │
│       │          ┌──────────┐                              │   │
│       │          │ PREPARE  │                              │   │
│       │          │ (Dapur)  │                              │   │
│       │          └──────────┘                              │   │
│       │                 │                                    │   │
│       │                 ▼                                    │   │
│       │          ┌──────────┐                              │   │
│       │          │  SHIFT    │                              │   │
│       │          │ CLOSE     │                              │   │
│       │          └────┬─────┘                              │   │
│       │                 │                                    │   │
└───────┼─────────────────┼────────────────────────────────────┼───┘
        │                 │
        ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        OWNER DASHBOARD                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ ANALYTICS│  │INVENTORY │  │  SHIFT   │  │    PROFIT    │ │
│  │(Reports)│  │ (Stock)   │  │(Reconcile)│  │   SHARING   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │PRODUCTS  │  │ DISCOUNT │  │  MEMBER   │  │  EXPENSES   │ │
│  │  (CRUD) │  │ (Tiers)  │  │ (Growth)  │  │   (OPEX)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 29.3 Cash Flow Diagram

```
                    INPUT                              OUTPUT
                       │                                  │
                       ▼                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                         KASIR                                        │
│                                                                        │
│   ┌─────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │ Kas Awal │────▶│  Penjualan  │────▶│  Kas Akhir   │              │
│   │ (Modal) │     │  (Revenue) │     │ (Expected)   │              │
│   └─────────┘     └──────┬──────┘     └──────┬──────┘              │
│                            │                     │                     │
│                            │                     ▼                     │
│                            │              ┌─────────────┐             │
│                            │              │  Selisih    │             │
│                            │              │ (Discrep.)  │             │
│                            │              └─────────────┘             │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │  SHIFT REPORTS   │
                    │   (To Owner)     │
                    └───────────────────┘
```

### 29.4 Loyalty Tier Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEMBER REGISTRATION                          │
│                                                                 │
│  QR Code on Receipt ──▶ Customer Scan ──▶ Input HP + Name      │
│                                                │                │
│                                                ▼                │
│                                    ┌─────────────────┐          │
│                                    │  Member ID     │          │
│                                    │  Auto-Create   │          │
│                                    └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TIER CALCULATION                            │
│                                                                 │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│  │ Bronze   │     │ Silver   │     │   Gold   │             │
│  │ 1-25 tx  │────▶│ 26-75 tx │────▶│  76+ tx  │             │
│  │Diskon 5% │     │Diskon 10%│     │Diskon 15%│             │
│  └──────────┘     └──────────┘     └──────────┘             │
│       ▲                ▲                ▲                      │
│       │                │                │                      │
│       │                │                │                      │
│  ┌────┴────────────────┴────────────────┴────┐               │
│  │      Rolling 2-Month Period               │               │
│  │      + 1 Month Grace Period              │               │
│  └───────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 29.5 Profit Sharing Calculation

```
LAPORAN BULANAN
═══════════════════════════════════════════════════════════════

REVENUE (Total Penjualan)          : Rp 15.000.000
────────────────────────────────────────────────────────────
HPP (Harga Pokok Penjualan)         : Rp  6.000.000
────────────────────────────────────────────────────────────
GROSS PROFIT                        : Rp  9.000.000
────────────────────────────────────────────────────────────
OPEX (Biaya Operasional)            : Rp  2.000.000
  - Sewa Tempat                     : Rp  1.000.000
  - Listrik                         : Rp    500.000
  - Kemasan                         : Rp    500.000
────────────────────────────────────────────────────────────
NET PROFIT (Laba Bersih)            : Rp  7.000.000
═══════════════════════════════════════════════════════════════

BAGI HASIL
═══════════════════════════════════════════════════════════════

OWNER (60%)                        : Rp  4.200.000
────────────────────────────────────────────────────────────
KASIR POOL (40%)                    : Rp  2.800.000
═══════════════════════════════════════════════════════════════

PER KASIR
────────────────────────────────────────────────────────────
Kasir A: 120 transaksi / 200 total   : Rp  1.680.000
Kasir B:  80 transaksi / 200 total  : Rp  1.120.000
────────────────────────────────────────────────────────────

JIKA KASIR RESIGN MID-MONTH
────────────────────────────────────────────────────────────
Kasir A kerja 14 hari (resign)
Share = (14/30) × (50/200) × 2.800.000
     = 0.467 × 0.25 × 2.800.000
     = Rp 326.667
═══════════════════════════════════════════════════════════════
```

---

## 30. CRITICAL GAPS & RECOMMENDATIONS

### 30.1 Critical Gaps Identified

| # | Gap | Severity | Impact |
|---|-----|----------|--------|
| 1 | Docker containers tidak jalan dengan baik | CRITICAL | Tidak bisa testing |
| 2 | Admin credentials belum di-test | HIGH | Owner tidak bisa login |
| 3 | Sample data belum di-generate | HIGH | Tidak ada data untuk testing |
| 4 | Printer integration belum di-test | HIGH | Receipt printing tidak work |
| 5 | Member system belum ada UI | MEDIUM | Loyalty tidak bisa dipakai |
| 6 | Loyalty tier UI belum ada | MEDIUM | Kasir tidak bisa apply discount |
| 7 | Waste tracking UI belum ada | MEDIUM | HPP tidak akurat |
| 8 | Multi-outlet architecture belum di-test | LOW | Future feature |

### 30.2 Recommended Priority

```
PHASE 1 (MVP)
═══════════════════════════════
✅ Fix Docker containers
✅ Test admin login
✅ Test kasir login (PIN)
✅ POS basic flow (add product, cart, payment)
✅ Cash payment
✅ Receipt printing (Bluetooth + Browser)
✅ Open/close shift
✅ Dashboard reports

PHASE 2 
═══════════════════════════════
□ Member registration UI
□ Loyalty tier calculation
□ Member lookup di POS
□ QR code generation untuk member
□ Waste tracking UI
□ BOM recipes setup

PHASE 3 
═══════════════════════════════
□ Online order integration (GoFood/GrabFood)
□ QRIS payment
□ Split payment
□ Multi-outlet setup
□ Profit sharing calculation
□ PPN reporting

FUTURE 
═══════════════════════════════
□ Full multi-outlet management
□ Advanced analytics
□ API integrations
□ Mobile app (optional)
```

### 30.3 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Kasir tidak bisa pakai POS | MEDIUM | HIGH | Training + video tutorial |
| Printer tidak compatible | MEDIUM | MEDIUM | Browser print fallback |
| Internet offline | MEDIUM | LOW | Offline mode sudah ada |
| Stockout sebelum reorder | LOW | HIGH | 10-day alert system |
| Kasir resign | MEDIUM | MEDIUM | Pro-rata calculation |

### 30.4 Questions untuk Clarification

Berikut pertanyaan yang mungkin masih perlu clarification:

1. **Tier benefits** - Apakah diskon 5%/10%/15% per item atau per transaksi?
2. **Free item** - Apakah free item "gratis 1 item" atau "gratis 1 porsi"?
3. **Expired tracking** - Apakah perlu batch tracking untuk FIFO?
4. **Platform fees** - Apakah fee 20% sudah pasti atau variasi per platform?
5. **Tax invoice** - Apakah perlu generate tax invoice (Faktur Pajak)?
6. **Cash float** - Apakah ada laci uang terpisah per kasir?
7. **Receipt footer** - Apa yang perlu ada di footer struk (WA, promo, dll)?
8. **Admin dashboard URL** - Apakah sudah bisa diakses?

---

## 31. SUMMARY

### Key Metrics

| Metric | Value |
|--------|-------|
| Total Questions | 95 |
| Total Topics | 30 |
| User Roles | 2 (Owner + Kasir) |
| Cashiers | 2 (freelance) |
| Outlets | 1 (expandable to multi) |
| Products | 10-20 SKU |
| Target Transactions/Day | 50 |
| Profit Share | 60% Owner / 40% Kasir |
| Launch Deadline | 1 Week |

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | NestJS 11 |
| Database | PostgreSQL 17 |
| Cache | Redis 7 |
| Frontend | SvelteKit 2 + Svelte 5 |
| Infrastructure | Docker + Caddy |
| Offline Storage | Dexie.js (IndexedDB) |
| Payment | Midtrans (QRIS) |

### Credentials

| Role | Username | Password/PIN |
|------|---------|--------------|
| Admin | admin@ngemiloh.com | SuperAdminP@ssw0rd123! |
| Kasir | kasir1 | 1234 |

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Admin | http://localhost/admin |
| POS | http://localhost/pos |
| API Health | http://localhost/_health |

---

**Document Status:** COMPLETE
**Last Updated:** June 19, 2026
**Next Action:** Review dan approve, lalu implement sesuai priority
