import {
  Product,
  Category,
  ProductModifierGroup,
  ProductModifierOption,
  Prisma,
} from '@prisma/client';

export interface IProductRepository {
  findAll(categoryId?: string, includeModifiers?: boolean): Promise<Product[]>;
  findOne(id: string): Promise<Product | null>;
  create(
    data: Prisma.ProductUncheckedCreateInput,
    creatorId: string,
  ): Promise<Product>;
  update(
    id: string,
    data: Prisma.ProductUncheckedUpdateInput,
  ): Promise<Product>;
  deleteProduct(id: string): Promise<Product>;
  hasOrderItems(id: string): Promise<boolean>;
  logPriceUpdate(
    adminId: string,
    id: string,
    oldPrice: number,
    newPrice: number,
  ): Promise<void>;

  createModifierGroup(
    productId: string,
    data: Prisma.ProductModifierGroupUncheckedCreateInput,
  ): Promise<ProductModifierGroup>;
  createModifierOption(
    groupId: string,
    data: Prisma.ProductModifierOptionUncheckedCreateInput,
  ): Promise<ProductModifierOption>;
  updateModifierGroup(
    id: string,
    data: Prisma.ProductModifierGroupUncheckedUpdateInput,
  ): Promise<ProductModifierGroup>;
  updateModifierOption(
    id: string,
    data: Prisma.ProductModifierOptionUncheckedUpdateInput,
  ): Promise<ProductModifierOption>;

  getCategories(): Promise<Category[]>;
  getModifierGroup(id: string): Promise<ProductModifierGroup | null>;
  getModifierOption(id: string): Promise<ProductModifierOption | null>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
