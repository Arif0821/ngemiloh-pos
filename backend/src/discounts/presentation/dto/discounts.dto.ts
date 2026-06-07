import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsUUID, IsDateString, IsBoolean, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { DiscountType, DiscountScope } from '@prisma/client';

export class CreateDiscountDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value: number;

  @IsEnum(DiscountScope)
  scope: DiscountScope;

  @IsOptional()
  @IsUUID()
  target_id?: string;

  @IsDateString()
  valid_from: string;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  applicable_days: number[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
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
