import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { RedisModule } from './common/redis/redis.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerLoggerGuard } from './auth/guards/throttler-logger.guard';
import { APP_GUARD } from '@nestjs/core';
import { DiscountsModule } from './discounts/discounts.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';
import { FlagsModule } from './flags/flags.module';
import { AuditModule } from './audit/audit.module';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/presentation/audit.interceptor';
import { ReceiptsModule } from './receipts/receipts.module';
import { JobsModule } from './jobs/jobs.module';
import { PaymentModule } from './payment/payment.module';
import { MembersModule } from './members/members.module';

// Skip throttling for health check endpoints (used by Docker healthcheck)
const skipThrottleForHealth = (context: {
  switchToHttp: () => { getRequest: () => { url: string; method: string } };
}) => {
  const req = context.switchToHttp().getRequest();
  const url = req.url;
  return url === '/_health' || url === '/health';
};

@Module({
  imports: [
    BullModule.forRoot({
      connection: (() => {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            const host = url.hostname;
            const port = Number(url.port) || 6379;
            const password = url.password || undefined;
            if (!host) throw new Error('Invalid hostname in REDIS_URL');
            return { host, port, password }; // Include password for auth
          } catch {
            console.warn(`Invalid REDIS_URL: ${redisUrl}, using fallback`);
          }
        }
        return {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || undefined,
        };
      })(),
    }),
    BullModule.registerQueue({
      name: 'SEND_EMAIL',
    }),
    BullModule.registerQueue({
      name: 'SYNC_OFFLINE',
    }),
    ScheduleModule.forRoot(),
    RedisModule, // Global Redis for OTP caching
    FlagsModule,
    AuditModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100, // 100 requests per minute per IP
        skipIf: skipThrottleForHealth,
      },
      {
        name: 'medium',
        ttl: 300000, // 5 mins
        limit: 300, // 300 requests per 5 mins
        skipIf: skipThrottleForHealth,
      },
      {
        name: 'login',
        ttl: 600000, // 10 mins
        limit: 5, // 5 login attempts per 10 mins
        skipIf: skipThrottleForHealth,
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000, // 1000 requests per hour
        skipIf: skipThrottleForHealth,
      },
    ]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    FinanceModule,
    DiscountsModule,
    UsersModule,
    ReceiptsModule,
    JobsModule,
    PaymentModule,
    MembersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerLoggerGuard, // Apply rate limiting globally with logging
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // Apply audit log globally for mutating requests
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
