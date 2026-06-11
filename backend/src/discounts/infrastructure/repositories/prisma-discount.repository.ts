import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IDiscountRepository } from '../../domain/interfaces/discount.repository.interface';
import { Discount, Prisma } from '@prisma/client';

@Injectable()
export class PrismaDiscountRepository implements IDiscountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Discount[]> {
    return this.prisma.discount.findMany({
      orderBy: { valid_from: 'desc' },
    });
  }

  async findOne(id: string): Promise<Discount | null> {
    return this.prisma.discount.findUnique({ where: { id } });
  }

  async create(
    data: Prisma.DiscountUncheckedCreateInput,
    adminId: string,
  ): Promise<Discount> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.discount.create({ data });

      await tx.auditLog.create({
        data: {
          actor_id: adminId,
          action: 'DISCOUNT_CREATE',
          entity_type: 'Discount',
          entity_id: created.id,
          new_value: {
            code: created.name,
            value: Number(created.value),
            type: created.type,
          },
        },
      });

      return created;
    });
  }

  async update(
    id: string,
    data: Prisma.DiscountUncheckedUpdateInput,
  ): Promise<Discount> {
    const old = await this.prisma.discount.findUnique({ where: { id } });

    const updated = await this.prisma.discount.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        scope: data.scope,
        target_id: data.target_id || null,
        valid_from: data.valid_from
          ? new Date(data.valid_from as any)
          : undefined,
        valid_until:
          data.valid_until !== undefined
            ? data.valid_until
              ? new Date(data.valid_until as any)
              : null
            : undefined,
        applicable_days: data.applicable_days,
        is_active: data.is_active,
      },
    });

    return updated;
  }

  async remove(id: string): Promise<Discount> {
    return this.prisma.discount.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
