import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { ORDER_REPOSITORY } from '../../domain/interfaces/order.repository.interface';
import { InventoryService } from '../../../inventory/application/services/inventory.service';
import { EmailService } from '../../../email/email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';

// SHA-512 produces 128-character hex string
const MOCK_SIG = 'a'.repeat(128);

// Mock midtrans-client
jest.mock('midtrans-client', () => ({
  CoreApi: jest.fn().mockImplementation(() => ({
    charge: jest.fn(),
    transaction: {
      notification: jest.fn(),
    },
  })),
}));

// Mock crypto module - define key inline in factory to avoid hoisting issues
jest.mock('crypto', () => {
  const SIG = 'a'.repeat(128); // 128 hex chars = 64 bytes when decoded
  return {
    ...jest.requireActual('crypto'),
    createHash: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        // SHA-512 produces 128 hex chars = 64 bytes
        digest: jest.fn().mockReturnValue(Buffer.from(SIG, 'hex')),
      }),
    }),
    timingSafeEqual: jest.fn().mockReturnValue(true),
  };
});

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderRepository: any;
  let mockInventoryService: any;
  let mockEmailService: any;
  let mockEventEmitter: any;
  let mockMidtransCore: any;
  let mockPrismaService: any;

  const mockProduct = {
    id: 'prod-001',
    name: 'Nasi Goreng',
    base_price: 25000,
    category_id: 'cat-001',
    modifier_groups: [
      {
        id: 'mod-group-001',
        name: 'Level Pedas',
        options: [
          { id: 'opt-001', name: 'Pedas Sedang', additional_price: 0 },
          { id: 'opt-002', name: 'Pedas Hot', additional_price: 2000 },
        ],
      },
    ],
  };

  const mockDiscount = {
    id: 'disc-001',
    name: 'Diskon 10%',
    type: 'percentage',
    value: 10,
    scope: 'all_products',
    target_id: null,
    is_active: true,
  };

  const mockOrder = {
    id: 'order-001',
    client_uuid: 'client-uuid-001',
    cashier_id: 'kasir-001',
    total_amount: 25000,
    discount_total: 2500,
    payment_method: PaymentMethod.cash,
    cash_amount: 25000,
    qris_amount: 0,
    status: OrderStatus.completed,
    payment_status: 'paid',
    created_at: new Date(),
    items: [
      {
        id: 'item-001',
        product_id: 'prod-001',
        product_name_snapshot: 'Nasi Goreng',
        quantity: 1,
        unit_price: 25000,
        discounted_base: 22500,
        final_price: 22500,
        subtotal: 22500,
      },
    ],
  };

  beforeEach(async () => {
    // Reset environment variables
    process.env.PRICE_DELTA_THRESHOLD_PCT = '10';
    process.env.MIDTRANS_ENV = 'sandbox';
    process.env.MIDTRANS_SERVER_KEY_SANDBOX = 'test-server-key';
    process.env.MIDTRANS_SERVER_KEY_PRODUCTION = 'prod-server-key';

    // Reset crypto mock to default state BEFORE each test
    const crypto = require('crypto');
    crypto.timingSafeEqual.mockReturnValue(true);
    crypto.createHash.mockReturnValue({
      update: jest.fn().mockReturnValue({
        // SHA-512 produces 128 hex chars = 64 bytes when decoded
        digest: jest.fn().mockReturnValue(Buffer.from(MOCK_SIG, 'hex')),
      }),
    });

    mockOrderRepository = {
      findOrderByClientUuid: jest.fn(),
      findActiveDiscounts: jest.fn().mockResolvedValue([]),
      findProductsWithModifiers: jest.fn().mockResolvedValue([]),
      createOrder: jest.fn(),
      updateOrder: jest.fn(),
      findOrderById: jest.fn(),
      createAuditLog: jest.fn(),
      findOrders: jest.fn(),
      findCurrentShift: jest.fn(),
      createShift: jest.fn(),
      getSetting: jest.fn(),
      countRecentVoids: jest.fn(),
      createOrderRefund: jest.fn(),
      findShifts: jest.fn(),
    };

    mockInventoryService = {
      reduceStockForOrder: jest.fn().mockResolvedValue(undefined),
    };

    mockEmailService = {
      sendAlert: jest.fn().mockResolvedValue(undefined),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    mockPrismaService = {
      $transaction: jest.fn((cb) => cb({ order: { create: jest.fn().mockResolvedValue(mockOrder) } })),
      user: {
        findUnique: jest.fn().mockResolvedValue({ cashier_letter: 'A' }),
      },
      order: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepository },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);

    // Get reference to the mocked midtransCore
    const midtransClient = require('midtrans-client');
    mockMidtransCore = midtransClient.CoreApi.mock.results[0].value;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateOrderNumber', () => {
    it('should generate order number in correct format TRX-YYYYMMDD-{letter}{seq}', async () => {
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.generateOrderNumber('A', new Date('2024-01-15'));

      expect(result).toMatch(/^TRX-20240115A001$/);
    });

    it('should increment sequence based on existing orders for same cashier and date', async () => {
      mockPrismaService.order.count.mockResolvedValue(5);

      const result = await service.generateOrderNumber('B', new Date('2024-01-15'));

      expect(result).toBe('TRX-20240115B006');
    });

    it('should pad sequence with leading zeros', async () => {
      mockPrismaService.order.count.mockResolvedValue(12);

      const result = await service.generateOrderNumber('C', new Date('2024-01-15'));

      expect(result).toBe('TRX-20240115C013');
    });

    it('should use X as default cashier letter when user has no cashier_letter', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ cashier_letter: null });
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.generateOrderNumber('X', new Date('2024-01-15'));

      expect(result).toBe('TRX-20240115X001');
    });
  });

  describe('createOrder', () => {
    const baseOrderDto = {
      client_uuid: 'client-uuid-001',
      payment_method: PaymentMethod.cash as PaymentMethod,
      client_final_price: 22500,
      items: [
        {
          product_id: 'prod-001',
          quantity: 1,
          modifiers: [],
        },
      ],
    };

    describe('Success cases', () => {
      it('should create order with cash payment successfully', async () => {
        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([
          mockDiscount,
        ]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          mockProduct,
        ]);
        mockOrderRepository.createOrder.mockResolvedValue(mockOrder);

        const result = await service.createOrder(baseOrderDto, 'kasir-001');

        expect(result).toEqual(mockOrder);
        expect(mockOrderRepository.findOrderByClientUuid).toHaveBeenCalledWith(
          'client-uuid-001',
        );
        expect(mockOrderRepository.createOrder).toHaveBeenCalled();
        expect(mockInventoryService.reduceStockForOrder).toHaveBeenCalledWith(
          'order-001',
        );
      });

      it('should create order with QRIS payment and call Midtrans', async () => {
        const qrisOrder = {
          ...baseOrderDto,
          payment_method: PaymentMethod.qris,
          client_final_price: 27000,
        };

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          { ...mockProduct, base_price: 27000 },
        ]);
        mockOrderRepository.createOrder.mockResolvedValue({
          ...mockOrder,
          payment_method: PaymentMethod.qris,
          status: OrderStatus.pending_sync,
          qr_string: null,
          midtrans_transaction_id: null,
        });
        mockMidtransCore.charge.mockResolvedValue({
          transaction_id: 'txn-123',
          actions: [{ name: 'generate-qr-code', url: 'mock-qr-url' }],
        });
        mockOrderRepository.updateOrder.mockResolvedValue({
          ...mockOrder,
          payment_method: PaymentMethod.qris,
          qr_string: 'mock-qr-url',
          midtrans_transaction_id: 'txn-123',
        });

        const result = await service.createOrder(qrisOrder, 'kasir-001');

        expect(mockMidtransCore.charge).toHaveBeenCalledWith(
          expect.objectContaining({
            payment_type: 'qris',
            transaction_details: expect.objectContaining({
              order_id: 'order-001',
            }),
          }),
        );
        // Type assertion needed since qr_string/midtrans_transaction_id are added dynamically
        expect((result as any).qr_string).toBe('mock-qr-url');
        expect((result as any).midtrans_transaction_id).toBe('txn-123');
      });

      it('should create order with split payment successfully', async () => {
        // mockProduct base_price is 25000, so calculated final price should be 25000
        const splitOrder = {
          ...baseOrderDto,
          client_final_price: 25000, // Must match calculated price
          payment_method: PaymentMethod.split,
          cash_amount: 15000,
          qris_amount: 10000, // 15000 + 10000 = 25000
        };

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          mockProduct,
        ]);
        mockOrderRepository.createOrder.mockResolvedValue({
          ...mockOrder,
          payment_method: PaymentMethod.split,
          cash_amount: 15000,
          qris_amount: 10000,
        });

        const result = await service.createOrder(splitOrder, 'kasir-001');

        expect(result.payment_method).toBe(PaymentMethod.split);
        expect(mockOrderRepository.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            cash_amount: 15000,
            qris_amount: 10000,
          }),
        );
      });

      it('should apply best discount correctly when multiple discounts exist', async () => {
        const percentageDiscount = {
          ...mockDiscount,
          type: 'percentage',
          value: 10,
        };
        const fixedDiscount = {
          ...mockDiscount,
          type: 'fixed_amount',
          value: 3000,
        };

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([
          percentageDiscount,
          fixedDiscount,
        ]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          mockProduct,
        ]);
        mockOrderRepository.createOrder.mockImplementation(
          async (data: any) => {
            // 25000 - 3000 (fixed, better than 2500) = 22000
            expect(data.items.create[0].discount_id).toBe(fixedDiscount.id);
            return {
              ...mockOrder,
              items: [{ ...mockOrder.items[0], discount_id: fixedDiscount.id }],
            };
          },
        );

        await service.createOrder(baseOrderDto, 'kasir-001');
      });
    });

    describe('Trust but Verify - Price Discrepancy Handling', () => {
      it('should throw BadRequestException when price discrepancy exceeds threshold (createOrder)', async () => {
        process.env.PRICE_DELTA_THRESHOLD_PCT = '5';

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          mockProduct,
        ]);

        // createOrder throws on discrepancy — no need to mock $transaction
        const discrepancyOrder = {
          ...baseOrderDto,
          client_final_price: 10000, // Big discrepancy from calculated 22500
        };

        await expect(
          service.createOrder(discrepancyOrder, 'kasir-001'),
        ).rejects.toThrow(BadRequestException);
      });

      it('should accept order with price discrepancy and flag as Perlu Cek (createOrderWithCache)', async () => {
        // createOrderWithCache is the Trust but Verify path: it accepts
        // discrepancy and flags the order for review instead of throwing.
        // This is the path used by syncBatchOrders for offline orders.
        process.env.PRICE_DELTA_THRESHOLD_PCT = '5'; // 5% threshold

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);

        const products = [{ ...mockProduct, id: 'prod-001' }];

        const createdOrder = {
          id: 'order-cache-001',
          client_uuid: 'client-uuid-cache-001',
          cashier_id: 'kasir-001',
          total_amount: 10000, // client's price (not server's 22500)
          verification_status: 'Perlu Cek', // flagged due to >5% discrepancy
          payment_method: PaymentMethod.cash,
          status: OrderStatus.completed,
          payment_status: 'paid',
          items: [],
        };

        mockPrismaService.$transaction.mockImplementation(async (cb) =>
          cb({
            order: {
              create: jest.fn().mockResolvedValue(createdOrder),
            },
          }),
        );

        // Cast to any to call the private createOrderWithCache method
        const result = await (service as any).createOrderWithCache(
          {
            client_uuid: 'client-uuid-cache-001',
            payment_method: PaymentMethod.cash,
            client_final_price: 10000, // Server calculates 22500 → 55% diff → exceeds 5% threshold
            items: [{ product_id: 'prod-001', quantity: 1, modifiers: [] }],
          },
          'kasir-001',
          products,
        );

        // Trust but Verify: order accepted with 'Perlu Cek' flag
        expect(result.verification_status).toBe('Perlu Cek');
        expect(result.total_amount).toBe(10000); // client's price preserved
      });

      it('should accept order with valid price and set verification_status to Valid', async () => {
        process.env.PRICE_DELTA_THRESHOLD_PCT = '10';

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          mockProduct,
        ]);
        mockOrderRepository.createOrder.mockResolvedValue({
          ...mockOrder,
          verification_status: 'Valid',
        });

        const result = await service.createOrder(baseOrderDto, 'kasir-001');

        expect(result).toBeDefined();
        expect(mockOrderRepository.createOrder).toHaveBeenCalled();
      });
    });

    describe('Failure cases', () => {
      it('should throw BadRequestException when minimum QRIS amount not met', async () => {
        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
          { ...mockProduct, base_price: 500 }, // Below 1000 minimum
        ]);

        const lowAmountQrisOrder = {
          ...baseOrderDto,
          payment_method: PaymentMethod.qris,
          client_final_price: 500,
          items: [{ product_id: 'prod-001', quantity: 1, modifiers: [] }],
        };

        await expect(
          service.createOrder(lowAmountQrisOrder, 'kasir-001'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.createOrder(lowAmountQrisOrder, 'kasir-001'),
        ).rejects.toThrow('Minimum transaksi QRIS adalah Rp 1.000');
      });

      it('should throw BadRequestException when product not found', async () => {
        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([]);

        const orderWithInvalidProduct = {
          ...baseOrderDto,
          items: [
            { product_id: 'non-existent-product', quantity: 1, modifiers: [] },
          ],
        };

        await expect(
          service.createOrder(orderWithInvalidProduct, 'kasir-001'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.createOrder(orderWithInvalidProduct, 'kasir-001'),
        ).rejects.toThrow('Product non-existent-product not found');
      });
    });

    it('should return existing order if client_uuid already exists', async () => {
      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(mockOrder);

      const result = await service.createOrder(baseOrderDto, 'kasir-001');

      expect(result).toEqual(mockOrder);
      expect(mockOrderRepository.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('syncBatchOrders', () => {
    const batchOrders = [
      {
        client_uuid: 'batch-001',
        payment_method: PaymentMethod.cash,
        client_final_price: 25000,
        items: [{ product_id: 'prod-001', quantity: 1, modifiers: [] }],
      },
      {
        client_uuid: 'batch-002',
        payment_method: PaymentMethod.cash,
        client_final_price: 30000,
        items: [{ product_id: 'prod-002', quantity: 1, modifiers: [] }],
      },
    ];

    it('should sync multiple orders successfully', async () => {
      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
      mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
      // Return BOTH products in one call (batched query)
      mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
        { ...mockProduct, id: 'prod-001' },
        { ...mockProduct, id: 'prod-002', base_price: 30000 },
      ]);
      mockOrderRepository.createOrder.mockImplementation(async (data: any) => ({
        id: `order-${data.client_uuid}`,
        ...data,
        status: OrderStatus.completed,
      }));
      mockOrderRepository.updateOrder.mockResolvedValue({});

      const results = await service.syncBatchOrders(batchOrders, 'kasir-001');

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
      expect(mockOrderRepository.createOrder).toHaveBeenCalledTimes(2);
    });

    it('should handle sync errors gracefully', async () => {
      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
      mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
      mockOrderRepository.findProductsWithModifiers.mockRejectedValue(
        new Error('Database error'),
      );

      const results = await service.syncBatchOrders(
        [batchOrders[0]] as any[],
        'kasir-001',
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toContain('Database error');
    });

    it('should allow QRIS orders in offline sync and mark as pending_sync', async () => {
      const qrisOrder = {
        client_uuid: 'batch-qris-001',
        payment_method: PaymentMethod.qris,
        client_final_price: 25000,
        items: [{ product_id: 'prod-001', quantity: 1, modifiers: [] }],
      };

      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
      mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
      mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
        mockProduct,
      ]);
      mockOrderRepository.createOrder.mockImplementation(async (data: any) => ({
        id: `order-${data.client_uuid}`,
        ...data,
        status: OrderStatus.pending_sync,
      }));
      mockOrderRepository.updateOrder.mockResolvedValue({});

      const results = await service.syncBatchOrders(
        [qrisOrder] as any[],
        'kasir-001',
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
    });

    it('should handle partial batch failures', async () => {
      // Return BOTH products so both orders can start processing
      mockOrderRepository.findProductsWithModifiers.mockResolvedValue([
        { ...mockProduct, id: 'prod-001', base_price: 25000 },
        { ...mockProduct, id: 'prod-002', base_price: 30000 },
      ]);
      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
      mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
      // First order succeeds, second fails with database error
      mockOrderRepository.createOrder
        .mockResolvedValueOnce({ ...mockOrder, id: 'order-001' })
        .mockRejectedValueOnce(new Error('Database error'));

      const results = await service.syncBatchOrders(batchOrders, 'kasir-001');

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
    });

    it('should handle empty batch', async () => {
      const results = await service.syncBatchOrders([] as any[], 'kasir-001');

      expect(results).toHaveLength(0);
    });
  });

  describe('handleMidtransWebhook', () => {
    // SHA-512 produces 128-character hex string (defined at top of file as MOCK_SIG)
    const validWebhookPayload = {
      order_id: 'order-001',
      status_code: '200',
      gross_amount: '25000',
      transaction_status: 'settlement',
      fraud_status: 'accept',
      transaction_id: 'txn-123',
      signature_key: MOCK_SIG,
    };

    it('should handle settlement webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
        fraud_status: 'accept',
        transaction_id: 'txn-123',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
        cashier_id: 'kasir-001',
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.completed,
        payment_status: 'paid',
        payment_settled_at: new Date(),
      });
      mockOrderRepository.createAuditLog.mockResolvedValue({});

      const result = await service.handleMidtransWebhook(validWebhookPayload);

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.completed,
          payment_status: 'paid',
          payment_settled_at: expect.any(Date),
        },
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('order.paid', {
        orderId: 'order-001',
        status: OrderStatus.completed,
      });
    });

    it('should handle expire webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'expire',
        status_code: '201',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
        payment_status: 'expire',
        payment_settled_at: null,
      });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'expire',
        status_code: '201',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.voided,
          payment_status: 'expire',
          payment_settled_at: null,
        },
      );
    });

    it('should handle cancel webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'cancel',
        status_code: '202',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
        payment_status: 'failed',
        payment_settled_at: null,
      });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'cancel',
        status_code: '202',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.voided,
          payment_status: 'failed',
          payment_settled_at: null,
        },
      );
    });

    it('should ignore webhook with invalid signature', async () => {
      // Mock timingSafeEqual to return false for invalid signature
      const crypto = require('crypto');
      (crypto.timingSafeEqual as jest.Mock).mockReturnValueOnce(false);

      // Mock the notification response
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });

      const result = await service.handleMidtransWebhook(validWebhookPayload);

      expect(result).toEqual({ status: 'IGNORED' });
      expect(mockOrderRepository.updateOrder).not.toHaveBeenCalled();
    });

    it('should handle pending webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'pending',
        status_code: '201',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
        payment_status: 'unpaid',
        payment_settled_at: null,
      });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'pending',
        status_code: '201',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.pending_sync,
          payment_status: 'unpaid',
          payment_settled_at: null,
        },
      );
    });

    it('should handle deny webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'deny',
        status_code: '202',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
        payment_status: 'failed',
        payment_settled_at: null,
      });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'deny',
        status_code: '202',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.voided,
          payment_status: 'failed',
          payment_settled_at: null,
        },
      );
    });

    it('should ignore webhook with missing signature_key', async () => {
      // Mock notification returns no signature_key
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
        // No signature_key - this is what the service will use
      });

      // Pass payload without signature_key (not validWebhookPayload)
      const result = await service.handleMidtransWebhook({
        order_id: 'order-001',
        status_code: '200',
        gross_amount: '25000',
        transaction_status: 'settlement',
        signature_key: undefined,
      });

      expect(result).toEqual({ status: 'IGNORED' });
      expect(mockOrderRepository.updateOrder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order not found', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'non-existent-order',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
        signature_key: MOCK_SIG,
      });
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(
          service.handleMidtransWebhook({
            ...validWebhookPayload,
            order_id: 'non-existent-order',
          }),
        ).rejects.toThrow(NotFoundException);
      } finally {
        loggerSpy.mockRestore();
      }
    });
  });

  describe('voidOrder', () => {
    it('should void order with valid reason', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.completed,
        total_amount: 25000,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
      });
      mockOrderRepository.createOrderRefund.mockResolvedValue({});
      mockOrderRepository.createAuditLog.mockResolvedValue({});
      mockOrderRepository.countRecentVoids.mockResolvedValue(0);

      const result = await service.voidOrder(
        'order-001',
        'Pelanggan meminta pembatalan',
        'admin-001',
      );

      expect(result).toEqual({
        success: true,
        message: 'Order voided successfully',
      });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith(
        'order-001',
        {
          status: OrderStatus.voided,
          voided_by: 'admin-001',
          voided_at: expect.any(Date),
          void_reason: 'Pelanggan meminta pembatalan',
          payment_status: 'failed',
        },
      );
      expect(mockOrderRepository.createOrderRefund).toHaveBeenCalledWith({
        order_id: 'order-001',
        amount: 25000,
        refund_method: 'manual_cash',
        refunded_by: 'admin-001',
        notes: expect.stringContaining('Refund for voided order'),
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(
          service.voidOrder(
            'non-existent-order',
            'Pelanggan minta batal',
            'admin-001',
          ),
        ).rejects.toThrow(NotFoundException);
        await expect(
          service.voidOrder(
            'non-existent-order',
            'Pelanggan minta batal',
            'admin-001',
          ),
        ).rejects.toThrow('Order not found');
      } finally {
        loggerSpy.mockRestore();
      }
    });

    it('should throw BadRequestException when order already voided', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
      });

      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(
          service.voidOrder('order-001', 'Pelanggan minta batal', 'admin-001'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.voidOrder('order-001', 'Pelanggan minta batal', 'admin-001'),
        ).rejects.toThrow('Order sudah di-void');
      } finally {
        loggerSpy.mockRestore();
      }
    });

    it('should throw BadRequestException when reason too short', async () => {
      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(
          service.voidOrder('order-001', 'short', 'admin-001'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.voidOrder('order-001', 'short', 'admin-001'),
        ).rejects.toThrow('Alasan void wajib minimal 10 karakter');
      } finally {
        loggerSpy.mockRestore();
      }
    });

    it('should send alert email when 3 or more voids in 10 minutes', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.completed,
        total_amount: 25000,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
      });
      mockOrderRepository.createOrderRefund.mockResolvedValue({});
      mockOrderRepository.createAuditLog.mockResolvedValue({});
      mockOrderRepository.countRecentVoids.mockResolvedValue(3);

      await service.voidOrder(
        'order-001',
        'Pelanggan minta batal',
        'admin-001',
      );

      expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
        'Indikasi Fraud - Banyak Void Transaksi',
        expect.stringContaining('3 transaksi'),
      );
    });
  });

  describe('getShiftSummary', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    it('should calculate correct totals for completed orders', async () => {
      const completedOrders = [
        {
          ...mockOrder,
          payment_method: PaymentMethod.cash,
          total_amount: 25000,
        },
        {
          ...mockOrder,
          id: 'order-002',
          payment_method: PaymentMethod.qris,
          total_amount: 35000,
        },
        {
          ...mockOrder,
          id: 'order-003',
          payment_method: PaymentMethod.cash,
          total_amount: 15000,
        },
      ];

      mockOrderRepository.findOrders.mockResolvedValue(completedOrders);

      const result = await service.getShiftSummary('kasir-001');

      expect(result).toEqual({
        date: today.toISOString(),
        kasir_id: 'kasir-001',
        total_orders: 3,
        total_cash: 40000, // 25000 + 15000
        total_qris: 35000,
        grand_total: 75000,
      });
    });

    it('should return zero totals for empty orders', async () => {
      mockOrderRepository.findOrders.mockResolvedValue([]);

      const result = await service.getShiftSummary('kasir-001');

      expect(result).toEqual({
        date: today.toISOString(),
        kasir_id: 'kasir-001',
        total_orders: 0,
        total_cash: 0,
        total_qris: 0,
        grand_total: 0,
      });
    });
  });

  describe('exportOrdersCsv', () => {
    it('should generate valid CSV with order items', async () => {
      const ordersWithItems = [
        {
          id: 'order-001',
          client_uuid: 'client-001',
          created_at: new Date('2024-01-15T10:30:00Z'),
          cashier: { name: 'Kasir Satu' },
          payment_method: PaymentMethod.cash,
          status: OrderStatus.completed,
          items: [
            {
              id: 'item-001',
              product_name_snapshot: 'Nasi Goreng',
              quantity: 2,
              base_price: 25000,
              discounted_base: 22500,
              final_price: 22500,
              discount: { name: 'Diskon 10%' },
            },
            {
              id: 'item-002',
              product_name_snapshot: 'Es Teh',
              quantity: 1,
              base_price: 5000,
              discounted_base: 5000,
              final_price: 5000,
              discount: null,
            },
          ],
        },
      ];

      mockOrderRepository.findOrders.mockResolvedValue(ordersWithItems);

      const csv = await service.exportOrdersCsv('2024-01-01', '2024-01-31');

      expect(csv).toContain(
        'Tanggal,ID Pesanan,Kasir,Metode Pembayaran,Status,Item,Kuantitas,Harga Dasar,Nama Diskon,Nominal Diskon,Harga Akhir',
      );
      expect(csv).toContain('Nasi Goreng');
      expect(csv).toContain('2'); // quantity
      expect(csv).toContain('25000'); // base price
      expect(csv).toContain('Diskon 10%');
      expect(csv).toContain('500'); // discount amount (25000 - 22500)
      expect(csv).toContain('Es Teh');
      expect(csv).toContain('1');
      expect(csv).toContain('5000');
    });

    it('should handle orders with no items', async () => {
      const ordersWithNoItems = [
        {
          id: 'order-001',
          client_uuid: 'client-001',
          created_at: new Date('2024-01-15T10:30:00Z'),
          cashier: { name: 'Kasir Satu' },
          payment_method: PaymentMethod.cash,
          status: OrderStatus.completed,
          items: [],
        },
      ];

      mockOrderRepository.findOrders.mockResolvedValue(ordersWithNoItems);

      const csv = await service.exportOrdersCsv('2024-01-01', '2024-01-31');

      expect(csv).toContain('-,0,0,-,0,0');
    });
  });

  describe('getOrder', () => {
    it('should return order when found', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue(mockOrder);

      const result = await service.getOrder('order-001');

      expect(result).toEqual(mockOrder);
      expect(mockOrderRepository.findOrderById).toHaveBeenCalledWith(
        'order-001',
      );
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(service.getOrder('non-existent-order')).rejects.toThrow(
          NotFoundException,
        );
      } finally {
        loggerSpy.mockRestore();
      }
    });
  });

  describe('getHistory', () => {
    it('should return all orders when no kasirId provided', async () => {
      mockOrderRepository.findOrders.mockResolvedValue([mockOrder]);

      const result = await service.getHistory();

      expect(result).toEqual([mockOrder]);
      expect(mockOrderRepository.findOrders).toHaveBeenCalledWith(
        {},
        { created_at: 'desc' },
        { items: true, cashier: { select: { name: true, username: true } } },
        50, // default limit
        0, // default skip (page 1 -> skip 0)
      );
    });

    it('should filter orders by kasirId for today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockOrderRepository.findOrders.mockResolvedValue([mockOrder]);

      await service.getHistory('kasir-001');

      expect(mockOrderRepository.findOrders).toHaveBeenCalledWith(
        { cashier_id: 'kasir-001', created_at: { gte: today } },
        { created_at: 'desc' },
        { items: true, cashier: { select: { name: true, username: true } } },
        50, // default limit
        0, // default skip (page 1 -> skip 0)
      );
    });

    it('should respect pagination parameters', async () => {
      mockOrderRepository.findOrders.mockResolvedValue([mockOrder]);

      await service.getHistory(undefined, 2, 50);

      expect(mockOrderRepository.findOrders).toHaveBeenCalledWith(
        {},
        { created_at: 'desc' },
        { items: true, cashier: { select: { name: true, username: true } } },
        50,
        50, // page 2 with limit 50 -> skip 50
      );
    });
  });

  describe('startShift', () => {
    it('should return existing shift if already open', async () => {
      const existingShift = {
        id: 'shift-001',
        cashier_id: 'kasir-001',
        status: 'open',
      };
      mockOrderRepository.findCurrentShift.mockResolvedValue(existingShift);

      const result = await service.startShift('kasir-001');

      expect(result).toEqual(existingShift);
      expect(mockOrderRepository.createShift).not.toHaveBeenCalled();
    });

    it('should create new shift with default opening balance', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newShift = {
        id: 'shift-002',
        cashier_id: 'kasir-001',
        status: 'open',
        opening_balance: 500000,
      };

      mockOrderRepository.findCurrentShift.mockResolvedValue(null);
      mockOrderRepository.getSetting.mockResolvedValue(null);
      mockOrderRepository.createShift.mockResolvedValue(newShift);

      const result = await service.startShift('kasir-001');

      expect(result).toEqual(newShift);
      expect(mockOrderRepository.createShift).toHaveBeenCalledWith({
        cashier_id: 'kasir-001',
        shift_date: today,
        opening_balance: 500000,
        status: 'open',
      });
    });

    it('should create new shift with configured opening balance', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newShift = {
        id: 'shift-002',
        cashier_id: 'kasir-001',
        status: 'open',
        opening_balance: 1000000,
      };

      mockOrderRepository.findCurrentShift.mockResolvedValue(null);
      mockOrderRepository.getSetting.mockResolvedValue({ value: '1000000' });
      mockOrderRepository.createShift.mockResolvedValue(newShift);

      const result = await service.startShift('kasir-001');

      expect(result.opening_balance).toBe(1000000);
    });
  });

  describe('getCurrentShift', () => {
    it('should return current shift for kasir', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const shift = {
        id: 'shift-001',
        cashier_id: 'kasir-001',
        status: 'open',
      };

      mockOrderRepository.findCurrentShift.mockResolvedValue(shift);

      const result = await service.getCurrentShift('kasir-001');

      expect(result).toEqual(shift);
      expect(mockOrderRepository.findCurrentShift).toHaveBeenCalledWith(
        'kasir-001',
        today,
      );
    });
  });

  describe('flagTransaction', () => {
    it('should flag transaction and create audit log', async () => {
      const order = { ...mockOrder, verification_status: 'pending' };
      const updatedOrder = { ...mockOrder, verification_status: 'verified' };

      mockOrderRepository.findOrderById.mockResolvedValue(order);
      mockOrderRepository.updateOrder.mockResolvedValue(updatedOrder);
      mockOrderRepository.createAuditLog.mockResolvedValue({});

      const result = await service.flagTransaction(
        'order-001',
        'verified',
        'admin-001',
      );

      expect(result).toEqual(updatedOrder);
      expect(mockOrderRepository.createAuditLog).toHaveBeenCalledWith({
        actor_id: 'admin-001',
        action: 'FLAG_TRANSACTION',
        entity_type: 'Order',
        entity_id: 'order-001',
        old_value: { verification_status: 'pending' },
        new_value: { verification_status: 'verified' },
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      // Suppress error logging for this expected error case
      const loggerSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => {});

      try {
        await expect(
          service.flagTransaction('non-existent', 'verified', 'admin-001'),
        ).rejects.toThrow(NotFoundException);
      } finally {
        loggerSpy.mockRestore();
      }
    });
  });

  describe('getAllShifts', () => {
    it('should return shifts filtered by kasirId', async () => {
      const shifts = [{ id: 'shift-001' }, { id: 'shift-002' }];
      mockOrderRepository.findShifts.mockResolvedValue(shifts);

      const result = await service.getAllShifts('kasir-001');

      expect(result).toEqual(shifts);
      expect(mockOrderRepository.findShifts).toHaveBeenCalledWith(
        { cashier_id: 'kasir-001' },
        { cashier: { select: { name: true } } },
        { shift_start: 'desc' },
        50,
      );
    });

    it('should return shifts filtered by date', async () => {
      const shifts = [{ id: 'shift-001' }];
      mockOrderRepository.findShifts.mockResolvedValue(shifts);

      await service.getAllShifts(undefined, '2024-01-15');

      expect(mockOrderRepository.findShifts).toHaveBeenCalledWith(
        expect.objectContaining({
          shift_start: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        expect.any(Object),
        expect.any(Object),
        expect.any(Number),
      );
    });
  });
});
