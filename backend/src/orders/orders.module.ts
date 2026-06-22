import { Module } from '@nestjs/common';
import { OrdersService } from './application/services/orders.service';
import { OrdersController } from './presentation/orders.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ORDER_REPOSITORY } from './domain/interfaces/order.repository.interface';
import { PrismaOrderRepository } from './infrastructure/repositories/prisma-order.repository';
import { MembersModule } from '../members/members.module';

@Module({
  imports: [InventoryModule, MembersModule],
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
