import { Injectable, Logger } from '@nestjs/common';
import { PaymentGateway, QrisResult } from './payment-gateway.interface';

/**
 * Fake Payment Gateway for testing
 * Provides mock QRIS responses without calling actual Midtrans API
 */
@Injectable()
export class FakePaymentGatewayService implements PaymentGateway {
  private readonly logger = new Logger(FakePaymentGatewayService.name);

  /**
   * Create mock QRIS payment
   */
  createQris(orderId: string, amount: number): Promise<QrisResult> {
    this.logger.log(
      `[FAKE] Creating QRIS for order ${orderId}, amount: ${amount}`,
    );

    // Generate mock transaction ID
    const mockTransactionId = `mock-txn-${orderId}-${Date.now()}`;

    // Generate mock QR string (using a public QR code generator for testing)
    const mockQrString = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ngemiloh-test-${orderId}`;

    // Calculate expiry (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    return Promise.resolve({
      transaction_id: mockTransactionId,
      qr_string: mockQrString,
      expires_at: expiresAt,
      status: 'pending',
      raw_response: {
        mock: true,
        order_id: orderId,
        amount,
        created_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Always return true for fake gateway (no signature verification needed)
   */
  verifyWebhookSignature(_payload: unknown, _signature: string): boolean {
    this.logger.log('[FAKE] Skipping signature verification');
    return true;
  }

  /**
   * Always available for testing
   */
  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
