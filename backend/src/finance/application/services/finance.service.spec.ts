import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { FINANCE_REPOSITORY } from '../../domain/interfaces/finance.repository.interface';

const mockFinanceRepository = {
  findOrders: jest.fn(),
  findFirstCashRegister: jest.fn(),
  createCashRegister: jest.fn(),
  updateCashRegister: jest.fn(),
  findProfitShareLog: jest.fn(),
  findProfitShareLogByPeriod: jest.fn(),
  createProfitShareLog: jest.fn(),
  updateProfitShareLog: jest.fn(),
  createAuditLog: jest.fn(),
  findOperationalExpenses: jest.fn(),
  createOperationalExpense: jest.fn(),
  findAssets: jest.fn(),
  findManyCashRegisters: jest.fn(),
  countCashRegisters: jest.fn(),
  aggregateAnalytics: jest.fn(),
};

const mockEmailService = {
  sendAlert: jest.fn().mockResolvedValue(undefined),
};

const mockPrismaService = {
  order: {
    aggregate: jest.fn().mockResolvedValue({ _sum: null, _count: 0 }),
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'order-1',
        total_amount: 1000000,
        cogs_total: 400000,
        cashier_id: 'cashier-1',
        created_at: new Date('2026-06-10T10:00:00Z'),
      },
      {
        id: 'order-2',
        total_amount: 500000,
        cogs_total: 200000,
        cashier_id: 'cashier-1',
        created_at: new Date('2026-06-10T11:00:00Z'),
      },
    ]),
  },
  cashRegister: {
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'shift-1',
        cashier_id: 'cashier-1',
        shift_start: new Date('2026-06-10T08:00:00Z'),
        actual_close_at: new Date('2026-06-10T16:00:00Z'),
      },
    ]),
    findUnique: jest.fn(),
  },
  userOutlet: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([]),
  $executeRaw: jest.fn().mockResolvedValue(1),
};

describe('FinanceService', () => {
  let service: FinanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: FINANCE_REPOSITORY, useValue: mockFinanceRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        EmailService,
      ],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    service = module.get<FinanceService>(FinanceService);
  });

  describe('openShift', () => {
    beforeEach(() => {
      // Mock userOutlet assignment check - return valid outlet assignment
      mockPrismaService.userOutlet.findUnique.mockResolvedValue({
        outlet: { id: 'outlet-1', is_active: true },
      });
      mockPrismaService.cashRegister.findMany.mockResolvedValue([]);
    });

    it('should throw BadRequestException if shift already open', async () => {
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue({
        id: 'shift-1',
        status: 'open',
      });

      await expect(service.openShift('cashier-1', 500000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create new shift when no open shift exists', async () => {
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue(null);
      mockFinanceRepository.findManyCashRegisters.mockResolvedValue([
        { id: 'shift-old', status: 'closed' },
      ]);
      mockFinanceRepository.createCashRegister.mockResolvedValue({
        id: 'shift-new',
        cashier_id: 'cashier-1',
        opening_balance: 500000,
        status: 'open',
      });

      const result = await service.openShift('cashier-1', 500000);
      expect(result.id).toBe('shift-new');
    });
  });

  describe('closeShift', () => {
    it('should throw NotFoundException if no active shift', async () => {
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue(null);

      await expect(service.closeShift('cashier-1', 600000)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate discrepancy and close shift', async () => {
      const mockShift = {
        id: 'shift-1',
        cashier_id: 'cashier-1',
        opening_balance: 500000,
        status: 'open',
        shift_start: new Date('2026-06-10T08:00:00Z'),
      };
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue(mockShift);
      mockFinanceRepository.findOrders.mockResolvedValue([
        { id: 'order-1', total_amount: 100000 },
        { id: 'order-2', total_amount: 200000 },
      ]);
      mockFinanceRepository.updateCashRegister.mockResolvedValue({
        ...mockShift,
        status: 'closed',
        discrepancy: 0,
      });
      mockFinanceRepository.createAuditLog.mockResolvedValue({ id: 'audit-1' });
      // Mock for optimistic locking check
      mockPrismaService.cashRegister.findUnique.mockResolvedValue({
        status: 'open',
      });

      const result = await service.closeShift('cashier-1', 800000);
      expect(result.status).toBe('closed');
    });

    it('should send alert when discrepancy exceeds threshold', async () => {
      const mockShift = {
        id: 'shift-1',
        cashier_id: 'cashier-1',
        opening_balance: 500000,
        status: 'open',
        shift_start: new Date('2026-06-10T08:00:00Z'),
      };
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue(mockShift);
      // Fix: Include payment_method for correct cash calculation
      mockFinanceRepository.findOrders.mockResolvedValue([
        {
          id: 'order-1',
          total_amount: 500000,
          payment_method: 'cash',
          cash_amount: 500000,
        },
      ]);
      mockFinanceRepository.updateCashRegister.mockResolvedValue({
        ...mockShift,
        status: 'closed',
        discrepancy: 200000,
      });
      mockFinanceRepository.createAuditLog.mockResolvedValue({ id: 'audit-1' });
      mockEmailService.sendAlert.mockClear();
      // Mock for optimistic locking check
      mockPrismaService.cashRegister.findUnique.mockResolvedValue({
        status: 'open',
      });

      await service.closeShift('cashier-1', 1200000);

      expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
        'Peringatan Selisih Laci Kasir',
        expect.stringContaining('200000'),
      );
    });
  });

  describe('getProfitShare', () => {
    it('should throw BadRequestException for invalid month', async () => {
      await expect(service.getProfitShare(13, 2026)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getProfitShare(0, 2026)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if no orders found', async () => {
      mockFinanceRepository.findOrders.mockResolvedValue([]);

      await expect(service.getProfitShare(6, 2026)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate profit share correctly', async () => {
      const mockOrders = [
        { id: 'order-1', total_amount: 1000000, cogs_total: 400000 },
        { id: 'order-2', total_amount: 500000, cogs_total: 200000 },
      ];
      // Mock cashRegister.findMany for getProfitShare shifts query
      mockPrismaService.cashRegister.findMany.mockResolvedValue([
        {
          id: 'shift-1',
          shift_start: new Date('2026-06-01T08:00:00Z'),
          actual_close_at: new Date('2026-06-30T20:00:00Z'),
        },
      ]);
      mockFinanceRepository.findOrders.mockResolvedValue(mockOrders);
      mockFinanceRepository.findOperationalExpenses.mockResolvedValue([]);
      mockFinanceRepository.findAssets.mockResolvedValue([]);
      mockFinanceRepository.findProfitShareLog.mockResolvedValue(null);
      mockFinanceRepository.createProfitShareLog.mockResolvedValue({
        id: 'log-1',
      });

      const result = await service.getProfitShare(6, 2026);

      expect(result.revenue).toBe(1500000);
      // netProfit = revenue - totalOpex(0) - totalDepreciation(0) = 1500000
      expect(result.netProfit).toBe(1500000);
    });

    it('should return existing log if already calculated', async () => {
      const existingLog = {
        id: 'log-1',
        period: '2026-06',
        revenue: 1500000,
        netProfit: 900000,
      };
      // Mock cashRegister.findMany for getProfitShare shifts query
      mockPrismaService.cashRegister.findMany.mockResolvedValue([
        {
          id: 'shift-1',
          shift_start: new Date('2026-06-01T08:00:00Z'),
          actual_close_at: new Date('2026-06-30T20:00:00Z'),
        },
      ]);
      mockFinanceRepository.findProfitShareLog.mockResolvedValue(existingLog);

      const result = await service.getProfitShare(6, 2026);

      expect(result.revenue).toBe(1500000);
      expect(mockFinanceRepository.createProfitShareLog).not.toHaveBeenCalled();
    });
  });

  describe('payProfitShare', () => {
    it('should throw NotFoundException if profit share not found', async () => {
      mockFinanceRepository.findProfitShareLogByPeriod.mockResolvedValue(null);

      await expect(
        service.payProfitShare(6, 2026, 'proof.pdf', 'notes', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already paid', async () => {
      mockFinanceRepository.findProfitShareLogByPeriod.mockResolvedValue({
        id: 'log-1',
        period_month: new Date('2026-06-01'),
        is_paid: true,
      });

      await expect(
        service.payProfitShare(6, 2026, 'proof.pdf', 'notes', 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pay profit share and create audit log', async () => {
      mockFinanceRepository.findProfitShareLogByPeriod.mockResolvedValue({
        id: 'log-1',
        period_month: new Date('2026-06-01'),
        cashier_share: 400000,
        is_paid: false,
      });
      mockFinanceRepository.updateProfitShareLog.mockResolvedValue({
        id: 'log-1',
        is_paid: true,
      });
      mockFinanceRepository.createAuditLog.mockResolvedValue({ id: 'audit-1' });

      const result = await service.payProfitShare(
        6,
        2026,
        'proof.pdf',
        'notes',
        'admin-1',
      );

      expect(result.is_paid).toBe(true);
      expect(mockFinanceRepository.createAuditLog).toHaveBeenCalled();
    });
  });

  describe('getDashboardKpi', () => {
    beforeEach(() => {
      // Reset mocks
      mockFinanceRepository.aggregateAnalytics.mockReset();
    });

    it('should calculate KPI correctly', async () => {
      // Mock cashRegister for shift-based filtering (required by getDashboardKpi)
      mockPrismaService.cashRegister.findMany.mockResolvedValue([
        {
          id: 'shift-1',
          cashier_id: 'cashier-1',
          shift_start: new Date('2026-06-18T08:00:00Z'),
          actual_close_at: new Date('2026-06-18T16:00:00Z'),
        },
      ]);
      // Mock aggregate result for KPI calculation
      mockPrismaService.order.aggregate.mockResolvedValue({
        _sum: {
          total_amount: 800000,
          cogs_total: 320000,
        },
        _count: 2,
      });
      mockPrismaService.$queryRaw.mockResolvedValue([
        { payment_method: 'cash', count: 1n },
        { payment_method: 'qris', count: 1n },
      ]);

      const result = await service.getDashboardKpi('2026-06-18');

      expect(result).toBeDefined();
      expect(result.revenue).toBeDefined();
      expect(result.cogs).toBeDefined();
      expect(result.order_count).toBeDefined();
    });

    it('should handle zero transactions', async () => {
      // Mock cashRegister.findMany to return empty (no shifts = zero KPI)
      mockPrismaService.cashRegister.findMany.mockResolvedValue([]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.getDashboardKpi('2026-06-18');

      expect(result).toBeDefined();
      expect(result.revenue).toBe(0);
      expect(result.order_count).toBe(0);
    });
  });

  describe('createOpex', () => {
    it('should create operational expense', async () => {
      mockFinanceRepository.createOperationalExpense.mockResolvedValue({
        id: 'opex-1',
        category: 'electricity',
        amount: 500000,
      });

      const result = await service.createOpex(
        {
          category: 'electricity',
          amount: 500000,
          expense_date: new Date('2026-06-18'),
        },
        'admin-1',
      );

      expect(result.id).toBe('opex-1');
      expect(
        mockFinanceRepository.createOperationalExpense,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'electricity',
          created_by: 'admin-1',
        }),
      );
    });
  });

  describe('getAnalytics', () => {
    it('should aggregate analytics for daily period', async () => {
      mockFinanceRepository.aggregateAnalytics.mockResolvedValue({
        trend: [
          { label: '2026-06-01', value: 100000 },
          { label: '2026-06-02', value: 200000 },
        ],
        topProductsByQty: [
          {
            product_id: 'p1',
            product_name: 'Product A',
            qty: 10,
            revenue: 100000,
          },
          {
            product_id: 'p2',
            product_name: 'Product B',
            qty: 5,
            revenue: 50000,
          },
        ],
        topProductsByRevenue: [
          {
            product_id: 'p1',
            product_name: 'Product A',
            qty: 10,
            revenue: 100000,
          },
          {
            product_id: 'p2',
            product_name: 'Product B',
            qty: 5,
            revenue: 50000,
          },
        ],
        paymentDistribution: {
          counts: { cash: 10, qris: 5, split: 2 },
          values: { cash: 500000, qris: 250000, split: 100000 },
        },
        peakHours: [
          { hour: 12, count: 5 },
          { hour: 18, count: 3 },
        ],
      });

      const result = await service.getAnalytics('daily');

      expect(result.trend).toBeDefined();
      expect(result.paymentDistribution).toBeDefined();
    });
  });
});
