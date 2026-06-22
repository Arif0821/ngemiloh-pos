import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FinanceService } from '../application/services/finance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateOpexDto,
  ClosePeriodDto,
  CompleteProfitShareDto,
  CreateAssetDto,
  UpdateAssetDto,
  OpenShiftDto,
  CloseShiftDto,
} from './dto/finance.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('api/v1/admin/finance')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles('superadmin')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('kpi')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get dashboard KPI data' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Target date (ISO 8601, default: today)',
  })
  @ApiResponse({ status: 200, description: 'KPI data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKpi(@Query('date') date: string) {
    const targetDate = date || new Date().toISOString();
    const data = await this.financeService.getDashboardKpi(targetDate);
    return { success: true, data };
  }

  @Get('opex')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get operational expenses' })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    description: 'Month (1-12)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: String,
    description: 'Year (YYYY)',
  })
  @ApiResponse({ status: 200, description: 'Opex data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOpex(@Query('month') month: string, @Query('year') year: string) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.getOpex(m, y);
    return { success: true, data };
  }

  @Post('opex')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create operational expense' })
  @ApiResponse({ status: 201, description: 'Opex created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOpex(
    @Body() createDto: CreateOpexDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.financeService.createOpex(createDto, req.user.id);
    return { status: 'success', data };
  }

  @Get('profit-share')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get profit share report' })
  @ApiQuery({
    name: 'month',
    required: false,
    type: String,
    description: 'Month (1-12)',
  })
  @ApiQuery({
    name: 'year',
    required: false,
    type: String,
    description: 'Year (YYYY)',
  })
  @ApiResponse({ status: 200, description: 'Profit share data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfitShare(
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    const m = month ? parseInt(month) : new Date().getMonth() + 1;
    const y = year ? parseInt(year) : new Date().getFullYear();
    const data = await this.financeService.getProfitShare(m, y);
    return { success: true, data };
  }

  @Post('profit-share/close')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Close profit share period' })
  @ApiResponse({ status: 200, description: 'Period closed' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async closePeriod(@Body() body: ClosePeriodDto) {
    const m = body.month ? parseInt(body.month) : new Date().getMonth() + 1;
    const y = body.year ? parseInt(body.year) : new Date().getFullYear();
    const data = await this.financeService.closePeriod(m, y);
    return { status: 'success', data };
  }

  @Post('profit-share/pay')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Record profit share payment' })
  @ApiResponse({ status: 200, description: 'Payment recorded' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async payProfitShare(
    @Body() body: CompleteProfitShareDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const m = body.month ? parseInt(body.month) : new Date().getMonth() + 1;
    const y = body.year ? parseInt(body.year) : new Date().getFullYear();
    const data = await this.financeService.payProfitShare(
      m,
      y,
      body.proof,
      body.notes || '',
      req.user.id,
    );
    return { status: 'success', data };
  }

  @Get('assets')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all assets' })
  @ApiResponse({ status: 200, description: 'Assets retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAssets() {
    const data = await this.financeService.getAssets();
    return { success: true, data };
  }

  @Post('assets')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create asset' })
  @ApiResponse({ status: 201, description: 'Asset created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createAsset(@Body() createDto: CreateAssetDto) {
    const data = await this.financeService.createAsset(createDto);
    return { status: 'success', data };
  }

  @Patch('assets/:id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update asset' })
  @ApiParam({ name: 'id', description: 'Asset UUID' })
  @ApiResponse({ status: 200, description: 'Asset updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Asset not found' })
  async updateAsset(
    @Param('id') id: string,
    @Body() updateDto: UpdateAssetDto,
  ) {
    const data = await this.financeService.updateAsset(id, updateDto);
    return { status: 'success', data };
  }

  @Get('analytics')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get finance analytics' })
  @ApiQuery({
    name: 'period',
    required: false,
    type: String,
    description: 'Period: daily, weekly, or monthly',
  })
  @ApiResponse({ status: 200, description: 'Analytics retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAnalytics(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
  ) {
    const data = await this.financeService.getAnalytics(period);
    return { success: true, data };
  }

  // --- CASH REGISTER (SHIFT) ---
  @Get('cash/current')
  @Roles('kasir', 'superadmin')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get current cash shift' })
  @ApiResponse({ status: 200, description: 'Current shift retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentShift(@Req() req: AuthenticatedRequest) {
    const data = await this.financeService.getCurrentShift(req.user.id);
    return { success: true, data };
  }

  @Post('cash/open')
  @Roles('kasir', 'superadmin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Open cash shift' })
  @ApiResponse({ status: 201, description: 'Shift opened' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async openShift(
    @Body() body: OpenShiftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.financeService.openShift(
      req.user.id,
      body.opening_balance,
      body.outlet_id,
      body.planned_close_at,
      body.carry_over_from_shift_id,
    );
    return { status: 'success', data };
  }

  @Post('cash/close')
  @Roles('kasir', 'superadmin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Close cash shift' })
  @ApiResponse({ status: 200, description: 'Shift closed' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async closeShift(
    @Body() body: CloseShiftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.financeService.closeShift(
      req.user.id,
      body.actual_cash,
      body.notes,
    );
    return { status: 'success', data };
  }

  @Get('cash/shifts')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiResponse({ status: 200, description: 'Shifts retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getShifts() {
    const data = await this.financeService.getShifts();
    return { success: true, data };
  }
}
