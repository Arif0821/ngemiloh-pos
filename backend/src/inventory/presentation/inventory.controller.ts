import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Patch,
  Param,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import { InventoryService } from '../application/services/inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  AdjustStockDto,
  SubmitOpnameDto,
  CreateRawMaterialDto,
  UpdateRawMaterialDto,
  CreateBomRecipeDto,
} from './dto/inventory.dto';

@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Controller('api/v1/admin/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(Role.superadmin)
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 req/min for list endpoints
  async getAll() {
    const data = await this.inventoryService.getAllRawMaterials();
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Get('low-stock')
  async getLowStock() {
    const data = await this.inventoryService.getLowStockMaterials();
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('adjust')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 req/min for mutations
  async adjustStock(@Body() body: AdjustStockDto, @Req() req: any) {
    const { id, qty, type, notes } = body;
    const userId = req.user.id;
    const data = await this.inventoryService.adjustStock(
      id,
      qty,
      type as 'IN' | 'OUT',
      notes || '',
      userId,
    );
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('opname')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 req/min for bulk operations
  async submitOpname(@Body() body: SubmitOpnameDto, @Req() req: any) {
    const { items } = body;
    const userId = req.user.id;
    const data = await this.inventoryService.submitOpname(items, userId);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('materials')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createRawMaterial(@Body() body: CreateRawMaterialDto) {
    const data = await this.inventoryService.createRawMaterial(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Patch('materials/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateRawMaterial(
    @Param('id') id: string,
    @Body() body: UpdateRawMaterialDto,
  ) {
    const data = await this.inventoryService.updateRawMaterial(id, body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('bom')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createBomRecipe(@Body() body: CreateBomRecipeDto) {
    const data = await this.inventoryService.createBomRecipe(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Delete('bom/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async deleteBomRecipe(@Param('id') id: string) {
    const data = await this.inventoryService.deleteBomRecipe(id);
    return { status: 'success', data };
  }
}
