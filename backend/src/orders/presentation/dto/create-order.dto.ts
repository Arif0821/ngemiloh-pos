import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class OrderItemModifierDto {
  @IsUUID()
  option_id: string;
}

export class OrderItemDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @Min(1)
  quantity: number;

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
  client_uuid: string;

  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @IsNumber()
  @Min(0)
  client_final_price: number;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class SyncBatchDto {
  // P1-API: Limit batch size to prevent memory issues
  @IsArray()
  @Max(100, { message: 'Maximum 100 orders per batch' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDto)
  orders: CreateOrderDto[];
}
