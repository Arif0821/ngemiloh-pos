import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USER_REPOSITORY, type IUserRepository } from '../../domain/interfaces/user.repository.interface';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: IUserRepository
  ) {}

  async findAllCashiers() {
    return this.userRepository.findCashiers();
  }

  async createCashier(data: any) {
    const exists = await this.userRepository.findByUsername(data.username.toLowerCase());
    if (exists) throw new BadRequestException('Username already taken');

    const pepper = process.env.PIN_PEPPER_SECRET || 'default_pepper';
    const pinHash = await bcrypt.hash(data.pin + pepper, 12);

    const user = await this.userRepository.create({
      name: data.name,
      username: data.username.toLowerCase(),
      role: 'kasir',
      pin_hash: pinHash,
      is_active: true,
    });

    return { id: user.id, username: user.username, name: user.name };
  }

  async resetCashierPin(id: string, newPin: string) {
    const user = await this.userRepository.findById(id);
    if (!user || user.role !== 'kasir') throw new NotFoundException('Cashier not found');

    const pepper = process.env.PIN_PEPPER_SECRET || 'default_pepper';
    const pinHash = await bcrypt.hash(newPin + pepper, 12);

    await this.userRepository.update(id, {
      pin_hash: pinHash,
      failed_login_count: 0,
      locked_until: null,
      must_change_pin: true,
    });
    return { success: true };
  }

  async toggleCashierStatus(id: string, isActive: boolean) {
    await this.userRepository.update(id, { is_active: isActive });
    return { success: true };
  }

  async findAllCustomers() {
    return this.userRepository.findCustomers();
  }

  async createCustomer(data: any) {
    // ensure unique phone number
    return this.userRepository.createCustomer(data);
  }

  async addLoyaltyPoints(id: string, points: number) {
    return this.userRepository.updateCustomerLoyalty(id, points);
  }
}
