import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from '../application/services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('cashiers')
  async getCashiers() {
    const data = await this.usersService.findAllCashiers();
    return { success: true, data };
  }

  @Post('cashiers')
  async createCashier(@Body() createDto: any) {
    const data = await this.usersService.createCashier(createDto);
    return { success: true, data };
  }

  @Patch('cashiers/:id/reset-pin')
  async resetPin(@Param('id') id: string, @Body() dto: { pin: string }) {
    const data = await this.usersService.resetCashierPin(id, dto.pin);
    return { success: true, data };
  }

  @Patch('cashiers/:id/toggle-status')
  async toggleStatus(@Param('id') id: string, @Body() dto: { is_active: boolean }) {
    const data = await this.usersService.toggleCashierStatus(id, dto.is_active);
    return { success: true, data };
  }

  // --- FASE 2: LOYALTY ---
  @Get('customers')
  async getCustomers() {
    const data = await this.usersService.findAllCustomers();
    return { success: true, data };
  }

  @Post('customers')
  async createCustomer(@Body() createDto: any) {
    const data = await this.usersService.createCustomer(createDto);
    return { success: true, data };
  }

  @Patch('customers/:id/loyalty')
  async addLoyaltyPoints(@Param('id') id: string, @Body() dto: { points: number }) {
    const data = await this.usersService.addLoyaltyPoints(id, dto.points);
    return { success: true, data };
  }
}
