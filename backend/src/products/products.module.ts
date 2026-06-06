import { Module } from '@nestjs/common';
import { ProductsService } from './application/services/products.service';
import { ProductsController } from './presentation/products.controller';
import { PRODUCT_REPOSITORY } from './domain/interfaces/product.repository.interface';
import { PrismaProductRepository } from './infrastructure/repositories/prisma-product.repository';

@Module({
  providers: [
    ProductsService,
    {
      provide: PRODUCT_REPOSITORY,
      useClass: PrismaProductRepository,
    },
  ],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
