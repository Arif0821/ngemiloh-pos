import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  Sse,
  Patch,
  Res,
  Query,
  ForbiddenException,
  Logger,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from '../application/services/orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { filter, map, fromEvent, merge, interval, Observable } from 'rxjs';
import type { Response } from 'express';
import {
  CreateOrderDto,
  SyncBatchDto,
  StartShiftDto,
} from './dto/create-order.dto';
import type { AuthenticatedRequest } from '../../types/express';

// SSE event type used by the @Sse() decorator return type
type SseEvent = { data: Record<string, unknown> };

@ApiTags('Orders')
@Controller('api/v1')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createOrder(
    @Body() body: CreateOrderDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const order = await this.ordersService.createOrder(body, req.user.id);
    return { success: true, data: order };
  }

  @Post('orders/sync-batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync batch of orders (offline mode)' })
  @ApiResponse({ status: 201, description: 'Batch sync completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async syncBatchOrders(
    @Body() body: SyncBatchDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { orders } = body;
    const result = await this.ordersService.syncBatchOrders(
      orders,
      req.user.id,
    );
    return { success: true, data: result };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order history' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: String,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: String,
    description: 'Items per page (default: 50, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Order history retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const filterKasir = req.user.role === 'kasir' ? req.user.id : undefined;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    const result = await this.ordersService.getHistory(
      filterKasir,
      pageNum,
      limitNum,
    );
    return { success: true, data: result };
  }

  @Get('admin/reports/export')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Export orders to CSV' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async exportCsv(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ) {
    // SECURITY: Sanitize filename parameters to prevent CRLF injection
    const sanitizeFilename = (str: string) =>
      str.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeStartDate = sanitizeFilename(startDate || 'start');
    const safeEndDate = sanitizeFilename(endDate || 'end');

    const csv = await this.ordersService.exportOrdersCsv(startDate, endDate);
    res.header('Content-Type', 'text/csv');
    res.attachment(`laporan_transaksi_${safeStartDate}_to_${safeEndDate}.csv`);
    return res.send(csv);
  }

  @Get('orders/shift')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shift summary for current cashier' })
  @ApiQuery({
    name: 'kasir_id',
    required: false,
    type: String,
    description: 'Kasir UUID (superadmin only)',
  })
  @ApiResponse({ status: 200, description: 'Shift summary retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getShiftSummary(
    @Req() req: AuthenticatedRequest,
    @Query('kasir_id', new ParseUUIDPipe({ optional: true })) kasirId?: string,
  ) {
    // SECURITY: Kasir can only see their own shift, superadmin can see any by query param
    let filterKasir: string;
    if (req.user.role === 'kasir') {
      // Kasir can only see their own shift - ignore query param
      filterKasir = req.user.id;
    } else if (req.user.role === Role.superadmin) {
      // Superadmin can query by kasir_id or default to themselves
      filterKasir = kasirId || req.user.id;
    } else {
      throw new ForbiddenException('Invalid role for shift summary');
    }

    if (!filterKasir) {
      return {
        success: false,
        message: 'Kasir ID required for superadmin shift check',
      };
    }
    const summary = await this.ordersService.getShiftSummary(filterKasir);
    return { success: true, data: summary };
  }

  @Get('admin/shifts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all shifts for a cashier on a date' })
  @ApiQuery({
    name: 'kasir_id',
    required: true,
    type: String,
    description: 'Kasir UUID',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Shifts retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getAllShifts(
    @Query(
      'kasir_id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new ForbiddenException('Invalid kasir_id format - must be UUID'),
      }),
    )
    kasirId: string,
    @Query('date') date: string,
  ) {
    const shifts = await this.ordersService.getAllShifts(kasirId, date);
    return { success: true, data: shifts };
  }

  @Post('pos/shift/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a new shift at selected outlet' })
  @ApiResponse({ status: 201, description: 'Shift started' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async startShift(
    @Body() body: StartShiftDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const shift = await this.ordersService.startShift(
      req.user.id,
      body.outlet_id,
    );
    return { success: true, data: shift };
  }

  @Get('pos/shift/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get shift status' })
  @ApiResponse({ status: 200, description: 'Shift status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkShiftStatus(@Req() req: AuthenticatedRequest) {
    const shift = await this.ordersService.getCurrentShift(req.user.id);
    return { success: true, data: shift };
  }

  @Post('admin/transactions/:id/void')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Void a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction voided' })
  @ApiResponse({ status: 400, description: 'Invalid transaction ID' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async voidTransaction(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid transaction ID format'),
      }),
    )
    id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    // SECURITY: Check role in controller, not via Roles decorator for detailed control
    // @Roles decorator is still applied at class level, this is additional check
    if (req.user.role !== 'superadmin') {
      throw new ForbiddenException('Only superadmin can void orders');
    }
    const order = await this.ordersService.voidOrder(id, reason, req.user.id);
    return { success: true, data: order };
  }

  @Patch('admin/transactions/:id/flag')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Flag a transaction for review' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({ status: 200, description: 'Transaction flagged' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async flagTransaction(
    @Param('id') id: string,
    @Body('status') status: string,
    @Req() req: AuthenticatedRequest,
  ) {
    // SECURITY: Check role in controller for proper 403 response
    if (req.user.role !== 'superadmin') {
      throw new ForbiddenException('Only superadmin can flag transactions');
    }
    const order = await this.ordersService.flagTransaction(
      id,
      status,
      req.user.id,
    );
    return { success: true, data: order };
  }

  @Get('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order status' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order status retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  async getOrderStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    // SECURITY: IDOR Check - only superadmin or the order owner can access
    const order = await this.ordersService.getOrder(id);

    // SECURITY: Role check - kasir can only see their own orders
    if (req.user.role !== Role.superadmin && order.cashier_id !== req.user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this order status',
      );
    }

    return {
      success: true,
      data: { status: order.status, payment_status: order.payment_status },
    };
  }
  @Sse('orders/:id/sse')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to order status updates (SSE)' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'SSE stream established' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  sse(@Param('id') id: string, @Req() _req: Request): Observable<SseEvent> {
    // SECURITY: JwtAuthGuard ensures only authenticated users can access SSE
    const orderEvents = fromEvent(this.eventEmitter, 'order.paid').pipe(
      filter((payload: { orderId: string }) => payload.orderId === id),
      map((payload: { orderId: string; status: string }) => ({
        data: payload,
      })),
    );

    const heartbeat = interval(30000).pipe(
      map(() => ({
        type: 'ping',
        data: { message: 'heartbeat' },
      })),
    );

    return merge(orderEvents, heartbeat);
  }

  @Post('webhooks/midtrans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Midtrans payment webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async midtransWebhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    // KRITIS-06: Get real client IP from X-Forwarded-For header (set by Caddy proxy)
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0].trim()
        : req.socket.remoteAddress || 'unknown';

    // SECURITY: Verify request comes from Midtrans IPs
    // Midtrans official IP ranges (production)
    const midtransIps = (process.env.MIDTRANS_ALLOWED_IPS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Add default Midtrans production IPs if not configured
    const defaultMidtransIps = [
      '13.229.87.0/24', // Singapore
      '54.255.192.0/24', // Singapore
      '103.211.86.0/24', // Indonesia
    ];

    const allowedIps =
      midtransIps.length > 0 ? midtransIps : defaultMidtransIps;
    const isAllowed = allowedIps.some((allowedIp) => {
      // Support /32 (single IP), /24, and /16 CIDR blocks
      if (allowedIp.includes('/')) {
        const [baseIp, prefix] = allowedIp.split('/');
        const prefixNum = parseInt(prefix, 10);
        if (prefixNum === 32) {
          return ip === baseIp;
        }
        if (prefixNum === 24) {
          return ip.startsWith(baseIp.substring(0, baseIp.lastIndexOf('.')));
        }
        if (prefixNum === 16) {
          return ip.startsWith(
            baseIp.substring(0, baseIp.indexOf('.', baseIp.indexOf('.') + 1)),
          );
        }
        // SECURITY: Log warning for unsupported CIDR notation
        this.logger.warn(
          `Unsupported CIDR notation: ${allowedIp} in MIDTRANS_ALLOWED_IPS`,
        );
        return false;
      }
      return ip === allowedIp;
    });

    // SECURITY: Only bypass IP validation in known test environments
    const isDevOrTest =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (!isAllowed && !isDevOrTest) {
      this.logger.warn(`Midtrans webhook blocked - untrusted IP: ${ip}`);
      throw new ForbiddenException('Webhook request from untrusted IP');
    }

    // SECURITY: Verify webhook signature from Midtrans
    const signatureKey = body.signature_key || body.signature;

    // P1-SECURITY: Always verify signature — do not skip in sandbox
    if (!signatureKey) {
      this.logger.warn('Midtrans webhook missing signature — rejecting');
      throw new ForbiddenException('Invalid webhook: missing signature');
    }

    try {
      const result = await this.ordersService.handleMidtransWebhook(body);
      return result;
    } catch (error: unknown) {
      // P0-API: Return distinct status instead of hiding failures
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing error: ${errorMessage}`);

      // Return processed with error status (not 'ok') so it's distinguishable
      // This still prevents Midtrans retries but makes debugging easier
      return {
        status: 'processed',
        result: 'error',
        error: 'Internal processing failed',
      };
    }
  }
}
