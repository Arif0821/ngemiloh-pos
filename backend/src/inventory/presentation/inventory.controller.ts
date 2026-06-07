import { Controller, Get, Post, Body, UseGuards, Req, Patch, Param, Delete } from '@nestjs/common';
import { InventoryService } from '../application/services/inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/admin/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(Role.superadmin)
  @Get()
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
  async adjustStock(@Body() body: any, @Req() req: any) {
    const { id, qty, type, notes } = body;
    const userId = req.user.id;
    const data = await this.inventoryService.adjustStock(id, qty, type, notes, userId);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('opname')
  async submitOpname(@Body() body: any, @Req() req: any) {
    const { items } = body; // Array of { id, physical_stock }
    const userId = req.user.id;
    const data = await this.inventoryService.submitOpname(items, userId);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('materials')
  async createRawMaterial(@Body() body: any) {
    const data = await this.inventoryService.createRawMaterial(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Patch('materials/:id')
  async updateRawMaterial(@Param('id') id: string, @Body() body: any) {
    const data = await this.inventoryService.updateRawMaterial(id, body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('bom')
  async createBomRecipe(@Body() body: any) {
    const data = await this.inventoryService.createBomRecipe(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Delete('bom/:id')
  async deleteBomRecipe(@Param('id') id: string) {
    const data = await this.inventoryService.deleteBomRecipe(id);
    return { status: 'success', data };
  }
}
