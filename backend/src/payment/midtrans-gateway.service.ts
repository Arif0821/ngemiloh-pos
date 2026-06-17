import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as midtransClient from 'midtrans-client';
import {
  PaymentGateway,
  QrisResult,
  WebhookPayload,
} from './payment-gateway.interface';

@Injectable()
export class MidtransGatewayService implements PaymentGateway {
  private readonly logger = new Logger(MidtransGatewayService.name);
  private readonly midtransCore: midtransClient.CoreApi;

  constructor() {
    const isProduction = process.env.MIDTRANS_ENV === 'production';
    this.midtransCore = new midtransClient.CoreApi({
      isProduction,
      serverKey: isProduction
        ? process.env.MIDTRANS_SERVER_KEY_PRODUCTION
        : process.env.MIDTRANS_SERVER_KEY_SANDBOX,
      clientKey: isProduction
        ? process.env.MIDTRANS_CLIENT_KEY_PRODUCTION
        : process.env.MIDTRANS_CLIENT_KEY_SANDBOX,
    });
  }

  /**
   * Create QRIS payment via Midtrans
   */
  async createQris(orderId: string, amount: number): Promise<QrisResult> {
    try {
      const params = {
        payment_type: 'qris' as const,
        transaction_details: {
          order_id: orderId,
          gross_amount: Math.round(amount),
        },
        qris: {
          acquirer: 'gopay',
        },
        custom_expiry: {
          expiry_duration: Number(process.env.QRIS_EXPIRY_SECONDS) || 900,
          unit: 'second' as const,
        },
      };

      const response = await this.midtransCore.charge(params);

      // Extract QR string from actions
      let qrString: string | undefined;
      if (response.actions && Array.isArray(response.actions)) {
        const qrAction = response.actions.find(
          (a: { name: string; url?: string }) => a.name === 'generate-qr-code',
        );
        qrString = qrAction?.url;
      }

      // Calculate expiry time
      const expirySeconds = Number(process.env.QRIS_EXPIRY_SECONDS) || 900;
      const expiresAt = new Date(Date.now() + expirySeconds * 1000);

      return {
        transaction_id: response.transaction_id || '',
        qr_string: qrString,
        expires_at: expiresAt,
        status: 'pending',
        raw_response: response as Record<string, unknown>,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create QRIS: ${message}`);
      throw error;
    }
  }

  /**
   * Verify Midtrans webhook signature using SHA512
   */
  verifyWebhookSignature(payload: unknown, _signature: string): boolean {
    try {
      const data = payload as WebhookPayload;
      if (!data.signature_key) {
        this.logger.warn('Missing signature_key in webhook');
        return false;
      }

      const serverKey =
        process.env.MIDTRANS_ENV === 'production'
          ? process.env.MIDTRANS_SERVER_KEY_PRODUCTION
          : process.env.MIDTRANS_SERVER_KEY_SANDBOX;

      // Construct the string to hash: order_id + status_code + gross_amount + serverKey
      const stringToHash =
        data.order_id + data.status_code + data.gross_amount + serverKey;

      const hash = crypto
        .createHash('sha512')
        .update(stringToHash)
        .digest('hex');

      const expectedBuffer = Buffer.from(hash, 'hex');
      const signatureBuffer = Buffer.from(data.signature_key, 'hex');

      // Check buffer lengths match before timingSafeEqual
      if (expectedBuffer.length !== signatureBuffer.length) {
        this.logger.warn('Signature key length mismatch');
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (error) {
      this.logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Check if Midtrans is available (circuit breaker check)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to ping Midtrans status page
      // For now, return true if we have valid server key
      const serverKey =
        process.env.MIDTRANS_ENV === 'production'
          ? process.env.MIDTRANS_SERVER_KEY_PRODUCTION
          : process.env.MIDTRANS_SERVER_KEY_SANDBOX;

      return !!serverKey && serverKey.length > 0;
    } catch {
      return false;
    }
  }
}
