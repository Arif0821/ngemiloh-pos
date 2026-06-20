# NGEMILOH POS - PANDUAN KODE (REFACTOR SUGGESTIONS)
Dokumen ini berisi saran penulisan kode (*Code Snippets*) yang **sangat sederhana dan mudah di-*debug***, sesuai dengan prinsip arsitektur yang telah kita tetapkan. Anda dapat meng-*copy-paste* dan memodifikasi logika ini ke dalam *Source Code* Anda nantinya.

---

## 1. Skema Database (Prisma)
Gunakan `String @default(uuid())` untuk memastikan ID unik secara global agar tidak bentrok saat *Offline Sync*.

```prisma
// schema.prisma

model Outlet {
  id        String   @id @default(uuid())
  name      String
  address   String?
  orders    Order[]
  createdAt DateTime @default(now())
}

model Order {
  id              String   @id @default(uuid()) // Wajib UUID!
  outlet_id       String   // Relasi ke Outlet mana
  total_price     Int      // Harga yang sudah dibulatkan
  tax_amount      Int      // Titipan Pajak Negara
  is_synced       Boolean  @default(false) // Untuk deteksi Offline/Online
  created_at      DateTime @default(now())
  
  outlet          Outlet   @relation(fields: [outlet_id], references: [id])
}
```

---

## 2. Logika Pembulatan Rp 500 Terdekat (Backend NestJS)
Logika pintar ini akan membulatkan total harga belanja + pajak ke kelipatan Rp 500 terdekat agar kasir tidak pusing mengembalikan receh Rp 100/200.

```typescript
// src/utils/pricing.util.ts

/**
 * Fungsi untuk membulatkan nominal ke kelipatan Rp 500 terdekat.
 * Contoh: 
 * - Rp 14.150 -> Rp 14.000 (Turun)
 * - Rp 14.350 -> Rp 14.500 (Naik)
 */
export function roundToNearest500(amount: number): number {
  return Math.round(amount / 500) * 500;
}

/**
 * Fungsi menghitung transaksi Kasir. Sangat mudah dibaca & di-debug.
 */
export function calculateOrderTotal(rawPrice: number) {
  const TAX_RATE = 0.11; // PPN 11%

  // 1. Hitung Pajaknya
  const taxAmount = rawPrice * TAX_RATE;
  
  // 2. Harga Kotor (Kotor = Asli + Pajak)
  const grossPrice = rawPrice + taxAmount;
  
  // 3. Bulatkan ke Rp 500 Terdekat
  const finalPayableAmount = roundToNearest500(grossPrice);

  return {
    original_price: rawPrice,
    tax_amount: taxAmount,
    final_price: finalPayableAmount
  };
}
```

---

## 3. Logika Proteksi Serangan Spam / DDoS (NestJS)
Sesuai Opsi B (Soal 98), kita mencegah tablet Android kasir me-lag-kan VPS. Gunakan paket resmi `@nestjs/throttler` karena ini sangat simpel dan *powerful*.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    // Aturan: Maksimal 20 Request per 60 Detik (1 Menit)
    ThrottlerModule.forRoot([{
      ttl: 60000, 
      limit: 20,  
    }]),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Terapkan anti-spam ke semua Endpoint
    },
  ],
})
export class AppModule {}
```
**Pengecualian:** Untuk *Endpoint VIP Docker* (`/health-internal`), Anda cukup menambahkan dekorator `@SkipThrottle()` di atas fungsinya agar Docker tidak ikut diblokir.

---

## 4. Konsep Sinkronisasi Offline (SvelteKit Frontend)
Jika internet mati, keranjang langsung disimpan di Tablet. Ketika internet hidup, baru dikirim ke Backend. Ini *pseudo-code* sederhana untuk antarmuka Anda.

```javascript
// src/lib/stores/syncQueue.js
import { writable } from 'svelte/store';

// Array untuk menyimpan transaksi yang belum terkirim
export const offlineQueue = writable([]);

/**
 * Fungsi ini dipanggil saat kasir memencet "Bayar Lunas"
 */
export async function processPayment(orderData) {
    if (navigator.onLine) {
        // Jika Online, langsung kirim ke NestJS Backend
        await sendToBackend(orderData);
    } else {
        // Jika Offline, simpan ke antrean lokal (Local Storage / Dexie)
        offlineQueue.update(queue => [...queue, orderData]);
        alert("Mode Offline Aktif! Transaksi disimpan di Tablet. Silakan cetak struk.");
    }
}

/**
 * Fungsi ini berjalan diam-diam (Background) setiap 1 menit untuk 
 * mengecek apakah sinyal internet sudah kembali hidup.
 */
setInterval(async () => {
    if (navigator.onLine) {
        let currentQueue;
        offlineQueue.subscribe(q => currentQueue = q)();
        
        if (currentQueue.length > 0) {
            console.log("Sinyal kembali! Mengirim data Offline...");
            // Kirim per kelompok kecil (Chunking)
            const chunk = currentQueue.slice(0, 10);
            const success = await sendToBackend(chunk);
            
            if (success) {
                // Hapus yang sudah sukses terkirim dari antrean
                offlineQueue.update(queue => queue.slice(10));
            }
        }
    }
}, 60000); // Cek setiap 60 detik
```
