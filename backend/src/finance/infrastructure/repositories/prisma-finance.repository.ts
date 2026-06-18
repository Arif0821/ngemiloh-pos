import { Injectable } from '@nestjs/common';
import { IFinanceRepository } from '../../domain/interfaces/finance.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaFinanceRepository implements IFinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrders(
    where: Prisma.OrderWhereInput,
    include?: Prisma.OrderInclude,
    take?: number,
  ) {
    return this.prisma.order.findMany({ where, include, take });
  }

  async findOperationalExpenses(
    where: Prisma.OperationalExpenseWhereInput,
    orderBy?: Prisma.OperationalExpenseOrderByWithRelationInput,
  ) {
    return this.prisma.operationalExpense.findMany({ where, orderBy });
  }

  async createOperationalExpense(
    data: Prisma.OperationalExpenseUncheckedCreateInput,
  ) {
    return this.prisma.operationalExpense.create({ data });
  }

  async findAssets(
    where?: Prisma.AssetWhereInput,
    orderBy?: Prisma.AssetOrderByWithRelationInput,
  ) {
    return this.prisma.asset.findMany({ where, orderBy });
  }

  async findAssetById(id: string) {
    return this.prisma.asset.findUnique({ where: { id } });
  }

  async createAsset(data: Prisma.AssetUncheckedCreateInput) {
    return this.prisma.asset.create({ data });
  }

  async updateAsset(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return this.prisma.asset.update({ where: { id }, data });
  }

  async findProfitShareLogByPeriod(periodMonth: Date) {
    return this.prisma.profitShareLog.findUnique({
      where: { period_month: periodMonth },
    });
  }

  async createProfitShareLog(data: Prisma.ProfitShareLogUncheckedCreateInput) {
    return this.prisma.profitShareLog.create({ data });
  }

  async updateProfitShareLog(
    id: string,
    data: Prisma.ProfitShareLogUncheckedUpdateInput,
  ) {
    return this.prisma.profitShareLog.update({ where: { id }, data });
  }

  async createAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
    return this.prisma.auditLog.create({ data });
  }

  async findFirstCashRegister(
    where: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
  ) {
    return this.prisma.cashRegister.findFirst({ where, orderBy });
  }

  async createCashRegister(data: Prisma.CashRegisterUncheckedCreateInput) {
    return this.prisma.cashRegister.create({ data });
  }

  async updateCashRegister(
    id: string,
    data: Prisma.CashRegisterUncheckedUpdateInput,
  ) {
    return this.prisma.cashRegister.update({ where: { id }, data });
  }

  async findManyCashRegisters(
    where?: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    include?: Prisma.CashRegisterInclude,
  ) {
    return this.prisma.cashRegister.findMany({ where, orderBy, include });
  }

  async createProfitShareDetail(
    data: Prisma.ProfitShareDetailUncheckedCreateInput,
  ) {
    return this.prisma.profitShareDetail.create({ data });
  }

  async createManyProfitShareDetails(
    data: Prisma.ProfitShareDetailUncheckedCreateInput[],
  ) {
    // F19: Use createManyAndReturn for PostgreSQL to get created records with IDs
    return this.prisma.profitShareDetail.createManyAndReturn({ data }) as any;
  }

  async findClosedCashRegistersForPeriod(start: Date, end: Date) {
    return this.prisma.cashRegister.findMany({
      where: {
        status: 'closed',
        shift_start: { gte: start, lte: end },
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });
  }
}
