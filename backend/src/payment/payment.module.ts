import { Module, Global } from '@nestjs/common';
import { MidtransGatewayService } from './midtrans-gateway.service';
import { FakePaymentGatewayService } from './fake-gateway.service';
import { PAYMENT_GATEWAY } from './payment-gateway.interface';

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () => {
        // Conditionally provide the gateway based on environment
        // In production/tests, use FAKE_MIDTRANS=true for testing
        if (process.env.FAKE_MIDTRANS === 'true') {
          return new FakePaymentGatewayService();
        }
        return new MidtransGatewayService();
      },
    },
    // Also export the concrete implementations for direct injection if needed
    MidtransGatewayService,
    FakePaymentGatewayService,
  ],
  exports: [PAYMENT_GATEWAY, MidtransGatewayService, FakePaymentGatewayService],
})
export class PaymentModule {}
