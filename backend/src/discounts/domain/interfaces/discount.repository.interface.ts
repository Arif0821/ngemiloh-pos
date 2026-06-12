import { Discount, Prisma } from '@prisma/client';

export const DISCOUNT_REPOSITORY = Symbol('DISCOUNT_REPOSITORY');

export interface IDiscountRepository {
  findAll(): Promise<Discount[]>;
  findOne(id: string): Promise<Discount | null>;
  create(
    data: Prisma.DiscountUncheckedCreateInput,
    adminId: string,
  ): Promise<Discount>;
  update(
    id: string,
    data: Prisma.DiscountUncheckedUpdateInput,
    adminId?: string,
  ): Promise<Discount>;
  remove(id: string, adminId?: string): Promise<Discount>;
}
