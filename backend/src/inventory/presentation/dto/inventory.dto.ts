import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsUUID, Min, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsString()
  @IsIn(['in', 'out', 'adjustment', 'waste'])
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

export class OpnameItemDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(0)
  physical_stock: number;
}

export class SubmitOpnameDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpnameItemDto)
  items: OpnameItemDto[];
}

export class CreateRawMaterialDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  purchase_unit: string;

  @IsNumber()
  @Min(0.01)
  purchase_qty: number;

  @IsString()
  @MaxLength(20)
  usage_unit: string;

  @IsNumber()
  @Min(0.0001)
  conversion_factor: number;

  @IsNumber()
  @Min(0)
  cost_per_unit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplier?: string;
}

export class UpdateRawMaterialDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  purchase_unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  purchase_qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  usage_unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  conversion_factor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_unit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplier?: string;
}

export class CreateBomRecipeDto {
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsUUID()
  modifier_option_id?: string;

  @IsUUID()
  raw_material_id: string;

  @IsNumber()
  @Min(0.0001)
  quantity_per_serving: number;
}
