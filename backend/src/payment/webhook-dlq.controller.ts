import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { WebhookDLQService } from './webhook-dlq.service';
import type { AuthenticatedRequest } from '../types/express';

/**
 * #20 Webhook DLQ Admin Endpoints
 * Allow admins to view and manage failed webhooks
 */
@ApiTags('Admin - Webhook DLQ')
@Controller('api/v1/admin/webhook-dlq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.superadmin)
@ApiBearerAuth()
export class WebhookDLQController {
  private readonly logger = new Logger(WebhookDLQController.name);

  constructor(private readonly dlqService: WebhookDLQService) {}

  @Get()
  @ApiOperation({ summary: 'Get webhook DLQ entries' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'provider',
    required: false,
    type: String,
    description: 'Filter by provider',
  })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiResponse({ status: 200, description: 'DLQ entries retrieved' })
  async getEntries(
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1', 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10)));

    const result = await this.dlqService.getEntries({
      status,
      provider,
      page: pageNum,
      limit: limitNum,
    });

    return { success: true, data: result };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get webhook DLQ statistics' })
  @ApiResponse({ status: 200, description: 'Stats retrieved' })
  async getStats() {
    const stats = await this.dlqService.getStats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single DLQ entry' })
  @ApiResponse({ status: 200, description: 'Entry retrieved' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async getEntry(@Param('id', new ParseUUIDPipe()) id: string) {
    const entry = await this.dlqService.getEntry(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }
    return { success: true, data: entry };
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge a DLQ entry without retry' })
  @ApiResponse({ status: 200, description: 'Entry acknowledged' })
  async acknowledge(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('notes') notes: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.dlqService.acknowledgeEntry(
      id,
      req.user.id,
      notes,
    );
    return { success: true, data: result };
  }
}
