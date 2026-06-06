export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

export interface IFinanceRepository {
  findOrders(where: any, include?: any): Promise<any[]>;
  findOperationalExpenses(where: any, orderBy?: any): Promise<any[]>;
  createOperationalExpense(data: any): Promise<any>;
  findAssets(where?: any, orderBy?: any): Promise<any[]>;
  findAssetById(id: string): Promise<any>;
  createAsset(data: any): Promise<any>;
  updateAsset(id: string, data: any): Promise<any>;
  findProfitShareLogByPeriod(periodMonth: Date): Promise<any>;
  createProfitShareLog(data: any): Promise<any>;
  updateProfitShareLog(id: string, data: any): Promise<any>;
  createAuditLog(data: any): Promise<any>;
  findFirstCashRegister(where: any, orderBy?: any): Promise<any>;
  createCashRegister(data: any): Promise<any>;
  updateCashRegister(id: string, data: any): Promise<any>;
  findManyCashRegisters(orderBy?: any, include?: any): Promise<any[]>;
}
