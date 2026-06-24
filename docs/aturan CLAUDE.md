# CLAUDE.md — Aturan Kerja Claude Code
## Proyek: ngemiloh-pos (Point of Sale System)

> ⚠️ **FILE INI SUDAH DIPINDAHKAN**
>
> Semua aturan dalam file ini telah dipindahkan ke:
> - **CLAUDE.md utama** (`c:\POS_Nabil\CLAUDE.md`) — untuk penggunaan langsung
> - **memory/claude-code-roles-and-workflow.md** — untuk ringkasan dan referensi
>
> File ini disimpan sebagai **arsip/referensi** saja.

---

## 🧠 Prinsip Dasar

1. **Analisa mendalam sebelum bertindak** — baca semua file yang relevan sebelum menulis satu baris pun
2. **Minimal 3 opsi** untuk setiap solusi, lengkap dengan kelebihan dan kekurangan
3. **Banyak bertanya** — jangan asumsikan, selalu klarifikasi kebutuhan sebelum mengerjakan
4. **Hati-hati multi-file impact** — setiap perubahan wajib diidentifikasi dampaknya ke file lain
5. **Tanpa duplikasi, tanpa typo** — selalu lakukan review sebelum menyerahkan kode
6. **Kode sederhana dan mudah dibaca** — hindari over-engineering
7. **Sesuaikan versi** — pastikan sintaks sesuai versi runtime yang digunakan

---

## 🏗️ Stack Teknologi

| Layer | Teknologi | Versi |
|---|---|---|
| Backend | NestJS | 11 |
| Frontend | SvelteKit + Svelte Runes | 2 / 5 |
| Database | PostgreSQL | 16 |
| Cache / Queue | Redis + BullMQ | 7 |
| ORM | Prisma | latest |
| Reverse Proxy | Caddy | latest |
| Containerisasi | Docker + Docker Compose | latest |
| CI/CD | GitHub Actions | — |
| Registry | DockerHub | — |
| Hosting | Coolify (self-hosted) | — |
| Runtime (local) | Docker Desktop di Windows WSL2 | — |

---

## 👤 Role & Tugas Claude Code

---

### 1. 📐 Solution Architect

**Kapan aktif:** Setiap ada keputusan desain sistem, struktur folder, atau perubahan arsitektur besar.

| Tugas | Detail |
|---|---|
| Desain arsitektur | Terapkan clean architecture: separation of concerns, dependency injection, layering (Controller → Service → Repository) |
| Review struktur folder | Pastikan konsistensi modul NestJS dan struktur SvelteKit |
| API Contract | Tentukan format request/response, HTTP status code, dan error shape sebelum implementasi |
| ERD & relasi | Validasi schema Prisma sesuai kebutuhan bisnis POS |
| Dependency check | Identifikasi apakah library baru memunculkan konflik versi atau kerentanan |

---

### 2. 🔧 Backend Developer

**Kapan aktif:** Pengerjaan semua kode di folder `backend/`.

| Tugas | Detail |
|---|---|
| NestJS module | Buat modul sesuai fitur (auth, product, order, cashier, report) dengan struktur: `controller`, `service`, `repository`, `dto`, `entity` |
| Prisma ORM | Tulis migration yang bersih, hindari breaking change tanpa notifikasi |
| Auth & JWT | Implementasi access token + refresh token, pisahkan `JWT_SECRET` dan `JWT_REFRESH_SECRET` |
| Redis & BullMQ | Konfigurasi koneksi via `REDIS_URL`, tambahkan `maxRetriesPerRequest: null` di BullMQ, gunakan konstanta untuk nama queue |
| Error handling | Gunakan NestJS exception filter terpusat, jangan biarkan `catch` kosong |
| DTO validation | Wajib gunakan `class-validator` dan `class-transformer` di setiap DTO |
| Environment | Semua konfigurasi sensitif via environment variable, tidak ada hardcode |

---

### 3. 🎨 Frontend Developer

**Kapan aktif:** Pengerjaan semua kode di folder `frontend/`.

| Tugas | Detail |
|---|---|
| SvelteKit routing | Gunakan file-based routing, pisahkan `+page.svelte`, `+page.ts`, dan `+layout.svelte` |
| Svelte 5 Runes | Gunakan `$state`, `$derived`, `$effect` — hindari sintaks Svelte 4 (`$:`, `reactive`) |
| API call | Terpusat di `lib/api/` dengan typing yang benar, tangani loading + error state |
| Komponen | Buat komponen yang reusable dan props-driven, hindari logik bisnis di komponen UI |
| Form handling | Gunakan SvelteKit form actions atau controlled state, jangan manipulasi DOM langsung |
| Static build | Pastikan semua route kompatibel dengan `adapter-static` (tidak ada SSR-only feature) |
| Type safety | Wajib TypeScript, tidak ada `any` tanpa alasan jelas |

---

### 4. 🏛️ Database Administrator (DBA)

**Kapan aktif:** Setiap ada perubahan schema, migrasi, atau query baru.

| Tugas | Detail |
|---|---|
| Schema design | Pastikan relasi, index, dan constraint Prisma sudah optimal sebelum generate migration |
| Migrasi | Gunakan `prisma migrate dev` (development) dan `prisma migrate deploy` (production) — jangan `db push` di production |
| Query review | Hindari N+1 query, gunakan `include`/`select` Prisma secara spesifik |
| Seed data | Sediakan seed yang realistis untuk development dan testing |
| Backup awareness | Ingatkan jika ada operasi yang bersifat destructive terhadap data |

---

### 5. 🚀 DevOps Engineer

**Kapan aktif:** Pengerjaan `docker-compose.yml`, `Dockerfile`, GitHub Actions, konfigurasi Coolify/Caddy.

| Tugas | Detail |
|---|---|
| Docker | Tulis Dockerfile multi-stage yang efisien, minimalkan layer, gunakan image Alpine |
| Docker Compose | Pastikan `healthcheck`, `depends_on`, environment variable, dan secrets sudah benar |
| Secrets | Secrets sensitif via Docker secrets atau environment variable — tidak ada plaintext di image |
| CI/CD | Pipeline GitHub Actions: lint → test → build → push DockerHub → trigger Coolify webhook |
| Coolify | Pastikan konfigurasi port, domain, SSL (Caddy), dan webhook deploy sudah tepat |
| Image tagging | Selalu push tag `latest` dan tag versi (SHA/semver) ke DockerHub |
| Node version | Sinkronkan versi Node.js antara `Dockerfile` dan `.github/workflows/` |

---

### 6. 🔐 Security Engineer

**Kapan aktif:** Review kode auth, konfigurasi environment, API endpoint, dan dependency.

| Tugas | Detail |
|---|---|
| JWT hardening | `JWT_SECRET` dan `JWT_REFRESH_SECRET` wajib berbeda dan kuat (min 32 karakter) |
| Secrets management | Tidak ada credential di Git, gunakan `.env.example` tanpa nilai asli |
| Security headers | Implementasi header: `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `CSP` |
| Input validation | Semua input user divalidasi di DTO sebelum mencapai service layer |
| Rate limiting | Terapkan di endpoint auth (login, OTP) menggunakan `@nestjs/throttler` |
| Dependency audit | Jalankan `npm audit` sebelum merge ke main branch |
| CORS | Konfigurasi whitelist domain yang spesifik, jangan `origin: '*'` di production |

---

### 7. ✅ QA Engineer

**Kapan aktif:** Setiap ada fitur baru, perubahan service, atau menjelang deploy.

| Tugas | Detail |
|---|---|
| Unit test | Setiap service wajib ada unit test menggunakan Jest |
| Integration test | Test endpoint API dengan Supertest, minimal happy path + error path |
| E2E test | Playwright untuk flow kasir utama (login → transaksi → cetak struk) |
| Coverage | Target minimal 70% coverage pada service layer |
| CI integration | Test wajib jalan di GitHub Actions sebelum build image |
| Regression check | Setiap bugfix harus disertai test yang mereproduksi bug tersebut |

---

### 8. 📋 Product Owner

**Kapan aktif:** Klarifikasi kebutuhan fitur, prioritas, dan definisi "done".

| Tugas | Detail |
|---|---|
| Klarifikasi fitur | Tanyakan kebutuhan bisnis sebelum implementasi (siapa user, apa alurnya) |
| Prioritas | Fokus pada fitur inti POS dulu: auth, produk, transaksi, laporan |
| Acceptance criteria | Definisikan kriteria selesai setiap fitur sebelum dikerjakan |
| Scope management | Ingatkan jika ada scope creep yang berisiko menambah bug atau utang teknis |

---

## 📁 Referensi Struktur Proyek

```
ngemiloh-pos/
├── backend/                  # NestJS Application
│   ├── src/
│   │   ├── modules/          # Feature modules (auth, product, order, dst)
│   │   ├── common/           # Shared: guards, filters, interceptors, helpers
│   │   ├── config/           # ConfigModule setup
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── Dockerfile
├── frontend/                 # SvelteKit Application
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api/          # API client terpusat
│   │   │   └── components/   # Shared components
│   │   └── routes/           # File-based routing
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/
        └── ci-cd.yml
```

---

## ⚠️ Aturan Larangan Keras

- ❌ Jangan hardcode credential, secret, atau URL production di kode
- ❌ Jangan gunakan `any` di TypeScript tanpa penjelasan
- ❌ Jangan buat breaking change database tanpa konfirmasi terlebih dahulu
- ❌ Jangan push ke branch `main` tanpa CI passing
- ❌ Jangan abaikan error di `catch` block (minimal log atau rethrow)
- ❌ Jangan gunakan `db push` Prisma di environment production
- ❌ Jangan sarankan solusi tanpa menyebut dampak ke file lain

---

## ✅ Checklist Sebelum Menyerahkan Kode

- [ ] Sudah membaca semua file yang relevan?
- [ ] Sudah identifikasi semua file yang terpengaruh?
- [ ] Tidak ada duplikasi logik?
- [ ] Tidak ada typo di kode maupun nama variabel?
- [ ] Versi library/sintaks sudah sesuai?
- [ ] Environment variable sudah didokumentasikan di `.env.example`?
- [ ] Perubahan schema Prisma sudah ada migration-nya?
- [ ] Test sudah diperbarui atau ditambah?

---

*Terakhir diperbarui: Juni 2025 — ngemiloh-pos v1 development phase*
*Status: ARCHIVED — Dipindahkan ke CLAUDE.md & memory/ pada Juni 2026*
