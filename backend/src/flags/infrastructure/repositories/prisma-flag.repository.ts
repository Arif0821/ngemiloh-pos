import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IFlagRepository } from '../../domain/interfaces/flag.repository.interface';
import { FeatureFlag } from '@prisma/client';

@Injectable()
export class PrismaFlagRepository implements IFlagRepository {
  constructor(private prisma: PrismaService) {}

  async findByName(name: string): Promise<FeatureFlag | null> {
    return this.prisma.featureFlag.findUnique({ where: { name } });
  }

  async create(data: { name: string; description: string; is_enabled: boolean }): Promise<FeatureFlag> {
    return this.prisma.featureFlag.create({ data });
  }

  async findAll(orderBy?: any): Promise<FeatureFlag[]> {
    return this.prisma.featureFlag.findMany({ orderBy });
  }

  async update(name: string, data: { is_enabled: boolean; updated_by: string; updated_at: Date }): Promise<FeatureFlag> {
    return this.prisma.featureFlag.update({
      where: { name },
      data,
    });
  }
}
