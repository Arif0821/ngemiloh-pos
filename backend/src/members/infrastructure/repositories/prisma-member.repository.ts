import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  IMemberRepository,
  MemberWithTier,
} from '../../domain/interfaces/member.repository.interface';

@Injectable()
export class PrismaMemberRepository implements IMemberRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private get client() {
    return this.prisma;
  }

  async create(data: any): Promise<MemberWithTier> {
    return this.client.member.create({
      data,
      include: { tier: true },
    });
  }

  async findById(id: string): Promise<MemberWithTier | null> {
    return this.client.member.findUnique({
      where: { id },
      include: { tier: true },
    });
  }

  async findByPhone(phone: string): Promise<MemberWithTier | null> {
    return this.client.member.findUnique({
      where: { phone },
      include: { tier: true },
    });
  }

  async findByMemberCode(code: string): Promise<MemberWithTier | null> {
    return this.client.member.findUnique({
      where: { member_code: code },
      include: { tier: true },
    });
  }

  async updatePoints(id: string, newBalance: number): Promise<MemberWithTier> {
    return this.client.member.update({
      where: { id },
      data: { loyalty_points: newBalance },
      include: { tier: true },
    });
  }

  async updateTier(id: string, tierId: string): Promise<MemberWithTier> {
    return this.client.member.update({
      where: { id },
      data: {
        current_tier_id: tierId,
        tier_downgrade_at: null,
      },
      include: { tier: true },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.client.member.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    tier?: string;
    search?: string;
  }): Promise<{ data: MemberWithTier[]; total: number }> {
    const { page = 1, limit = 20, tier, search } = options || {};
    const skip = (page - 1) * limit;

    const where: any = { is_active: true };
    if (tier) where.current_tier_id = tier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { member_code: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.client.member.findMany({
        where,
        include: { tier: true },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.client.member.count({ where }),
    ]);

    return { data: data, total };
  }

  async createTransaction(data: any): Promise<void> {
    await this.client.memberTransaction.create({ data });
  }

  async getTransactionHistory(memberId: string, limit = 50): Promise<any[]> {
    return this.client.memberTransaction.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }
}
