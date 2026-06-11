import {
  Prisma,
  Order,
  OperationalExpense,
  Asset,
  ProfitShareLog,
  AuditLog,
  CashRegister,
} from '@prisma/client';

export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

export interface IFinanceRepository {
  findOrders(
    where: Prisma.OrderWhereInput,
    include?: Prisma.OrderInclude,
  ): Promise<any[]>;
  findOperationalExpenses(
    where: Prisma.OperationalExpenseWhereInput,
    orderBy?: Prisma.OperationalExpenseOrderByWithRelationInput,
  ): Promise<OperationalExpense[]>;
  createOperationalExpense(
    data: Prisma.OperationalExpenseUncheckedCreateInput,
  ): Promise<OperationalExpense>;
  findAssets(
    where?: Prisma.AssetWhereInput,
    orderBy?: Prisma.AssetOrderByWithRelationInput,
  ): Promise<Asset[]>;
  findAssetById(id: string): Promise<Asset | null>;
  createAsset(data: Prisma.AssetUncheckedCreateInput): Promise<Asset>;
  updateAsset(
    id: string,
    data: Prisma.AssetUncheckedUpdateInput,
  ): Promise<Asset>;
  findProfitShareLogByPeriod(periodMonth: Date): Promise<ProfitShareLog | null>;
  createProfitShareLog(
    data: Prisma.ProfitShareLogUncheckedCreateInput,
  ): Promise<ProfitShareLog>;
  updateProfitShareLog(
    id: string,
    data: Prisma.ProfitShareLogUncheckedUpdateInput,
  ): Promise<ProfitShareLog>;
  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog>;
  findFirstCashRegister(
    where: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
  ): Promise<CashRegister | null>;
  createCashRegister(
    data: Prisma.CashRegisterUncheckedCreateInput,
  ): Promise<CashRegister>;
  updateCashRegister(
    id: string,
    data: Prisma.CashRegisterUncheckedUpdateInput,
  ): Promise<CashRegister>;
  findManyCashRegisters(
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    include?: Prisma.CashRegisterInclude,
  ): Promise<any[]>;
}
