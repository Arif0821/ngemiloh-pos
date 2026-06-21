# Phase 3: Member & Loyalty System Design

**Version:** 1.0
**Date:** 2026-06-21
**Author:** Senior Engineering Team
**Status:** Approved

---

## 1. Overview

### 1.1 Purpose
Implementasi Member & Loyalty System untuk Ngemiloh POS untuk meningkatkan customer retention dan engagement.

### 1.2 Business Context
```
FRANCHISE MODEL KHUSUS
├─ NGEMILOH HQ
│   └─ Supplier Raw Materials
├─ Multiple Outlets (A, B, C...)
└─ Freelance Kasir
```

### 1.3 Goals
- Meningkatkan customer retention
- Memberikan benefit yang menarik untuk repeat visits
- Mencegah abuse dari kasir dan customer
- Simple untuk operasional kasir

---

## 2. Database Schema

### 2.1 New Models

```prisma
model LoyaltyTier {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name             String    @unique  // Bronze, Silver, Gold, Platinum
  min_points       Int       @default(0)
  points_multiplier Decimal  @default(1.0) // multiplier for earning (future use)
  discount_rate    Int?      // percentage discount (optional, currently unused)
  free_item_id     String?   @db.Uuid  // product_id for free item
  is_active        Boolean   @default(true)
  sort_order       Int       @default(0)
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  members          Member[]

  @@index([sort_order])
}

model Member {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  member_code          String    @unique @db.VarChar(20)  // MBR-XXXXX format
  phone                String    @unique @db.VarChar(20)
  name                 String    @db.VarChar(100)
  email                String?   @db.VarChar(150)
  loyalty_points       Int       @default(0)
  current_tier_id      String?   @db.Uuid
  registered_at        DateTime  @default(now())
  registered_via       String    @default("qr_link")  // 'qr_link', 'cashier', 'admin'
  registered_outlet_id String?   @db.VarChar(50)  // outlet identifier
  last_transaction_at  DateTime?
  tier_downgrade_at    DateTime?  // grace period tracking
  is_active            Boolean   @default(true)
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt

  tier              LoyaltyTier?      @relation(fields: [current_tier_id], references: [id])
  transactions      MemberTransaction[]
  orders            Order[]  // link transactions to members

  @@index([phone])
  @@index([loyalty_points(sort: Desc)])
  @@index([member_code])
}

model MemberTransaction {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  member_id       String    @db.Uuid
  order_id        String?   @db.Uuid
  type            String    // 'earn', 'redeem', 'adjust', 'void_revoke', 'void_restore'
  points          Int       // positive = earn, negative = redeem/adjust
  balance_after   Int
  description     String?
  cashier_id      String?   @db.Uuid  // who processed this
  reference_order String?   @db.VarChar(30)  // original order number if voided
  created_at      DateTime  @default(now())

  member          Member       @relation(fields: [member_id], references: [id])
  order           Order?       @relation(fields: [order_id], references: [id])

  @@index([member_id])
  @@index([order_id])
  @@index([created_at(sort: Desc)])
  @@index([type])
}
```

### 2.2 Modified Models

```prisma
// Order model - add member reference
model Order {
  // ... existing fields ...
  member_id       String?   @db.Uuid  // NEW: optional member link
  
  member          Member?   @relation(fields: [member_id], references: [id])
  
  // existing index: @@index([cashier_id, status, created_at(sort: Desc)])
  @@index([member_id])  // NEW
}

// User model - add cashier can_process_member flag (optional, for future RBAC)
model User {
  // ... existing fields ...
  can_process_member Boolean @default(true)  // NEW: all kasir can process member
}
```

### 2.3 Seed Data: Loyalty Tiers

| Tier | Min Points | Sort Order |
|------|-----------|------------|
| Bronze | 0 | 1 |
| Silver | 500 | 2 |
| Gold | 1.500 | 3 |
| Platinum | 5.000 | 4 |

---

## 3. Point Calculation Rules

### 3.1 Earning Points

```
Formula: floor(transaction_subtotal / 1000) × 5

Examples:
├─ Transaction: Rp 15.000 → 75 pts
├─ Transaction: Rp 50.000 → 250 pts
├─ Transaction: Rp 100.000 → 500 pts
└─ Transaction: Rp 235.500 → 1.177 pts
```

### 3.2 Redeeming Points

```
Formula: 5 pts = Rp 1.000 discount

Rules:
├─ Use all-in or nothing (all points or none)
├─ Can reduce transaction to FREE (Rp 0)
├─ No cooldown on redeem
└─ 2-minute cooldown on earn AFTER successful transaction
```

### 3.3 Point Cooldown

```
Trigger: After successful transaction with point earning
Duration: 2 minutes

Purpose: Prevent abuse/farming by kasir-customer collusion

Behavior:
├─ Member cannot earn points if cooldown active
├─ Cooldown resets after 2 minutes
├─ Cooldown is per-member
└─ Redeem still allowed during cooldown
```

### 3.4 Tier Evaluation

```
At Every Transaction (earn or redeem):
├─ Calculate new tier based on current points
├─ If tier UPGRADE:
│   └─ Immediately effective
│   └─ New tier benefits apply NOW
│
├─ If tier DOWNGRADE:
│   └─ 30-day grace period starts
│   └─ Keep current tier benefits for 30 days
│   └─ If earn enough points, cancel grace (immediate upgrade)
│
└─ Freebies:
    └─ Based on tier at transaction time
```

---

## 4. Void & Refund Handling

### 4.1 Void Transaction (Same Day)

```
Trigger: Kasir voids order

Flow:
1. Find order with member_id
2. Find MemberTransaction with order_id
3. If points were earned:
   └─ Create new MemberTransaction:
      type: 'void_revoke'
      points: -(original earned points)
      description: 'Void: TRX-XXXXX'
4. If points were redeemed:
   └─ Create new MemberTransaction:
      type: 'void_restore'
      points: +(original redeemed points)
      description: 'Void restore: TRX-XXXXX'
5. Update member balance
6. Restore stock (already exists)
```

### 4.2 Refund Transaction (After Day)

```
Trigger: Admin processes refund

Flow:
1. Check: already > 24 hours since transaction?
   └─ Same logic regardless of time
   
2. Find order with member_id
3. Apply same logic as void:
   └─ Revoke earned points
   └─ Restore redeemed points
   
4. Refund cash/transfer to customer
```

### 4.3 Edge Cases

#### Case: Redeem + Void/Refund

```
Original Transaction:
├─ Subtotal: Rp 100.000
├─ Redeem: 500 pts = Rp 50.000
├─ Cash paid: Rp 50.000
└─ Earned: 500 pts

When Refunded:
├─ Refund: Rp 100.000 to customer
├─ Restore redeemed: +500 pts
├─ Revoke earned: -500 pts
└─ Net balance: 0 pts change
```

#### Case: Redeem More Than Current Balance

```
Prevention:
├─ Check balance before redeem
├─ Cap at current balance
└─ Warn kasir if insufficient
```

#### Case: Transaction < Points Value

```
Example:
├─ Balance: 1.000 pts (Rp 100.000)
└─ Transaction: Rp 30.000

Solution:
├─ Use all points: 1.000 pts
├─ Discount: Rp 100.000
├─ Final: MAX(0, 30.000 - 100.000) = Rp 0
└─ Transaction becomes FREE
```

---

## 5. Member Registration

### 5.1 Registration Flow (QR Link)

```
1. Customer checkout at POS
2. Receipt printed with QR code:
   https://ngemiloh.com/member/register?ref=XXXXX
   
3. Customer scans QR → opens registration page
4. Customer inputs:
   ├─ Name (required)
   ├─ Phone (required, unique)
   └─ Email (optional)
   
5. System validates:
   ├─ Check phone uniqueness
   └─ If exists: "No. HP sudah terdaftar"
   
6. If unique:
   ├─ Create Member record
   ├─ Generate Member Code: MBR-XXXXX
   ├─ Assign Bronze tier
   └─ Show success + Member Card
   
7. Customer receives:
   ├─ Member Code (MBR-XXXXX)
   ├─ QR Code for quick login
   └─ Welcome message with tier benefits
```

### 5.2 Member Code Format

```
Format: MBR-{6 alphanumeric chars}
Example: MBR-A1B2C3

Generation:
├─ Random 6 chars (uppercase letters + numbers)
├─ Ensure uniqueness (retry if collision)
└─ No sequential/guessable
```

### 5.3 Registration Reference Code

```
QR Link: /member/register?ref={encoded_ref}

Encoded Ref contains:
├─ Outlet ID
├─ Timestamp
└─ Optional: Order number

Format: Base64 encoded
Decoded: {outlet_id}:{timestamp}:{order_num}
```

---

## 6. API Endpoints

### 6.1 Public Endpoints (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/member/register` | Register new member |
| `GET` | `/member/lookup` | Lookup member by phone/code |
| `GET` | `/member/:code` | Get member info by code (for receipt) |

### 6.2 POS Endpoints (Kasir Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/pos/member/lookup` | Lookup for POS (phone/code/QR) |
| `POST` | `/pos/member/redeem-preview` | Preview redeem amount |
| `POST` | `/pos/member/process` | Process earn + optional redeem |

### 6.3 Admin Endpoints (Admin Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/members` | List all members |
| `GET` | `/admin/members/stats` | Analytics dashboard |
| `GET` | `/admin/members/:id` | Member detail + history |
| `PATCH` | `/admin/members/:id` | Update member |
| `POST` | `/admin/members/:id/adjust` | Manual points adjustment |
| `POST` | `/admin/members/:id/deactivate` | Soft delete member |
| `GET` | `/admin/loyalty/tiers` | List tiers |
| `PATCH` | `/admin/loyalty/tiers/:id` | Update tier (free_item, etc.) |

### 6.4 Internal Endpoints (System)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/internal/member/earn` | Earn points (called by orders service) |
| `POST` | `/internal/member/revoke` | Revoke points (called by orders void) |
| `GET` | `/internal/member/:id/cooldown` | Check cooldown status |

---

## 7. API Contracts

### 7.1 POST /member/register

**Request:**
```json
{
  "name": "John Doe",
  "phone": "081234567890",
  "email": "john@example.com",
  "ref_code": "a1b2c3d4"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "member_code": "MBR-A1B2C3",
    "name": "John Doe",
    "phone": "081234567890",
    "tier": "Bronze",
    "loyalty_points": 0,
    "registered_at": "2026-06-21T10:00:00Z"
  },
  "message": "Pendaftaran berhasil! Selamat datang di NGEMILOH Members."
}
```

**Error (409 - Duplicate Phone):**
```json
{
  "success": false,
  "message": "No. HP sudah terdaftar. Silakan gunakan no. HP lain."
}
```

### 7.2 GET /pos/member/lookup?phone=xxx

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "member_code": "MBR-A1B2C3",
    "name": "John Doe",
    "tier": "Silver",
    "loyalty_points": 1250,
    "can_earn": true,
    "cooldown_ends_at": null
  }
}
```

### 7.3 POST /pos/member/process

**Request:**
```json
{
  "member_id": "uuid",
  "order_id": "order-uuid",
  "transaction_subtotal": 85000,
  "redeem_requested": true,
  "cashier_id": "kasir-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "points_earned": 425,
    "points_redeemed": 0,
    "discount_amount": 0,
    "new_balance": 1425,
    "cooldown_until": "2026-06-21T10:02:00Z",
    "tier": "Gold",
    "tier_changed": true,
    "tier_benefits": {
      "free_item": "Free Keripik"
    }
  }
}
```

**With Redeem:**
```json
{
  "success": true,
  "data": {
    "points_earned": 425,
    "points_redeemed": 1200,
    "discount_amount": 24000,
    "final_payment": 61000,
    "new_balance": 225,
    "cooldown_until": "2026-06-21T10:02:00Z",
    "tier": "Gold"
  }
}
```

### 7.4 GET /admin/members/stats

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_members": 1523,
    "new_this_month": 87,
    "total_points_issued": 2500000,
    "total_points_redeemed": 1200000,
    "tier_distribution": {
      "Bronze": 890,
      "Silver": 450,
      "Gold": 150,
      "Platinum": 33
    },
    "top_redeemers": [
      {"name": "John D.", "points_redeemed": 50000},
      {"name": "Jane S.", "points_redeemed": 45000}
    ],
    "conversion_rate": 0.35,
    "avg_points_per_member": 1650,
    "growth_trend": [
      {"month": "2026-01", "members": 1200},
      {"month": "2026-02", "members": 1310},
      {"month": "2026-03", "members": 1420},
      {"month": "2026-04", "members": 1450},
      {"month": "2026-05", "members": 1500},
      {"month": "2026-06", "members": 1523}
    ]
  }
}
```

---

## 8. Frontend Routes

### 8.1 Member Pages (Public)

```
/member/register
├─ Registration form
├─ Success page with member card
└─ QR code display

/member/:code
├─ Member profile view
├─ Points balance
└─ QR code for POS scan
```

### 8.2 POS Integration

```
/pos
├─ Existing POS interface
├─ NEW: "Ada Member?" button
├─ NEW: Member lookup modal (HP/QR/Code)
├─ NEW: Display member info + balance
├─ NEW: "Mau pakai poin?" confirmation
└─ NEW: Cooldown indicator if active
```

### 8.3 Admin Pages

```
/admin/members
├─ Member list table
├─ Search by name/phone/code
├─ Filter by tier
└─ Quick actions

/admin/members/:id
├─ Member detail
├─ Points history
├─ Transaction history
├─ Tier progress bar
└─ Edit/Adjust actions

/admin/members/analytics
├─ Dashboard with charts
├─ Tier distribution pie
├─ Growth trend line
└─ Top redeemers list

/admin/loyalty/settings
├─ Tier configuration
├─ Free item assignment per tier
└─ Points rate settings
```

---

## 9. POS Checkout Flow with Member

### 9.1 Step-by-Step

```
1. KASIR SELESAIKAN ORDER
   └─ Cart: Rp 85.000

2. KASIR TANYA
   └─ "Sudah punya member Ngemiloh?"

3. JIKA TIDAK
   └─ Proceed normal, no member

4. JIKA YA
   └─ "Mau pakai HP / QR / ID Member?"
   
5. MEMBER LOGIN
   └─ Customer provides: HP / QR / Member Code
   └─ POS: Lookup member
   
6. TAMPILKAN INFO
   └─ "John Doe - MBR-A1B2C3"
   └─ "Tier: Silver"
   └─ "Saldo Poin: 1.250 pts (Rp 25.000)"

7. KASIR TANYA
   └─ "Mau pakai 1.250 poin (Rp 25.000)?"

8. JIKA YA
   ├─ Redeem all 1.250 pts
   ├─ Discount: Rp 25.000
   └─ Bayar: Rp 60.000

9. JIKA TIDAK / TIMEOUT
   └─ No redeem
   └─ Bayar: Rp 85.000

10. PAYMENT SELESAI (LUNAS)
    ├─ IF redeem used:
    │   └─ Poin restored
    │
    └─ AUTO: Poin earned (if not in cooldown)
        ├─ Transaction: Rp 60.000 (after redeem)
        ├─ Earned: 300 pts
        └─ New balance: 300 pts (Silver)
        └─ ⚠️ COOLDOWN 2 MENIT AKTIF
```

### 9.2 Member Lookup Modal UI

```
┌────────────────────────────────────────┐
│  🔍 Cari Member                         │
├────────────────────────────────────────┤
│                                        │
│  Masukkan:                              │
│  ┌──────────────────────────────────┐  │
│  │ 081234567890                     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  Atau scan QR Code:                    │
│  ┌─────────┐                          │
│  │ [QR]   │  ← Camera capture         │
│  └─────────┘                          │
│                                        │
│  Atau masukkan ID Member:              │
│  ┌──────────────────────────────────┐  │
│  │ MBR-A1B2C3                       │  │
│  └──────────────────────────────────┘  │
│                                        │
│           [Cari]  [Batal]              │
└────────────────────────────────────────┘

AFTER LOOKUP:
┌────────────────────────────────────────┐
│  ✓ Member Ditemukan!                   │
├────────────────────────────────────────┤
│                                        │
│  👤 John Doe                           │
│  🏷️ MBR-A1B2C3                        │
│  🥈 Silver                             │
│                                        │
│  💰 Saldo Poin: 1.250 pts             │
│     (setara Rp 25.000)                │
│                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│  Mau pakai poin?                       │
│  "Tersedia 1.250 poin (Rp 25.000)"   │
│                                        │
│  ┌──────────┐    ┌──────────────────┐ │
│  │  Tidak   │    │  Ya, Pakai Poin  │ │
│  └──────────┘    └──────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

---

## 10. Receipt Integration

### 10.1 Receipt with Member

```
=====================================
        🏪 NGEMILOH OUTLET A
         Jl. Raya Snack No.1
           Telp: 021-123456
=====================================
Date: 21/06/2026  14:30
Kasir: Kasir A
Order: TRX-20260621-A-001

--------------------------------------
Macaroni Pedas     x2   Rp 30.000
Keripich Bawang    x1   Rp 20.000
Teh Manis          x2   Rp 10.000
--------------------------------------
SUB TOTAL              Rp 60.000
DISKON (Member)       -Rp 25.000
======================================
TOTAL              Rp 35.000
CASH              Rp 50.000
KEMBALI           Rp 15.000
======================================

👤 Member: John D. (MBR-A1B2C3)
🥈 Silver
💰 Poin: +300 pts (Total: 1.250 pts)
⏱️ Poin berikutnya: 14:32

=====================================
 DAFTAR MEMBER, FREE MEMBERSHIP!
 Scan QR atau ke:
 https://ngemiloh.com/member/register
=====================================
       Terima Kasih! 👋
=====================================
```

### 10.2 Receipt WITHOUT Member

```
=====================================
   DAFTAR MEMBER, FREE MEMBERSHIP!
   Scan QR atau ke:
   https://ngemiloh.com/member/register
   Ref: NGEM-A1B2C3
=====================================
```

---

## 11. Security & Abuse Prevention

### 11.1 Point Farming Prevention

```
Problem: Kasir + customer collusion to farm points
├─ Fake transactions to earn points
├─ Rapid-fire checkout
└─ Redeem and get free money

Solution: 2-Minute Cooldown
├─ After earning points, 2-minute wait
├─ Customer cannot earn again in 2 minutes
├─ Makes farming impractical
└─ Single person can only earn once per 2 minutes
```

### 11.2 Rate Limiting

```
├─ Member lookup: 60 req/min per IP
├─ Redeem: 10 req/min per member
├─ Register: 5 req/min per IP
└─ Adjust: 10 req/min per admin
```

### 11.3 Audit Trail

```
Every point operation logged:
├─ member_id
├─ type (earn/redeem/adjust/void)
├─ points (positive/negative)
├─ balance_after
├─ cashier_id
├─ order_id
├─ reference_order (for void)
├─ created_at
└─ ip_address (for register)
```

### 11.4 Validation Rules

```
├─ Phone: unique, 8-15 digits
├─ Member code: unique, 10 chars
├─ Points: integer >= 0 (except adjustments)
├─ Balance: cannot go negative (CHECK constraint)
└─ Tier: must match points threshold
```

---

## 12. Configuration

### 12.1 Feature Flags

```typescript
enum FlagName {
  MEMBER_SYSTEM = 'MEMBER_SYSTEM',        // Enable/disable entire system
  POINT_EARNING = 'POINT_EARNING',        // Enable point earning
  POINT_REDEEM = 'POINT_REDEEM',         // Enable point redemption
  TIER_SYSTEM = 'TIER_SYSTEM',           // Enable tier benefits
  FREE_ITEMS = 'FREE_ITEMS',             // Enable free item rewards
  QR_REGISTRATION = 'QR_REGISTRATION',    // Enable QR registration
}
```

### 12.2 Tier Configuration (Admin Editable)

```json
{
  "tiers": [
    {
      "name": "Bronze",
      "min_points": 0,
      "points_multiplier": 1.0,
      "discount_rate": 0,
      "free_item": null,
      "is_active": true
    },
    {
      "name": "Silver",
      "min_points": 500,
      "points_multiplier": 1.0,
      "discount_rate": 0,
      "free_item": "PROD-XXXXX",
      "is_active": true
    },
    {
      "name": "Gold",
      "min_points": 1500,
      "points_multiplier": 1.0,
      "discount_rate": 0,
      "free_item": "PROD-YYYYY",
      "is_active": true
    },
    {
      "name": "Platinum",
      "min_points": 5000,
      "points_multiplier": 1.0,
      "discount_rate": 0,
      "free_item": "PROD-ZZZZZ",
      "is_active": true
    }
  ],
  "point_rules": {
    "earn_rate": 5,
    "earn_per": 1000,
    "redeem_rate": 5,
    "redeem_per": 1000,
    "cooldown_minutes": 2,
    "grace_days": 30
  }
}
```

---

## 13. Implementation Phases

### Phase 3.1: Database & Backend Core
1. Create Prisma models
2. Create Members module (backend)
3. Implement registration API
4. Implement lookup API
5. Implement earn/redeem API

### Phase 3.2: POS Integration
1. Add member lookup to POS
2. Add member display in cart
3. Add redeem confirmation flow
4. Add to receipt generation
5. Add cooldown indicator

### Phase 3.3: Admin Dashboard
1. Member list page
2. Member detail page
3. Member analytics dashboard
4. Tier configuration page
5. Manual adjustment

### Phase 3.4: Registration Flow
1. Public registration page
2. Member card display
3. QR code generation
4. Receipt QR integration

---

## 14. Acceptance Criteria

### 14.1 Registration
- [ ] Can register with name, phone, email
- [ ] Phone uniqueness enforced
- [ ] Member code generated (MBR-XXXXX)
- [ ] Bronze tier assigned by default
- [ ] QR code generated

### 14.2 Point Earning
- [ ] 5 points per Rp 1.000 spent
- [ ] 2-minute cooldown enforced
- [ ] Tier auto-upgrade works
- [ ] Tier downgrade with 30-day grace

### 14.3 Point Redemption
- [ ] Kasir can lookup member
- [ ] Kasir can ask to redeem
- [ ] All-in or nothing logic
- [ ] Transaction can be FREE
- [ ] Balance cannot go negative

### 14.4 Void/Refund
- [ ] Earned points revoked on void
- [ ] Redeemed points restored on void
- [ ] Same logic for refund

### 14.5 Admin
- [ ] Member list with search/filter
- [ ] Member detail with history
- [ ] Analytics dashboard
- [ ] Tier configuration
- [ ] Manual adjustment

### 14.6 Security
- [ ] 2-minute cooldown prevents farming
- [ ] Audit trail complete
- [ ] Rate limiting active
- [ ] No negative balance possible

---

## 15. File Structure

```
backend/src/
├─ members/
│   ├─ domain/
│   │   ├─ interfaces/
│   │   │   └─ member.repository.interface.ts
│   │   └─ models/
│   │       └─ member.entity.ts
│   ├─ application/
│   │   ├─ services/
│   │   │   └─ member.service.ts
│   │   │   └─ loyalty.service.ts
│   │   └─ dto/
│   │       ├─ register-member.dto.ts
│   │       ├─ lookup-member.dto.ts
│   │       └─ process-points.dto.ts
│   ├─ infrastructure/
│   │   ├─ repositories/
│   │   │   └─ prisma-member.repository.ts
│   │   └─ ...
│   └─ presentation/
│       ├─ member.controller.ts
│       └─ pos-member.controller.ts
│       └─ admin-member.controller.ts
│
frontend/src/
├─ routes/
│   ├─ member/
│   │   ├─ register/
│   │   │   └─ +page.svelte
│   │   │   └─ +page.server.ts
│   │   └─ [code]/
│   │       └─ +page.svelte
│   └─ admin/
│       ├─ members/
│       │   ├─ +page.svelte
│       │   ├─ [id]/
│       │   │   └─ +page.svelte
│       │   └─ analytics/
│       │       └─ +page.svelte
│       └─ loyalty/
│           └─ settings/
│               └─ +page.svelte
│   └─ pos/
│       └─ (POS page updated with member lookup)
│
├─ lib/
│   ├─ services/
│   │   └─ member.service.ts
│   └─ stores/
│       └─ member.store.svelte
│   └─ domain/
│       └─ models/
│           └─ member.types.ts
```

---

## 16. Dependencies

### Backend
- NestJS 11
- Prisma 6
- Redis (for cooldown tracking)
- UUID generation

### Frontend
- SvelteKit 2
- Svelte 5 Runes
- Tailwind CSS 4
- QR Code library (qrcode)

### Infrastructure
- PostgreSQL (existing)
- Redis (existing)

---

## 17. Testing Requirements

### Unit Tests
- Point calculation logic
- Tier evaluation logic
- Cooldown logic
- Redeem balance check

### Integration Tests
- Registration flow
- Earning flow
- Redeem flow
- Void flow

### E2E Tests
- Full POS checkout with member
- Member registration via QR
- Admin member management

---

*Document Version: 1.0*
*Last Updated: 2026-06-21*
*Status: APPROVED*
