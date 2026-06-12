import { User, Customer, Prisma } from '@prisma/client';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface IUserRepository {
  findCashiers(): Promise<
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
  >;
  findByUsername(username: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: Prisma.UserUncheckedCreateInput): Promise<User>;
  update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<User>;
  findCustomers(): Promise<Customer[]>;
  createCustomer(data: Prisma.CustomerUncheckedCreateInput): Promise<Customer>;
  updateCustomerLoyalty(id: string, points: number): Promise<Customer>;
}
