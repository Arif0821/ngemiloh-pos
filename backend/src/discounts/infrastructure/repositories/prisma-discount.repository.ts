import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IDiscountRepository } from '../../domain/interfaces/discount.repository.interface';

@Injectable()
export class PrismaDiscountRepository implements IDiscountRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<any> {
    return this.prisma.discount.findMany({
      orderBy: { valid_from: 'desc' }
    });
  }

  async findOne(id: string): Promise<any> {
    return this.prisma.discount.findUnique({ where: { id } });
  }

  async create(data: any, adminId: string): Promise<any> {
    const created = await this.prisma.discount.create({
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        scope: data.scope,
        target_id: data.target_id || null,
        valid_from: new Date(data.valid_from),
        valid_until: data.valid_until ? new Date(data.valid_until) : null,
        applicable_days: data.applicable_days || [1,2,3,4,5,6,7],
        is_active: data.is_active ?? true,
        created_by: adminId,
      }
    });

    await this.prisma.auditLog.create({
      data: {
        actor_id: adminId,
        action: 'DISCOUNT_CREATE',
        entity_type: 'Discount',
        entity_id: created.id,
        new_value: { code: created.name, value: Number(created.value), type: created.type } as any
      }
    });

    return created;
  }

  async update(id: string, data: any): Promise<any> {
    const old = await this.prisma.discount.findUnique({ where: { id } });

    const updated = await this.prisma.discount.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        scope: data.scope,
        target_id: data.target_id || null,
        valid_from: data.valid_from ? new Date(data.valid_from) : undefined,
        valid_until: data.valid_until !== undefined ? (data.valid_until ? new Date(data.valid_until) : null) : undefined,
        applicable_days: data.applicable_days,
        is_active: data.is_active,
      }
    });

    return updated;
  }

  async remove(id: string): Promise<any> {
    return this.prisma.discount.update({
      where: { id },
      data: { is_active: false }
    });
  }
}
