import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { EmailService } from '../../../email/email.service';
import { FINANCE_REPOSITORY } from '../../domain/interfaces/finance.repository.interface';

const mockFinanceRepository = {
  findOrders: jest.fn(),
  findFirstCashRegister: jest.fn(),
  createCashRegister: jest.fn(),
  updateCashRegister: jest.fn(),
  findProfitShareLog: jest.fn(),
  createProfitShareLog: jest.fn(),
  updateProfitShareLog: jest.fn(),
  createAuditLog: jest.fn(),
  findOperationalExpenses: jest.fn(),
  findAssets: jest.fn(),
};

const mockEmailService = {
  sendAlert: jest.fn().mockResolvedValue(undefined),
};

describe('FinanceService', () => {
  let service: FinanceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: FINANCE_REPOSITORY, useValue: mockFinanceRepository },
        EmailService,
      ],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    service = module.get<FinanceService>(FinanceService);
  });

  describe('openShift', () => {
    it('should throw BadRequestException if shift already open', async () => {
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue({ id: 'shift-1', status: 'open' });

      await expect(service.openShift('cashier-1', 500000)).rejects.toThrow(BadRequestException);
    });

    it('should create new shift when no open shift exists', async () => {
      mockFinanceRepository.findFirstCashRegister.mockResolvedValue(null);
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

      await expect(service.closeShift('cashier-1', 600000)).rejects.toThrow(NotFoundException);
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
        { id: 'order-1', total_amount: 500000, payment_method: 'cash', cash_amount: 500000 },
      ]);
      mockFinanceRepository.updateCashRegister.mockResolvedValue({
        ...mockShift,
        status: 'closed',
        discrepancy: 200000,
      });
      mockFinanceRepository.createAuditLog.mockResolvedValue({ id: 'audit-1' });
      mockEmailService.sendAlert.mockClear();

      await service.closeShift('cashier-1', 1200000);

      expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
        'Peringatan Selisih Laci Kasir',
        expect.stringContaining('200000')
      );
    });
  });

  describe('getProfitShare', () => {
    it('should throw BadRequestException for invalid month', async () => {
      await expect(service.getProfitShare(13, 2026)).rejects.toThrow(BadRequestException);
      await expect(service.getProfitShare(0, 2026)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if no orders found', async () => {
      mockFinanceRepository.findOrders.mockResolvedValue([]);

      await expect(service.getProfitShare(6, 2026)).rejects.toThrow(NotFoundException);
    });

    it('should calculate profit share correctly', async () => {
      const mockOrders = [
        { id: 'order-1', total_amount: 1000000, cogs_total: 400000 },
        { id: 'order-2', total_amount: 500000, cogs_total: 200000 },
      ];
      mockFinanceRepository.findOrders.mockResolvedValue(mockOrders);
      mockFinanceRepository.findOperationalExpenses.mockResolvedValue([]);
      mockFinanceRepository.findAssets.mockResolvedValue([]);
      mockFinanceRepository.findProfitShareLog.mockResolvedValue(null);
      mockFinanceRepository.createProfitShareLog.mockResolvedValue({ id: 'log-1' });

      const result = await service.getProfitShare(6, 2026);

      expect(result.revenue).toBe(1500000);
      expect(result.netProfit).toBe(900000);
    });

    it('should return existing log if already calculated', async () => {
      const existingLog = {
        id: 'log-1',
        period: '2026-06',
        revenue: 1500000,
        netProfit: 900000,
      };
      mockFinanceRepository.findProfitShareLog.mockResolvedValue(existingLog);

      const result = await service.getProfitShare(6, 2026);

      expect(result.revenue).toBe(1500000);
      expect(mockFinanceRepository.createProfitShareLog).not.toHaveBeenCalled();
    });
  });

  describe('getAnalytics', () => {
    it('should aggregate analytics for daily period', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          total_amount: 100000,
          created_at: new Date('2026-06-01'),
          payment_method: 'cash',
          client_created_at: new Date('2026-06-01'),
          items: [{ product_id: 'p1', product_name_snapshot: 'Product A', quantity: 2, subtotal: 100000 }]
        },
        {
          id: 'order-2',
          total_amount: 200000,
          created_at: new Date('2026-06-01'),
          payment_method: 'qris',
          client_created_at: new Date('2026-06-01'),
          items: [{ product_id: 'p2', product_name_snapshot: 'Product B', quantity: 1, subtotal: 200000 }]
        },
      ];
      mockFinanceRepository.findOrders.mockResolvedValue(mockOrders);

      const result = await service.getAnalytics('daily');

      expect(result.trend).toBeDefined();
      expect(result.paymentDistribution).toBeDefined();
    });
  });
});