import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { type IDiscountRepository, DISCOUNT_REPOSITORY } from '../../domain/interfaces/discount.repository.interface';

@Injectable()
export class DiscountsService {
  constructor(
    @Inject(DISCOUNT_REPOSITORY) private readonly discountRepository: IDiscountRepository,
  ) {}

  async findAll() {
    return this.discountRepository.findAll();
  }

  async findOne(id: string) {
    const discount = await this.discountRepository.findOne(id);
    if (!discount) throw new NotFoundException('Discount not found');
    return discount;
  }

  async create(data: any, adminId: string) {
    return this.discountRepository.create(data, adminId);
  }

  async update(id: string, data: any) {
    return this.discountRepository.update(id, data);
  }

  async remove(id: string) {
    return this.discountRepository.remove(id);
  }
}
