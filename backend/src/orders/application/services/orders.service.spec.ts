import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import { ORDER_REPOSITORY } from '../../domain/interfaces/order.repository.interface';
import { InventoryService } from '../../../inventory/application/services/inventory.service';
import { EmailService } from '../../../email/email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Mock midtrans-client
jest.mock('midtrans-client', () => ({
  CoreApi: jest.fn().mockImplementation(() => ({
    charge: jest.fn(),
    transaction: {
      notification: jest.fn(),
    },
  })),
}));

// Mock crypto module
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue(Buffer.from('mock-signature')),
    }),
  }),
}));

describe('OrdersService', () => {
  let service: OrdersService;
  let mockOrderRepository: any;
  let mockInventoryService: any;
  let mockEmailService: any;
  let mockEventEmitter: any;
  let mockMidtransCore: any;

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
    // Reset environment variable for threshold
    process.env.PRICE_DELTA_THRESHOLD_PCT = '10';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepository },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
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
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([mockDiscount]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([mockProduct]);
        mockOrderRepository.createOrder.mockResolvedValue(mockOrder);

        const result = await service.createOrder(baseOrderDto, 'kasir-001');

        expect(result).toEqual(mockOrder);
        expect(mockOrderRepository.findOrderByClientUuid).toHaveBeenCalledWith('client-uuid-001');
        expect(mockOrderRepository.createOrder).toHaveBeenCalled();
        expect(mockInventoryService.reduceStockForOrder).toHaveBeenCalledWith('order-001');
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
        expect(result.qr_string).toBe('mock-qr-url');
        expect(result.midtrans_transaction_id).toBe('txn-123');
      });

      it('should create order with split payment successfully', async () => {
        const splitOrder = {
          ...baseOrderDto,
          payment_method: PaymentMethod.split,
          client_final_price: 22500,
          cash_amount: 15000,
          qris_amount: 7500,
        };

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([mockProduct]);
        mockOrderRepository.createOrder.mockResolvedValue({
          ...mockOrder,
          payment_method: PaymentMethod.split,
          cash_amount: 15000,
          qris_amount: 7500,
        });

        const result = await service.createOrder(splitOrder, 'kasir-001');

        expect(result.payment_method).toBe(PaymentMethod.split);
        expect(mockOrderRepository.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            cash_amount: 15000,
            qris_amount: 7500,
          }),
        );
      });

      it('should apply best discount correctly when multiple discounts exist', async () => {
        const percentageDiscount = { ...mockDiscount, type: 'percentage', value: 10 };
        const fixedDiscount = { ...mockDiscount, type: 'fixed_amount', value: 3000 };

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([percentageDiscount, fixedDiscount]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([mockProduct]);
        mockOrderRepository.createOrder.mockImplementation(async (data: any) => {
          // 25000 - 3000 (fixed, better than 2500) = 22000
          expect(data.items.create[0].discount_id).toBe(fixedDiscount.id);
          return { ...mockOrder, items: [{ ...mockOrder.items[0], discount_id: fixedDiscount.id }] };
        });

        await service.createOrder(baseOrderDto, 'kasir-001');
      });
    });

    describe('Failure cases', () => {
      it('should throw BadRequestException when price discrepancy exceeds threshold', async () => {
        process.env.PRICE_DELTA_THRESHOLD_PCT = '5';

        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([mockProduct]);

        const orderWithPriceDiscrepancy = {
          ...baseOrderDto,
          client_final_price: 10000, // Big discrepancy from calculated 22500
        };

        await expect(service.createOrder(orderWithPriceDiscrepancy, 'kasir-001')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.createOrder(orderWithPriceDiscrepancy, 'kasir-001')).rejects.toThrow(
          'Price calculation discrepancy exceeds threshold',
        );
      });

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

        await expect(service.createOrder(lowAmountQrisOrder, 'kasir-001')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.createOrder(lowAmountQrisOrder, 'kasir-001')).rejects.toThrow(
          'Minimum transaksi QRIS adalah Rp 1.000',
        );
      });

      it('should throw BadRequestException when product not found', async () => {
        mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
        mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
        mockOrderRepository.findProductsWithModifiers.mockResolvedValue([]);

        const orderWithInvalidProduct = {
          ...baseOrderDto,
          items: [{ product_id: 'non-existent-product', quantity: 1, modifiers: [] }],
        };

        await expect(service.createOrder(orderWithInvalidProduct, 'kasir-001')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.createOrder(orderWithInvalidProduct, 'kasir-001')).rejects.toThrow(
          'Product non-existent-product not found',
        );
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
        { ...mockProduct, id: 'prod-002', base_price: 30000 }
      ]);
      mockOrderRepository.createOrder.mockImplementation(async (data: any) => ({
        id: `order-${data.client_uuid}`,
        ...data,
        status: OrderStatus.completed,
      }));
      mockOrderRepository.updateOrder.mockResolvedValue({});

      const results = await service.syncBatchOrders(batchOrders as any[], 'kasir-001');

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
      expect(mockOrderRepository.createOrder).toHaveBeenCalledTimes(2);
    });

    it('should handle sync errors gracefully', async () => {
      mockOrderRepository.findOrderByClientUuid.mockResolvedValue(null);
      mockOrderRepository.findActiveDiscounts.mockResolvedValue([]);
      mockOrderRepository.findProductsWithModifiers.mockRejectedValue(new Error('Database error'));

      const results = await service.syncBatchOrders([batchOrders[0]] as any[], 'kasir-001');

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toBe('Database error');
    });

    it('should skip QRIS orders in offline sync', async () => {
      const qrisOrder = {
        client_uuid: 'batch-qris-001',
        payment_method: PaymentMethod.qris,
        client_final_price: 25000,
        items: [{ product_id: 'prod-001', quantity: 1, modifiers: [] }],
      };

      const results = await service.syncBatchOrders([qrisOrder] as any[], 'kasir-001');

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].message).toBe('QRIS not allowed in offline sync');
    });
  });

  describe('handleMidtransWebhook', () => {
    const validWebhookPayload = {
      order_id: 'order-001',
      status_code: '200',
      gross_amount: '25000',
      transaction_status: 'settlement',
      fraud_status: 'accept',
      transaction_id: 'txn-123',
      signature_key: Buffer.from('mock-signature').toString('hex'),
    };

    it('should handle settlement webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
        fraud_status: 'accept',
        transaction_id: 'txn-123',
        signature_key: Buffer.from('mock-signature').toString('hex'),
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
        cashier_id: 'kasir-001',
      });
      mockOrderRepository.updateOrder.mockResolvedValue({ ...mockOrder, status: OrderStatus.completed });
      mockOrderRepository.createAuditLog.mockResolvedValue({});

      const result = await service.handleMidtransWebhook(validWebhookPayload);

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith('order-001', {
        status: OrderStatus.completed,
        payment_status: 'paid',
        payment_settled_at: expect.any(Date),
      });
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
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({ ...mockOrder, status: OrderStatus.voided });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'expire',
        status_code: '201',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith('order-001', {
        status: OrderStatus.voided,
        payment_status: 'expire',
        payment_settled_at: null,
      });
    });

    it('should handle cancel webhook successfully', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'order-001',
        transaction_status: 'cancel',
        status_code: '202',
        gross_amount: '25000',
      });
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.pending_sync,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({ ...mockOrder, status: OrderStatus.voided });

      const result = await service.handleMidtransWebhook({
        ...validWebhookPayload,
        transaction_status: 'cancel',
        status_code: '202',
      });

      expect(result).toEqual({ status: 'success' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith('order-001', {
        status: OrderStatus.voided,
        payment_status: 'failed',
        payment_settled_at: null,
      });
    });

    it('should ignore webhook with invalid signature', async () => {
      // Reset crypto mock for this test
      const crypto = require('crypto');
      crypto.createHash.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          digest: jest.fn().mockReturnValue(Buffer.from('different-signature')),
        }),
      });

      const result = await service.handleMidtransWebhook(validWebhookPayload);

      expect(result).toEqual({ status: 'IGNORED' });
      expect(mockOrderRepository.updateOrder).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order not found', async () => {
      mockMidtransCore.transaction.notification.mockResolvedValue({
        order_id: 'non-existent-order',
        transaction_status: 'settlement',
        status_code: '200',
        gross_amount: '25000',
      });
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      await expect(service.handleMidtransWebhook({
        ...validWebhookPayload,
        order_id: 'non-existent-order',
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('voidOrder', () => {
    it('should void order with valid reason', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.completed,
        total_amount: 25000,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({ ...mockOrder, status: OrderStatus.voided });
      mockOrderRepository.createOrderRefund.mockResolvedValue({});
      mockOrderRepository.createAuditLog.mockResolvedValue({});
      mockOrderRepository.countRecentVoids.mockResolvedValue(0);

      const result = await service.voidOrder('order-001', 'Pelanggan meminta pembatalan', 'admin-001');

      expect(result).toEqual({ success: true, message: 'Order voided successfully' });
      expect(mockOrderRepository.updateOrder).toHaveBeenCalledWith('order-001', {
        status: OrderStatus.voided,
        voided_by: 'admin-001',
        voided_at: expect.any(Date),
        void_reason: 'Pelanggan meminta pembatalan',
        payment_status: 'failed',
      });
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

      await expect(
        service.voidOrder('non-existent-order', 'Pelanggan minta batal', 'admin-001'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.voidOrder('non-existent-order', 'Pelanggan minta batal', 'admin-001'),
      ).rejects.toThrow('Order not found');
    });

    it('should throw BadRequestException when order already voided', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.voided,
      });

      await expect(
        service.voidOrder('order-001', 'Pelanggan minta batal', 'admin-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.voidOrder('order-001', 'Pelanggan minta batal', 'admin-001'),
      ).rejects.toThrow('Order sudah di-void');
    });

    it('should throw BadRequestException when reason too short', async () => {
      await expect(
        service.voidOrder('order-001', 'short', 'admin-001'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.voidOrder('order-001', 'short', 'admin-001'),
      ).rejects.toThrow('Alasan void wajib minimal 10 karakter');
    });

    it('should send alert email when 3 or more voids in 10 minutes', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.completed,
        total_amount: 25000,
      });
      mockOrderRepository.updateOrder.mockResolvedValue({ ...mockOrder, status: OrderStatus.voided });
      mockOrderRepository.createOrderRefund.mockResolvedValue({});
      mockOrderRepository.createAuditLog.mockResolvedValue({});
      mockOrderRepository.countRecentVoids.mockResolvedValue(3);

      await service.voidOrder('order-001', 'Pelanggan minta batal', 'admin-001');

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
        { ...mockOrder, payment_method: PaymentMethod.cash, total_amount: 25000 },
        { ...mockOrder, id: 'order-002', payment_method: PaymentMethod.qris, total_amount: 35000 },
        { ...mockOrder, id: 'order-003', payment_method: PaymentMethod.cash, total_amount: 15000 },
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

      expect(csv).toContain('Tanggal,ID Pesanan,Kasir,Metode Pembayaran,Status,Item,Kuantitas,Harga Dasar,Nama Diskon,Nominal Diskon,Harga Akhir');
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
      expect(mockOrderRepository.findOrderById).toHaveBeenCalledWith('order-001');
    });

    it('should throw NotFoundException when order not found', async () => {
      mockOrderRepository.findOrderById.mockResolvedValue(null);

      await expect(service.getOrder('non-existent-order')).rejects.toThrow(NotFoundException);
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
      );
    });
  });

  describe('startShift', () => {
    it('should return existing shift if already open', async () => {
      const existingShift = { id: 'shift-001', cashier_id: 'kasir-001', status: 'open' };
      mockOrderRepository.findCurrentShift.mockResolvedValue(existingShift);

      const result = await service.startShift('kasir-001');

      expect(result).toEqual(existingShift);
      expect(mockOrderRepository.createShift).not.toHaveBeenCalled();
    });

    it('should create new shift with default opening balance', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newShift = { id: 'shift-002', cashier_id: 'kasir-001', status: 'open', opening_balance: 500000 };

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
      const newShift = { id: 'shift-002', cashier_id: 'kasir-001', status: 'open', opening_balance: 1000000 };

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
      const shift = { id: 'shift-001', cashier_id: 'kasir-001', status: 'open' };

      mockOrderRepository.findCurrentShift.mockResolvedValue(shift);

      const result = await service.getCurrentShift('kasir-001');

      expect(result).toEqual(shift);
      expect(mockOrderRepository.findCurrentShift).toHaveBeenCalledWith('kasir-001', today);
    });
  });

  describe('flagTransaction', () => {
    it('should flag transaction and create audit log', async () => {
      const order = { ...mockOrder, verification_status: 'pending' };
      const updatedOrder = { ...mockOrder, verification_status: 'verified' };

      mockOrderRepository.findOrderById.mockResolvedValue(order);
      mockOrderRepository.updateOrder.mockResolvedValue(updatedOrder);
      mockOrderRepository.createAuditLog.mockResolvedValue({});

      const result = await service.flagTransaction('order-001', 'verified', 'admin-001');

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

      await expect(service.flagTransaction('non-existent', 'verified', 'admin-001')).rejects.toThrow(
        NotFoundException,
      );
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
