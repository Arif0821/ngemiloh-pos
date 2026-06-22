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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DiscountsService } from '../application/services/discounts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discounts.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Discounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('superadmin')
@Controller('api/v1/admin/discounts')
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create discount campaign' })
  @ApiResponse({ status: 201, description: 'Discount created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
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
  @ApiOperation({ summary: 'Get all discount campaigns' })
  @ApiResponse({ status: 200, description: 'Discounts retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() {
    const data = await this.discountsService.findAll();
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount campaign by ID' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  @ApiResponse({ status: 200, description: 'Discount retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  async findOne(@Param('id') id: string) {
    const data = await this.discountsService.findOne(id);
    return { success: true, data };
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update discount campaign' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  @ApiResponse({ status: 200, description: 'Discount updated' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Discount not found' })
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
  @ApiOperation({ summary: 'Delete discount campaign' })
  @ApiParam({ name: 'id', description: 'Discount UUID' })
  @ApiResponse({ status: 200, description: 'Discount deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Discount not found' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const data = await this.discountsService.remove(id, req.user.id);
    return { success: true, data };
  }
}
