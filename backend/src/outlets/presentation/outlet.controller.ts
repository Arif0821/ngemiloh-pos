import {
  Controller,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OutletService } from '../application/outlet.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Outlets')
@Controller('api/v1/outlets')
export class OutletController {
  constructor(private readonly outletService: OutletService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get outlets assigned to current user' })
  @ApiResponse({
    status: 200,
    description: 'List of assigned outlets',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async get_assigned_outlets(@Req() req: AuthenticatedRequest) {
    const user_id = req.user?.id;
    if (!user_id) {
      return { success: false, message: 'User not authenticated' };
    }

    const outlets = await this.outletService.get_assigned_outlets(user_id);
    return { success: true, data: outlets };
  }
}
