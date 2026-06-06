import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/interfaces/user.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  async findCashiers() {
    return this.prisma.user.findMany({
      where: { role: 'kasir' },
      select: {
        id: true,
        name: true,
        username: true,
        is_active: true,
        failed_login_count: true,
        locked_until: true,
        last_login_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: any) {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data
    });
  }
}
