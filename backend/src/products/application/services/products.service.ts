import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { type IProductRepository, PRODUCT_REPOSITORY } from '../../domain/interfaces/product.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: IProductRepository
  ) {}

  async findAll(categoryId?: string, includeModifiers: boolean = false) {
    return this.productRepository.findAll(categoryId, includeModifiers);
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(data: Prisma.ProductUncheckedCreateInput, creatorId: string) {
    return this.productRepository.create(data, creatorId);
  }

  async update(id: string, data: Prisma.ProductUncheckedUpdateInput, adminId: string) {
    const product = await this.productRepository.findOne(id);
    if (!product) throw new NotFoundException('Product not found');

    if (data.base_price !== undefined && Number(data.base_price) !== Number(product.base_price)) {
      await this.productRepository.logPriceUpdate(adminId, id, Number(product.base_price), Number(data.base_price));
    }

    const updateData = {
      name: data.name !== undefined ? data.name : product.name,
      base_price: data.base_price !== undefined ? data.base_price : product.base_price,
      is_active: data.is_active !== undefined ? data.is_active : product.is_active,
      is_out_of_stock: data.is_out_of_stock !== undefined ? data.is_out_of_stock : product.is_out_of_stock,
      sort_order: data.sort_order !== undefined ? data.sort_order : product.sort_order,
    };

    return this.productRepository.update(id, updateData);
  }

  async deleteProduct(id: string) {
    const hasOrderItems = await this.productRepository.hasOrderItems(id);
    if (hasOrderItems) {
      return this.productRepository.update(id, { is_active: false });
    } else {
      return this.productRepository.deleteProduct(id);
    }
  }

  async createModifierGroup(productId: string, data: Prisma.ProductModifierGroupUncheckedCreateInput) {
    return this.productRepository.createModifierGroup(productId, data);
  }

  async createModifierOption(groupId: string, data: Prisma.ProductModifierOptionUncheckedCreateInput) {
    return this.productRepository.createModifierOption(groupId, data);
  }

  async getCategories() {
    return this.productRepository.getCategories();
  }

  async updateModifierGroup(id: string, data: Prisma.ProductModifierGroupUncheckedUpdateInput) {
    const group = await this.productRepository.getModifierGroup(id);
    if (!group) throw new NotFoundException('Modifier group not found');

    const updateData = {
      name: data.name !== undefined ? data.name : group.name,
      is_required: data.is_required !== undefined ? data.is_required : group.is_required,
      is_active: data.is_active !== undefined ? data.is_active : group.is_active,
      max_selections: data.max_selections !== undefined ? data.max_selections : group.max_selections,
    };

    return this.productRepository.updateModifierGroup(id, updateData);
  }

  async updateModifierOption(id: string, data: Prisma.ProductModifierOptionUncheckedUpdateInput) {
    const option = await this.productRepository.getModifierOption(id);
    if (!option) throw new NotFoundException('Modifier option not found');

    const updateData = {
      name: data.name !== undefined ? data.name : option.name,
      additional_price: data.additional_price !== undefined ? data.additional_price : option.additional_price,
      is_active: data.is_active !== undefined ? data.is_active : option.is_active,
      sort_order: data.sort_order !== undefined ? data.sort_order : option.sort_order,
    };

    return this.productRepository.updateModifierOption(id, updateData);
  }
}
