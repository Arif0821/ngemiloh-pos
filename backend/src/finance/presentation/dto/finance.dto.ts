import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOpexDto {
  @IsString()
  @MaxLength(50)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  expense_date: string;
}

export class CreateAssetDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchase_price: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  useful_life_months: number;

  @IsDateString()
  purchase_date: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchase_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  useful_life_months?: number;

  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ClosePeriodDto {
  @IsString()
  month: string;

  @IsString()
  year: string;
}

export class CompleteProfitShareDto {
  @IsString()
  month: string;

  @IsString()
  year: string;

  @IsString()
  proof: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OpenShiftDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  opening_balance: number;

  // FASE 4: Multi-Outlet - outlet_id is required
  @IsUUID()
  outlet_id: string;

  @IsOptional()
  @IsDateString()
  planned_close_at?: string;

  @IsOptional()
  @IsString()
  carry_over_from_shift_id?: string;
}

export class CloseShiftDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actual_cash: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
