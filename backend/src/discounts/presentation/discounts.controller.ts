import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { DiscountsService } from '../application/services/discounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discounts.dto';

@Controller('api/v1/admin/discounts')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('superadmin')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async create(@Body() createDiscountDto: CreateDiscountDto, @Req() req: any) {
    const data = await this.discountsService.create(
      createDiscountDto,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get()
  async findAll() {
    const data = await this.discountsService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const data = await this.discountsService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async update(
    @Param('id') id: string,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ) {
    const data = await this.discountsService.update(id, updateDiscountDto);
    return { success: true, data };
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async remove(@Param('id') id: string) {
    const data = await this.discountsService.remove(id);
    return { success: true, data };
  }
}
