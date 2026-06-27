import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as midtransClient from 'midtrans-client';
import {
  PaymentGateway,
  QrisResult,
  WebhookPayload,
} from './payment-gateway.interface';

const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

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

      // SECURITY: Reject webhook if timestamp is too old (> 5 minutes)
      // This prevents replay attacks where old valid webhooks are replayed
      if (!this.isWebhookTimestampValid(data)) {
        this.logger.warn(
          'Webhook timestamp is too old (>5 minutes), rejecting',
        );
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
   * SECURITY: Validate webhook timestamp to prevent replay attacks
   * Midtrans webhook contains transaction_time field indicating when the transaction was created
   */
  private isWebhookTimestampValid(data: WebhookPayload): boolean {
    // Get transaction time from webhook
    // Midtrans provides this in various formats, try common fields
    const transactionTimeStr =
      ((data as Record<string, unknown>).transaction_time as string) ||
      ((data as Record<string, unknown>).settlement_time as string) ||
      ((data as Record<string, unknown>).transaction_time as string);

    if (!transactionTimeStr) {
      // If no timestamp available, we cannot validate - log warning but allow
      // This maintains backward compatibility while encouraging clients to include timestamps
      this.logger.warn(
        'No transaction_time in webhook, skipping timestamp validation',
      );
      return true;
    }

    try {
      const transactionTime = new Date(transactionTimeStr).getTime();
      const now = Date.now();
      const age = now - transactionTime;

      if (age > WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
        this.logger.warn(
          `Webhook too old: ${Math.round(age / 1000)}s > ${WEBHOOK_TIMESTAMP_TOLERANCE_MS / 1000}s tolerance`,
        );
        return false;
      }

      // Also reject if timestamp is in the future (clock skew protection)
      // Allow 60 seconds of future tolerance for clock differences
      if (transactionTime > now + 60 * 1000) {
        this.logger.warn('Webhook timestamp is in the future, rejecting');
        return false;
      }

      return true;
    } catch {
      this.logger.warn('Failed to parse transaction_time, skipping validation');
      return true; // Skip validation on parse error to maintain backward compatibility
    }
  }

  /**
   * Check if Midtrans is available (circuit breaker check)
   */
  isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to ping Midtrans status page
      // For now, return true if we have valid server key
      const serverKey =
        process.env.MIDTRANS_ENV === 'production'
          ? process.env.MIDTRANS_SERVER_KEY_PRODUCTION
          : process.env.MIDTRANS_SERVER_KEY_SANDBOX;
      // Return synchronously - no async operations needed
      return Promise.resolve(!!serverKey && serverKey.length > 0);
    } catch {
      return Promise.resolve(false);
    }
  }
}
