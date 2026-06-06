import { Controller, Post, Get, Body, UseGuards, Req, HttpCode, HttpStatus, Param, Sse, MessageEvent, Patch, Res, Query } from '@nestjs/common';
import { OrdersService } from '../application/services/orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, filter, map, fromEvent, merge, interval } from 'rxjs';
import type { Response } from 'express';

@Controller('api/v1')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  @Post('orders')
  @UseGuards(JwtAuthGuard)
  async createOrder(@Body() body: any, @Req() req: any) {
    const order = await this.ordersService.createOrder(body, req.user.id);
    return { success: true, data: order };
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Req() req: any, @Query('page') page: string = '1') {
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
    const csv = await this.ordersService.exportOrdersCsv(startDate, endDate);
    res.header('Content-Type', 'text/csv');
    res.attachment(`laporan_transaksi_${startDate}_to_${endDate}.csv`);
    return res.send(csv);
  }

  @Get('orders/shift')
  @UseGuards(JwtAuthGuard)
  async getShiftSummary(@Req() req: any) {
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
  async startShift(@Req() req: any) {
    const shift = await this.ordersService.startShift(req.user.id);
    return { success: true, data: shift };
  }

  @Get('pos/shift/status')
  @UseGuards(JwtAuthGuard)
  async checkShiftStatus(@Req() req: any) {
    const shift = await this.ordersService.getCurrentShift(req.user.id);
    return { success: true, data: shift };
  }

  @Post('admin/transactions/:id/void')
  @UseGuards(JwtAuthGuard)
  async voidTransaction(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    if (req.user.role !== 'superadmin') {
      return { success: false, message: 'Forbidden' };
    }
    const order = await this.ordersService.voidOrder(id, reason, req.user.id);
    return { success: true, data: order };
  }

  @Patch('admin/transactions/:id/flag')
  @UseGuards(JwtAuthGuard)
  async flagTransaction(@Param('id') id: string, @Body('status') status: string, @Req() req: any) {
    if (req.user.role !== 'superadmin') {
      return { success: false, message: 'Forbidden' };
    }
    const order = await this.ordersService.flagTransaction(id, status, req.user.id);
    return { success: true, data: order };
  }

  @Get('orders/:id/status')
  async getOrderStatus(@Param('id') id: string) {
    const order = await this.ordersService.getOrder(id);
    return { success: true, data: { status: order.status, payment_status: order.payment_status } };
  }

  @Sse('orders/:id/sse')
  sse(@Param('id') id: string): Observable<MessageEvent> {
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
  async midtransWebhook(@Body() body: any) {
    await this.ordersService.handleMidtransWebhook(body);
    return { status: 'ok' }; 
  }
}
