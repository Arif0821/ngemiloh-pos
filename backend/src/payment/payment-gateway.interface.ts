/**
 * PaymentGateway Interface
 * Abstraksi untuk integrasi payment provider (Midtrans, dll)
 * Memisahkan business logic dari SDK payment specific
 */
export interface QrisResult {
  transaction_id: string;
  qr_url?: string;
  qr_string?: string;
  expires_at?: Date;
  status: 'success' | 'pending' | 'failed';
  raw_response?: Record<string, unknown>;
}

export interface WebhookPayload {
  order_id: string;
  transaction_status: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
  transaction_id?: string;
}

export interface PaymentGateway {
  /**
   * Create QRIS payment for an order
   */
  createQris(orderId: string, amount: number): Promise<QrisResult>;

  /**
   * Verify webhook signature from payment provider
   */
  verifyWebhookSignature(payload: unknown, signature: string): boolean;

  /**
   * Check if payment service is available
   */
  isAvailable(): Promise<boolean>;
}

// Token for DI
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
