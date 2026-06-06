export interface IProductRepository {
  findAll(categoryId?: string, includeModifiers?: boolean): Promise<any[]>;
  findOne(id: string): Promise<any>;
  create(data: any, creatorId: string): Promise<any>;
  update(id: string, data: any): Promise<any>;
  deleteProduct(id: string): Promise<any>;
  hasOrderItems(id: string): Promise<boolean>;
  logPriceUpdate(adminId: string, id: string, oldPrice: number, newPrice: number): Promise<void>;
  
  createModifierGroup(productId: string, data: any): Promise<any>;
  createModifierOption(groupId: string, data: any): Promise<any>;
  updateModifierGroup(id: string, data: any): Promise<any>;
  updateModifierOption(id: string, data: any): Promise<any>;
  
  getCategories(): Promise<any[]>;
  getModifierGroup(id: string): Promise<any>;
  getModifierOption(id: string): Promise<any>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
