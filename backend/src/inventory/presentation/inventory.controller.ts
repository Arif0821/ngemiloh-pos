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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
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
  RecordWasteDto,
} from './dto/inventory.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Controller('api/v1/admin/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(Role.superadmin)
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all raw materials' })
  @ApiResponse({ status: 200, description: 'Raw materials retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getAll() {
    const data = await this.inventoryService.getAllRawMaterials();
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock materials' })
  @ApiResponse({ status: 200, description: 'Low stock materials retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getLowStock() {
    const data = await this.inventoryService.getLowStockMaterials();
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('adjust')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Adjust raw material stock' })
  @ApiResponse({ status: 200, description: 'Stock adjusted' })
  @ApiResponse({ status: 400, description: 'Invalid adjustment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async adjustStock(
    @Body() body: AdjustStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { id, qty, type, notes } = body;
    const userId = req.user.id;
    const data = await this.inventoryService.adjustStock(
      id,
      qty,
      type as 'in' | 'out' | 'adjustment' | 'waste',
      notes || '',
      userId,
    );
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('opname')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit stock opname (stocktake)' })
  @ApiResponse({ status: 200, description: 'Opname submitted' })
  @ApiResponse({ status: 400, description: 'Invalid opname data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async submitOpname(
    @Body() body: SubmitOpnameDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { items } = body;
    const userId = req.user.id;
    const data = await this.inventoryService.submitOpname(items, userId);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('materials')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create raw material' })
  @ApiResponse({ status: 201, description: 'Raw material created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createRawMaterial(@Body() body: CreateRawMaterialDto) {
    const data = await this.inventoryService.createRawMaterial(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Patch('materials/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update raw material' })
  @ApiParam({ name: 'id', description: 'Raw material UUID' })
  @ApiResponse({ status: 200, description: 'Raw material updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Raw material not found' })
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
  @ApiOperation({ summary: 'Create BOM recipe' })
  @ApiResponse({ status: 201, description: 'BOM recipe created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createBomRecipe(@Body() body: CreateBomRecipeDto) {
    const data = await this.inventoryService.createBomRecipe(body);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Delete('bom/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete BOM recipe' })
  @ApiParam({ name: 'id', description: 'BOM recipe UUID' })
  @ApiResponse({ status: 200, description: 'BOM recipe deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'BOM recipe not found' })
  async deleteBomRecipe(@Param('id') id: string) {
    const data = await this.inventoryService.deleteBomRecipe(id);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Post('waste')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Record waste entry' })
  @ApiResponse({ status: 200, description: 'Waste recorded' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async recordWaste(
    @Body() body: RecordWasteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    const data = await this.inventoryService.recordWaste(
      body.raw_material_id,
      body.quantity,
      body.reason,
      body.notes || '',
      userId,
    );
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Get('waste')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get waste history' })
  @ApiResponse({ status: 200, description: 'Waste history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getWasteHistory() {
    const data = await this.inventoryService.getWasteHistory();
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Get('bom/:productId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get BOM recipes by product' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'BOM recipes retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getBomRecipes(@Param('productId') productId: string) {
    const data = await this.inventoryService.getBomRecipesByProduct(productId);
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Patch('bom/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update BOM recipe quantity' })
  @ApiParam({ name: 'id', description: 'BOM recipe UUID' })
  @ApiResponse({ status: 200, description: 'BOM recipe updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'BOM recipe not found' })
  async updateBomRecipe(
    @Param('id') id: string,
    @Body() body: { quantity_per_serving: number },
  ) {
    const data = await this.inventoryService.updateBomRecipe(
      id,
      body.quantity_per_serving,
    );
    return { status: 'success', data };
  }

  @Roles(Role.superadmin)
  @Get('bom-coverage')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get BOM coverage report' })
  @ApiResponse({ status: 200, description: 'BOM coverage retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getBomCoverage() {
    const data = await this.inventoryService.getBomCoverage();
    return { status: 'success', data };
  }
}
