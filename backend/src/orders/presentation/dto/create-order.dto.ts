import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class OrderItemModifierDto {
  @IsUUID()
  option_id: string = '';
}

export class OrderItemDto {
  @IsUUID()
  product_id: string = '';

  @IsNumber()
  @Min(1)
  quantity: number = 1;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemModifierDto)
  modifiers?: OrderItemModifierDto[];
}

export class CreateOrderDto {
  @IsUUID()
  client_uuid: string = '';

  // FASE 4: Multi-Outlet - outlet_id is required
  @IsUUID()
  outlet_id: string = '';

  @IsOptional()
  @IsUUID()
  member_id?: string;

  @IsOptional()
  @IsBoolean()
  redeem_points?: boolean;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod = 'cash';

  @IsNumber()
  @Min(0)
  client_final_price: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cash_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  qris_amount?: number;

  @IsOptional()
  @IsString()
  customer_name?: string;

  // Server-generated: TRX-YYYYMMDD-{cashier_letter}{SEQ}, not provided by client
  @IsOptional()
  @IsString()
  order_number?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cash_received?: number;

  // For internal use (sync-batch): mark QRIS offline orders as pending_sync
  @IsOptional()
  @IsString()
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[] = [];
}

export class SyncBatchDto {
  // P1-API: Limit batch size to prevent memory issues
  @IsArray()
  @Max(100, { message: 'Maximum 100 orders per batch' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDto)
  orders: CreateOrderDto[] = [];
}

export class StartShiftDto {
  @IsUUID()
  outlet_id: string = '';
}
