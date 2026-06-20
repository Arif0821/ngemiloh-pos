import {
  Prisma,
  Order,
  OperationalExpense,
  Asset,
  ProfitShareLog,
  ProfitShareDetail,
  AuditLog,
  CashRegister,
} from '@prisma/client';

/**
 * Interface for profit share detail record returned from createManyAndReturn
 */
export interface ProfitShareDetailResult {
  id: string;
  order_id: string;
  cashier_id: string;
  gross_profit: number;
  kasir_share: number;
  hq_share: number;
  created_at: Date;
  updated_at: Date;
}

export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

export interface IFinanceRepository {
  findOrders(
    where: Prisma.OrderWhereInput,
    include?: Prisma.OrderInclude,
    take?: number,
  ): Promise<Order[]>;
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
  countCashRegisters(where: Prisma.CashRegisterWhereInput): Promise<number>;
  findManyCashRegisters(
    where?: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    include?: Prisma.CashRegisterInclude,
  ): Promise<CashRegister[]>;
  createProfitShareDetail(
    data: Prisma.ProfitShareDetailUncheckedCreateInput,
  ): Promise<ProfitShareDetail>;
  createManyProfitShareDetails(
    data: Prisma.ProfitShareDetailUncheckedCreateInput[],
  ): Promise<ProfitShareDetailResult[]>;
  findClosedCashRegistersForPeriod(
    start: Date,
    end: Date,
  ): Promise<
    Array<
      CashRegister & {
        cashier: { id: string; name: string };
      }
    >
  >;
}
