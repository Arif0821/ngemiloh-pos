# 09. Security Design

*[← 08-api-contract.md](./08-api-contract.md) | [→ 10-testing.md](./10-testing.md)*

---

> **Konteks UU PDP:** Sistem v4.1 tidak mengumpulkan data pribadi pelanggan (transaksi anonim). Data pribadi terbatas pada data internal staf (nama kasir, PIN ter-hash). Lihat `05-nonfunctional-reqs.md §5.6` untuk detail dan flag Fase 2 (Loyalitas Pelanggan).

---

## 13.1 Auth Flow — Session-Based

```
KASIR — POST /auth/login/cashier { pin: "1234" }
├── Rate limit: 5 gagal / 10 menit per user (Redis)
├── Lookup kasir aktif (role='kasir', is_active=true)
├── Bcrypt verify(PEPPER:pin:PEPPER, pin_hash)
├── Gagal → failed_login_count++ → jika ≥5: locked_until=NOW()+10min
│         → log system_logs(security_alert) → 401
└── Berhasil → reset counter → Redis: HSET session:{uuid} {...} (no TTL)
             → Set-Cookie: session_id={uuid}; HttpOnly; Secure; SameSite=Strict; Path=/
             → log audit_logs(USER_LOGIN) → 200

SUPERADMIN — POST /auth/login/admin { email, password }
└── Sama, tapi: EXPIRE session:{uuid} 86400 (24 jam)

SETIAP REQUEST:
├── SessionGuard → HGETALL session:{id} dari Redis
├── Tidak ada / expired → 401 Unauthorized
├── Mutating request (POST/PUT/PATCH/DELETE) → validasi Origin header (13.2)
└── RolesGuard → cek role vs @Roles() decorator

LOGOUT — POST /auth/logout
├── Jika kasir: cek shift masih terbuka → 400 SHIFT_NOT_OPEN jika iya
├── DEL session:{id} + DEL user_sessions:{userId}:{sessionId}
├── Clear cookie (Set-Cookie: expires=past)
└── log audit_logs(USER_LOGOUT)

SESSION BERAKHIR SAAT:
├── Kasir: logout manual ATAU tutup shift ATAU SA force-logout
├── Superadmin: logout manual ATAU TTL 24 jam habis
└── SA reset PIN / deactivate user → scan user_sessions:{userId}:* → DEL semua
```

---

## 13.2 CSRF Protection — SameSite + Origin Header Check

> **v4.0:** CSRF Double Submit Cookie dihapus. Diganti dua mekanisme lebih ringan dan efektif untuk deployment single-domain.

**Mekanisme:**
1. `SameSite=Strict` pada session cookie — browser tidak mengirim cookie untuk cross-site request.
2. Origin header check di server — tolak request jika `Origin` tidak sesuai.

```typescript
// common/middleware/origin-check.middleware.ts
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowedOrigins: string[];

  constructor(private config: ConfigService) {
    const domain = config.get('APP_DOMAIN');
    this.allowedOrigins = [
      `https://${domain}`,
      ...(config.get('NODE_ENV') === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000']
        : []),
    ];
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Safe methods: skip
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.headers['origin'];

    // Webhook Midtrans tidak punya Origin — diverifikasi via SHA512
    if (req.path === '/api/v1/payment/webhook/midtrans') return next();

    if (!origin) throw new ForbiddenException('Origin header required');
    if (!this.allowedOrigins.includes(origin))
      throw new ForbiddenException('Invalid origin');

    next();
  }
}
```

**Kenapa cukup untuk Ngemiloh:**
- Satu domain, path-based routing — tidak ada kebutuhan cross-origin legitimate.
- `SameSite=Strict` sudah mencegah cookie dikirim dari domain lain.
- Origin check sebagai defense-in-depth layer tambahan.
- Webhook Midtrans diverifikasi terpisah via SHA512 (13.5).

---

## 13.3 PIN Hashing (Kasir)

```typescript
// PIN_PEPPER_SECRET: env variable 32 karakter random
// JANGAN ubah setelah production — semua PIN hash akan invalid

const PEPPER = process.env.PIN_PEPPER_SECRET;

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(`${PEPPER}:${pin}:${PEPPER}`, 12); // cost=12 ≈ 250ms
}

async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(`${PEPPER}:${pin}:${PEPPER}`, hash);
}
```

**Kenapa pepper + bcrypt (bukan bcrypt saja):**
- 4-digit PIN = 10.000 kombinasi — tanpa pepper, brute-force trivial jika DB bocor.
- Pepper 32 karakter (disimpan di server env, bukan di DB) → brute-force infeasible walau DB bocor.
- Cost=12 ≈ 250ms di 4-vCPU VPS → mencegah online brute-force (rate limit sudah ada sebagai first line).

---

## 13.4 Password Requirements (Superadmin)

| Requirement | Minimum |
|-------------|---------|
| Panjang | ≥ 16 karakter |
| Huruf kapital | ≥ 1 |
| Huruf kecil | ≥ 1 |
| Angka | ≥ 1 |
| Simbol | ≥ 1 (`!@#$%^&*()_+-=[]{}|;:,.<>?`) |

```typescript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+\[\]{}|;:,.<>?]).{16,}$/;
```

> **2FA tidak diimplementasi (accepted risk, dicatat).** Kompensasi: password ≥16 char + email alert IP baru + rate limit + session TTL 24 jam. Akan dievaluasi jika ada indikasi credential compromise.

---

## 13.5 Webhook Signature Verification (Midtrans)

```typescript
function verifyWebhookSignature(payload: MidtransWebhookPayload): boolean {
  const { order_id, status_code, gross_amount, signature_key } = payload;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;

  const raw = `${order_id}${status_code}${gross_amount}${serverKey}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');

  // Constant-time comparison — mencegah timing attack
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature_key, 'hex'),
  );
}
// SELALU return HTTP 200 ke Midtrans — non-200 menyebabkan retry & potensi duplikasi
```

---

## 13.6 File Upload Security

```typescript
const ALLOWED_MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png':  [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

async function validateAndProcessImage(buffer: Buffer): Promise<Buffer> {
  // 1. Validasi magic bytes — tolak non-image
  const isValid = Object.values(ALLOWED_MAGIC_BYTES)
    .some(magic => magic.every((byte, i) => buffer[i] === byte));
  if (!isValid) throw new BadRequestException('Format gambar tidak valid');

  // 2. UUID filename — cegah path traversal
  const filename = `${randomUUID()}.webp`;

  // 3. Sharp resize — cegah resource exhaustion
  const processed = await sharp(buffer)
    .resize(600, 600, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  // 4. Size check — cegah storage abuse
  if (processed.length > 500 * 1024)
    throw new BadRequestException('Ukuran foto melebihi 500KB setelah kompresi');

  return processed;
}
```

---

## 13.7 Rate Limiting (Lihat juga `02-business-rules.md §6.10`)

```typescript
// common/guards/rate-limit.guard.ts
// Implementasi Redis sliding window per-session
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const identifier = request.session?.userId ?? request.ip;  // per-session, fallback per-IP
  const key = `rate_limit:${identifier}:${request.route.path}`;

  const pipeline = this.redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, 60);  // 1 menit window
  const [[, count]] = await pipeline.exec();

  if (count > LIMITS[request.route.path] ?? 100) {
    await this.logRateLimit(identifier, request.route.path);
    throw new HttpException({ error: 'RATE_LIMITED', message: 'Too many requests' }, 429);
  }
  return true;
}
```

---

## 13.8 Security Headers (Helmet.js)

```typescript
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // SvelteKit butuh inline styles
      connectSrc: ["'self'", "https://api.midtrans.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

---

## 13.9 Threat Model STRIDE — 4 Flow Kritis `[v4.1 — baru]`

Sesuai framework dari panduan SDLC §3.4, diterapkan sebagai tabel ringkas (bukan dokumen terpisah — terlalu berat untuk tim 1–2 dev).

| Flow | Kategori STRIDE | Ancaman | Status | Mitigasi |
|------|----------------|---------|--------|----------|
| `POST /orders/:id/pay/cash` | **Tampering** | Kasir manipulasi `total_amount` dari client | ✅ Sudah aman | Total dihitung ulang server-side dari `order_items` di DB — nilai dari client diabaikan. **Pertegas di code review checklist.** |
| `POST /orders/:id/pay/cash` | **Repudiation** | Kasir klaim tidak terima uang, tapi `cash_received` sudah tercatat | ✅ Sudah aman | `audit_logs(PAYMENT_SETTLED)` immutable (RLS) + struk sebagai bukti |
| `POST /admin/orders/:id/void` | **Elevation of Privilege** | Kasir mencoba akses endpoint void | ✅ Sudah aman | Defense-in-depth: `@Roles('superadmin')` decorator + DB-level CHECK constraint |
| `POST /admin/orders/:id/void` | **Repudiation** | SA void tapi menyangkal pernah melakukannya | ✅ Sudah aman | `audit_logs(ORDER_VOIDED)` immutable + `voided_by`, `voided_at`, `void_reason` wajib |
| `POST /payment/webhook/midtrans` | **Spoofing** | Pihak ketiga kirim webhook palsu untuk settle order tanpa bayar | ✅ Sudah aman | SHA512 signature + timingSafeEqual (13.5) |
| `POST /payment/webhook/midtrans` | **Repudiation** | Midtrans klaim tidak pernah kirim notifikasi | ✅ Sudah aman | `payment_raw_response` menyimpan raw body webhook |
| `POST /orders/sync-batch` | **Tampering** | `client_created_at` dipalsukan untuk memasukkan transaksi ke laporan kas shift lain | **[v4.1 — baru]** | Validasi `client_created_at` harus dalam rentang shift aktif kasir (±5 menit). Kode error `SYNC_TIMESTAMP_INVALID`. |
| `POST /orders/sync-batch` | **Denial of Service** | Kirim batch berisi 10.000 order dummy untuk membebani DB | ✅ Sudah aman | Rate limit 10/menit + validasi array size (maks 50 order per batch, tambahkan sebagai DTO constraint) |
| `GET /products` (cache) | **Tampering** | Injeksi Redis key palsu untuk memanipulasi response produk | ✅ Sudah aman | Redis di network internal (tidak exposed publik), key naming deterministic |
| Auth (PIN brute-force) | **Spoofing** | Brute-force 4-digit PIN (10.000 kombinasi) | ✅ Sudah aman | Rate limit 5/10mnt + account lock + pepper + bcrypt cost=12 |

**Tambahan constraint dari analisis ini (masuk ke `04-functional-reqs.md §FR-TRX-06`):**
```typescript
// Validasi sync-batch: maks 50 order per request
@IsArray()
@ArrayMaxSize(50)
@ValidateNested({ each: true })
orders: OfflineOrderDto[];
```

---

## 13.10 CI/CD Security Gates `[v4.1 — baru]`

Tambahan di pipeline CI (lihat juga `11-deployment.md §12.9`):

```yaml
# .github/workflows/ci.yml (tambahan)

- name: Scan secrets in code
  run: npx gitleaks detect --no-git -v
  # Mencegah API key, password, atau secret ter-commit ke repo

- name: License compliance check
  run: npx license-checker --summary --failOn 'GPL;AGPL;LGPL'
  # Cegah lisensi copyleft di production bundle
```

> **SonarQube tidak digunakan** — membutuhkan server tambahan, overhead tidak sepadan untuk tim 1–2 dev. ESLint + coverage gate + Gitleaks sudah menutupi mayoritas manfaat.

---

## 13.11 Security Checklist v4.1

| Status | Item | Detail | Perubahan v4.1 |
|--------|------|--------|---------------|
| ✅ | Session di HttpOnly Cookie | Tidak accessible via JavaScript | — |
| ✅ | SameSite=Strict | Browser tidak kirim cookie cross-site | — |
| ✅ | Origin header check | Server tolak request dari origin asing | — |
| ✅ | PIN Bcrypt cost=12 + pepper | Brute-force infeasible walau DB bocor | — |
| ✅ | Password SA ≥16 karakter | 4 jenis karakter wajib | — |
| ✅ | Rate limit per-session (Redis) | Mencegah brute-force online | Diperjelas "per-session, bukan per-IP global" |
| ✅ | SQL injection prevention | Prisma parameterized queries | — |
| ✅ | Security headers (Helmet.js) | CSP, HSTS, X-Frame-Options, nosniff | — |
| ✅ | File upload validation | Magic bytes + UUID filename + Sharp | — |
| ✅ | Webhook SHA512 + timingSafeEqual | Cegah webhook palsu & timing attack | — |
| ✅ | Audit log immutable | RLS policy (no UPDATE, no DELETE) | — |
| ✅ | HTTPS enforced | Caddy auto-SSL via Let's Encrypt | — |
| ✅ | Session force-logout | SA invalidate semua session kasir | — |
| ✅ | Backup AES-256 encryption | Backup ter-enkripsi sebelum upload ke offsite | — |
| ✅ | Email alert suspicious activity | Void berlebihan, login IP baru, discrepancy kas | — |
| ✅ | **Idempotency lock (FOR UPDATE)** | Cegah double-payment / double-void | **Baru v4.1** |
| ✅ | **Sync timestamp validation** | `client_created_at` harus dalam rentang shift | **Baru v4.1** |
| ✅ | **Gitleaks di CI** | Scan secret ter-commit otomatis | **Baru v4.1** |
| ✅ | **Circuit breaker Midtrans** | Degradasi graceful saat QRIS gangguan | **Baru v4.1** |
| ❌ | 2FA superadmin | Accepted risk. Kompensasi: pwd≥16 + email alert + TTL 24j | — |

---

## 13.12 Audit Log Events

| Action | Trigger | Data Dicatat |
|--------|---------|-------------|
| `USER_LOGIN` | Login berhasil | userId, role, IP, userAgent |
| `USER_LOGOUT` | Logout | userId, session_duration |
| `USER_LOGIN_FAILED` | Login gagal | userId (jika ada), IP, attempt_count |
| `USER_CREATED` | SA buat kasir | userId baru, nama |
| `USER_UPDATED` | SA update user | old/new values |
| `PIN_RESET` | SA reset PIN kasir | kasir userId, initiated_by |
| `PIN_CHANGED` | Kasir ganti PIN sendiri | userId |
| `ORDER_CREATED` | Order baru | orderId, items_count, total_amount |
| `ORDER_VOIDED` | SA void order | orderId, reason, voided_by |
| `PAYMENT_SETTLED` | Pembayaran berhasil | orderId, method, amount, settled_at |
| `PRODUCT_CREATED` | SA tambah produk | productId, name, price |
| `PRODUCT_UPDATED` | SA update produk | productId, old/new values |
| `PRODUCT_PRICE_CHANGED` | Cron apply scheduled price | productId, old_price, new_price |
| `DISCOUNT_CREATED` | SA buat diskon | discountId, type, value, scope |
| `DISCOUNT_UPDATED` | SA update diskon | discountId, changes |
| `SHIFT_OPENED` | Kasir buka shift | shiftId, cashier, opening_balance |
| `SHIFT_CLOSED` | Kasir/sistem tutup shift | shiftId, closing_balance, discrepancy |
| `SHIFT_AUTO_CLOSED` | BullMQ auto-close | shiftId, auto_close_at |
| `FEATURE_FLAG_TOGGLED` | SA toggle flag | flag_name, old/new value |
| `PROFIT_SHARE_CALCULATED` | SA hitung bagi hasil | period, amounts |
| `PROFIT_SHARE_PAID` | SA mark paid | cashier_id, paid_amount |
| `EXPORT_CSV` | SA export laporan | type, date_range |
| `SETTING_UPDATED` | SA ubah setting | key, old_value, new_value |
| `WEBHOOK_FRAUD_ATTEMPT` | Signature webhook tidak valid | IP, order_id, invalid_signature (truncated) |

---

*Lanjut ke: [`10-testing.md`](./10-testing.md)*
