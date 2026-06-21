import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Order, OrderItem, User, CashRegister, Member } from '@prisma/client';
import { Role } from '@prisma/client';

export interface ReceiptData {
  order: Order & {
    items: (OrderItem & {
      modifiers: Array<{
        option_name_snapshot: string;
        additional_price_at_time: unknown;
      }>;
    })[];
    cashier: Pick<User, 'name' | 'cashier_letter'>;
    member?: Pick<Member, 'name' | 'member_code'> | null;
  };
  shift?: CashRegister;
  config: {
    company_name: string;
    address?: string;
    phone?: string;
    receipt_width: 58 | 80; // mm
  };
  member_info?: {
    name: string;
    code: string;
    tier: string;
    points_earned: number;
    total_points: number;
  };
}

interface PrintableReceipt {
  lines: string[];
  width: number;
  totalLines: number;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly COMPANY_NAME =
    process.env.RECEIPT_COMPANY_NAME || 'Ngemiloh';
  private readonly ADDRESS = process.env.RECEIPT_ADDRESS;
  private readonly PHONE = process.env.RECEIPT_PHONE;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get complete order data for receipt generation
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  async getReceiptData(
    orderId: string,
    userId?: string,
    userRole?: string,
  ): Promise<ReceiptData> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        cashier: {
          select: {
            name: true,
            cashier_letter: true,
          },
        },
        member: {
          select: {
            name: true,
            member_code: true,
            tier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // SECURITY: IDOR Check - only superadmin or the order owner can access
    if (userRole !== Role.superadmin && order.cashier_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this receipt',
      );
    }

    // Get current shift info
    let shift: CashRegister | undefined;
    if (order.cashier_id) {
      shift = await this.prisma.cashRegister.findFirst({
        where: {
          cashier_id: order.cashier_id,
          status: 'open',
        },
        orderBy: {
          shift_start: 'desc',
        },
      });
    }

    return {
      order,
      shift,
      config: {
        company_name: this.COMPANY_NAME,
        address: this.ADDRESS,
        phone: this.PHONE,
        receipt_width: 58, // Default 58mm
      },
      member_info: order.member ? {
        name: order.member.name,
        code: order.member.member_code,
        tier: order.member.tier?.name || '',
        points_earned: 0, // Will be calculated by caller if needed
        total_points: 0,
      } : undefined,
    };
  }

  /**
   * Generate printable receipt text
   * Supports 58mm and 80mm paper widths
   */
  generateReceiptText(data: ReceiptData): PrintableReceipt {
    const { order, shift, config } = data;
    const width = config.receipt_width;
    const charsPerLine = width === 80 ? 48 : 32; // Approximate chars per line based on width

    const lines: string[] = [];

    // Header
    lines.push(this.centerText(config.company_name, charsPerLine));
    if (config.address) {
      lines.push(this.centerText(config.address, charsPerLine));
    }
    if (config.phone) {
      lines.push(this.centerText(`Telp: ${config.phone}`, charsPerLine));
    }
    lines.push(this.divider('-', charsPerLine));

    // Transaction info
    const orderNumber = order.order_number || `ORD-${order.id.slice(0, 8)}`;
    lines.push(this.formatKeyValue('No. Transaksi', orderNumber, charsPerLine));
    lines.push(
      this.formatKeyValue(
        'Tanggal',
        this.formatDate(order.client_created_at || order.created_at),
        charsPerLine,
      ),
    );
    lines.push(
      this.formatKeyValue(
        'Kasir',
        order.cashier?.name || 'Unknown',
        charsPerLine,
      ),
    );

    if (shift) {
      lines.push(
        this.formatKeyValue(
          'Shift',
          `${shift.shift_number || 1}`,
          charsPerLine,
        ),
      );
    }

    lines.push(this.divider('-', charsPerLine));

    // Items header
    lines.push(this.centerText('DETAIL PEMBELIAN', charsPerLine));
    lines.push(this.divider('-', charsPerLine));

    // Items
    for (const item of order.items) {
      // Item name and quantity
      const itemLine = `${item.quantity}x ${item.product_name_snapshot}`;
      lines.push(this.truncate(itemLine, charsPerLine));

      // Price per item
      const priceLine = this.formatPrice(
        Number(item.final_price),
        charsPerLine,
      );
      lines.push(priceLine);

      // Modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modLine = `   + ${mod.option_name_snapshot}`;
          lines.push(this.truncate(modLine, charsPerLine));
        }
      }
    }

    lines.push(this.divider('=', charsPerLine));

    // Totals
    lines.push(
      this.formatKeyValue(
        'Subtotal',
        this.formatRupiah(Number(order.total_amount)),
        charsPerLine,
      ),
    );

    if (order.discount_total && Number(order.discount_total) > 0) {
      lines.push(
        this.formatKeyValue(
          'Diskon',
          `-${this.formatRupiah(Number(order.discount_total))}`,
          charsPerLine,
        ),
      );
    }

    lines.push(this.divider('-', charsPerLine));
    lines.push(
      this.formatKeyValue(
        'TOTAL',
        this.formatRupiah(Number(order.total_amount)),
        charsPerLine,
      ),
    );
    lines.push(this.divider('=', charsPerLine));

    // Payment info
    const paymentMethod = this.getPaymentMethodLabel(order.payment_method);
    lines.push(this.formatKeyValue('Metode', paymentMethod, charsPerLine));

    if (order.payment_method === 'cash' || order.payment_method === 'split') {
      const cashReceived = order.cash_received || order.cash_amount;
      if (cashReceived) {
        lines.push(
          this.formatKeyValue(
            'Tunai',
            this.formatRupiah(Number(cashReceived)),
            charsPerLine,
          ),
        );
        const change = order.cash_change || 0;
        if (Number(change) > 0) {
          lines.push(
            this.formatKeyValue(
              'Kembalian',
              this.formatRupiah(Number(change)),
              charsPerLine,
            ),
          );
        }
      }
    }

    if (order.payment_method === 'qris' || order.payment_method === 'split') {
      if (order.qris_amount && Number(order.qris_amount) > 0) {
        lines.push(
          this.formatKeyValue(
            'QRIS',
            this.formatRupiah(Number(order.qris_amount)),
            charsPerLine,
          ),
        );
      }
    }

    // QRIS indicator
    if (
      order.payment_gateway_ref &&
      order.payment_gateway_ref.startsWith('mock-')
    ) {
      lines.push(''); // Empty line for spacing
      lines.push(this.centerText('*** TEST MODE ***', charsPerLine));
    }

    lines.push('');
    lines.push(this.centerText('TERIMA KASIH', charsPerLine));
    lines.push(this.centerText('ATAS KUNJUNGAN ANDA', charsPerLine));
    lines.push('');

    // Member info section
    if (data.member_info) {
      lines.push(this.divider('-', charsPerLine));
      lines.push(this.centerText('👤 MEMBER', charsPerLine));
      lines.push(this.formatKeyValue('Nama', data.member_info.name, charsPerLine));
      lines.push(this.formatKeyValue('ID', data.member_info.code, charsPerLine));
      lines.push(this.formatKeyValue('Tier', data.member_info.tier, charsPerLine));
      if (data.member_info.points_earned > 0) {
        lines.push(this.formatKeyValue('Poin Didapat', `+${data.member_info.points_earned}`, charsPerLine));
      }
      if (data.member_info.total_points > 0) {
        lines.push(this.formatKeyValue('Total Poin', `${data.member_info.total_points}`, charsPerLine));
      }
      lines.push('');
    }

    // Registration CTA if no member
    if (!data.member_info) {
      lines.push(this.divider('-', charsPerLine));
      lines.push(this.centerText('DAFTAR MEMBER, FREE!', charsPerLine));
      lines.push(this.centerText('ngemiloh.com/member/register', charsPerLine));
      lines.push('');
    }

    return {
      lines,
      width: config.receipt_width,
      totalLines: lines.length,
    };
  }

  /**
   * Generate HTML receipt for browser printing
   */
  generateHtmlReceipt(data: ReceiptData): string {
    const { order } = data;
    const printable = this.generateReceiptText(data);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Struk - ${order.order_number || order.id}</title>
  <style>
    @page {
      size: 80mm 200mm; /* Adjust based on receipt width */
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.4;
      width: ${data.config.receipt_width}mm;
      padding: 5mm;
      background: white;
    }

    .receipt {
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">${printable.lines.join('\n')}</div>
  <script>
    // Auto-print when page loads
    window.onload = function() {
      window.print();
    }
  </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate receipt by order ID
   * SECURITY: Only superadmin or the cashier who created the order can access
   */
  async generateReceiptByOrderId(
    orderId: string,
    userId?: string,
    userRole?: string,
  ): Promise<{
    text: PrintableReceipt;
    html: string;
  }> {
    const data = await this.getReceiptData(orderId, userId, userRole);
    return {
      text: this.generateReceiptText(data),
      html: this.generateHtmlReceipt(data),
    };
  }

  // ============ Helper Methods ============

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private divider(char: string, width: number): string {
    return char.repeat(width);
  }

  private formatKeyValue(key: string, value: string, width: number): string {
    const separator = ': ';
    const maxKeyWidth = Math.floor(
      (width - separator.length - value.length) * 0.6,
    );
    const truncatedKey =
      key.length > maxKeyWidth ? key.slice(0, maxKeyWidth - 2) + '..' : key;
    const padding =
      width - truncatedKey.length - separator.length - value.length;
    const paddingStr = padding > 0 ? ' '.repeat(padding) : '';
    return `${truncatedKey}${separator}${paddingStr}${value}`;
  }

  private formatPrice(price: number, width: number): string {
    const priceStr = this.formatRupiah(price);
    const padding = width - priceStr.length;
    return ' '.repeat(Math.max(1, padding)) + priceStr;
  }

  private formatRupiah(amount: number): string {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 2) + '..';
  }

  private getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash':
        return 'Tunai';
      case 'qris':
        return 'QRIS';
      case 'split':
        return 'Split (Tunai + QRIS)';
      default:
        return method;
    }
  }
}
