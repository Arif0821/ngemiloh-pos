# QRIS Expiry Enforcement - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement cron job to void expired QRIS orders every 5 minutes, restore inventory, and send alerts.

**Architecture:** Cron job in `FinanceCronService` that checks for expired QRIS orders, voids them with proper audit logging, restores inventory, and sends email/system log alerts. Feature-flag controlled.

**Tech Stack:** NestJS @Cron, Prisma ORM, EmailService, InventoryService

---

## File Structure

| File | Action | Notes |
|------|--------|-------|
| `backend/src/finance/finance.cron.ts` | Modify | Add cron method (~80 lines) |
| `backend/src/finance/finance.module.ts` | Modify | Import InventoryModule |
| `backend/src/finance/finance.cron.spec.ts` | Create | Unit tests |

---

## Task 1: Update FinanceModule to import InventoryModule

**Files:**
- Modify: `backend/src/finance/finance.module.ts:1-21`

- [ ] **Step 1: Add InventoryModule import**

```typescript
import { Module } from '@nestjs/common';
import { FinanceController } from './presentation/finance.controller';
import { FinanceService } from './application/services/finance.service';
import { FinanceCronService } from './finance.cron';
import { FINANCE_REPOSITORY } from './domain/interfaces/finance.repository.interface';
import { PrismaFinanceRepository } from './infrastructure/repositories/prisma-finance.repository';
import { EmailModule } from '../email/email.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [EmailModule, InventoryModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceCronService,
    {
      provide: FINANCE_REPOSITORY,
      useClass: PrismaFinanceRepository,
    },
  ],
})
export class FinanceModule {}
```

- [ ] **Step 2: Verify imports**

Run: `cd backend && npx tsc --noEmit src/finance/finance.module.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/finance/finance.module.ts
git commit -m "feat(finance): import InventoryModule for stock restore on QRIS expiry"
```

---

## Task 2: Add InventoryService to FinanceCronService constructor

**Files:**
- Modify: `backend/src/finance/finance.cron.ts:1-20`

- [ ] **Step 1: Update imports and constructor**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InventoryService } from '../inventory/application/services/inventory.service';
import {
  AUTO_CLOSE_GRACE_MS,
  AUTO_CLOSE_WARNING_MS,
} from '../common/utils/constants';

@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private inventoryService: InventoryService,
  ) {}
```

- [ ] **Step 2: Verify compilation**

Run: `cd backend && npx tsc --noEmit src/finance/finance.cron.ts`
Expected: No errors related to InventoryService

- [ ] **Step 3: Commit**

```bash
git add backend/src/finance/finance.cron.ts
git commit -m "feat(finance): add InventoryService to FinanceCronService"
```

---

## Task 3: Implement checkExpiredQrisOrders cron method

**Files:**
- Modify: `backend/src/finance/finance.cron.ts` (add method at end of class)

- [ ] **Step 1: Add the cron method before closing brace of class**

Add this method to `FinanceCronService` class (before the last closing `}`):

```typescript
  // Run every 5 minutes to check for expired QRIS orders
  @Cron('*/5 * * * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async checkExpiredQrisOrders() {
    this.logger.log('Checking for expired QRIS orders...');

    // Check feature flag
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT' },
    });

    if (!flag?.is_enabled) {
      this.logger.debug('QRIS Expiry Enforcement is disabled, skipping...');
      return;
    }

    // Find expired QRIS orders
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        payment_method: {
          in: ['qris', 'split'],
        },
        status: 'pending_sync',
        payment_status: 'unpaid',
        qris_expiry_at: {
          not: null,
          lt: new Date(),
        },
      },
      select: {
        id: true,
        order_number: true,
        total_amount: true,
        qris_expiry_at: true,
        cashier: {
          select: { name: true, email: true },
        },
      },
    });

    if (expiredOrders.length === 0) {
      this.logger.debug('No expired QRIS orders found.');
      return;
    }

    this.logger.warn(
      `Found ${expiredOrders.length} expired QRIS order(s) to void`,
    );

    // Process each expired order
    const expiryMinutes = Math.round(
      (Number(process.env.QRIS_EXPIRY_SECONDS) || 900) / 60,
    );
    const voidReason = `QRIS expired: no payment received within ${expiryMinutes} minutes`;

    const results = await Promise.allSettled(
      expiredOrders.map((order) =>
        this.voidExpiredQrisOrder(order.id, voidReason),
      ),
    );

    // Count successes and failures
    const successes = results.filter(
      (r) => r.status === 'fulfilled',
    ).length;
    const failures = results.filter(
      (r) => r.status === 'rejected',
    ).length;

    const totalAmount = expiredOrders.reduce(
      (sum, o) => sum + Number(o.total_amount),
      0,
    );

    // Send alert email
    await this.sendExpiryAlert(
      successes,
      failures,
      totalAmount,
      expiredOrders.map((o) => o.order_number || o.id),
    );

    // Log to system
    await this.prisma.systemLog.create({
      data: {
        level: 'warn',
        source: 'finance.cron',
        message: `QRIS expiry void: ${successes} order(s) auto-voided, ${failures} failed`,
        metadata: JSON.stringify({
          order_ids: expiredOrders.map((o) => o.id),
          order_numbers: expiredOrders.map((o) => o.order_number),
          total_amount: totalAmount,
          expired_at: new Date().toISOString(),
        }),
      },
    });

    this.logger.log(
      `QRIS expiry processing complete: ${successes} voided, ${failures} failed`,
    );
  }

  private async voidExpiredQrisOrder(orderId: string, voidReason: string) {
    this.logger.log(`Voiding expired QRIS order: ${orderId}`);

    // 1. Restore inventory (non-blocking, log errors)
    try {
      await this.inventoryService.restoreStockForOrder(orderId);
    } catch (err) {
      this.logger.error(
        `Failed to restore stock for order ${orderId}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
      // Continue with void even if stock restore fails
    }

    // 2. Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'voided',
        payment_status: 'expired',
        void_reason: voidReason,
        voided_at: new Date(),
        voided_by: null, // System void
      },
    });

    // 3. Create audit log
    await this.prisma.auditLog.create({
      data: {
        actor_id: null, // System action
        action: 'QRIS_EXPIRY_VOID',
        entity_type: 'Order',
        entity_id: orderId,
        new_value: {
          void_reason: voidReason,
          voided_at: new Date().toISOString(),
          source: 'finance.cron',
        },
      },
    });

    this.logger.log(`Successfully voided expired QRIS order: ${orderId}`);
  }

  private async sendExpiryAlert(
    successCount: number,
    failureCount: number,
    totalAmount: number,
    orderNumbers: (string | null)[],
  ) {
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(totalAmount);

    const orderList = orderNumbers
      .filter(Boolean)
      .map((num) => `<li>${num}</li>`)
      .join('');

    const body = `
      <p><strong>${successCount}</strong> order QRIS telah di-void otomatis karena tidak dibayar dalam waktu expiry.</p>
      <p><strong>Total amount affected:</strong> ${formattedAmount}</p>
      ${failureCount > 0 ? `<p><strong>Failed:</strong> ${failureCount} order(s)</p>` : ''}
      <h4>Order List:</h4>
      <ul>${orderList}</ul>
      <p><em>Generated at: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</em></p>
    `;

    await this.emailService
      .sendAlert(
        `[NGEMILOH] QRIS Expired - ${successCount} order(s) auto-voided`,
        body,
      )
      .catch((err) =>
        this.logger.error(
          `Failed to send QRIS expiry alert email: ${err instanceof Error ? err.message : 'Unknown error'}`,
        ),
      );
  }
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build**

Run: `cd backend && npm run build 2>&1 | head -50`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add backend/src/finance/finance.cron.ts
git commit -m "feat(finance): add QRIS expiry cron job

- Check expired QRIS orders every 5 minutes
- Void expired orders and restore inventory
- Send email alert and log to system
- Feature flag: FEATURE_QRIS_EXPIRY_ENFORCEMENT

Closes: #18.1 Issue #1"
```

---

## Task 4: Write unit tests for checkExpiredQrisOrders

**Files:**
- Create: `backend/src/finance/finance.cron.spec.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { FinanceCronService } from './finance.cron';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InventoryService } from '../inventory/application/services/inventory.service';

describe('FinanceCronService', () => {
  let service: FinanceCronService;
  let prisma: PrismaService;
  let emailService: EmailService;
  let inventoryService: InventoryService;

  const mockPrisma = {
    featureFlag: { findUnique: jest.fn() },
    order: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    systemLog: { create: jest.fn() },
  };

  const mockEmailService = {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  };

  const mockInventoryService = {
    restoreStockForOrder: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<FinanceCronService>(FinanceCronService);
    prisma = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  describe('checkExpiredQrisOrders', () => {
    it('should skip when feature flag is disabled', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
        is_enabled: false,
      });

      await service.checkExpiredQrisOrders();

      expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
    });

    it('should skip when feature flag does not exist', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);

      await service.checkExpiredQrisOrders();

      expect(mockPrisma.order.findMany).not.toHaveBeenCalled();
    });

    it('should skip when no expired orders found', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
        is_enabled: true,
      });
      mockPrisma.order.findMany.mockResolvedValue([]);

      await service.checkExpiredQrisOrders();

      expect(mockPrisma.order.findMany).toHaveBeenCalled();
      expect(mockEmailService.sendAlert).not.toHaveBeenCalled();
    });

    it('should void expired orders and send alert', async () => {
      const expiredOrders = [
        {
          id: 'order-1',
          order_number: 'TRX-20260625-XX001',
          total_amount: 50000,
          qris_expiry_at: new Date(Date.now() - 1000),
          cashier: { name: 'Kasir A', email: 'kasir@test.com' },
        },
      ];

      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
        is_enabled: true,
      });
      mockPrisma.order.findMany.mockResolvedValue(expiredOrders);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.systemLog.create.mockResolvedValue({});

      await service.checkExpiredQrisOrders();

      expect(mockInventoryService.restoreStockForOrder).toHaveBeenCalledWith('order-1');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: {
          status: 'voided',
          payment_status: 'expired',
          void_reason: expect.stringContaining('QRIS expired'),
          voided_at: expect.any(Date),
          voided_by: null,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'QRIS_EXPIRY_VOID',
          entity_type: 'Order',
          entity_id: 'order-1',
        }),
      });
      expect(mockEmailService.sendAlert).toHaveBeenCalled();
      expect(mockPrisma.systemLog.create).toHaveBeenCalled();
    });

    it('should continue voiding even if inventory restore fails', async () => {
      const expiredOrders = [
        {
          id: 'order-1',
          order_number: 'TRX-20260625-XX001',
          total_amount: 50000,
          qris_expiry_at: new Date(Date.now() - 1000),
          cashier: { name: 'Kasir A', email: 'kasir@test.com' },
        },
      ];

      mockPrisma.featureFlag.findUnique.mockResolvedValue({
        name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
        is_enabled: true,
      });
      mockPrisma.order.findMany.mockResolvedValue(expiredOrders);
      mockInventoryService.restoreStockForOrder.mockRejectedValue(
        new Error('Stock restore failed'),
      );
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockPrisma.systemLog.create.mockResolvedValue({});

      await service.checkExpiredQrisOrders();

      // Order should still be voided
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'voided',
        }),
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (first run)**

Run: `cd backend && npm run test -- --testPathPattern="finance.cron.spec" 2>&1`
Expected: Tests run (may pass if implementation is correct)

- [ ] **Step 3: Verify test coverage**

Run: `cd backend && npm run test:cov -- --testPathPattern="finance.cron" 2>&1 | tail -30`
Expected: Coverage report generated

- [ ] **Step 4: Commit**

```bash
git add backend/src/finance/finance.cron.spec.ts
git commit -m "test(finance): add unit tests for QRIS expiry cron job"
```

---

## Task 5: Verify complete implementation

- [ ] **Step 1: Run full test suite**

Run: `cd backend && npm run test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `cd backend && npm run lint 2>&1 | tail -10`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `cd backend && npm run build 2>&1 | tail -10`
Expected: Build succeeds

---

## Self-Review Checklist

- [ ] Spec coverage: All design requirements implemented
  - [x] Cron every 5 minutes
  - [x] Feature flag check
  - [x] Find expired orders (qris/split, pending_sync, unpaid, qris_expiry_at < now)
  - [x] Restore inventory
  - [x] Void order (status, payment_status, void_reason, voided_at)
  - [x] Audit log (QRIS_EXPIRY_VOID)
  - [x] Email alert
  - [x] System log
- [ ] No placeholders: All code is complete
- [ ] Type consistency: All method calls match existing patterns

---

## Summary

| Task | Files | Lines |
|------|-------|-------|
| 1. Update FinanceModule | 1 modified | +2 |
| 2. Add InventoryService | 1 modified | +2 |
| 3. Implement cron method | 1 modified | ~120 |
| 4. Unit tests | 1 created | ~150 |
| **Total** | 4 files | ~275 lines |
