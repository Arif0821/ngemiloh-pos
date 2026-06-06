# Disaster Recovery (DR) Test Log

Dokumen ini digunakan untuk mencatat secara historis hasil uji coba pemulihan bencana (Disaster Recovery) yang diwajibkan oleh spesifikasi 12.5.

**Aturan Main (SOP):**
1. Lakukan simulasi DR Test setiap tanggal 1 setiap bulannya.
2. Unduh `PostgreSQL Full Dump` terbaru dari Backblaze B2.
3. *Restore* data tersebut ke *database staging* terpisah.
4. Pastikan aplikasi *staging* dapat terhubung dan data transaksi pesanan terakhir terverifikasi utuh.
5. Catat hasil pengujian di bawah ini.

---

## Log Riwayat

| Tanggal Uji Coba | PIC / Tester | Status | Durasi Restore | Keterangan / Isu Ditemukan |
| :--- | :--- | :--- | :--- | :--- |
| *Contoh: 1 Juli 2026* | *Admin* | ✅ *Sukses* | *15 Menit* | *Semua data pesanan kembali 100%. Storage (foto) valid.* |
