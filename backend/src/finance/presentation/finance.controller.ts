import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Req } from '@nestjs/common';
import { FinanceService } from '../application/services/finance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateOpexDto, ClosePeriodDto, CompleteProfitShareDto, CreateAssetDto, UpdateAssetDto, OpenShiftDto, CloseShiftDto } from './dto/finance.dto';

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
  async createOpex(@Body() createDto: CreateOpexDto, @Req() req: Request & { user: any }) {
    const data = await this.financeService.createOpex(createDto, req.user.id);
    return { status: 'success', data };
  }

  @Get('profit-share')
  async getProfitShare(@Query('month') month: string, @Query('year') year: string) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.getProfitShare(m, y);
    return { success: true, data };
  }

  @Post('profit-share/close')
  async closePeriod(@Body() body: ClosePeriodDto) {
    const m = body.month ? parseInt(body.month) : new Date().getMonth() + 1;
    const y = body.year ? parseInt(body.year) : new Date().getFullYear();
    const data = await this.financeService.closePeriod(m, y);
    return { status: 'success', data };
  }

  @Post('profit-share/pay')
  async payProfitShare(
    @Body() body: CompleteProfitShareDto,
    @Req() req: Request & { user: any }
  ) {
    const m = body.month ? parseInt(body.month) : new Date().getMonth() + 1;
    const y = body.year ? parseInt(body.year) : new Date().getFullYear();
    const data = await this.financeService.payProfitShare(m, y, body.proof, body.notes || '', req.user.id);
    return { status: 'success', data };
  }

  @Get('assets')
  async getAssets() {
    const data = await this.financeService.getAssets();
    return { success: true, data };
  }

  @Post('assets')
  async createAsset(@Body() createDto: CreateAssetDto) {
    const data = await this.financeService.createAsset(createDto as any);
    return { status: 'success', data };
  }

  @Patch('assets/:id')
  async updateAsset(@Param('id') id: string, @Body() updateDto: UpdateAssetDto) {
    const data = await this.financeService.updateAsset(id, updateDto as any);
    return { status: 'success', data };
  }

  @Get('analytics')
  async getAnalytics(@Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily') {
    const data = await this.financeService.getAnalytics(period);
    return { success: true, data };
  }

  // --- CASH REGISTER (SHIFT) ---
  @Get('cash/current')
  @Roles('kasir', 'superadmin')
  async getCurrentShift(@Req() req: Request & { user: any }) {
    const data = await this.financeService.getCurrentShift(req.user.id);
    return { success: true, data };
  }

  @Post('cash/open')
  @Roles('kasir', 'superadmin')
  async openShift(@Body() body: OpenShiftDto, @Req() req: Request & { user: any }) {
    const data = await this.financeService.openShift(req.user.id, body.opening_balance);
    return { status: 'success', data };
  }

  @Post('cash/close')
  @Roles('kasir', 'superadmin')
  async closeShift(@Body() body: CloseShiftDto, @Req() req: Request & { user: any }) {
    const data = await this.financeService.closeShift(req.user.id, body.closing_balance);
    return { status: 'success', data };
  }

  @Get('cash/shifts')
  async getShifts() {
    const data = await this.financeService.getShifts();
    return { success: true, data };
  }
}
