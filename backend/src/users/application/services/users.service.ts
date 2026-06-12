import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  USER_REPOSITORY,
  type IUserRepository,
} from '../../domain/interfaces/user.repository.interface';
import { Prisma } from '@prisma/client';
import { CreateCashierDto } from '../../presentation/dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY) private userRepository: IUserRepository,
  ) {}

  private getPepper(): string {
    const pepper = process.env.PIN_PEPPER_SECRET;
    if (!pepper) {
      throw new Error(
        'FATAL: PIN_PEPPER_SECRET environment variable is required',
      );
    }
    return pepper;
  }

  async findAllCashiers() {
    return this.userRepository.findCashiers();
  }

  async createCashier(data: CreateCashierDto) {
    const exists = await this.userRepository.findByUsername(
      data.username.toLowerCase(),
    );
    if (exists) throw new BadRequestException('Username already taken');

    const pinHash = await bcrypt.hash(data.pin + this.getPepper(), 12);

    const user = await this.userRepository.create({
      name: data.name,
      username: data.username.toLowerCase(),
      pin_hash: pinHash,
    } as Prisma.UserUncheckedCreateInput);

    return { id: user.id, username: user.username, name: user.name };
  }

  async resetCashierPin(id: string, newPin: string) {
    const user = await this.userRepository.findById(id);
    if (!user || user.role !== 'kasir')
      throw new NotFoundException('Cashier not found');

    const pinHash = await bcrypt.hash(newPin + this.getPepper(), 12);

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

  async createCustomer(data: Prisma.CustomerUncheckedCreateInput) {
    return this.userRepository.createCustomer(data);
  }

  async addLoyaltyPoints(id: string, points: number) {
    return this.userRepository.updateCustomerLoyalty(id, points);
  }
}
