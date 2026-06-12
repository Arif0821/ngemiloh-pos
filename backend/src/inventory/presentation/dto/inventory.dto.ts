import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  Min,
  MaxLength,
  IsIn,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

@ValidatorConstraint({ name: 'atLeastOneRequired', async: false })
export class AtLeastOneRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const obj = args.object as Record<string, unknown>;
    const fields = args.constraints as string[];
    return fields.some(
      (f) => obj[f] !== undefined && obj[f] !== null && obj[f] !== '',
    );
  }
  defaultMessage(args: ValidationArguments) {
    const fields = args.constraints as string[];
    return `At least one of [${fields.join(', ')}] must be provided`;
  }
}

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

  @Validate(AtLeastOneRequiredConstraint, ['product_id', 'modifier_option_id'])
  _atLeastOne: undefined;

  @IsUUID()
  raw_material_id: string;

  @IsNumber()
  @Min(0.0001)
  quantity_per_serving: number;
}
