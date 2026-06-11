import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  type IDiscountRepository,
  DISCOUNT_REPOSITORY,
} from '../../domain/interfaces/discount.repository.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class DiscountsService {
  constructor(
    @Inject(DISCOUNT_REPOSITORY)
    private readonly discountRepository: IDiscountRepository,
  ) {}

  async findAll() {
    return this.discountRepository.findAll();
  }

  async findOne(id: string) {
    const discount = await this.discountRepository.findOne(id);
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async create(data: Prisma.DiscountUncheckedCreateInput, adminId: string) {
    return this.discountRepository.create(data, adminId);
  }

  async update(id: string, data: Prisma.DiscountUncheckedUpdateInput) {
    // TINGGI-02: Track manual activation/deactivation to prevent cron from overriding
    if ('is_active' in data) {
      data.manually_disabled = !data.is_active;
    }
    return this.discountRepository.update(id, data);
  }

  async remove(id: string) {
    return this.discountRepository.remove(id);
  }
}
