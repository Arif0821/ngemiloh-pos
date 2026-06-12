import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DiscountsService } from '../application/services/discounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discounts.dto';
import type { AuthenticatedRequest } from '../../types/express';

@Controller('api/v1/admin/discounts')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('superadmin')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async create(
    @Body() createDiscountDto: CreateDiscountDto,
    @Req() req: AuthenticatedRequest,
  ) {
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
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.discountsService.update(
      id,
      updateDiscountDto,
      req.user.id,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.discountsService.remove(id, req.user.id);
    return { success: true, data };
  }
}
