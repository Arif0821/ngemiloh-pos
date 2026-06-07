import { Injectable, BadRequestException, Logger, NotFoundException, Inject } from '@nestjs/common';
import { OrderStatus, PaymentMethod } from '@prisma/client';
import * as crypto from 'crypto';
import { InventoryService } from '../../../inventory/application/services/inventory.service';
import { EmailService } from '../../../email/email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MailService } from '../../../mail/mail.service';
import { ORDER_REPOSITORY, type OrderRepositoryInterface } from '../../domain/interfaces/order.repository.interface';

const midtransClient = require('midtrans-client');

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private midtransCore: any;

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orderRepository: OrderRepositoryInterface,
    private inventoryService: InventoryService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
    private mailService: MailService
  ) {
    this.midtransCore = new midtransClient.CoreApi({
      isProduction: process.env.MIDTRANS_ENV === 'production',
      serverKey: process.env.MIDTRANS_ENV === 'production' 
        ? process.env.MIDTRANS_SERVER_KEY_PROD 
        : process.env.MIDTRANS_SERVER_KEY_SANDBOX,
      clientKey: process.env.MIDTRANS_ENV === 'production'
        ? process.env.MIDTRANS_CLIENT_KEY_PROD
        : process.env.MIDTRANS_CLIENT_KEY_SANDBOX,
    });
  }

  async createOrder(data: any, kasirId: string) {
    const existingOrder = await this.orderRepository.findOrderByClientUuid(data.client_uuid);
    
    if (existingOrder) {
      return existingOrder;
    }

    let calculatedSubtotal = 0;
    let totalDiscountAmount = 0;
    const orderItemsPayload: any[] = [];
    
    const activeDiscounts = await this.orderRepository.findActiveDiscounts();

    for (const item of data.items) {
      const product = await this.orderRepository.findProductWithModifiers(item.product_id);
      if (!product) throw new BadRequestException(`Product ${item.product_id} not found`);

      let basePrice = Number(product.base_price);
      let maxDiscountAmount = 0;
      let appliedDiscountId: string | null = null;

      for (const disc of activeDiscounts) {
        const isApplicable = disc.scope === 'all_products' || 
                             (disc.scope === 'specific_product' && disc.target_id === product.id) ||
                             (disc.scope === 'category' && disc.target_id === product.category_id);
        
        if (isApplicable) {
          let currentDiscAmount = 0;
          if (disc.type === 'percentage') {
            currentDiscAmount = basePrice * (Number(disc.value) / 100);
          } else if (disc.type === 'fixed_amount') {
            currentDiscAmount = Math.min(Number(disc.value), basePrice);
          }
          
          if (currentDiscAmount > maxDiscountAmount) {
            maxDiscountAmount = currentDiscAmount;
            appliedDiscountId = disc.id;
          }
        }
      }
      
      let itemTotal = basePrice - maxDiscountAmount;
      let modifierTotal = 0;

      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          let foundOption: any = null;
          for (const group of product.modifier_groups) {
             const option = group.options.find((o: any) => o.id === mod.option_id);
             if (option) foundOption = option;
          }
          if (foundOption) {
            modifierTotal += Number(foundOption.additional_price);
            itemTotal += Number(foundOption.additional_price);
          }
        }
      }

      const rowTotal = itemTotal * item.quantity;
      calculatedSubtotal += rowTotal;
      totalDiscountAmount += (maxDiscountAmount * item.quantity);

      orderItemsPayload.push({
        product_id: product.id,
        discount_id: appliedDiscountId,
        quantity: item.quantity,
        unit_price: product.base_price,
        subtotal: rowTotal,
        notes: item.notes,
        discounted_base: basePrice - maxDiscountAmount,
        final_price: itemTotal
      });
    }

    const taxRate = 0; 
    const calculatedTax = calculatedSubtotal * taxRate;
    const calculatedFinalPrice = calculatedSubtotal + calculatedTax;
    
    const clientFinalPrice = Number(data.client_final_price);
    const thresholdPct = Number(process.env.PRICE_DELTA_THRESHOLD_PCT || '10');
    
    const diffPct = Math.abs(calculatedFinalPrice - clientFinalPrice) / calculatedFinalPrice * 100;
    
    if (diffPct > thresholdPct) {
      this.logger.warn(`Price Discrepancy! Backend: ${calculatedFinalPrice}, Client: ${clientFinalPrice}`);
      throw new BadRequestException('Price calculation discrepancy exceeds threshold');
    }
    
    if (data.payment_method === PaymentMethod.qris && calculatedFinalPrice < 1000) {
      throw new BadRequestException('Minimum transaksi QRIS adalah Rp 1.000');
    }

    let cashAmount = Number(data.cash_amount) || 0;
    let qrisAmount = Number(data.qris_amount) || 0;

    if (data.payment_method === PaymentMethod.split) {
      if (Math.abs((cashAmount + qrisAmount) - calculatedFinalPrice) > 1) { 
        throw new BadRequestException('Split payment amounts do not match total');
      }
      if (qrisAmount > 0 && qrisAmount < 1000) {
        throw new BadRequestException('Minimum QRIS pada split payment adalah Rp 1.000');
      }
    } else if (data.payment_method === PaymentMethod.cash) {
      cashAmount = calculatedFinalPrice;
      qrisAmount = 0;
    } else if (data.payment_method === PaymentMethod.qris) {
      cashAmount = 0;
      qrisAmount = calculatedFinalPrice;
    }

    const order = await this.orderRepository.createOrder({
      client_uuid: data.client_uuid,
      cashier_id: kasirId,
      client_created_at: new Date(),
      total_amount: calculatedFinalPrice,
      discount_total: totalDiscountAmount, 
      payment_method: data.payment_method,
      cash_amount: cashAmount,
      qris_amount: qrisAmount,
      status: data.payment_method === PaymentMethod.cash ? OrderStatus.completed : OrderStatus.pending_sync,
      payment_status: data.payment_method === PaymentMethod.cash ? 'paid' : 'unpaid',
      items: {
        create: orderItemsPayload.map(i => ({
          product_id: i.product_id,
          discount_id: i.discount_id,
          product_name_snapshot: 'Menu',
          base_price: i.unit_price,
          discounted_base: i.discounted_base,
          final_price: i.final_price, 
          quantity: i.quantity,
          subtotal: i.subtotal
        }))
      }
    });

    if (order.status === OrderStatus.completed) {
      await this.inventoryService.reduceStockForOrder(order.id).catch(err => {
        this.logger.error(`Failed to reduce stock for order ${order.id}: ${err.message}`);
      });
    }

    if (data.payment_method === PaymentMethod.qris) {
      try {
        const qrisParams = {
          payment_type: 'qris',
          transaction_details: {
            order_id: order.id,
            gross_amount: Math.round(calculatedFinalPrice)
          },
          qris: {
            acquirer: "gopay"
          },
          custom_expiry: {
            expiry_duration: process.env.QRIS_EXPIRY_SECONDS ? Number(process.env.QRIS_EXPIRY_SECONDS) : 900,
            unit: "second"
          }
        };
        
        const qrisResponse = await this.midtransCore.charge(qrisParams);
        
        if (qrisResponse.actions && qrisResponse.actions.length > 0) {
          const qrString = qrisResponse.actions.find((a: any) => a.name === 'generate-qr-code')?.url;
          
          await this.orderRepository.updateOrder(order.id, { 
            payment_gateway_ref: qrisResponse.transaction_id,
            payment_raw_response: qrString,
          });
          
          return { ...order, qr_string: qrString, midtrans_transaction_id: qrisResponse.transaction_id };
        }
      } catch (err: any) {
        this.logger.warn('Midtrans QRIS Generation Failed, falling back to MOCK QRIS for testing. Error: ' + err.message);
        const mockQrString = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ngemiloh-mock-${order.id}`;
        
        await this.orderRepository.updateOrder(order.id, { 
          payment_gateway_ref: `mock-txn-${order.id}`,
          payment_raw_response: mockQrString,
        });
        
        return { ...order, qr_string: mockQrString, midtrans_transaction_id: `mock-txn-${order.id}` };
      }
    }

    return order;
  }

  async syncBatchOrders(orders: any[], kasirId: string) {
    const results: any[] = [];
    for (const orderData of orders) {
      try {
        // Flag to mark it came from offline sync
        orderData.synced_from_offline = true;
        // The QRIS can't be used offline per BR-O01, but we still handle it
        if (orderData.payment_method === PaymentMethod.qris) {
           results.push({ client_uuid: orderData.client_uuid, status: 'error', message: 'QRIS not allowed in offline sync' });
           continue;
        }
        
        const order = await this.createOrder(orderData, kasirId);
        
        // Ensure it is marked as synced_from_offline
        await this.orderRepository.updateOrder(order.id, { synced_from_offline: true });
        
        results.push({ client_uuid: orderData.client_uuid, status: 'success', server_id: order.id });
      } catch (err: any) {
        this.logger.error(`Failed to sync offline order ${orderData.client_uuid}: ${err.message}`);
        results.push({ client_uuid: orderData.client_uuid, status: 'error', message: err.message });
      }
    }
    return results;
  }

  async handleMidtransWebhook(notification: any) {
    try {
      const statusResponse = await this.midtransCore.transaction.notification(notification);
      
      const orderId = statusResponse.order_id;
      const transactionStatus = statusResponse.transaction_status;
      const fraudStatus = statusResponse.fraud_status;

      const serverKey = process.env.MIDTRANS_ENV === 'production' ? process.env.MIDTRANS_SERVER_KEY_PROD : process.env.MIDTRANS_SERVER_KEY_SANDBOX;
      const hash = crypto.createHash('sha512').update(orderId + statusResponse.status_code + statusResponse.gross_amount + serverKey).digest('hex');
      
      const expectedBuffer = Buffer.from(hash, 'hex');
      const signatureBuffer = Buffer.from(statusResponse.signature_key || '', 'hex');

      if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
        this.logger.warn(`Invalid Midtrans Signature Key: order ${orderId}`);
        return { status: 'IGNORED' };
      }

      let newStatus: OrderStatus = OrderStatus.pending_sync;
      let paymentStatus: string = 'unpaid';

      if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
        newStatus = OrderStatus.completed;
        paymentStatus = 'paid';
      } else if (transactionStatus === 'expire') {
        newStatus = OrderStatus.voided;
        paymentStatus = 'expire';
      } else if (transactionStatus === 'cancel' || transactionStatus === 'deny') {
        newStatus = OrderStatus.voided;
        paymentStatus = 'failed';
      } else if (transactionStatus === 'pending') {
        newStatus = OrderStatus.pending_sync;
        paymentStatus = 'unpaid';
      }

      const existingOrder = await this.orderRepository.findOrderById(orderId);
      if (!existingOrder) {
        throw new NotFoundException('Order not found');
      }

      await this.orderRepository.updateOrder(orderId, {
        status: newStatus,
        payment_status: paymentStatus,
        payment_settled_at: transactionStatus === 'settlement' || transactionStatus === 'capture' ? new Date() : null,
      });
        
      if (existingOrder.status !== OrderStatus.completed && newStatus === OrderStatus.completed) {
        await this.orderRepository.createAuditLog({
          actor_id: existingOrder.cashier_id,
          action: 'QRIS_PAYMENT_SUCCESS',
          entity_type: 'Order',
          entity_id: orderId,
          new_value: { payment_provider_ref: statusResponse.transaction_id, total_amount: Number(existingOrder.total_amount) }
        });

        this.inventoryService.reduceStockForOrder(orderId).catch(err => {
          this.logger.error(`Failed to reduce stock for order ${orderId}: ${err.message}`);
        });
        
        this.eventEmitter.emit('order.paid', { orderId, status: newStatus });
      }

      return { status: 'success' };
    } catch (e) {
      this.logger.error('Error processing midtrans webhook', e);
    }
  }

  async getOrder(id: string) {
    const order = await this.orderRepository.findOrderById(id);
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getHistory(kasirId?: string) {
    let whereClause: any = {};
    if (kasirId) {
      const today = new Date();
      today.setHours(0,0,0,0);
      whereClause = { cashier_id: kasirId, created_at: { gte: today } };
    }
    return this.orderRepository.findOrders(
      whereClause,
      { created_at: 'desc' },
      { items: true, cashier: { select: { name: true, username: true } } }
    );
  }

  async getShiftSummary(kasirId: string) {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const orders = await this.orderRepository.findOrders(
      {
        created_at: { gte: today },
        cashier_id: kasirId,
        status: OrderStatus.completed,
      }
    );

    const totalOrders = orders.length;
    let totalCash = 0;
    let totalQris = 0;

    orders.forEach((o: any) => {
      if (o.payment_method === PaymentMethod.cash) totalCash += Number(o.total_amount);
      if (o.payment_method === PaymentMethod.qris) totalQris += Number(o.total_amount);
    });

    return {
      date: today.toISOString(),
      kasir_id: kasirId,
      total_orders: totalOrders,
      total_cash: totalCash,
      total_qris: totalQris,
      grand_total: totalCash + totalQris
    };
  }

  async getCurrentShift(kasirId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.orderRepository.findCurrentShift(kasirId, today);
  }

  async startShift(kasirId: string) {
    const existing = await this.getCurrentShift(kasirId);
    if (existing) return existing;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const setting = await this.orderRepository.getSetting('DEFAULT_OPENING_BALANCE');
    const openingBalance = setting && setting.value ? Number(setting.value) : 500000;

    return this.orderRepository.createShift({
      cashier_id: kasirId,
      shift_date: today,
      opening_balance: openingBalance,
      status: 'open'
    });
  }

  async voidOrder(orderId: string, reason: string, adminId: string) {
    if (!reason || reason.length < 10) {
      throw new BadRequestException('Alasan void wajib minimal 10 karakter');
    }

    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (order.status === OrderStatus.voided) {
      throw new BadRequestException('Order sudah di-void');
    }

    await this.orderRepository.updateOrder(orderId, {
      status: OrderStatus.voided,
      voided_by: adminId,
      voided_at: new Date(),
      void_reason: reason,
      payment_status: 'failed'
    });

    await this.orderRepository.createOrderRefund({
      order_id: orderId,
      amount: order.total_amount,
      refund_method: 'manual_cash',
      refunded_by: adminId,
      notes: `Refund for voided order. Reason: ${reason}`
    });

    await this.orderRepository.createAuditLog({
      actor_id: adminId,
      action: 'ORDER_VOID',
      entity_type: 'Order',
      entity_id: orderId,
      old_value: { status: order.status },
      new_value: { status: 'voided', reason }
    });

    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentVoids = await this.orderRepository.countRecentVoids(tenMinsAgo);

    if (recentVoids >= 3) {
      this.mailService.sendAlert(
        'Indikasi Fraud - Banyak Void Transaksi',
        `<p>Sistem mendeteksi ada <strong>${recentVoids} transaksi</strong> yang di-void dalam 10 menit terakhir.</p><p>Mohon segera periksa log audit untuk detail lebih lanjut.</p>`
      );
    }

    return { success: true, message: 'Order voided successfully' };
  }

  async flagTransaction(orderId: string, status: string, adminId: string) {
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.orderRepository.updateOrder(orderId, {
      verification_status: status
    });

    await this.orderRepository.createAuditLog({
      actor_id: adminId,
      action: 'FLAG_TRANSACTION',
      entity_type: 'Order',
      entity_id: orderId,
      old_value: { verification_status: (order as any).verification_status },
      new_value: { verification_status: status }
    });

    return updated;
  }

  async exportOrdersCsv(startDate: string, endDate: string): Promise<string> {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const orders = await this.orderRepository.findOrders(
      {
        created_at: { gte: start, lte: end }
      },
      { created_at: 'desc' },
      {
        cashier: { select: { name: true } },
        items: {
          include: {
            discount: { select: { name: true } }
          }
        }
      }
    );

    const header = 'Tanggal,ID Pesanan,Kasir,Metode Pembayaran,Status,Item,Kuantitas,Harga Dasar,Nama Diskon,Nominal Diskon,Harga Akhir\n';
    let rows: string[] = [];

    for (const o of orders) {
      const date = o.created_at.toISOString();
      const id = o.client_uuid || o.id;
      const cashier = o.cashier?.name || 'Unknown';
      const method = o.payment_method;
      const status = o.status;

      if (o.items && o.items.length > 0) {
        for (const item of o.items) {
          const itemName = item.product_name_snapshot || 'Item';
          const qty = item.quantity;
          const basePrice = item.base_price;
          const discountName = item.discount?.name || '-';
          const discountAmt = Number(item.base_price) - Number(item.discounted_base);
          const finalPrice = item.final_price;
          rows.push(`${date},${id},${cashier},${method},${status},${itemName},${qty},${basePrice},${discountName},${discountAmt},${finalPrice}`);
        }
      } else {
        rows.push(`${date},${id},${cashier},${method},${status},-,0,0,-,0,0`);
      }
    }

    return header + rows.join('\n');
  }

  async getAllShifts(kasirId?: string, dateStr?: string) {
    const where: any = {};
    if (kasirId) {
      where.cashier_id = kasirId;
    }
    if (dateStr) {
      const d = new Date(dateStr);
      d.setHours(0,0,0,0);
      const end = new Date(d);
      end.setHours(23,59,59,999);
      where.shift_start = { gte: d, lte: end };
    }
    
    return this.orderRepository.findShifts(
      where,
      {
        cashier: { select: { name: true } }
      },
      { shift_start: 'desc' },
      50
    );
  }
}
