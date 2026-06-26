import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType, DiscountScope } from '@prisma/client';

@ValidatorConstraint({ name: 'discountValue', async: false })
export class DiscountValueConstraint implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments) {
    const obj = args.object as CreateDiscountDto;
    if (obj.type === 'percentage' && value > 100) return false;
    if (obj.type === 'percentage' && value < 0) return false;
    if (obj.type === 'fixed_amount' && value < 0) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as CreateDiscountDto;
    if (obj.type === 'percentage') {
      return 'Percentage discount value must be between 0 and 100';
    }
    return 'Discount value must be 0 or greater';
  }
}

@ValidatorConstraint({ name: 'discountValueUpdate', async: false })
export class DiscountValueUpdateConstraint implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments) {
    const obj = args.object as UpdateDiscountDto;
    if (obj.type === 'percentage' && value > 100) return false;
    if (obj.type === 'percentage' && value < 0) return false;
    if (obj.type === 'fixed_amount' && value < 0) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as UpdateDiscountDto;
    if (obj.type === 'percentage') {
      return 'Percentage discount value must be between 0 and 100';
    }
    return 'Discount value must be 0 or greater';
  }
}

export class CreateDiscountDto {
  @IsString()
  @MaxLength(100)
  name: string = '';

  @IsEnum(DiscountType)
  type: DiscountType = 'percentage';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Validate(DiscountValueConstraint)
  value: number = 0;

  @IsEnum(DiscountScope)
  scope: DiscountScope = 'global' as DiscountScope;

  @IsOptional()
  @IsUUID()
  target_id?: string = undefined;

  @IsDateString()
  valid_from: string = new Date().toISOString();

  @IsOptional()
  @IsDateString()
  valid_until?: string = undefined;

  @IsArray()
  @IsNumber({}, { each: true })
  applicable_days: number[] = [];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = undefined;
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Validate(DiscountValueUpdateConstraint)
  value?: number;

  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @IsOptional()
  @IsUUID()
  target_id?: string;

  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  applicable_days?: number[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
