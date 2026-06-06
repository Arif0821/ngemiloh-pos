import { Module } from '@nestjs/common';
import { InventoryService } from './application/services/inventory.service';
import { InventoryController } from './presentation/inventory.controller';
import { PrismaInventoryRepository } from './infrastructure/repositories/prisma-inventory.repository';
import { INVENTORY_REPOSITORY } from './domain/interfaces/inventory.repository.interface';

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryService,
    {
      provide: INVENTORY_REPOSITORY,
      useClass: PrismaInventoryRepository,
    },
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
