import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDLQService } from './webhook-dlq.service';
import { PrismaService } from '../prisma/prisma.service';

// Jest globals are available in Jest environment

declare const jest: any;

declare const describe: any;

declare const it: any;

declare const expect: any;

declare const beforeEach: any;

// Mock Prisma
const mockPrisma = {
  webhookDLQ: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

// Helper to create mock DLQ entry
const createMockEntry = (overrides = {}) => ({
  id: 'dlq-123',
  provider: 'midtrans',
  event_type: 'payment.success',
  payload: { order_id: 'order-123', amount: 50000 },
  error_message: 'Processing error',
  status: 'pending',
  attempt_count: 0,
  max_attempts: 3,
  last_attempt_at: null,
  resolved_by: null,
  resolved_at: null,
  resolution: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

describe('WebhookDLQService', () => {
  let service: WebhookDLQService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDLQService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WebhookDLQService>(WebhookDLQService);
  });

  describe('addToDLQ', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should add webhook to DLQ with default max_attempts', async () => {
      const mockEntry = createMockEntry();
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      const result = await service.addToDLQ({
        provider: 'midtrans',
        event_type: 'payment.success',
        payload: { order_id: 'order-123' },
        error_message: 'Processing error',
      });

      expect(result).toBe(mockEntry.id);
      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalledWith({
        data: {
          provider: 'midtrans',
          event_type: 'payment.success',
          payload: { order_id: 'order-123' },
          error_message: 'Processing error',
          max_attempts: 3, // Default value
          status: 'pending',
        },
      });
    });

    it('should add webhook with custom max_attempts', async () => {
      const mockEntry = createMockEntry({ max_attempts: 5 });
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      await service.addToDLQ({
        provider: 'midtrans',
        event_type: 'payment.success',
        payload: { order_id: 'order-123' },
        error_message: 'Processing error',
        max_attempts: 5,
      });

      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ max_attempts: 5 }),
      });
    });

    it('should add webhook from different providers', async () => {
      const mockEntry = createMockEntry({ provider: 'xendit' });
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      await service.addToDLQ({
        provider: 'xendit',
        event_type: 'invoice.paid',
        payload: { invoice_id: 'inv-123' },
        error_message: 'Xendit API error',
      });

      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ provider: 'xendit' }),
      });
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle complex payload structures', async () => {
      const complexPayload = {
        order_id: 'order-123',
        items: [
          { id: 1, name: 'Product A', price: 25000, quantity: 2 },
          { id: 2, name: 'Product B', price: 10000, quantity: 1 },
        ],
        customer: { name: 'John Doe', email: 'john@example.com' },
        metadata: { source: 'mobile_app', version: '2.0' },
      };
      const mockEntry = createMockEntry({ payload: complexPayload });
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      await service.addToDLQ({
        provider: 'midtrans',
        event_type: 'order.completed',
        payload: complexPayload,
        error_message: 'Complex payload processing error',
      });

      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalled();
    });

    it('should handle empty payload', async () => {
      const mockEntry = createMockEntry({ payload: {} });
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      await service.addToDLQ({
        provider: 'midtrans',
        event_type: 'unknown.event',
        payload: {},
        error_message: 'Unknown event type',
      });

      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalled();
    });

    it('should handle long error messages', async () => {
      const longError = 'A'.repeat(1000);
      const mockEntry = createMockEntry({ error_message: longError });
      mockPrisma.webhookDLQ.create.mockResolvedValue(mockEntry);

      await service.addToDLQ({
        provider: 'midtrans',
        event_type: 'error',
        payload: {},
        error_message: longError,
      });

      expect(mockPrisma.webhookDLQ.create).toHaveBeenCalled();
    });
  });

  describe('getEntries', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return paginated DLQ entries', async () => {
      const entries = [
        createMockEntry({ id: 'dlq-1' }),
        createMockEntry({ id: 'dlq-2' }),
      ];
      mockPrisma.webhookDLQ.findMany.mockResolvedValue(entries);
      mockPrisma.webhookDLQ.count.mockResolvedValue(10);

      const result = await service.getEntries({ page: 1, limit: 2 });

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.total_pages).toBe(5);
    });

    it('should filter by status', async () => {
      const entries = [createMockEntry({ status: 'pending' })];
      mockPrisma.webhookDLQ.findMany.mockResolvedValue(entries);
      mockPrisma.webhookDLQ.count.mockResolvedValue(1);

      await service.getEntries({ status: 'pending' });

      expect(mockPrisma.webhookDLQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });

    it('should filter by provider', async () => {
      const entries = [createMockEntry({ provider: 'midtrans' })];
      mockPrisma.webhookDLQ.findMany.mockResolvedValue(entries);
      mockPrisma.webhookDLQ.count.mockResolvedValue(1);

      await service.getEntries({ provider: 'midtrans' });

      expect(mockPrisma.webhookDLQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: 'midtrans' },
        }),
      );
    });

    it('should filter by both status and provider', async () => {
      mockPrisma.webhookDLQ.findMany.mockResolvedValue([]);
      mockPrisma.webhookDLQ.count.mockResolvedValue(0);

      await service.getEntries({ status: 'failed', provider: 'xendit' });

      expect(mockPrisma.webhookDLQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'failed', provider: 'xendit' },
        }),
      );
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should use default pagination values', async () => {
      mockPrisma.webhookDLQ.findMany.mockResolvedValue([]);
      mockPrisma.webhookDLQ.count.mockResolvedValue(0);

      const result = await service.getEntries();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total_pages).toBe(0);
    });

    it('should handle zero total entries', async () => {
      mockPrisma.webhookDLQ.findMany.mockResolvedValue([]);
      mockPrisma.webhookDLQ.count.mockResolvedValue(0);

      const result = await service.getEntries();

      expect(result.total_pages).toBe(0);
      expect(result.entries).toHaveLength(0);
    });

    it('should handle large page numbers', async () => {
      mockPrisma.webhookDLQ.findMany.mockResolvedValue([]);
      mockPrisma.webhookDLQ.count.mockResolvedValue(100);

      const result = await service.getEntries({ page: 1000, limit: 10 });

      expect(result.total_pages).toBe(10);
      // Should skip to the correct offset
      expect(mockPrisma.webhookDLQ.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 9990 }),
      );
    });
  });

  describe('getEntry', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return a single DLQ entry by ID', async () => {
      const mockEntry = createMockEntry();
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);

      const result = await service.getEntry('dlq-123');

      expect(result).toEqual(mockEntry);
      expect(mockPrisma.webhookDLQ.findUnique).toHaveBeenCalledWith({
        where: { id: 'dlq-123' },
      });
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return null for non-existent entry', async () => {
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(null);

      const result = await service.getEntry('non-existent');

      expect(result).toBeNull();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle UUID format entry ID', async () => {
      const mockEntry = createMockEntry({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);

      const result = await service.getEntry(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toEqual(mockEntry);
    });
  });

  describe('acknowledgeEntry', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should acknowledge entry and create audit log', async () => {
      // Return updated entry with resolved fields
      const resolvedAt = new Date();
      const updatedEntry = {
        ...createMockEntry(),
        status: 'resolved',
        resolved_by: 'admin-456',
        resolved_at: resolvedAt,
        resolution: 'acknowledged',
      };
      mockPrisma.webhookDLQ.update.mockResolvedValue(updatedEntry);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.acknowledgeEntry(
        'dlq-123',
        'admin-456',
        'Manually acknowledged',
      );

      expect(result.status).toBe('resolved');
      expect(result.resolved_by).toBe('admin-456');
      expect(result.resolved_at).toEqual(resolvedAt);
      expect(result.resolution).toBe('acknowledged');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle acknowledgment without notes', async () => {
      const updatedEntry = {
        ...createMockEntry(),
        status: 'resolved',
        resolved_by: 'admin-456',
        resolution: 'acknowledged',
      };
      mockPrisma.webhookDLQ.update.mockResolvedValue(updatedEntry);
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.acknowledgeEntry('dlq-123', 'admin-456');

      expect(result.resolution).toBe('acknowledged');
    });
  });

  describe('retryEntry', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should retry and mark as resolved on success', async () => {
      const mockEntry = createMockEntry({ status: 'pending' });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update
        .mockResolvedValueOnce({ ...mockEntry, status: 'retrying' })
        .mockResolvedValueOnce({
          ...mockEntry,
          status: 'resolved',
          resolved_by: 'admin-123',
        });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const processor = jest.fn().mockResolvedValue(undefined);

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(true);
      expect(processor).toHaveBeenCalledWith(mockEntry.payload);
      expect(mockPrisma.webhookDLQ.update).toHaveBeenCalledTimes(2);
    });

    it('should increment attempt count on retry', async () => {
      const mockEntry = createMockEntry({
        status: 'pending',
        attempt_count: 2,
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update
        .mockResolvedValueOnce({
          ...mockEntry,
          status: 'retrying',
          attempt_count: 3,
        })
        .mockResolvedValueOnce({ ...mockEntry, status: 'resolved' });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const processor = jest.fn().mockResolvedValue(undefined);

      await service.retryEntry('dlq-123', 'admin-123', processor);

      expect(mockPrisma.webhookDLQ.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ attempt_count: 3 }),
        }),
      );
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return error for non-existent entry', async () => {
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(null);

      const processor = jest.fn();

      const result = await service.retryEntry(
        'non-existent',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry not found');
    });

    it('should return error for already resolved entry', async () => {
      const mockEntry = createMockEntry({ status: 'resolved' });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);

      const processor = jest.fn();

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Entry already resolved');
    });

    it('should mark as failed when max attempts reached', async () => {
      const mockEntry = createMockEntry({
        status: 'pending',
        attempt_count: 2,
        max_attempts: 3,
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update.mockResolvedValue({
        ...mockEntry,
        status: 'retrying',
        attempt_count: 3,
      });

      const processor = jest
        .fn()
        .mockRejectedValue(new Error('Processing failed'));

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Processing failed');
      // Entry should now be in failed status
      expect(mockPrisma.webhookDLQ.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });

    it('should return error when processor throws', async () => {
      const mockEntry = createMockEntry({
        status: 'pending',
        attempt_count: 0,
        max_attempts: 3,
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update.mockResolvedValue({
        ...mockEntry,
        status: 'retrying',
      });

      const errorMessage = 'Network timeout after 30s';
      const processor = jest.fn().mockRejectedValue(new Error(errorMessage));

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle processor that returns promise', async () => {
      const mockEntry = createMockEntry({ status: 'pending' });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update
        .mockResolvedValueOnce({ ...mockEntry, status: 'retrying' })
        .mockResolvedValueOnce({ ...mockEntry, status: 'resolved' });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const processor = jest.fn().mockImplementation(() => Promise.resolve());

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(true);
    });

    it('should preserve error message when processor throws non-Error', async () => {
      const mockEntry = createMockEntry({
        status: 'pending',
        attempt_count: 0,
        max_attempts: 3,
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update.mockResolvedValue({
        ...mockEntry,
        status: 'retrying',
      });

      const processor = jest.fn().mockRejectedValue('String error');

      const result = await service.retryEntry(
        'dlq-123',
        'admin-123',
        processor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should set status back to pending when max attempts not reached', async () => {
      const mockEntry = createMockEntry({
        status: 'pending',
        attempt_count: 1,
        max_attempts: 5,
      });
      mockPrisma.webhookDLQ.findUnique.mockResolvedValue(mockEntry);
      mockPrisma.webhookDLQ.update
        .mockResolvedValueOnce({
          ...mockEntry,
          status: 'retrying',
          attempt_count: 2,
        })
        .mockResolvedValueOnce({ ...mockEntry, status: 'pending' });

      const processor = jest
        .fn()
        .mockRejectedValue(new Error('Temporary error'));

      await service.retryEntry('dlq-123', 'admin-123', processor);

      // Last update should set status back to pending for retry
      expect(mockPrisma.webhookDLQ.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });
  });

  describe('getStats', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return DLQ statistics', async () => {
      mockPrisma.webhookDLQ.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(50) // pending
        .mockResolvedValueOnce(30) // failed
        .mockResolvedValueOnce(20); // resolved
      mockPrisma.webhookDLQ.groupBy.mockResolvedValue([
        { provider: 'midtrans', status: 'pending', _count: 40 },
        { provider: 'midtrans', status: 'failed', _count: 20 },
        { provider: 'xendit', status: 'pending', _count: 10 },
        { provider: 'xendit', status: 'failed', _count: 5 },
      ]);

      const result = await service.getStats();

      expect(result.total).toBe(100);
      expect(result.pending).toBe(50);
      expect(result.failed).toBe(30);
      expect(result.resolved).toBe(20);
      expect(result.by_provider).toHaveProperty('midtrans');
      expect(result.by_provider).toHaveProperty('xendit');
    });

    it('should group stats by provider correctly', async () => {
      mockPrisma.webhookDLQ.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);
      mockPrisma.webhookDLQ.groupBy.mockResolvedValue([
        { provider: 'midtrans', status: 'pending', _count: 3 },
        { provider: 'midtrans', status: 'failed', _count: 2 },
      ]);

      const result = await service.getStats();

      expect(result.by_provider['midtrans']).toEqual({
        pending: 3,
        failed: 2,
        resolved: 0,
      });
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle empty DLQ', async () => {
      mockPrisma.webhookDLQ.count.mockResolvedValue(0);
      mockPrisma.webhookDLQ.groupBy.mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.total).toBe(0);
      expect(result.pending).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.resolved).toBe(0);
      expect(Object.keys(result.by_provider)).toHaveLength(0);
    });

    it('should handle providers with only resolved entries', async () => {
      mockPrisma.webhookDLQ.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);
      mockPrisma.webhookDLQ.groupBy.mockResolvedValue([
        { provider: 'old_system', status: 'resolved', _count: 5 },
      ]);

      const result = await service.getStats();

      expect(result.by_provider['old_system']).toEqual({
        pending: 0,
        failed: 0,
        resolved: 5,
      });
    });

    it('should handle many providers', async () => {
      const manyProviders = Array.from({ length: 20 }, (_, i) => ({
        provider: `provider-${i}`,
        status: 'pending',
        _count: i + 1,
      }));
      mockPrisma.webhookDLQ.count
        .mockResolvedValueOnce(210)
        .mockResolvedValueOnce(210)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.webhookDLQ.groupBy.mockResolvedValue(manyProviders);

      const result = await service.getStats();

      expect(Object.keys(result.by_provider)).toHaveLength(20);
    });
  });
});
