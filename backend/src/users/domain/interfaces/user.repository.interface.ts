export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface IUserRepository {
  findCashiers(): Promise<any[]>;
  findByUsername(username: string): Promise<any | null>;
  findById(id: string): Promise<any | null>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
}
