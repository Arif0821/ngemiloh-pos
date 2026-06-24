import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './processors/email.processor';
import { SyncProcessor } from './processors/sync.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { EmailModule } from '../email/email.module';

// Default retry configuration for all queues
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 5000; // 5 seconds

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'SEND_EMAIL',
        defaultJobOptions: {
          attempts: DEFAULT_RETRY_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: DEFAULT_RETRY_DELAY,
          },
          removeOnComplete: {
            age: 3600, // Remove completed jobs after 1 hour
            count: 100, // Keep last 100 completed
          },
          removeOnFail: {
            age: 86400, // Keep failed jobs in failed state for 24 hours (for DLQ inspection)
            count: 500, // Keep last 500 failed
          },
        },
      },
      {
        name: 'SYNC_OFFLINE',
        defaultJobOptions: {
          attempts: DEFAULT_RETRY_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: DEFAULT_RETRY_DELAY,
          },
          removeOnComplete: {
            age: 3600,
            count: 100,
          },
          removeOnFail: {
            age: 86400,
            count: 500,
          },
        },
      },
    ),
    PrismaModule,
    InventoryModule,
    OrdersModule,
    EmailModule,
  ],
  providers: [EmailProcessor, SyncProcessor],
  exports: [BullModule],
})
export class JobsModule {}
