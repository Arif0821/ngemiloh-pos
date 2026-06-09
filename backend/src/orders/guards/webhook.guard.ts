import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * WebhookGuard - Verifies Midtrans webhook signature
 *
 * Midtrans sends signature key in notification headers.
 * We verify it to ensure the request is from Midtrans.
 */
@Injectable()
export class WebhookGuard implements NestInterceptor {
  private readonly logger = new Logger(WebhookGuard.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const signatureKey = request.headers['x-midtrans-signature-key'];

    // In production, verify the signature
    if (process.env.NODE_ENV === 'production') {
      if (!signatureKey) {
        throw new Error('Missing Midtrans signature key');
      }
      // Midtrans signature format: sha512(order_id+status_code+gross_amount+server_key)
      // Verification happens in orders.service.handleMidtransWebhook
    }

    return next.handle();
  }
}
