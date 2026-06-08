import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { EmailModule } from './email/email.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DiscountsModule } from './discounts/discounts.module';
import { UsersModule } from './users/users.module';
import { FinanceModule } from './finance/finance.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CsrfMiddleware } from './auth/middleware/csrf.middleware';
import { FlagsModule } from './flags/flags.module';
import { MailModule } from './mail/mail.module';
import { AuditModule } from './audit/audit.module';
import { BullModule } from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './audit/presentation/audit.interceptor';

@Module({
  imports: [
    BullModule.forRoot({
      connection: (() => {
        // Support both REDIS_URL (dari docker-compose) dan REDIS_HOST+REDIS_PORT
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            return { host: url.hostname, port: Number(url.port) || 6379 };
          } catch {
            // Fallback jika URL tidak valid
          }
        }
        return {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
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
    FlagsModule,
    MailModule,
    AuditModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,
        limit: 100, // 100 requests per minute
      },
      {
        name: 'login',
        ttl: 600000, // 10 mins
        limit: 5, // 5 requests per 10 mins
      }
    ]),
    EventEmitterModule.forRoot(),
    PrismaModule, 
    AuthModule, 
    ProductsModule, 
    OrdersModule, 
    InventoryModule,
    FinanceModule,
    DiscountsModule,
    EmailModule,
    UsersModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Apply rate limiting globally
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor, // Apply audit log globally for mutating requests
    }
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CsrfMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
