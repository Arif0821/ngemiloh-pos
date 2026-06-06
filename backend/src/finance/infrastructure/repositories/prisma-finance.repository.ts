import { Injectable } from '@nestjs/common';
import { IFinanceRepository } from '../../domain/interfaces/finance.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PrismaFinanceRepository implements IFinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrders(where: any, include?: any) {
    return this.prisma.order.findMany({ where, include });
  }

  async findOperationalExpenses(where: any, orderBy?: any) {
    return this.prisma.operationalExpense.findMany({ where, orderBy });
  }

  async createOperationalExpense(data: any) {
    return this.prisma.operationalExpense.create({ data });
  }

  async findAssets(where?: any, orderBy?: any) {
    return this.prisma.asset.findMany({ where, orderBy });
  }

  async findAssetById(id: string) {
    return this.prisma.asset.findUnique({ where: { id } });
  }

  async createAsset(data: any) {
    return this.prisma.asset.create({ data });
  }

  async updateAsset(id: string, data: any) {
    return this.prisma.asset.update({ where: { id }, data });
  }

  async findProfitShareLogByPeriod(periodMonth: Date) {
    return this.prisma.profitShareLog.findUnique({ where: { period_month: periodMonth } });
  }

  async createProfitShareLog(data: any) {
    return this.prisma.profitShareLog.create({ data });
  }

  async updateProfitShareLog(id: string, data: any) {
    return this.prisma.profitShareLog.update({ where: { id }, data });
  }

  async createAuditLog(data: any) {
    return this.prisma.auditLog.create({ data });
  }

  async findFirstCashRegister(where: any, orderBy?: any) {
    return this.prisma.cashRegister.findFirst({ where, orderBy });
  }

  async createCashRegister(data: any) {
    return this.prisma.cashRegister.create({ data });
  }

  async updateCashRegister(id: string, data: any) {
    return this.prisma.cashRegister.update({ where: { id }, data });
  }

  async findManyCashRegisters(orderBy?: any, include?: any) {
    return this.prisma.cashRegister.findMany({ orderBy, include });
  }
}
