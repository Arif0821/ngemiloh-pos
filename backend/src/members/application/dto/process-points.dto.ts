import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
  IsUUID,
} from 'class-validator';

export class ProcessMemberPointsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @IsUUID('4', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  order_id?: string;

  @ApiProperty({ example: 85000 })
  @IsNumber()
  @Min(0)
  transaction_subtotal: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  redeem_requested: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cashier_id?: string;
}

export class ProcessMemberPointsResponseDto {
  @ApiProperty({ example: 425 })
  points_earned: number;

  @ApiProperty({ example: 0 })
  points_redeemed: number;

  @ApiProperty({ example: 0, description: 'Discount amount in Rupiah' })
  discount_amount: number;

  @ApiPropertyOptional({
    example: 61000,
    description: 'Final payment after redeem',
  })
  final_payment?: number;

  @ApiProperty({ example: 1425 })
  new_balance: number;

  @ApiPropertyOptional()
  cooldown_until: Date | null;

  @ApiProperty({ example: 'Gold' })
  tier: string;

  @ApiProperty({ example: false })
  tier_changed: boolean;

  @ApiPropertyOptional()
  tier_benefits: {
    free_item?: string;
  } | null;
}
