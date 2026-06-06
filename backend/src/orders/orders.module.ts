import { Module } from '@nestjs/common';
import { OrdersService } from './application/services/orders.service';
import { OrdersController } from './presentation/orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { MailModule } from '../mail/mail.module';
import { ORDER_REPOSITORY } from './domain/interfaces/order.repository.interface';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';

@Module({
  imports: [InventoryModule, MailModule],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useClass: PrismaOrderRepository,
    },
    OrdersService,
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
