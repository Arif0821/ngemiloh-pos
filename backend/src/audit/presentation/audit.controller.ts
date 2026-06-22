import {
  Controller,
  Get,
  Query,
  UseGuards,
  Post,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from '../application/services/audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.superadmin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiQuery({
    name: 'actor_id',
    required: false,
    type: String,
    description: 'Filter by actor UUID',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filter by action name',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: String,
    description: 'Page number (default: 1)',
  })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getLogs(
    @Query('actor_id') actor_id?: string,
    @Query('action') action?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page: string = '1',
  ) {
    const filters = { actor_id, action, date_from, date_to };
    const pageNum = parseInt(page, 10) || 1;
    const result = await this.auditService.getLogs(filters, pageNum, 50);
    return { success: true, ...result };
  }

  @Post('archive')
  @ApiOperation({ summary: 'Archive old audit logs' })
  @ApiResponse({ status: 200, description: 'Old logs archived' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async archiveLogs(@Req() req: Request & { user: { role: string } }) {
    // SECURITY: Explicit role check as defense-in-depth
    if (req.user?.role !== Role.superadmin) {
      throw new ForbiddenException('Only superadmin can archive audit logs');
    }
    const result = await this.auditService.archiveOldLogs();
    return { success: true, data: result };
  }
}
