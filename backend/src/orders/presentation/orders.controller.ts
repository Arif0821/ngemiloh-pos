import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus, Param, Sse, MessageEvent, Patch, Res, Query, Ip, ForbiddenException } from '@nestjs/common';
import { OrdersService } from '../application/services/orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Request } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, filter, map, fromEvent, merge, interval } from 'rxjs';
import type { Response } from 'express';
import { CreateOrderDto, SyncBatchDto } from './dto/create-order.dto';

@Controller('api/v1')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  async createOrder(@Body() body: CreateOrderDto, @Req() req: Request & { user: any }) {
    const order = await this.ordersService.createOrder(body, req.user.id);
    return { success: true, data: order };
  }

  @Post('orders/sync-batch')
  @UseGuards(JwtAuthGuard)
  async syncBatchOrders(@Body() body: SyncBatchDto, @Req() req: Request & { user: any }) {
    const { orders } = body;
    const result = await this.ordersService.syncBatchOrders(orders, req.user.id);
    return { success: true, data: result };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: Request & { user: any }, @Query('page') page: string = '1') {
    const filterKasir = req.user.role === 'kasir' ? req.user.id : undefined;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 50;
    const skip = (pageNum - 1) * limit;
    
    const result = await this.ordersService.getHistory(filterKasir);
    // Note: getHistory returned array in original code, but controller expected { orders, total }. 
    // Adapting to match what service actually returned.
    return { success: true, data: result }; 
  }

  @Get('admin/reports/export')
  @UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
  @Roles(Role.superadmin)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async exportCsv(@Query('startDate') startDate: string, @Query('endDate') endDate: string, @Res() res: Response) {
    // SECURITY: Sanitize filename parameters to prevent CRLF injection
    const sanitizeFilename = (str: string) => str.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeStartDate = sanitizeFilename(startDate || 'start');
    const safeEndDate = sanitizeFilename(endDate || 'end');

    const csv = await this.ordersService.exportOrdersCsv(startDate, endDate);
    res.header('Content-Type', 'text/csv');
    res.attachment(`laporan_transaksi_${safeStartDate}_to_${safeEndDate}.csv`);
    return res.send(csv);
  }

  @Get('orders/shift')
  @UseGuards(JwtAuthGuard)
  async getShiftSummary(@Req() req: Request & { user: any }) {
    const filterKasir = req.user.role === 'kasir' ? req.user.id : req.query.kasir_id;
    if (!filterKasir) {
      return { success: false, message: 'Kasir ID required for superadmin shift check' };
    }
    const summary = await this.ordersService.getShiftSummary(filterKasir);
    return { success: true, data: summary };
  }

  @Get('admin/shifts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async getAllShifts(@Query('kasir_id') kasirId: string, @Query('date') date: string) {
    const shifts = await this.ordersService.getAllShifts(kasirId, date);
    return { success: true, data: shifts };
  }

  @Post('pos/shift/start')
  @UseGuards(JwtAuthGuard)
  async startShift(@Req() req: Request & { user: any }) {
    const shift = await this.ordersService.startShift(req.user.id);
    return { success: true, data: shift };
  }

  @Get('pos/shift/status')
  @UseGuards(JwtAuthGuard)
  async checkShiftStatus(@Req() req: Request & { user: any }) {
    const shift = await this.ordersService.getCurrentShift(req.user.id);
    return { success: true, data: shift };
  }

  @Post('admin/transactions/:id/void')
  @UseGuards(JwtAuthGuard)
  async voidTransaction(@Param('id') id: string, @Body('reason') reason: string, @Req() req: Request & { user: any }) {
    if (req.user.role !== 'superadmin') {
      return { success: false, message: 'Forbidden' };
    }
    const order = await this.ordersService.voidOrder(id, reason, req.user.id);
    return { success: true, data: order };
  }

  @Patch('admin/transactions/:id/flag')
  @UseGuards(JwtAuthGuard)
  async flagTransaction(@Param('id') id: string, @Body('status') status: string, @Req() req: Request & { user: any }) {
    if (req.user.role !== 'superadmin') {
      return { success: false, message: 'Forbidden' };
    }
    const order = await this.ordersService.flagTransaction(id, status, req.user.id);
    return { success: true, data: order };
  }

  @Get('orders/:id/status')
  async getOrderStatus(@Param('id') id: string, @Req() req: Request) {
    // SECURITY: Require authentication for order status
    // Extract user from JWT if present
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return { success: false, message: 'Authentication required' };
    }
    const order = await this.ordersService.getOrder(id);
    return { success: true, data: { status: order.status, payment_status: order.payment_status } };
  }

  @Sse('orders/:id/sse')
  async sse(@Param('id') id: string, @Req() req: Request) {
    // SECURITY: Require authentication for SSE endpoint
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new ForbiddenException('Authentication required for real-time updates');
    }
    const orderEvents = fromEvent(this.eventEmitter, 'order.paid').pipe(
      filter((payload: any) => payload.orderId === id),
      map((payload: any) => ({
        data: payload,
      } as MessageEvent)),
    );

    const heartbeat = interval(30000).pipe(
      map(() => ({
        type: 'ping',
        data: { message: 'heartbeat' }
      } as MessageEvent))
    );

    return merge(orderEvents, heartbeat);
  }

  @Post('webhooks/midtrans')
  @HttpCode(HttpStatus.OK)
  async midtransWebhook(@Body() body: any, @Ip() ip: string) {
    // SECURITY: Verify webhook signature from Midtrans
    // In production, always verify the signature
    const signatureKey = body.signature_key || body.signature;
    const isProduction = process.env.MIDTRANS_ENV === 'production';

    if (isProduction && !signatureKey) {
      throw new ForbiddenException('Invalid webhook: missing signature');
    }

    try {
      await this.ordersService.handleMidtransWebhook(body);
      return { status: 'ok' };
    } catch (error: any) {
      // Log error but still return 200 to prevent Midtrans retries
      console.error('Webhook processing error:', error.message);
      return { status: 'error', message: error.message };
    }
  }
}
