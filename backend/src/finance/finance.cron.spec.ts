import { Test, TestingModule } from '@nestjs/testing';
import { FinanceCronService } from './finance.cron';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InventoryService } from '../inventory/application/services/inventory.service';

const mockPrismaService = {
  featureFlag: {
    findFirst: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  systemLog: {
    create: jest.fn(),
  },
};

const mockEmailService = {
  sendAlert: jest.fn().mockResolvedValue(undefined),
};

const mockInventoryService = {
  restoreStockForOrder: jest.fn().mockResolvedValue(undefined),
};

describe('FinanceCronService', () => {
  let service: FinanceCronService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceCronService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<FinanceCronService>(FinanceCronService);
  });

  describe('checkExpiredQrisOrders', () => {
    describe('feature flag checks', () => {
      it('should skip when feature flag is disabled', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: false,
        });

        await service.checkExpiredQrisOrders();

        expect(mockPrismaService.order.findMany).not.toHaveBeenCalled();
        expect(mockEmailService.sendAlert).not.toHaveBeenCalled();
      });

      it('should skip when feature flag does not exist', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue(null);

        await service.checkExpiredQrisOrders();

        expect(mockPrismaService.order.findMany).not.toHaveBeenCalled();
        expect(mockEmailService.sendAlert).not.toHaveBeenCalled();
      });

      it('should skip when feature flag exists but is_enabled is null', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: null,
        });

        await service.checkExpiredQrisOrders();

        expect(mockPrismaService.order.findMany).not.toHaveBeenCalled();
      });
    });

    describe('query parameter verification', () => {
      it('should query only expired QRIS orders with correct filters', async () => {
        const expiredOrders = [
          {
            id: 'order-1',
            order_number: 'TRX-001',
            total_amount: 50000,
            qris_expiry_at: new Date(Date.now() - 1000),
          },
        ];

        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue(expiredOrders);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        // Verify the query filters are correct
        expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
          where: {
            payment_method: { in: ['qris', 'split'] },
            status: 'pending_sync',
            payment_status: 'unpaid',
            qris_expiry_at: {
              not: null,
              lt: expect.any(Date),
            },
          },
          select: {
            id: true,
            order_number: true,
            total_amount: true,
            qris_expiry_at: true,
          },
        });
      });
    });

    describe('no expired orders', () => {
      it('should skip when no expired orders found', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([]);

        await service.checkExpiredQrisOrders();

        expect(mockInventoryService.restoreStockForOrder).not.toHaveBeenCalled();
        expect(mockEmailService.sendAlert).not.toHaveBeenCalled();
        expect(mockPrismaService.systemLog.create).not.toHaveBeenCalled();
      });
    });

    describe('voiding expired orders', () => {
      const mockExpiredOrder = {
        id: 'order-123',
        order_number: 'ORD-20260625-001',
        total_amount: 50000,
        qris_expiry_at: new Date('2026-06-25T08:00:00Z'),
      };

      it('should void expired orders and send alert', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([mockExpiredOrder]);
        mockPrismaService.order.update.mockResolvedValue({
          ...mockExpiredOrder,
          status: 'voided',
          payment_status: 'expired',
        });
        mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        mockPrismaService.systemLog.create.mockResolvedValue({ id: 'log-1' });

        await service.checkExpiredQrisOrders();

        // Verify inventory restore was called
        expect(
          mockInventoryService.restoreStockForOrder,
        ).toHaveBeenCalledWith('order-123');

        // Verify order was updated to voided
        expect(mockPrismaService.order.update).toHaveBeenCalledWith({
          where: { id: 'order-123' },
          data: expect.objectContaining({
            status: 'voided',
            payment_status: 'expired',
            void_reason: expect.stringContaining('QRIS expired'),
          }),
        });

        // Verify audit log was created
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'QRIS_EXPIRY_VOID',
            entity_type: 'Order',
            entity_id: 'order-123',
          }),
        });

        // Verify system log was created
        expect(mockPrismaService.systemLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            level: 'info',
            source: 'finance.cron',
            message: expect.stringContaining('1 voided'),
          }),
        });

        // Verify email was sent
        expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
          'Laporan Void QRIS Kadaluarsa',
          expect.stringContaining('1'),
        );
      });

      it('should void multiple expired orders', async () => {
        const mockOrders = [
          { ...mockExpiredOrder, id: 'order-1', order_number: 'ORD-001', total_amount: 30000 },
          { ...mockExpiredOrder, id: 'order-2', order_number: 'ORD-002', total_amount: 45000 },
          { ...mockExpiredOrder, id: 'order-3', order_number: 'ORD-003', total_amount: 25000 },
        ];

        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        mockPrismaService.systemLog.create.mockResolvedValue({ id: 'log-1' });

        await service.checkExpiredQrisOrders();

        // Verify all orders were voided
        expect(
          mockInventoryService.restoreStockForOrder,
        ).toHaveBeenCalledTimes(3);
        expect(mockPrismaService.order.update).toHaveBeenCalledTimes(3);
        expect(mockPrismaService.auditLog.create).toHaveBeenCalledTimes(3);

        // Verify email was sent with summary
        expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
          'Laporan Void QRIS Kadaluarsa',
          expect.stringContaining('3'),
        );
      });

      it('should continue voiding even if inventory restore fails', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([mockExpiredOrder]);
        mockInventoryService.restoreStockForOrder.mockRejectedValue(
          new Error('Inventory restore failed'),
        );
        mockPrismaService.order.update.mockResolvedValue({
          ...mockExpiredOrder,
          status: 'voided',
          payment_status: 'expired',
        });
        mockPrismaService.auditLog.create.mockResolvedValue({ id: 'audit-1' });
        mockPrismaService.systemLog.create.mockResolvedValue({ id: 'log-1' });

        await service.checkExpiredQrisOrders();

        // Order should still be voided even though inventory restore failed
        expect(mockPrismaService.order.update).toHaveBeenCalled();
        expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
        expect(mockEmailService.sendAlert).toHaveBeenCalled();
      });

      it('should count failures when voiding fails', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([
          { ...mockExpiredOrder, id: 'order-1' },
          { ...mockExpiredOrder, id: 'order-2' },
        ]);
        mockPrismaService.order.update.mockRejectedValue(
          new Error('Database error'),
        );
        mockPrismaService.systemLog.create.mockResolvedValue({ id: 'log-1' });

        await service.checkExpiredQrisOrders();

        // System log should have warn level due to failures
        expect(mockPrismaService.systemLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            level: 'warn',
            message: expect.stringContaining('0 voided, 2 failed'),
          }),
        });
      });

      it('should set void_reason with expiry minutes from env', async () => {
        // Save original env
        const originalEnv = process.env.QRIS_EXPIRY_SECONDS;

        // Set custom expiry time
        process.env.QRIS_EXPIRY_SECONDS = '1800'; // 30 minutes

        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([mockExpiredOrder]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        // Verify void reason contains correct expiry minutes
        expect(mockPrismaService.order.update).toHaveBeenCalledWith({
          where: { id: 'order-123' },
          data: expect.objectContaining({
            void_reason: expect.stringContaining('30 minutes'),
          }),
        });

        // Restore original env
        process.env.QRIS_EXPIRY_SECONDS = originalEnv;
      });
    });

    describe('email alert content', () => {
      it('should send alert with formatted amount', async () => {
        const mockOrder = {
          id: 'order-1',
          order_number: 'ORD-001',
          total_amount: 125000,
          qris_expiry_at: new Date(),
        };

        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([mockOrder]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        // Verify email contains formatted amount
        expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
          'Laporan Void QRIS Kadaluarsa',
          expect.stringContaining('125.000'),
        );
      });

      it('should send alert with order numbers', async () => {
        const mockOrders = [
          { id: 'order-1', order_number: 'ORD-FIRST', total_amount: 10000, qris_expiry_at: new Date() },
          { id: 'order-2', order_number: 'ORD-SECOND', total_amount: 20000, qris_expiry_at: new Date() },
        ];

        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
          'Laporan Void QRIS Kadaluarsa',
          expect.stringContaining('ORD-FIRST'),
        );
        expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
          'Laporan Void QRIS Kadaluarsa',
          expect.stringContaining('ORD-SECOND'),
        );
      });

      it('should handle email send failure gracefully', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([
          { id: 'order-1', order_number: 'ORD-001', total_amount: 10000, qris_expiry_at: new Date() },
        ]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});
        mockEmailService.sendAlert.mockRejectedValue(new Error('SMTP error'));

        // Should not throw
        await expect(service.checkExpiredQrisOrders()).resolves.not.toThrow();

        // System log should still be created
        expect(mockPrismaService.systemLog.create).toHaveBeenCalled();
      });
    });

    describe('voidExpiredQrisOrder (private method via checkExpiredQrisOrders)', () => {
      it('should set voided_at timestamp', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([
          { id: 'order-1', order_number: 'ORD-001', total_amount: 10000, qris_expiry_at: new Date() },
        ]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        // Verify voided_at is set
        expect(mockPrismaService.order.update).toHaveBeenCalledWith({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            voided_at: expect.any(Date),
          }),
        });
      });

      it('should set voided_by to null for system void', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([
          { id: 'order-1', order_number: 'ORD-001', total_amount: 10000, qris_expiry_at: new Date() },
        ]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        // Verify voided_by is null (system void)
        expect(mockPrismaService.order.update).toHaveBeenCalledWith({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            voided_by: null,
          }),
        });
      });

      it('should create audit log with QRIS_EXPIRY_VOID action', async () => {
        mockPrismaService.featureFlag.findFirst.mockResolvedValue({
          name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
          is_enabled: true,
        });
        mockPrismaService.order.findMany.mockResolvedValue([
          { id: 'order-1', order_number: 'ORD-001', total_amount: 10000, qris_expiry_at: new Date() },
        ]);
        mockPrismaService.order.update.mockResolvedValue({});
        mockPrismaService.auditLog.create.mockResolvedValue({});
        mockPrismaService.systemLog.create.mockResolvedValue({});

        await service.checkExpiredQrisOrders();

        expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'QRIS_EXPIRY_VOID',
            entity_type: 'Order',
            entity_id: 'order-1',
          }),
        });
      });
    });
  });
});
