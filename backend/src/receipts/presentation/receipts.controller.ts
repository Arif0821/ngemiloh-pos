import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReceiptsService } from '../application/receipts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Receipts')
@ApiBearerAuth()
@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * Get receipt data as JSON
   * GET /receipts/:orderId
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  @Get(':orderId')
  @ApiOperation({ summary: 'Get receipt data as JSON' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Receipt data retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getReceipt(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // SECURITY: Check ownership - only superadmin or order owner can access
    const data = await this.receiptsService.getReceiptData(
      orderId,
      userId,
      userRole,
    );
    return {
      success: true,
      data,
    };
  }

  /**
   * Get receipt as plain text for thermal printer
   * GET /receipts/:orderId/text
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  @Get(':orderId/text')
  @ApiOperation({ summary: 'Get receipt as plain text for thermal printer' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Receipt text retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getReceiptText(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // SECURITY: Check ownership
    const printable = await this.receiptsService.generateReceiptByOrderId(
      orderId,
      userId,
      userRole,
    );
    return {
      success: true,
      data: {
        lines: printable.text.lines,
        width: printable.text.width,
        totalLines: printable.text.totalLines,
      },
    };
  }

  /**
   * Get receipt as HTML for browser printing
   * GET /receipts/:orderId/html
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  @Get(':orderId/html')
  @ApiOperation({ summary: 'Get receipt as HTML for browser printing' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Receipt HTML' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getReceiptHtml(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // SECURITY: Check ownership
    const printable = await this.receiptsService.generateReceiptByOrderId(
      orderId,
      userId,
      userRole,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(printable.html);
  }

  /**
   * Print receipt (opens print dialog in browser)
   * GET /receipts/:orderId/print
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  @Get(':orderId/print')
  @ApiOperation({ summary: 'Print receipt (opens browser print dialog)' })
  @ApiParam({ name: 'orderId', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Receipt HTML with print dialog' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - access denied' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async printReceipt(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // SECURITY: Check ownership
    const printable = await this.receiptsService.generateReceiptByOrderId(
      orderId,
      userId,
      userRole,
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(printable.html);
  }
}
