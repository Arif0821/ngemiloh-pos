import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { FinanceService } from '../application/services/finance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@Controller('api/v1/admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('kpi')
  async getKpi(@Query('date') date: string) {
    const targetDate = date || new Date().toISOString();
    const data = await this.financeService.getDashboardKpi(targetDate);
    return { success: true, data };
  }

  @Get('opex')
  async getOpex(@Query('month') month: string, @Query('year') year: string) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.getOpex(m, y);
    return { success: true, data };
  }

  @Post('opex')
  async createOpex(@Body() createDto: any, @Req() req: any) {
    const data = await this.financeService.createOpex(createDto, req.user.id);
    return { success: true, data };
  }

  @Get('profit-share')
  async getProfitShare(@Query('month') month: string, @Query('year') year: string) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.getProfitShare(m, y);
    return { success: true, data };
  }

  @Post('profit-share/close')
  async closePeriod(@Body('month') month: string, @Body('year') year: string) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.closePeriod(m, y);
    return { success: true, data };
  }

  @Post('profit-share/pay')
  async payProfitShare(
    @Body('month') month: string, 
    @Body('year') year: string, 
    @Body('proof') proof: string,
    @Body('notes') notes: string,
    @Req() req: any
  ) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.payProfitShare(m, y, proof, notes, req.user.id);
    return { success: true, data };
  }

  @Get('assets')
  async getAssets() {
    const data = await this.financeService.getAssets();
    return { success: true, data };
  }

  @Post('assets')
  async createAsset(@Body() createDto: any) {
    const data = await this.financeService.createAsset(createDto);
    return { success: true, data };
  }

  @Patch('assets/:id')
  async updateAsset(@Param('id') id: string, @Body() updateDto: any) {
    const data = await this.financeService.updateAsset(id, updateDto);
    return { success: true, data };
  }

  @Get('analytics')
  async getAnalytics(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const data = await this.financeService.getAnalytics(period);
    return { success: true, data };
  }

  // --- CASH REGISTER (SHIFT) ---
  @Get('cash/current')
  @Roles('kasir', 'superadmin')
  async getCurrentShift(@Req() req: any) {
    const data = await this.financeService.getCurrentShift(req.user.id);
    return { success: true, data };
  }

  @Post('cash/open')
  @Roles('kasir', 'superadmin')
  async openShift(@Body('opening_balance') openingBalance: number, @Req() req: any) {
    const data = await this.financeService.openShift(req.user.id, openingBalance);
    return { success: true, data };
  }

  @Post('cash/close')
  @Roles('kasir', 'superadmin')
  async closeShift(@Body('closing_balance') closingBalance: number, @Req() req: any) {
    const data = await this.financeService.closeShift(req.user.id, closingBalance);
    return { success: true, data };
  }

  @Get('cash/shifts')
  @Roles('superadmin')
  async getShifts() {
    const data = await this.financeService.getShifts();
    return { success: true, data };
  }
}
