# Phase 3: Member & Loyalty System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementasi Member & Loyalty System lengkap dengan registration, point earning/redeeming, tier system, dan admin dashboard.

**Architecture:**
- Backend: NestJS module baru `members/` dengan Repository pattern
- Database: Prisma models baru (LoyaltyTier, Member, MemberTransaction) + modifikasi Order
- Frontend: Public registration page, POS integration, admin dashboard
- Security: Redis untuk cooldown tracking, audit trail untuk semua operasi

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Redis, SvelteKit 2, Svelte 5 Runes

---

## Phase Breakdown

| Phase | Tasks | Description |
|-------|-------|-------------|
| 3.1 | Tasks 1-8 | Database & Backend Core |
| 3.2 | Tasks 9-14 | POS Integration |
| 3.3 | Tasks 15-19 | Admin Dashboard |
| 3.4 | Tasks 20-24 | Registration Flow |

---

## PART 1: Database & Backend Core

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Backup existing schema**

Run: `cp backend/prisma/schema.prisma backend/prisma/schema.prisma.backup`

- [ ] **Step 2: Add new enums and models**

Add to `backend/prisma/schema.prisma` after existing enums:

```prisma
// --- FASE 3: MEMBER & LOYALTY SYSTEM ---

model LoyaltyTier {
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name             String    @unique @db.VarChar(20)
  min_points       Int       @default(0)
  points_multiplier Decimal  @default(1.0) @db.Decimal(3, 2)
  discount_rate    Int?      @db.SmallInt
  free_item_id     String?   @db.Uuid
  is_active        Boolean   @default(true)
  sort_order       Int       @default(0)
  created_at       DateTime  @default(now()) @db.Timestamptz
  updated_at       DateTime  @updatedAt

  members          Member[]

  @@index([sort_order])
  @@index([is_active])
}

model Member {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  member_code          String    @unique @db.VarChar(20)
  phone                String    @unique @db.VarChar(20)
  name                 String    @db.VarChar(100)
  email                String?   @db.VarChar(150)
  loyalty_points       Int       @default(0)
  current_tier_id      String?   @db.Uuid
  registered_at        DateTime  @default(now())
  registered_via       String    @default("qr_link")
  registered_outlet_id String?   @db.VarChar(50)
  last_transaction_at DateTime?
  tier_downgrade_at    DateTime?
  is_active            Boolean   @default(true)
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt

  tier         LoyaltyTier?         @relation(fields: [current_tier_id], references: [id])
  transactions MemberTransaction[]
  orders       Order[]

  @@index([phone])
  @@index([member_code])
  @@index([loyalty_points(sort: Desc)])
  @@index([is_active])
}

model MemberTransaction {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  member_id       String    @db.Uuid
  order_id        String?   @db.Uuid
  type            String    @db.VarChar(30)
  points          Int
  balance_after   Int
  description     String?
  cashier_id      String?   @db.Uuid
  reference_order String?   @db.VarChar(30)
  created_at      DateTime  @default(now())

  member Member @relation(fields: [member_id], references: [id], onDelete: Cascade)
  order  Order? @relation(fields: [order_id], references: [id])

  @@index([member_id])
  @@index([order_id])
  @@index([type])
  @@index([created_at(sort: Desc)])
}
```

- [ ] **Step 3: Update existing Customer model to Member (migration)**

Replace existing `Customer` model with:

```prisma
// Legacy: Customer model renamed to Member
// Existing data will be migrated to Member model
```

Actually, keep `Customer` as-is for now, we'll create `Member` separately.

- [ ] **Step 4: Add member_id to Order model**

Find `model Order` and add after `cash_change`:
```prisma
  customer_name       String?       @db.VarChar(50)
  member_id           String?       @db.Uuid   // NEW: link to member
```

Add relation in Order model:
```prisma
  member          Member?   @relation(fields: [member_id], references: [id])
```

Add index:
```prisma
  @@index([member_id])  // NEW
```

- [ ] **Step 5: Add free_item_id relation to Product model**

Find `model Product` and add:
```prisma
  loyalty_tiers_used LoyaltyTier[]
```

- [ ] **Step 6: Generate Prisma client**

Run: `cd backend && npx prisma generate`
Expected: Successfully generated Prisma client

- [ ] **Step 7: Create migration**

Run: `cd backend && npx prisma migrate dev --name add_member_loyalty_system`
Expected: Migration created successfully

- [ ] **Step 8: Commit**

Run:
```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): add Member, LoyaltyTier, MemberTransaction models"
```

---

### Task 2: Seed Loyalty Tiers

**Files:**
- Modify: `backend/prisma/seed.ts`

- [ ] **Step 1: Read existing seed file**

Read: `backend/prisma/seed.ts`

- [ ] **Step 2: Add tier seeding function**

Add to `backend/prisma/seed.ts`:

```typescript
async function seedLoyaltyTiers(prisma: PrismaClient) {
  const tiers = [
    { name: 'Bronze', min_points: 0, sort_order: 1, points_multiplier: 1.0 },
    { name: 'Silver', min_points: 500, sort_order: 2, points_multiplier: 1.0 },
    { name: 'Gold', min_points: 1500, sort_order: 3, points_multiplier: 1.0 },
    { name: 'Platinum', min_points: 5000, sort_order: 4, points_multiplier: 1.0 },
  ];

  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { name: tier.name },
      update: {},
      create: tier,
    });
  }
  console.log('✅ Loyalty tiers seeded');
}
```

- [ ] **Step 3: Call seed function in main**

Add to main seed function:
```typescript
await seedLoyaltyTiers(prisma);
```

- [ ] **Step 4: Run seed**

Run: `cd backend && npx prisma db seed`
Expected: Loyalty tiers seeded

- [ ] **Step 5: Commit**

Run:
```bash
git add backend/prisma/seed.ts
git commit -m "feat(db): seed default loyalty tiers (Bronze/Silver/Gold/Platinum)"
```

---

### Task 3: Create Member Repository Interface

**Files:**
- Create: `backend/src/members/domain/interfaces/member.repository.interface.ts`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p backend/src/members/domain/interfaces backend/src/members/domain/models`

- [ ] **Step 2: Create repository interface**

Create `backend/src/members/domain/interfaces/member.repository.interface.ts`:

```typescript
import { Prisma } from '@prisma/client';

export interface MemberWithTier {
  id: string;
  member_code: string;
  phone: string;
  name: string;
  email: string | null;
  loyalty_points: number;
  current_tier_id: string | null;
  registered_at: Date;
  registered_via: string;
  is_active: boolean;
  tier: {
    id: string;
    name: string;
    min_points: number;
    free_item_id: string | null;
  } | null;
}

export interface IMemberRepository {
  create(data: Prisma.MemberUncheckedCreateInput): Promise<MemberWithTier>;
  findById(id: string): Promise<MemberWithTier | null>;
  findByPhone(phone: string): Promise<MemberWithTier | null>;
  findByMemberCode(code: string): Promise<MemberWithTier | null>;
  updatePoints(id: string, newBalance: number): Promise<MemberWithTier>;
  updateTier(id: string, tierId: string): Promise<MemberWithTier>;
  deactivate(id: string): Promise<void>;
  findAll(options?: {
    page?: number;
    limit?: number;
    tier?: string;
    search?: string;
  }): Promise<{ data: MemberWithTier[]; total: number }>;
  createTransaction(data: Prisma.MemberTransactionUncheckedCreateInput): Promise<void>;
  getTransactionHistory(memberId: string, limit?: number): Promise<any[]>;
  getCooldownUntil(memberId: string): Promise<Date | null>;
  setCooldown(memberId: string, until: Date): Promise<void>;
  executeInTransaction<T>(fn: (repo: IMemberRepository) => Promise<T>): Promise<T>;
}
```

- [ ] **Step 3: Create entity model**

Create `backend/src/members/domain/models/member.entity.ts`:

```typescript
export interface MemberEntity {
  id: string;
  memberCode: string;
  phone: string;
  name: string;
  email: string | null;
  loyaltyPoints: number;
  tierId: string | null;
  tierName: string | null;
  registeredAt: Date;
  registeredVia: string;
  isActive: boolean;
  canEarn: boolean;
  cooldownUntil: Date | null;
}

export interface MemberTransactionEntity {
  id: string;
  memberId: string;
  type: 'earn' | 'redeem' | 'adjust' | 'void_revoke' | 'void_restore';
  points: number;
  balanceAfter: number;
  description: string | null;
  createdAt: Date;
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add backend/src/members/domain/interfaces/member.repository.interface.ts backend/src/members/domain/models/member.entity.ts
git commit -m "feat(members): add repository interface and entity models"
```

---

### Task 4: Create Prisma Member Repository

**Files:**
- Create: `backend/src/members/infrastructure/repositories/prisma-member.repository.ts`

- [ ] **Step 1: Create directory**

Run: `mkdir -p backend/src/members/infrastructure/repositories`

- [ ] **Step 2: Create repository implementation**

Create `backend/src/members/infrastructure/repositories/prisma-member.repository.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { IMemberRepository } from '../../domain/interfaces/member.repository.interface';

@Injectable()
export class PrismaMemberRepository implements IMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private get client() {
    return this.prisma;
  }

  async create(data: any) {
    return this.client.member.create({
      data,
      include: { tier: true },
    });
  }

  async findById(id: string) {
    return this.client.member.findUnique({
      where: { id },
      include: { tier: true },
    });
  }

  async findByPhone(phone: string) {
    return this.client.member.findUnique({
      where: { phone },
      include: { tier: true },
    });
  }

  async findByMemberCode(code: string) {
    return this.client.member.findUnique({
      where: { member_code: code },
      include: { tier: true },
    });
  }

  async updatePoints(id: string, newBalance: number) {
    return this.client.member.update({
      where: { id },
      data: { loyalty_points: newBalance },
      include: { tier: true },
    });
  }

  async updateTier(id: string, tierId: string) {
    return this.client.member.update({
      where: { id },
      data: { 
        current_tier_id: tierId,
        tier_downgrade_at: null, // Clear grace period on upgrade
      },
      include: { tier: true },
    });
  }

  async deactivate(id: string) {
    await this.client.member.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async findAll(options?: { page?: number; limit?: number; tier?: string; search?: string }) {
    const { page = 1, limit = 20, tier, search } = options || {};
    const skip = (page - 1) * limit;

    const where: any = { is_active: true };
    if (tier) where.current_tier_id = tier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { member_code: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.client.member.findMany({
        where,
        include: { tier: true },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.client.member.count({ where }),
    ]);

    return { data, total };
  }

  async createTransaction(data: any) {
    await this.client.memberTransaction.create({ data });
  }

  async getTransactionHistory(memberId: string, limit = 50) {
    return this.client.memberTransaction.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async getCooldownUntil(memberId: string): Promise<Date | null> {
    const key = `member:cooldown:${memberId}`;
    const value = await this.client.$queryRaw`
      SELECT COALESCE(
        (SELECT TO_TIMESTAMP(value::numeric) FROM redis_get(${key})),
        null
      ) as cooldown_until
    `;
    // Simplified: use Redis service directly in service layer
    return null; // Will be handled by service
  }

  async setCooldown(memberId: string, until: Date) {
    const key = `member:cooldown:${memberId}`;
    const ttlSeconds = Math.max(0, Math.floor((until.getTime() - Date.now()) / 1000));
    if (ttlSeconds > 0) {
      await this.client.$executeRaw`SELECT redis_setex(${key}, ${ttlSeconds}, ${until.toISOString()})`;
    }
  }

  async executeInTransaction<T>(fn: (repo: IMemberRepository) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      // Create a proxy that uses the transaction client
      const txRepo = new PrismaMemberRepository(tx as any);
      return fn(txRepo as any);
    });
  }
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add backend/src/members/infrastructure/repositories/prisma-member.repository.ts
git commit -m "feat(members): add PrismaMemberRepository implementation"
```

---

### Task 5: Create Member DTOs

**Files:**
- Create: `backend/src/members/application/dto/register-member.dto.ts`
- Create: `backend/src/members/application/dto/lookup-member.dto.ts`
- Create: `backend/src/members/application/dto/process-points.dto.ts`

- [ ] **Step 1: Create DTOs directory**

Run: `mkdir -p backend/src/members/application/dto`

- [ ] **Step 2: Create register DTO**

Create `backend/src/members/application/dto/register-member.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsPhoneNumber, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterMemberDto {
  @ApiProperty({ example: 'John Doe', description: 'Nama lengkap member' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '081234567890', description: 'Nomor HP (unique)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9]{8,15}$/, { message: 'Phone must be 8-15 digits' })
  phone: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  ref_code?: string;
}

export class RegisterMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MBR-A1B2C3' })
  member_code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ example: 'Bronze' })
  tier: string;

  @ApiProperty({ example: 0 })
  loyalty_points: number;

  @ApiProperty()
  registered_at: Date;
}
```

- [ ] **Step 3: Create lookup DTO**

Create `backend/src/members/application/dto/lookup-member.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class LookupMemberQueryDto {
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Member code (MBR-XXXXX)' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'QR code reference' })
  @IsString()
  @IsOptional()
  qr?: string;
}

export class MemberLookupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MBR-A1B2C3' })
  member_code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'Silver' })
  tier: string;

  @ApiProperty({ example: 1250 })
  loyalty_points: number;

  @ApiProperty({ example: 12500, description: 'Poin value in Rupiah' })
  points_value: number;

  @ApiProperty({ example: true })
  can_earn: boolean;

  @ApiPropertyOptional()
  cooldown_until: Date | null;
}
```

- [ ] **Step 4: Create process points DTO**

Create `backend/src/members/application/dto/process-points.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class ProcessMemberPointsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  member_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  order_id?: string;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0)
  transaction_subtotal: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  redeem_requested: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cashier_id?: string;
}

export class ProcessMemberPointsResponseDto {
  @ApiProperty({ example: 425 })
  points_earned: number;

  @ApiProperty({ example: 0 })
  points_redeemed: number;

  @ApiProperty({ example: 0, description: 'Discount amount in Rupiah' })
  discount_amount: number;

  @ApiPropertyOptional({ example: 61000, description: 'Final payment after redeem' })
  final_payment?: number;

  @ApiProperty({ example: 1425 })
  new_balance: number;

  @ApiPropertyOptional()
  cooldown_until: Date | null;

  @ApiProperty({ example: 'Gold' })
  tier: string;

  @ApiProperty({ example: false })
  tier_changed: boolean;

  @ApiPropertyOptional()
  tier_benefits: {
    free_item?: string;
  } | null;
}
```

- [ ] **Step 5: Commit**

Run:
```bash
git add backend/src/members/application/dto/
git commit -m "feat(members): add DTOs for register, lookup, process points"
```

---

### Task 6: Create Member Service

**Files:**
- Create: `backend/src/members/application/services/member.service.ts`
- Create: `backend/src/members/application/services/loyalty.service.ts`

- [ ] **Step 1: Create services directory**

Run: `mkdir -p backend/src/members/application/services`

- [ ] **Step 2: Create loyalty service**

Create `backend/src/members/application/services/loyalty.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class LoyaltyService {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Constants
  readonly POINTS_EARN_RATE = 5;      // 5 points per Rp 1,000
  readonly POINTS_EARN_PER = 1000;     // per Rp 1,000
  readonly POINTS_REDEEM_RATE = 5;     // 5 points = Rp 1,000
  readonly POINTS_REDEEM_PER = 1000;
  readonly COOLDOWN_MINUTES = 2;
  readonly GRACE_DAYS = 30;

  calculatePointsEarned(subtotal: number): number {
    return Math.floor(subtotal / this.POINTS_EARN_PER) * this.POINTS_EARN_RATE;
  }

  calculateRedeemValue(points: number): number {
    return Math.floor(points / this.POINTS_REDEEM_RATE) * this.POINTS_REDEEM_PER;
  }

  generateMemberCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `MBR-${code}`;
  }

  async evaluateTier(memberId: string, currentPoints: number): Promise<{
    tierId: string;
    tierName: string;
    changed: boolean;
    isUpgrade: boolean;
  }> {
    // Get all tiers ordered by min_points DESC
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { is_active: true },
      orderBy: { min_points: 'desc' },
    });

    // Find appropriate tier
    let newTier = tiers.find(t => currentPoints >= t.min_points);
    if (!newTier) {
      newTier = tiers[tiers.length - 1]; // Lowest tier
    }

    // Get current tier
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { tier: true },
    });

    const currentTierOrder = member?.tier?.sort_order || 0;
    const newTierOrder = newTier?.sort_order || 0;
    const isUpgrade = newTierOrder > currentTierOrder;

    return {
      tierId: newTier?.id || '',
      tierName: newTier?.name || 'Bronze',
      changed: member?.current_tier_id !== newTier?.id,
      isUpgrade,
    };
  }

  async shouldDowngrade(memberId: string): Promise<boolean> {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { tier: true },
    });

    if (!member?.tier_downgrade_at) return false;

    const graceEnd = new Date(member.tier_downgrade_at);
    graceEnd.setDate(graceEnd.getDate() + this.GRACE_DAYS);

    return new Date() > graceEnd;
  }

  async getTierBenefits(tierId: string): Promise<{ free_item?: string } | null> {
    if (!tierId) return null;

    const tier = await this.prisma.loyaltyTier.findUnique({
      where: { id: tierId },
      include: { free_item_id: true },
    });

    if (!tier?.free_item_id) return null;

    const product = await this.prisma.product.findUnique({
      where: { id: tier.free_item_id },
    });

    return product ? { free_item: product.name } : null;
  }
}
```

- [ ] **Step 3: Create member service**

Create `backend/src/members/application/services/member.service.ts`:

```typescript
import { Injectable, Inject, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { LoyaltyService } from './loyalty.service';
import { IMemberRepository } from '../../domain/interfaces/member.repository.interface';

@Injectable()
export class MemberService {
  constructor(
    @Inject('MEMBER_REPOSITORY')
    private readonly memberRepository: IMemberRepository,
    private readonly redisService: RedisService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  async register(data: { name: string; phone: string; email?: string; ref_code?: string }) {
    // Check phone uniqueness
    const existing = await this.memberRepository.findByPhone(data.phone);
    if (existing) {
      throw new ConflictException('No. HP sudah terdaftar. Silakan gunakan no. HP lain.');
    }

    // Generate member code
    let memberCode: string;
    let attempts = 0;
    do {
      memberCode = this.loyaltyService.generateMemberCode();
      const existingCode = await this.memberRepository.findByMemberCode(memberCode);
      if (!existingCode) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      throw new BadRequestException('Gagal membuat kode member. Silakan coba lagi.');
    }

    // Get Bronze tier (default)
    const bronzeTier = await this.getBronzeTier();

    // Create member
    const member = await this.memberRepository.create({
      member_code: memberCode,
      phone: data.phone,
      name: data.name,
      email: data.email,
      registered_via: 'qr_link',
      registered_outlet_id: this.decodeRefCode(data.ref_code),
      current_tier_id: bronzeTier.id,
    });

    return {
      id: member.id,
      member_code: member.member_code,
      name: member.name,
      phone: member.phone,
      tier: member.tier?.name || 'Bronze',
      loyalty_points: member.loyalty_points,
      registered_at: member.registered_at,
    };
  }

  async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
    let member;

    if (identifier.phone) {
      member = await this.memberRepository.findByPhone(identifier.phone);
    } else if (identifier.code) {
      member = await this.memberRepository.findByMemberCode(identifier.code);
    } else if (identifier.qr) {
      // Decode QR ref and lookup
      member = await this.lookupByQR(identifier.qr);
    }

    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    // Check cooldown
    const cooldownUntil = await this.getCooldownUntil(member.id);

    return {
      id: member.id,
      member_code: member.member_code,
      name: member.name,
      tier: member.tier?.name || 'Bronze',
      loyalty_points: member.loyalty_points,
      points_value: this.loyaltyService.calculateRedeemValue(member.loyalty_points),
      can_earn: !cooldownUntil,
      cooldown_until: cooldownUntil,
    };
  }

  async processPoints(data: {
    member_id: string;
    order_id?: string;
    transaction_subtotal: number;
    redeem_requested: boolean;
    cashier_id?: string;
  }) {
    const member = await this.memberRepository.findById(data.member_id);
    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    if (!member.is_active) {
      throw new BadRequestException('Member sudah tidak aktif');
    }

    let pointsEarned = 0;
    let pointsRedeemed = 0;
    let discountAmount = 0;
    let finalPayment: number | undefined;

    // Check cooldown for earning
    const cooldownUntil = await this.getCooldownUntil(data.member_id);
    const canEarn = !cooldownUntil;

    // Handle redemption (if requested)
    if (data.redeem_requested && member.loyalty_points > 0) {
      pointsRedeemed = member.loyalty_points;
      discountAmount = this.loyaltyService.calculateRedeemValue(pointsRedeemed);
      
      // Create redeem transaction
      await this.memberRepository.createTransaction({
        member_id: data.member_id,
        order_id: data.order_id,
        type: 'redeem',
        points: -pointsRedeemed,
        balance_after: 0,
        description: `Redeem ${pointsRedeemed} pts`,
        cashier_id: data.cashier_id,
      });

      // Update balance to 0
      await this.memberRepository.updatePoints(data.member_id, 0);

      // Calculate final payment
      finalPayment = Math.max(0, data.transaction_subtotal - discountAmount);
    }

    // Handle earning (after payment success, not during cooldown)
    if (canEarn) {
      pointsEarned = this.loyaltyService.calculatePointsEarned(data.transaction_subtotal);

      if (pointsEarned > 0) {
        const newBalance = member.loyalty_points - pointsRedeemed + pointsEarned;

        await this.memberRepository.createTransaction({
          member_id: data.member_id,
          order_id: data.order_id,
          type: 'earn',
          points: pointsEarned,
          balance_after: newBalance,
          description: `Earn ${pointsEarned} pts`,
          cashier_id: data.cashier_id,
        });

        // Set cooldown
        const cooldownUntilDate = new Date(Date.now() + this.loyaltyService.COOLDOWN_MINUTES * 60 * 1000);
        await this.setCooldown(data.member_id, cooldownUntilDate);

        // Update balance
        await this.memberRepository.updatePoints(data.member_id, newBalance);

        // Evaluate tier
        const tierResult = await this.loyaltyService.evaluateTier(data.member_id, newBalance);
        if (tierResult.changed) {
          await this.memberRepository.updateTier(data.member_id, tierResult.tierId);
        }
      }
    }

    // Get updated member
    const updatedMember = await this.memberRepository.findById(data.member_id);
    const tierBenefits = await this.loyaltyService.getTierBenefits(updatedMember?.current_tier_id || '');

    return {
      points_earned: pointsEarned,
      points_redeemed: pointsRedeemed,
      discount_amount: discountAmount,
      final_payment: finalPayment,
      new_balance: updatedMember?.loyalty_points || 0,
      cooldown_until: canEarn ? new Date(Date.now() + this.loyaltyService.COOLDOWN_MINUTES * 60 * 1000) : cooldownUntil,
      tier: updatedMember?.tier?.name || 'Bronze',
      tier_changed: false, // Simplified
      tier_benefits: tierBenefits,
    };
  }

  async revokePoints(orderId: string) {
    // Find transactions for this order
    const transactions = await this.prisma.memberTransaction.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });

    if (transactions.length === 0) return;

    const memberId = transactions[0].member_id;

    for (const tx of transactions) {
      if (tx.type === 'earn') {
        // Revoke earned points
        await this.memberRepository.createTransaction({
          member_id: memberId,
          type: 'void_revoke',
          points: tx.points,
          balance_after: tx.balance_after - tx.points,
          description: `Void: ${tx.reference_order || orderId}`,
          reference_order: orderId,
        });
      } else if (tx.type === 'redeem') {
        // Restore redeemed points
        await this.memberRepository.createTransaction({
          member_id: memberId,
          type: 'void_restore',
          points: Math.abs(tx.points),
          balance_after: tx.balance_after + Math.abs(tx.points),
          description: `Void restore: ${tx.reference_order || orderId}`,
          reference_order: orderId,
        });
      }
    }

    // Recalculate balance
    const allTxs = await this.memberRepository.getTransactionHistory(memberId, 1000);
    const currentBalance = allTxs.reduce((sum, tx) => sum + tx.points, 0);
    await this.memberRepository.updatePoints(memberId, Math.max(0, currentBalance));
  }

  async getAllMembers(options?: { page?: number; limit?: number; tier?: string; search?: string }) {
    return this.memberRepository.findAll(options);
  }

  async getMemberDetail(id: string) {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    const transactions = await this.memberRepository.getTransactionHistory(id);
    const tierBenefits = await this.loyaltyService.getTierBenefits(member.current_tier_id || '');

    return {
      ...member,
      points_value: this.loyaltyService.calculateRedeemValue(member.loyalty_points),
      tier_benefits: tierBenefits,
      transactions,
    };
  }

  async getStats() {
    const prisma = this.prisma;
    const [
      totalMembers,
      newThisMonth,
      tierDistribution,
      topRedeemers,
    ] = await Promise.all([
      prisma.member.count({ where: { is_active: true } }),
      prisma.member.count({
        where: {
          is_active: true,
          registered_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      prisma.member.groupBy({
        by: ['current_tier_id'],
        where: { is_active: true },
        _count: true,
      }),
      prisma.memberTransaction.groupBy({
        by: ['member_id'],
        where: { type: 'redeem' },
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
        take: 10,
      }),
    ]);

    // Get tier names
    const tiers = await prisma.loyaltyTier.findMany();
    const tierMap = new Map(tiers.map(t => [t.id, t.name]));

    const distribution: Record<string, number> = {};
    for (const td of tierDistribution) {
      const name = tierMap.get(td.current_tier_id || '') || 'Bronze';
      distribution[name] = td._count;
    }

    return {
      total_members: totalMembers,
      new_this_month: newThisMonth,
      tier_distribution: distribution,
      top_redeemers: topRedeemers,
    };
  }

  // Private helpers
  private async getBronzeTier() {
    const prisma = this.prisma;
    return prisma.loyaltyTier.findFirst({ where: { name: 'Bronze' } });
  }

  private decodeRefCode(ref?: string): string | null {
    if (!ref) return null;
    try {
      // Base64 decode
      return Buffer.from(ref, 'base64').toString('utf-8');
    } catch {
      return ref;
    }
  }

  private async lookupByQR(qr: string): Promise<any> {
    // QR contains member_code directly
    return this.memberRepository.findByMemberCode(qr);
  }

  private async getCooldownUntil(memberId: string): Promise<Date | null> {
    const key = `member:cooldown:${memberId}`;
    const value = await this.redisService.get(key);
    if (!value) return null;
    const until = new Date(value);
    return until > new Date() ? until : null;
  }

  private async setCooldown(memberId: string, until: Date): Promise<void> {
    const key = `member:cooldown:${memberId}`;
    const ttlSeconds = Math.max(0, Math.floor((until.getTime() - Date.now()) / 1000));
    if (ttlSeconds > 0) {
      await this.redisService.set(key, until.toISOString(), ttlSeconds);
    }
  }

  // Get prisma for internal use
  private get prisma() {
    return (this.memberRepository as any).prisma || (this.memberRepository as any).client;
  }
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add backend/src/members/application/services/
git commit -m "feat(members): add MemberService and LoyaltyService"
```

---

### Task 7: Create Member Controllers

**Files:**
- Create: `backend/src/members/presentation/member.controller.ts`
- Create: `backend/src/members/presentation/pos-member.controller.ts`
- Create: `backend/src/members/presentation/admin-member.controller.ts`

- [ ] **Step 1: Create controllers directory**

Run: `mkdir -p backend/src/members/presentation`

- [ ] **Step 2: Create public member controller**

Create `backend/src/members/presentation/member.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { RegisterMemberDto } from '../application/dto/register-member.dto';
import { LookupMemberQueryDto } from '../application/dto/lookup-member.dto';

@ApiTags('Members')
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new member' })
  @ApiBody({ type: RegisterMemberDto })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Phone already registered' })
  async register(@Body() dto: RegisterMemberDto) {
    const member = await this.memberService.register(dto);
    return {
      success: true,
      data: member,
      message: 'Pendaftaran berhasil! Selamat datang di NGEMILOH Members.',
    };
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup member by phone/code/QR' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async lookup(@Query() query: LookupMemberQueryDto) {
    const member = await this.memberService.lookup(query);
    return { success: true, data: member };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get member info by code' })
  @ApiResponse({ status: 200, description: 'Member info' })
  async getByCode(@Query('code') code: string) {
    const member = await this.memberService.lookup({ code });
    return { success: true, data: member };
  }
}
```

- [ ] **Step 3: Create POS member controller**

Create `backend/src/members/presentation/pos-member.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LookupMemberQueryDto } from '../application/dto/lookup-member.dto';
import { ProcessMemberPointsDto } from '../application/dto/process-points.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('POS - Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pos/member')
export class PosMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('lookup')
  @ApiOperation({ summary: 'Lookup member for POS' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async lookup(@Query() query: LookupMemberQueryDto) {
    const member = await this.memberService.lookup(query);
    return { success: true, data: member };
  }

  @Post('process')
  @ApiOperation({ summary: 'Process member points (earn + optional redeem)' })
  @ApiResponse({ status: 200, description: 'Points processed' })
  async processPoints(@Body() dto: ProcessMemberPointsDto, @Req() req: AuthenticatedRequest) {
    const result = await this.memberService.processPoints({
      ...dto,
      cashier_id: req.user.id,
    });
    return { success: true, data: result };
  }
}
```

- [ ] **Step 4: Create admin member controller**

Create `backend/src/members/presentation/admin-member.controller.ts`:

```typescript
import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('Admin - Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Controller('admin/members')
@Roles(Role.superadmin)
export class AdminMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'List all members' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.memberService.getAllMembers({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      tier,
      search,
    });
    return { success: true, data: result };
  }

  @Get('stats')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get member statistics' })
  async stats() {
    const stats = await this.memberService.getStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member detail' })
  @ApiResponse({ status: 200, description: 'Member detail' })
  async detail(@Param('id') id: string) {
    const member = await this.memberService.getMemberDetail(id);
    return { success: true, data: member };
  }
}
```

- [ ] **Step 5: Commit**

Run:
```bash
git add backend/src/members/presentation/
git commit -m "feat(members): add member controllers (public, POS, admin)"
```

---

### Task 8: Create Members Module

**Files:**
- Create: `backend/src/members/members.module.ts`

- [ ] **Step 1: Create module file**

Create `backend/src/members/members.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MemberService } from './application/services/member.service';
import { LoyaltyService } from './application/services/loyalty.service';
import { MemberController } from './presentation/member.controller';
import { PosMemberController } from './presentation/pos-member.controller';
import { AdminMemberController } from './presentation/admin-member.controller';
import { PrismaMemberRepository } from './infrastructure/repositories/prisma-member.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    MemberService,
    LoyaltyService,
    {
      provide: 'MEMBER_REPOSITORY',
      useClass: PrismaMemberRepository,
    },
  ],
  controllers: [MemberController, PosMemberController, AdminMemberController],
  exports: [MemberService],
})
export class MembersModule {}
```

- [ ] **Step 2: Register module in app.module.ts**

Read: `backend/src/app.module.ts`

Add import:
```typescript
import { MembersModule } from './members/members.module';
```

Add to imports array:
```typescript
MembersModule,
```

- [ ] **Step 3: Verify build**

Run: `cd backend && npm run build 2>&1 | head -50`
Expected: Should compile without major errors

- [ ] **Step 4: Commit**

Run:
```bash
git add backend/src/members/ backend/src/app.module.ts
git commit -m "feat(members): create MembersModule and register in app"
```

---

## PART 2: POS Integration

---

### Task 9: Add Member Types to Frontend

**Files:**
- Modify: `frontend/src/lib/domain/models/types.ts`

- [ ] **Step 1: Add member types**

Read: `frontend/src/lib/domain/models/types.ts`

Add to end of file:

```typescript
// Member & Loyalty Types
export interface MemberData {
  id: string;
  member_code: string;
  name: string;
  phone: string;
  email?: string;
  tier: string;
  loyalty_points: number;
  points_value: number;
  registered_at: string;
  registered_via: string;
  can_earn: boolean;
  cooldown_until?: string | null;
}

export interface MemberTransactionData {
  id: string;
  type: 'earn' | 'redeem' | 'adjust' | 'void_revoke' | 'void_restore';
  points: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface ProcessPointsResponse {
  points_earned: number;
  points_redeemed: number;
  discount_amount: number;
  final_payment?: number;
  new_balance: number;
  cooldown_until: string | null;
  tier: string;
  tier_changed: boolean;
  tier_benefits: { free_item?: string } | null;
}

export interface MemberStats {
  total_members: number;
  new_this_month: number;
  tier_distribution: Record<string, number>;
  top_redeemers: Array<{ member_id: string; name: string; points_redeemed: number }>;
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/lib/domain/models/types.ts
git commit -m "feat(members): add member types to frontend"
```

---

### Task 10: Create Member Service (Frontend)

**Files:**
- Create: `frontend/src/lib/services/member.service.ts`

- [ ] **Step 1: Create service file**

Create `frontend/src/lib/services/member.service.ts`:

```typescript
import { api } from './api.client';
import type { ApiResponse, MemberData, ProcessPointsResponse, MemberStats } from '../domain/models/types';

export class MemberService {
  async register(data: { name: string; phone: string; email?: string; ref_code?: string }) {
    const res = await api.post('/member/register', data);
    const json: ApiResponse<MemberData> = await res.json();
    return json;
  }

  async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
    const params = new URLSearchParams();
    if (identifier.phone) params.append('phone', identifier.phone);
    if (identifier.code) params.append('code', identifier.code);
    if (identifier.qr) params.append('qr', identifier.qr);

    const res = await api.get(`/member/lookup?${params.toString()}`);
    const json: ApiResponse<MemberData> = await res.json();
    return json;
  }

  async posLookup(identifier: { phone?: string; code?: string; qr?: string }) {
    const params = new URLSearchParams();
    if (identifier.phone) params.append('phone', identifier.phone);
    if (identifier.code) params.append('code', identifier.code);
    if (identifier.qr) params.append('qr', identifier.qr);

    const res = await api.get(`/pos/member/lookup?${params.toString()}`, {
      credentials: 'include'
    });
    const json: ApiResponse<MemberData> = await res.json();
    return json;
  }

  async processPoints(data: {
    member_id: string;
    order_id?: string;
    transaction_subtotal: number;
    redeem_requested: boolean;
  }) {
    const res = await api.post('/pos/member/process', data, {
      credentials: 'include'
    });
    const json: ApiResponse<ProcessPointsResponse> = await res.json();
    return json;
  }

  async getMembers(options?: { page?: number; limit?: number; tier?: string; search?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', String(options.page));
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.tier) params.append('tier', options.tier);
    if (options?.search) params.append('search', options.search);

    const res = await api.get(`/admin/members?${params.toString()}`, {
      credentials: 'include'
    });
    const json: ApiResponse<any> = await res.json();
    return json;
  }

  async getMemberDetail(id: string) {
    const res = await api.get(`/admin/members/${id}`, {
      credentials: 'include'
    });
    const json: ApiResponse<any> = await res.json();
    return json;
  }

  async getStats() {
    const res = await api.get('/admin/members/stats', {
      credentials: 'include'
    });
    const json: ApiResponse<MemberStats> = await res.json();
    return json;
  }
}

export const member_service = new MemberService();
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/lib/services/member.service.ts
git commit -m "feat(members): create frontend member service"
```

---

### Task 11: Add Member Store (Svelte 5 Runes)

**Files:**
- Create: `frontend/src/lib/stores/member.store.svelte.ts`

- [ ] **Step 1: Create store file**

Create `frontend/src/lib/stores/member.store.svelte.ts`:

```typescript
import { member_service } from '$lib/services/member.service';
import type { MemberData } from '$lib/domain/models/types';

class MemberStore {
  currentMember: MemberData | null = $state(null);
  isLoading = $state(false);
  error: string | null = $state(null);
  showLookupModal = $state(false);
  redeemPending = $state(false);
  selectedForRedeem = $state(false);

  async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
    this.isLoading = true;
    this.error = null;
    try {
      const result = await member_service.posLookup(identifier);
      if (result.success) {
        this.currentMember = result.data;
      } else {
        this.error = result.message || 'Member tidak ditemukan';
        this.currentMember = null;
      }
    } catch (e) {
      this.error = 'Gagal mencari member';
      this.currentMember = null;
    } finally {
      this.isLoading = false;
    }
  }

  async processPoints(data: {
    order_id?: string;
    transaction_subtotal: number;
    redeem_requested: boolean;
  }) {
    if (!this.currentMember) return null;

    this.redeemPending = true;
    try {
      const result = await member_service.processPoints({
        member_id: this.currentMember.id,
        ...data,
      });

      if (result.success) {
        // Update member balance
        if (this.currentMember) {
          this.currentMember = {
            ...this.currentMember,
            loyalty_points: result.data.new_balance,
            points_value: Math.floor(result.data.new_balance / 5) * 1000,
            tier: result.data.tier,
          };
        }
      }

      return result;
    } finally {
      this.redeemPending = false;
    }
  }

  clear() {
    this.currentMember = null;
    this.error = null;
    this.showLookupModal = false;
    this.selectedForRedeem = false;
  }

  get formatPointsValue() {
    if (!this.currentMember) return 'Rp 0';
    const value = Math.floor(this.currentMember.loyalty_points / 5) * 1000;
    return `Rp ${value.toLocaleString('id-ID')}`;
  }

  get canEarn() {
    if (!this.currentMember) return false;
    if (!this.currentMember.can_earn) return false;
    // Check cooldown
    if (this.currentMember.cooldown_until) {
      return new Date(this.currentMember.cooldown_until) < new Date();
    }
    return true;
  }
}

export const member_store = new MemberStore();
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/lib/stores/member.store.svelte.ts
git commit -m "feat(members): add member store with Svelte 5 runes"
```

---

### Task 12: Create Member Lookup Modal Component

**Files:**
- Create: `frontend/src/lib/components/pos/MemberLookupModal.svelte`

- [ ] **Step 1: Create component**

Create `frontend/src/lib/components/pos/MemberLookupModal.svelte`:

```svelte
<script lang="ts">
  import { member_store } from '$lib/stores/member.store.svelte';
  import { toast } from '$lib/stores/toast.store.svelte';

  interface Props {
    onClose: () => void;
    onMemberSelected: (usePoints: boolean) => void;
  }

  let { onClose, onMemberSelected }: Props = $props();

  let searchInput = $state('');
  let searchMode = $state<'phone' | 'code'>('phone');

  async function handleSearch() {
    if (!searchInput.trim()) return;

    if (searchMode === 'phone') {
      await member_store.lookup({ phone: searchInput });
    } else {
      await member_store.lookup({ code: searchInput });
    }

    if (member_store.error) {
      toast.error(member_store.error);
    }
  }

  function handleSelect() {
    if (!member_store.currentMember) return;
    
    member_store.showLookupModal = false;
    onMemberSelected(member_store.selectedForRedeem);
  }

  function handleClose() {
    member_store.clear();
    onClose();
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-200 p-4">
      <h2 class="text-lg font-bold text-slate-800">🔍 Cari Member</h2>
      <button onclick={handleClose} class="rounded-lg p-2 hover:bg-slate-100">
        <svg class="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="p-4 space-y-4">
      {#if !member_store.currentMember}
        <!-- Search Form -->
        <div class="space-y-3">
          <!-- Mode Toggle -->
          <div class="flex gap-2">
            <button
              onclick={() => { searchMode = 'phone'; searchInput = ''; }}
              class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors {searchMode === 'phone' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}"
            >
              📱 Nomor HP
            </button>
            <button
              onclick={() => { searchMode = 'code'; searchInput = ''; }}
              class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors {searchMode === 'code' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}"
            >
              🏷️ ID Member
            </button>
          </div>

          <!-- Input -->
          <input
            type={searchMode === 'phone' ? 'tel' : 'text'}
            bind:value={searchInput}
            placeholder={searchMode === 'phone' ? '081234567890' : 'MBR-A1B2C3'}
            class="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <!-- Search Button -->
          <button
            onclick={handleSearch}
            disabled={member_store.isLoading || !searchInput.trim()}
            class="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
          >
            {member_store.isLoading ? 'Mencari...' : '🔍 Cari'}
          </button>
        </div>

      {:else}
        <!-- Member Found -->
        <div class="space-y-4">
          <div class="rounded-lg bg-emerald-50 p-4">
            <div class="flex items-center gap-2 text-emerald-700">
              <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span class="font-bold">Member Ditemukan!</span>
            </div>
          </div>

          <!-- Member Info -->
          <div class="space-y-2 rounded-lg border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <span class="text-slate-600">Nama</span>
              <span class="font-bold text-slate-800">{member_store.currentMember.name}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600">ID</span>
              <span class="font-mono text-slate-800">{member_store.currentMember.member_code}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-600">Tier</span>
              <span class="font-bold text-amber-600">{member_store.currentMember.tier}</span>
            </div>
            <div class="flex items-center justify-between border-t border-slate-100 pt-2">
              <span class="text-slate-600">Saldo Poin</span>
              <div class="text-right">
                <span class="text-xl font-black text-blue-600">{member_store.currentMember.loyalty_points} pts</span>
                <span class="ml-2 text-sm text-slate-500">({member_store.formatPointsValue})</span>
              </div>
            </div>
          </div>

          <!-- Redeem Option -->
          {#if member_store.currentMember.loyalty_points > 0}
            <label class="flex items-center gap-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 cursor-pointer hover:bg-blue-100 transition-colors">
              <input
                type="checkbox"
                bind:checked={member_store.selectedForRedeem}
                class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div class="flex-1">
                <span class="font-bold text-blue-800">Pakai Poin?</span>
                <p class="text-sm text-blue-600">
                  Tersedia {member_store.currentMember.loyalty_points} poin ({member_store.formatPointsValue})
                </p>
              </div>
            </label>
          {/if}

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              onclick={() => { searchInput = ''; member_store.currentMember = null; }}
              class="flex-1 rounded-lg border border-slate-300 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              🔄 Cari Lagi
            </button>
            <button
              onclick={handleSelect}
              class="flex-1 rounded-lg bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
            >
              ✅ Pilih
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/lib/components/pos/MemberLookupModal.svelte
git commit -m "feat(members): add member lookup modal component"
```

---

### Task 13: Integrate POS with Member System

**Files:**
- Modify: `frontend/src/routes/pos/+page.svelte`

- [ ] **Step 1: Read POS page**

Read: `frontend/src/routes/pos/+page.svelte` (first 100 lines)

- [ ] **Step 2: Add member state and modal**

Add to script section:
```typescript
import { member_store } from '$lib/stores/member.store.svelte';
import MemberLookupModal from '$lib/components/pos/MemberLookupModal.svelte';

// Add to component state
let showMemberModal = $state(false);
let memberUsePoints = $state(false);
```

Add to template (after cart section or before payment):
```svelte
<!-- Member Section -->
<div class="rounded-lg border border-slate-200 bg-white p-3">
  {#if member_store.currentMember}
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-lg">👤</span>
        <div>
          <span class="font-bold text-slate-800">{member_store.currentMember.name}</span>
          <span class="ml-2 text-xs text-slate-500">{member_store.currentMember.member_code}</span>
        </div>
      </div>
      <div class="text-right">
        <span class="font-bold text-blue-600">{member_store.currentMember.loyalty_points} pts</span>
        {#if memberUsePoints && member_store.currentMember.loyalty_points > 0}
          <span class="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
            -{member_store.formatPointsValue}
          </span>
        {/if}
      </div>
    </div>
  {:else}
    <button
      onclick={() => { showMemberModal = true; }}
      class="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-2 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-600"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span class="font-medium">Tambah Member</span>
    </button>
  {/if}
</div>

{#if showMemberModal}
  <MemberLookupModal
    onClose={() => { showMemberModal = false; }}
    onMemberSelected={(usePoints) => {
      memberUsePoints = usePoints;
      showMemberModal = false;
    }}
  />
{/if}
```

- [ ] **Step 3: Adjust payment calculation**

In payment section, calculate discount:
```typescript
let finalTotal = $derived(() => {
  let total = pos_store.cart_total;
  if (memberUsePoints && member_store.currentMember) {
    const discount = member_store.currentMember.points_value;
    total = Math.max(0, total - discount);
  }
  return total;
});
```

- [ ] **Step 4: Commit**

Run:
```bash
git add frontend/src/routes/pos/+page.svelte
git commit -m "feat(pos): integrate member lookup and redemption"
```

---

### Task 14: Update Receipt to Include Member Info

**Files:**
- Modify: `backend/src/receipts/...`

- [ ] **Step 1: Read receipt service**

Glob: `backend/src/receipts/**/*.ts`

- [ ] **Step 2: Add member info to receipt**

Add to receipt data:
```typescript
// If order has member_id, include member info
if (order.member_id) {
  const member = await prisma.member.findUnique({
    where: { id: order.member_id },
    include: { tier: true },
  });
  
  if (member) {
    receiptData.member = {
      name: member.name,
      code: member.member_code,
      tier: member.tier?.name,
      points_earned: pointsEarned,
      total_points: member.loyalty_points,
    };
  }
}
```

- [ ] **Step 3: Update receipt template**

Add member section to receipt HTML/text template:
```html
{#if receipt.member}
<div class="receipt-member">
  <div class="text-center border-t border-b border-dashed py-2 my-2">
    <span class="text-xs">👤 Member: {receipt.member.name} ({receipt.member.code})</span>
    <span class="text-xs"> | {receipt.member.tier}</span>
    <br>
    <span class="text-xs">💰 Poin: +{receipt.member.points_earned} pts</span>
    <span class="text-xs"> (Total: {receipt.member.total_points} pts)</span>
  </div>
</div>
{/if}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add backend/src/receipts/
git commit -m "feat(receipts): add member info to receipts"
```

---

## PART 3: Admin Dashboard

---

### Task 15: Create Admin Members Page

**Files:**
- Create: `frontend/src/routes/admin/members/+page.svelte`

- [ ] **Step 1: Create page**

Run: `mkdir -p frontend/src/routes/admin/members`

Create `frontend/src/routes/admin/members/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { member_service } from '$lib/services/member.service';
  import { toast } from '$lib/stores/toast.store.svelte';

  let members: any[] = $state([]);
  let total = $state(0);
  let isLoading = $state(false);
  let search = $state('');
  let page = $state(1);
  let limit = $state(20);

  onMount(() => {
    fetchMembers();
  });

  async function fetchMembers() {
    isLoading = true;
    try {
      const result = await member_service.getMembers({ page, limit, search });
      if (result.success) {
        members = result.data.data;
        total = result.data.total;
      }
    } catch (e) {
      toast.error('Gagal memuat data member');
    } finally {
      isLoading = false;
    }
  }

  function handleSearch() {
    page = 1;
    fetchMembers();
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Members</h1>
      <p class="text-slate-500">Total {total} member terdaftar</p>
    </div>
    <a
      href="/admin/members/analytics"
      class="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
    >
      📊 Analytics
    </a>
  </div>

  <!-- Search -->
  <div class="flex gap-2">
    <input
      type="text"
      bind:value={search}
      placeholder="Cari nama, HP, atau ID..."
      class="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium"
      onkeydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <button onclick={handleSearch} class="rounded-lg bg-slate-700 px-6 py-2 font-bold text-white">
      🔍 Cari
    </button>
  </div>

  <!-- Table -->
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
        <tr>
          <th class="px-4 py-3">Member</th>
          <th class="px-4 py-3">ID</th>
          <th class="px-4 py-3">HP</th>
          <th class="px-4 py-3">Tier</th>
          <th class="px-4 py-3 text-right">Poin</th>
          <th class="px-4 py-3">Register</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200">
        {#each members as member}
          <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 font-medium text-slate-800">{member.name}</td>
            <td class="px-4 py-3 font-mono text-slate-600">{member.member_code}</td>
            <td class="px-4 py-3 text-slate-600">{member.phone}</td>
            <td class="px-4 py-3">
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {member.tier?.name || 'Bronze'}
              </span>
            </td>
            <td class="px-4 py-3 text-right font-bold text-blue-600">
              {member.loyalty_points} pts
            </td>
            <td class="px-4 py-3 text-slate-500">
              {new Date(member.registered_at).toLocaleDateString('id-ID')}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">
              {isLoading ? 'Memuat...' : 'Belum ada member'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if total > limit}
    <div class="flex items-center justify-between">
      <span class="text-sm text-slate-500">
        Halaman {page} dari {Math.ceil(total / limit)}
      </span>
      <div class="flex gap-2">
        <button
          onclick={() => { page = Math.max(1, page - 1); fetchMembers(); }}
          disabled={page === 1}
          class="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50"
        >
          ← Prev
        </button>
        <button
          onclick={() => { page++; fetchMembers(); }}
          disabled={page * limit >= total}
          class="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/routes/admin/members/+page.svelte
git commit -m "feat(admin): create members list page"
```

---

### Task 16: Create Member Analytics Page

**Files:**
- Create: `frontend/src/routes/admin/members/analytics/+page.svelte`

- [ ] **Step 1: Create page**

Run: `mkdir -p frontend/src/routes/admin/members/analytics`

Create `frontend/src/routes/admin/members/analytics/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { member_service } from '$lib/services/member.service';
  import { toast } from '$lib/stores/toast.store.svelte';

  let stats: any = $state(null);
  let isLoading = $state(false);

  onMount(() => {
    fetchStats();
  });

  async function fetchStats() {
    isLoading = true;
    try {
      const result = await member_service.getStats();
      if (result.success) {
        stats = result.data;
      }
    } catch (e) {
      toast.error('Gagal memuat statistik');
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Member Analytics</h1>
    <p class="text-slate-500">Statistik program loyalitas member</p>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-pulse text-slate-500">Memuat...</div>
    </div>
  {:else if stats}
    <!-- KPI Cards -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Total Member</div>
        <div class="text-3xl font-black text-slate-800">{stats.total_members.toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Member Baru (Bulan Ini)</div>
        <div class="text-3xl font-black text-emerald-600">+{stats.new_this_month}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Tier Distribution</div>
        <div class="mt-2 space-y-1 text-sm">
          {#each Object.entries(stats.tier_distribution || {}) as [tier, count]}
            <div class="flex justify-between">
              <span>{tier}</span>
              <span class="font-bold">{count}</span>
            </div>
          {/each}
        </div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Top Redeemers</div>
        <div class="mt-2 space-y-1 text-sm">
          {#each (stats.top_redeemers || []).slice(0, 3) as redeemer}
            <div class="flex justify-between">
              <span>{redeemer.name || redeemer.member_id?.slice(0, 8)}</span>
              <span class="font-bold text-red-600">-{redeemer.points_redeemed} pts</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Tier Distribution Chart (Simple Bar) -->
    <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 class="mb-4 font-bold text-slate-800">Distribusi Tier</h3>
      <div class="space-y-3">
        {#each Object.entries(stats.tier_distribution || {}) as [tier, count]}
          {@const total = stats.total_members || 1}
          {@const pct = Math.round((count / total) * 100)}
          <div>
            <div class="mb-1 flex justify-between text-sm">
              <span class="font-medium">{tier}</span>
              <span class="text-slate-500">{count} ({pct}%)</span>
            </div>
            <div class="h-4 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                style="width: {pct}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/routes/admin/members/analytics/+page.svelte
git commit -m "feat(admin): create member analytics page"
```

---

### Task 17: Create Member Detail Page

**Files:**
- Create: `frontend/src/routes/admin/members/[id]/+page.svelte`

- [ ] **Step 1: Create page**

Run: `mkdir -p frontend/src/routes/admin/members/[id]`

Create `frontend/src/routes/admin/members/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { member_service } from '$lib/services/member.service';
  import { toast } from '$lib/stores/toast.store.svelte';

  let member: any = $state(null);
  let isLoading = $state(false);

  $effect(() => {
    const id = $page.params.id;
    if (id) fetchMember(id);
  });

  async function fetchMember(id: string) {
    isLoading = true;
    try {
      const result = await member_service.getMemberDetail(id);
      if (result.success) {
        member = result.data;
      }
    } catch (e) {
      toast.error('Gagal memuat detail member');
    } finally {
      isLoading = false;
    }
  }

  function formatType(type: string) {
    const map: Record<string, { label: string; color: string }> = {
      earn: { label: '+', color: 'text-emerald-600' },
      redeem: { label: '-', color: 'text-red-600' },
      adjust: { label: '±', color: 'text-blue-600' },
      void_revoke: { label: '-', color: 'text-red-600' },
      void_restore: { label: '+', color: 'text-emerald-600' },
    };
    return map[type] || { label: '', color: 'text-slate-600' };
  }
</script>

<div class="space-y-6">
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <div class="animate-pulse text-slate-500">Memuat...</div>
    </div>
  {:else if member}
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <a href="/admin/members" class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          ← Kembali ke Daftar
        </a>
        <h1 class="text-2xl font-black text-slate-800">{member.name}</h1>
        <p class="text-slate-500">{member.member_code}</p>
      </div>
      <span class="rounded-full bg-amber-100 px-4 py-2 text-lg font-bold text-amber-700">
        {member.tier?.name || 'Bronze'}
      </span>
    </div>

    <!-- Info Cards -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Poin</div>
        <div class="text-3xl font-black text-blue-600">{member.loyalty_points} pts</div>
        <div class="text-sm text-slate-500">= Rp {(Math.floor(member.loyalty_points / 5) * 1000).toLocaleString()}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">HP</div>
        <div class="text-xl font-bold text-slate-800">{member.phone}</div>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm text-slate-500">Terdaftar</div>
        <div class="text-xl font-bold text-slate-800">
          {new Date(member.registered_at).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 p-4">
        <h3 class="font-bold text-slate-800">Riwayat Poin</h3>
      </div>
      <div class="divide-y divide-slate-200">
        {#each member.transactions as tx}
          {@const fmt = formatType(tx.type)}
          <div class="flex items-center justify-between p-4">
            <div>
              <span class="font-medium capitalize {fmt.color}">
                {fmt.label}{Math.abs(tx.points)} pts
              </span>
              <span class="ml-2 text-sm text-slate-500">{tx.description || tx.type}</span>
            </div>
            <div class="text-right">
              <div class="font-bold text-slate-800">{tx.balance_after} pts</div>
              <div class="text-xs text-slate-500">
                {new Date(tx.created_at).toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        {:else}
          <div class="p-8 text-center text-slate-500">Belum ada transaksi poin</div>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/routes/admin/members/\[id\]/+page.svelte
git commit -m "feat(admin): create member detail page"
```

---

### Task 18: Add Admin Sidebar Link

**Files:**
- Modify: `frontend/src/routes/admin/+layout.svelte`

- [ ] **Step 1: Read layout**

Read: `frontend/src/routes/admin/+layout.svelte`

- [ ] **Step 2: Add Members link**

Add to sidebar nav items:
```typescript
{
  href: '/admin/members',
  label: 'Members',
  icon: 'users',
}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add frontend/src/routes/admin/+layout.svelte
git commit -m "feat(admin): add Members link to sidebar"
```

---

## PART 4: Registration Flow

---

### Task 19: Create Public Registration Page

**Files:**
- Create: `frontend/src/routes/member/register/+page.svelte`

- [ ] **Step 1: Create page**

Run: `mkdir -p frontend/src/routes/member/register`

Create `frontend/src/routes/member/register/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { member_service } from '$lib/services/member.service';
  import { goto } from '$app/navigation';

  let name = $state('');
  let phone = $state('');
  let email = $state('');
  let isLoading = $state(false);
  let error = $state('');
  let success = $state(false);
  let registeredMember = $state<any>(null);

  // Get ref_code from URL
  let refCode = $derived($page.url.searchParams.get('ref'));

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) {
      error = 'Nama dan HP wajib diisi';
      return;
    }

    if (!/^[0-9]{8,15}$/.test(phone)) {
      error = 'No. HP tidak valid';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const result = await member_service.register({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        ref_code: refCode || undefined,
      });

      if (result.success) {
        success = true;
        registeredMember = result.data;
      } else {
        error = result.message || 'Registrasi gagal';
      }
    } catch (e) {
      error = 'Terjadi kesalahan. Silakan coba lagi.';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
  <div class="mx-auto max-w-md px-4 py-12">
    {#if success && registeredMember}
      <!-- Success Card -->
      <div class="rounded-2xl bg-white p-8 shadow-xl">
        <div class="mb-6 text-center">
          <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg class="h-8 w-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-2xl font-black text-slate-800">Pendaftaran Berhasil!</h1>
          <p class="mt-2 text-slate-500">Selamat datang di NGEMILOH Members</p>
        </div>

        <!-- Member Card -->
        <div class="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-6">
          <div class="mb-4 text-center">
            <div class="mb-2 text-3xl">🏪 NGEMILOH</div>
            <div class="text-sm font-bold text-amber-700">MEMBERSHIP CARD</div>
          </div>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-600">Nama</span>
              <span class="font-bold text-slate-800">{registeredMember.name}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Member ID</span>
              <span class="font-mono font-bold text-slate-800">{registeredMember.member_code}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Tier</span>
              <span class="font-bold text-amber-600">{registeredMember.tier}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Poin</span>
              <span class="font-bold text-blue-600">{registeredMember.loyalty_points} pts</span>
            </div>
          </div>

          <!-- QR Placeholder -->
          <div class="mt-4 flex justify-center">
            <div class="rounded-lg bg-slate-200 p-4">
              <div class="h-24 w-24 rounded bg-slate-300"></div>
            </div>
          </div>
        </div>

        <div class="mt-6 text-center text-sm text-slate-500">
          <p>Tunjukkan kartu ini saat checkout untuk mendapatkan poin!</p>
          <p class="mt-2">1 poin = Rp 200 dari setiap pembelian</p>
        </div>

        <button
          onclick={() => goto('/')}
          class="mt-6 w-full rounded-lg bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
        >
          🛒 Mulai Belanja
        </button>
      </div>

    {:else}
      <!-- Registration Form -->
      <div class="rounded-2xl bg-white p-8 shadow-xl">
        <div class="mb-6 text-center">
          <h1 class="text-2xl font-black text-slate-800">📋 Daftar Member</h1>
          <p class="mt-2 text-slate-500">Daftar gratis dan dapatkan poin dari setiap pembelian!</p>
        </div>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
          <div>
            <label for="name" class="mb-1 block text-sm font-medium text-slate-700">
              Nama Lengkap <span class="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              bind:value={name}
              placeholder="Masukkan nama lengkap"
              class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label for="phone" class="mb-1 block text-sm font-medium text-slate-700">
              No. HP <span class="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              bind:value={phone}
              placeholder="08xxxxxxxxxx"
              class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
            />
          </div>

          <div>
            <label for="email" class="mb-1 block text-sm font-medium text-slate-700">
              Email <span class="text-xs text-slate-400">(opsional)</span>
            </label>
            <input
              id="email"
              type="email"
              bind:value={email}
              placeholder="email@contoh.com"
              class="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {#if error}
            <div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          {/if}

          <button
            type="submit"
            disabled={isLoading}
            class="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
          >
            {isLoading ? 'Mendaftarkan...' : '📝 Daftar Sekarang'}
          </button>
        </form>

        <div class="mt-6 text-center text-xs text-slate-400">
          <p>Dengan mendaftar, Anda menyetujui syarat & ketentuan</p>
          <p class="mt-1">program loyalty NGEMILOH</p>
        </div>
      </div>

      <!-- Benefits -->
      <div class="mt-6 rounded-xl bg-white p-6 shadow">
        <h3 class="mb-4 font-bold text-slate-800">🌟 Keuntungan Member</h3>
        <ul class="space-y-2 text-sm text-slate-600">
          <li class="flex items-center gap-2">
            <span class="text-emerald-500">✓</span>
            <span>Dapatkan 5 poin setiap Rp 1.000 belanja</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="text-emerald-500">✓</span>
            <span>Tukar 100 poin = Rp 1.000 discount</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="text-emerald-500">✓</span>
            <span>Tier Bronze → Silver → Gold → Platinum</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="text-emerald-500">✓</span>
            <span>Benefit tambahan untuk tier tinggi</span>
          </li>
        </ul>
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Commit**

Run:
```bash
git add frontend/src/routes/member/register/+page.svelte
git commit -m "feat(members): create public registration page"
```

---

### Task 20: Add Member Link to Receipt (QR Code)

**Files:**
- Modify: `frontend/src/routes/pos/print/+page.svelte` or receipt template

- [ ] **Step 1: Read receipt/print page**

Glob: `frontend/src/routes/pos/print/**/*.svelte`

- [ ] **Step 2: Add QR registration link**

Add to receipt footer:
```svelte
<!-- If no member, show registration QR -->
{#if !order.member_id}
  <div class="text-center border-t border-dashed pt-2 mt-2">
    <p class="text-xs text-slate-500">DAFTAR MEMBER, FREE!</p>
    <p class="text-xs text-slate-400">Scan QR atau ke:</p>
    <p class="font-mono text-xs text-blue-600">ngemiloh.com/member/register</p>
  </div>
{/if}
```

- [ ] **Step 3: Commit**

Run:
```bash
git add frontend/src/routes/pos/print/
git commit -m "feat(receipts): add member registration CTA"
```

---

## Verification

---

### Backend Verification

Run each of these commands and verify:

```bash
cd backend

# 1. Lint
npm run lint
# Expected: No errors

# 2. Build
npm run build
# Expected: Build successful

# 3. Type check
npx tsc --noEmit
# Expected: No type errors

# 4. Test (if tests exist)
npm run test
# Expected: All tests pass
```

### Frontend Verification

```bash
cd frontend

# 1. Lint
npm run lint
# Expected: No errors

# 2. Type check
npm run check
# Expected: No type errors

# 3. Build
npm run build
# Expected: Build successful
```

---

## Self-Review Checklist

- [ ] Spec coverage: All requirements covered
- [ ] Placeholder scan: No TBD/TODO in plan
- [ ] Type consistency: Consistent naming
- [ ] Task breakdown: Bite-sized steps
- [ ] File paths: Exact and verified
- [ ] Commands: Complete with expected output

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-21-member-loyalty-system.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
