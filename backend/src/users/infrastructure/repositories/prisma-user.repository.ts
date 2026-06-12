import { Injectable } from '@nestjs/common';
import { IUserRepository } from '../../domain/interfaces/user.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { User, Customer, Prisma } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private prisma: PrismaService) {}

  async findCashiers(): Promise<
    Array<{
      id: string;
      name: string;
      username: string;
      is_active: boolean;
      failed_login_count: number;
      locked_until: Date | null;
      last_login_at: Date | null;
      created_at: Date;
    }>
  > {
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
      orderBy: { created_at: 'desc' },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: Prisma.UserUncheckedCreateInput) {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUncheckedUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async findCustomers(): Promise<Customer[]> {
    return this.prisma.customer.findMany({
      orderBy: { created_at: 'desc' },
    });
  }

  async createCustomer(
    data: Prisma.CustomerUncheckedCreateInput,
  ): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  async updateCustomerLoyalty(id: string, points: number): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: { loyalty_points: { increment: points } },
    });
  }
}
