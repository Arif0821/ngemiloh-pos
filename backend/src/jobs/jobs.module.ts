import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './processors/email.processor';
import { SyncProcessor } from './processors/sync.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'SEND_EMAIL' }, { name: 'SYNC_OFFLINE' }),
    PrismaModule,
    InventoryModule,
    OrdersModule,
    EmailModule,
  ],
  providers: [EmailProcessor, SyncProcessor],
  exports: [BullModule],
})
export class JobsModule {}
