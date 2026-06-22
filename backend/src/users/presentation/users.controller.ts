import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from '../application/services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  CreateCashierDto,
  ResetPinDto,
  ToggleStatusDto,
  CreateCustomerDto,
  AddLoyaltyPointsDto,
} from './dto/users.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('cashiers')
  @ApiOperation({ summary: 'Get all cashiers' })
  @ApiResponse({ status: 200, description: 'Cashiers retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getCashiers() {
    const data = await this.usersService.findAllCashiers();
    return { success: true, data };
  }

  @Post('cashiers')
  @ApiOperation({ summary: 'Create cashier' })
  @ApiResponse({ status: 201, description: 'Cashier created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createCashier(@Body() createDto: CreateCashierDto) {
    const data = await this.usersService.createCashier(createDto);
    return { success: true, data };
  }

  @Patch('cashiers/:id/reset-pin')
  @ApiOperation({ summary: 'Reset cashier PIN' })
  @ApiParam({ name: 'id', description: 'Cashier UUID' })
  @ApiResponse({ status: 200, description: 'PIN reset' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Cashier not found' })
  async resetPin(@Param('id') id: string, @Body() dto: ResetPinDto) {
    const data = await this.usersService.resetCashierPin(id, dto.pin);
    return { success: true, data };
  }

  @Patch('cashiers/:id/toggle-status')
  @ApiOperation({ summary: 'Toggle cashier active status' })
  @ApiParam({ name: 'id', description: 'Cashier UUID' })
  @ApiResponse({ status: 200, description: 'Status toggled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Cashier not found' })
  async toggleStatus(@Param('id') id: string, @Body() dto: ToggleStatusDto) {
    const data = await this.usersService.toggleCashierStatus(id, dto.is_active);
    return { success: true, data };
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({ status: 200, description: 'Customers retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getCustomers() {
    const data = await this.usersService.findAllCustomers();
    return { success: true, data };
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async createCustomer(@Body() createDto: CreateCustomerDto) {
    const data = await this.usersService.createCustomer(createDto);
    return { success: true, data };
  }

  @Patch('customers/:id/loyalty')
  @ApiOperation({ summary: 'Add loyalty points to customer' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  @ApiResponse({ status: 200, description: 'Points added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async addLoyaltyPoints(
    @Param('id') id: string,
    @Body() dto: AddLoyaltyPointsDto,
  ) {
    const data = await this.usersService.addLoyaltyPoints(id, dto.points);
    return { success: true, data };
  }
}
