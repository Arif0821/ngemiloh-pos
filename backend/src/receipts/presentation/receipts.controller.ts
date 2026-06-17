import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReceiptsService } from '../application/receipts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /**
   * Get receipt data as JSON
   * GET /receipts/:orderId
   */
  @Get(':orderId')
  async getReceipt(@Param('orderId') orderId: string) {
    const data = await this.receiptsService.getReceiptData(orderId);
    return {
      success: true,
      data,
    };
  }

  /**
   * Get receipt as plain text for thermal printer
   * GET /receipts/:orderId/text
   */
  @Get(':orderId/text')
  async getReceiptText(@Param('orderId') orderId: string) {
    const printable =
      await this.receiptsService.generateReceiptByOrderId(orderId);
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
   */
  @Get(':orderId/html')
  async getReceiptHtml(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const printable =
      await this.receiptsService.generateReceiptByOrderId(orderId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(printable.html);
  }

  /**
   * Print receipt (opens print dialog in browser)
   * GET /receipts/:orderId/print
   */
  @Get(':orderId/print')
  async printReceipt(@Param('orderId') orderId: string, @Res() res: Response) {
    const printable =
      await this.receiptsService.generateReceiptByOrderId(orderId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline');
    res.send(printable.html);
  }
}
