export const DISCOUNT_REPOSITORY = 'DISCOUNT_REPOSITORY';

export interface IDiscountRepository {
  findAll(): Promise<any>;
  findOne(id: string): Promise<any>;
  create(data: any, adminId: string): Promise<any>;
  update(id: string, data: any): Promise<any>;
  remove(id: string): Promise<any>;
}
