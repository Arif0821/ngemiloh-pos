import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IProductRepository } from '../../domain/interfaces/product.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaProductRepository implements IProductRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(categoryId?: string, includeModifiers: boolean = false) {
    return this.prisma.product.findMany({
      where: {
        is_active: true,
        ...(categoryId ? { category_id: categoryId } : {}),
      },
      orderBy: { sort_order: 'asc' },
      include: {
        category: true,
        modifier_groups: includeModifiers
          ? {
              where: { is_active: true },
              orderBy: { sort_order: 'asc' },
              include: {
                options: {
                  where: { is_active: true },
                  orderBy: { sort_order: 'asc' },
                },
              },
            }
          : false,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        modifier_groups: {
          include: { options: true },
        },
      },
    });
  }

  async create(data: Prisma.ProductUncheckedCreateInput, creatorId: string) {
    return this.prisma.product.create({
      data: {
        name: data.name,
        category_id: data.category_id,
        base_price: data.base_price,
        image_url: data.image_url,
        created_by: creatorId,
      },
    });
  }

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        base_price: data.base_price,
        is_active: data.is_active,
        is_out_of_stock: data.is_out_of_stock,
        sort_order: data.sort_order,
      },
    });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }

  async hasOrderItems(id: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: { product_id: id },
    });
    return count > 0;
  }

  async logPriceUpdate(
    adminId: string,
    id: string,
    oldPrice: number,
    newPrice: number,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actor_id: adminId,
        action: 'PRODUCT_PRICE_UPDATE',
        entity_type: 'Product',
        entity_id: id,
        old_value: { base_price: oldPrice },
        new_value: { base_price: newPrice },
      },
    });
  }

  async createModifierGroup(
    productId: string,
    data: Prisma.ProductModifierGroupUncheckedCreateInput,
  ) {
    return this.prisma.productModifierGroup.create({
      data: {
        product_id: productId,
        name: data.name,
        is_required: data.is_required,
        max_selections: data.max_selections,
      },
    });
  }

  async createModifierOption(
    groupId: string,
    data: Prisma.ProductModifierOptionUncheckedCreateInput,
  ) {
    return this.prisma.productModifierOption.create({
      data: {
        group_id: groupId,
        name: data.name,
        additional_price: data.additional_price,
        sort_order: data.sort_order,
      },
    });
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  async getModifierGroup(id: string) {
    return this.prisma.productModifierGroup.findUnique({ where: { id } });
  }

  async getModifierOption(id: string) {
    return this.prisma.productModifierOption.findUnique({ where: { id } });
  }

  async updateModifierGroup(
    id: string,
    data: Prisma.ProductModifierGroupUncheckedUpdateInput,
  ) {
    return this.prisma.productModifierGroup.update({
      where: { id },
      data: {
        name: data.name,
        is_required: data.is_required,
        is_active: data.is_active,
        max_selections: data.max_selections,
      },
    });
  }

  async updateModifierOption(
    id: string,
    data: Prisma.ProductModifierOptionUncheckedUpdateInput,
  ) {
    return this.prisma.productModifierOption.update({
      where: { id },
      data: {
        name: data.name,
        additional_price: data.additional_price,
        is_active: data.is_active,
        sort_order: data.sort_order,
      },
    });
  }
}
