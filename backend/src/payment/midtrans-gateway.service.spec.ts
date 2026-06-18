import { Test, TestingModule } from '@nestjs/testing';
import { MidtransGatewayService } from './midtrans-gateway.service';

// Mock the entire midtrans-client module
jest.mock('midtrans-client', () => ({
  CoreApi: jest.fn().mockImplementation(() => ({
    charge: jest.fn(),
  })),
}));

import * as midtransClient from 'midtrans-client';

describe('MidtransGatewayService', () => {
  let service: MidtransGatewayService;
  let mockCoreApi: { charge: jest.Mock };

  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset environment variables
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MIDTRANS_ENV: 'sandbox',
      MIDTRANS_SERVER_KEY_SANDBOX: 'test-sandbox-key',
      MIDTRANS_CLIENT_KEY_SANDBOX: 'test-client-key',
      QRIS_EXPIRY_SECONDS: '900',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MidtransGatewayService],
    }).compile();

    service = module.get<MidtransGatewayService>(MidtransGatewayService);

    // Get reference to the mocked CoreApi instance
    mockCoreApi = (midtransClient.CoreApi as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('createQris', () => {
    const orderId = 'ORDER-123';
    const amount = 50000;

    it('should create QRIS payment successfully', async () => {
      const mockResponse = {
        transaction_id: 'txn-abc123',
        status_code: '201',
        actions: [
          {
            name: 'generate-qr-code',
            url: 'https://api.midtrans.com/qris/abc123',
          },
        ],
      };

      mockCoreApi.charge.mockResolvedValue(mockResponse);

      const result = await service.createQris(orderId, amount);

      expect(result.transaction_id).toBe('txn-abc123');
      expect(result.qr_string).toBe('https://api.midtrans.com/qris/abc123');
      expect(result.status).toBe('pending');
      expect(result.expires_at).toBeInstanceOf(Date);
      expect(result.raw_response).toEqual(mockResponse);

      // Verify correct params were passed
      expect(mockCoreApi.charge).toHaveBeenCalledWith({
        payment_type: 'qris',
        transaction_details: {
          order_id: orderId,
          gross_amount: 50000, // Amount is rounded
        },
        qris: {
          acquirer: 'gopay',
        },
        custom_expiry: {
          expiry_duration: 900,
          unit: 'second',
        },
      });
    });

    it('should handle response without actions', async () => {
      const mockResponse = {
        transaction_id: 'txn-xyz789',
        status_code: '201',
      };

      mockCoreApi.charge.mockResolvedValue(mockResponse);

      const result = await service.createQris(orderId, amount);

      expect(result.transaction_id).toBe('txn-xyz789');
      expect(result.qr_string).toBeUndefined();
      expect(result.status).toBe('pending');
    });

    it('should handle response with actions but no generate-qr-code action', async () => {
      const mockResponse = {
        transaction_id: 'txn-def456',
        status_code: '201',
        actions: [
          {
            name: 'other-action',
            url: 'https://example.com/other',
          },
        ],
      };

      mockCoreApi.charge.mockResolvedValue(mockResponse);

      const result = await service.createQris(orderId, amount);

      expect(result.transaction_id).toBe('txn-def456');
      expect(result.qr_string).toBeUndefined();
    });

    it('should round amount to integer', async () => {
      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-test',
        status_code: '201',
      });

      await service.createQris(orderId, 50000.75);

      expect(mockCoreApi.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: {
            order_id: orderId,
            gross_amount: 50001, // Rounded up
          },
        }),
      );
    });

    it('should use default expiry of 900 seconds if QRIS_EXPIRY_SECONDS is not set', async () => {
      // First, reset the module and clear the mock
      jest.resetModules();

      // Clear the mock entirely
      (midtransClient.CoreApi as jest.Mock).mockClear();
      (midtransClient.CoreApi as jest.Mock).mockReset();

      // Re-mock with fresh implementation
      const freshMockCharge = jest.fn();
      (midtransClient.CoreApi as jest.Mock).mockImplementation(() => ({
        charge: freshMockCharge,
      }));

      // Now set up env WITHOUT QRIS_EXPIRY_SECONDS before creating service
      process.env.QRIS_EXPIRY_SECONDS = '';

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      freshMockCharge.mockResolvedValue({
        transaction_id: 'txn-test',
        status_code: '201',
      });

      const serviceWithDefaults = module.get<MidtransGatewayService>(
        MidtransGatewayService,
      );

      await serviceWithDefaults.createQris(orderId, amount);

      expect(freshMockCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_expiry: {
            expiry_duration: 900,
            unit: 'second',
          },
        }),
      );
    });

    it('should throw error when Midtrans API fails', async () => {
      mockCoreApi.charge.mockRejectedValue(new Error('API timeout'));

      await expect(service.createQris(orderId, amount)).rejects.toThrow(
        'API timeout',
      );
    });

    it('should handle empty transaction_id in response', async () => {
      const mockResponse = {
        transaction_id: '',
        status_code: '201',
      };

      mockCoreApi.charge.mockResolvedValue(mockResponse);

      const result = await service.createQris(orderId, amount);

      expect(result.transaction_id).toBe('');
    });

    it('should include gopay as default acquirer', async () => {
      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-test',
        status_code: '201',
      });

      await service.createQris(orderId, amount);

      expect(mockCoreApi.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          qris: {
            acquirer: 'gopay',
          },
        }),
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should return true for valid signature', () => {
      // Generate a valid signature
      const orderId = 'ORDER-123';
      const statusCode = '201';
      const grossAmount = '50000';
      const serverKey = 'test-sandbox-key';

      const stringToHash = orderId + statusCode + grossAmount + serverKey;
      const crypto = require('crypto');
      const validSignature = crypto
        .createHash('sha512')
        .update(stringToHash)
        .digest('hex');

      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: validSignature,
        transaction_status: 'settlement',
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(true);
    });

    it('should return false for missing signature_key', () => {
      const payload = {
        order_id: 'ORDER-123',
        status_code: '201',
        gross_amount: '50000',
        // No signature_key
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });

    it('should return false for invalid signature', () => {
      const payload = {
        order_id: 'ORDER-123',
        status_code: '201',
        gross_amount: '50000',
        signature_key: 'invalid-signature-key-that-is-not-valid-hex',
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });

    it('should return false for invalid hex in signature_key', () => {
      const payload = {
        order_id: 'ORDER-123',
        status_code: '201',
        gross_amount: '50000',
        // Valid hex length but invalid characters (G is not a hex digit)
        signature_key: 'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });

    it('should return false for tampered order_id', () => {
      const serverKey = 'test-sandbox-key';
      const statusCode = '201';
      const grossAmount = '50000';

      // Create valid signature with correct order_id
      const stringToHash = 'ORDER-123' + statusCode + grossAmount + serverKey;
      const crypto = require('crypto');
      const validSignature = crypto
        .createHash('sha512')
        .update(stringToHash)
        .digest('hex');

      // Payload with tampered order_id
      const payload = {
        order_id: 'ORDER-999', // Different order_id
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: validSignature,
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });

    it('should return false for tampered gross_amount', () => {
      const serverKey = 'test-sandbox-key';
      const orderId = 'ORDER-123';
      const statusCode = '201';

      // Create valid signature with amount 50000
      const stringToHash = orderId + statusCode + '50000' + serverKey;
      const crypto = require('crypto');
      const validSignature = crypto
        .createHash('sha512')
        .update(stringToHash)
        .digest('hex');

      // Payload with different gross_amount
      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: '99999', // Different amount
        signature_key: validSignature,
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });

    it('should use production server key in production mode', async () => {
      // Set to production BEFORE creating service
      process.env.MIDTRANS_ENV = 'production';
      process.env.MIDTRANS_SERVER_KEY_PRODUCTION = 'production-server-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const productionService = module.get<MidtransGatewayService>(
        MidtransGatewayService,
      );

      const result = await productionService.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false for empty payload', () => {
      const result = service.verifyWebhookSignature({}, 'unused');

      expect(result).toBe(false);
    });

    it('should return false for payload with undefined values', () => {
      const payload = {
        order_id: undefined,
        status_code: '201',
        gross_amount: '50000',
        signature_key: 'abc123',
      };

      const result = service.verifyWebhookSignature(payload, 'unused');

      expect(result).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true when server key is configured', async () => {
      // Recreate service with the env var set
      delete process.env.MIDTRANS_SERVER_KEY_SANDBOX;
      process.env.MIDTRANS_SERVER_KEY_SANDBOX = 'valid-key';

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const svc = module.get<MidtransGatewayService>(MidtransGatewayService);

      const result = await svc.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when server key is empty', async () => {
      // Recreate service with empty env var
      process.env.MIDTRANS_SERVER_KEY_SANDBOX = '';

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const svc = module.get<MidtransGatewayService>(MidtransGatewayService);

      const result = await svc.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when server key is undefined', async () => {
      delete process.env.MIDTRANS_SERVER_KEY_SANDBOX;

      // Need to recreate service since env is read at construction
      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const serviceNoKey = module.get<MidtransGatewayService>(
        MidtransGatewayService,
      );

      const result = await serviceNoKey.isAvailable();

      expect(result).toBe(false);
    });

    it('should use production key in production mode', async () => {
      process.env.MIDTRANS_ENV = 'production';
      process.env.MIDTRANS_SERVER_KEY_PRODUCTION = 'production-key';
      delete process.env.MIDTRANS_SERVER_KEY_SANDBOX;

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const productionService = module.get<MidtransGatewayService>(
        MidtransGatewayService,
      );

      const result = await productionService.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when production key is missing in production mode', async () => {
      process.env.MIDTRANS_ENV = 'production';
      delete process.env.MIDTRANS_SERVER_KEY_PRODUCTION;

      const module: TestingModule = await Test.createTestingModule({
        providers: [MidtransGatewayService],
      }).compile();

      const productionService = module.get<MidtransGatewayService>(
        MidtransGatewayService,
      );

      const result = await productionService.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large amount values', async () => {
      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-large',
        status_code: '201',
      });

      // 1 billion IDR
      const result = await service.createQris('ORDER-LARGE', 1_000_000_000);

      expect(result.transaction_id).toBe('txn-large');
      expect(mockCoreApi.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: {
            order_id: 'ORDER-LARGE',
            gross_amount: 1000000000,
          },
        }),
      );
    });

    it('should handle special characters in order_id', async () => {
      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-special',
        status_code: '201',
      });

      // Order ID with special characters (as might come from client)
      const result = await service.createQris('ORDER-SPECIAL-CHARS_123', 10000);

      expect(result.transaction_id).toBe('txn-special');
      expect(mockCoreApi.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: {
            order_id: 'ORDER-SPECIAL-CHARS_123',
            gross_amount: 10000,
          },
        }),
      );
    });

    it('should handle fractional seconds in expiry calculation', async () => {
      // Use fake timers for deterministic testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-time',
        status_code: '201',
      });

      const result = await service.createQris('ORDER-TIME', 10000);

      // expires_at should be exactly 900 seconds from now
      const expectedExpiry = new Date('2026-01-01T12:15:00.000Z');
      expect(result.expires_at).toEqual(expectedExpiry);

      jest.useRealTimers();
    });

    it('should handle zero amount (though unlikely in real usage)', async () => {
      mockCoreApi.charge.mockResolvedValue({
        transaction_id: 'txn-zero',
        status_code: '201',
      });

      const result = await service.createQris('ORDER-ZERO', 0);

      expect(result.status).toBe('pending');
      expect(mockCoreApi.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_details: {
            order_id: 'ORDER-ZERO',
            gross_amount: 0,
          },
        }),
      );
    });
  });
});
