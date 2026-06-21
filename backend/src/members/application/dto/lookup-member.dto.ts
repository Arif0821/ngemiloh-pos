import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class LookupMemberQueryDto {
  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Member code (MBR-XXXXX)' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'QR code reference' })
  @IsString()
  @IsOptional()
  qr?: string;
}

export class MemberLookupResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'MBR-A1B2C3' })
  member_code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: 'Silver' })
  tier: string;

  @ApiProperty({ example: 1250 })
  loyalty_points: number;

  @ApiProperty({ example: 12500, description: 'Poin value in Rupiah' })
  points_value: number;

  @ApiProperty({ example: true })
  can_earn: boolean;

  @ApiPropertyOptional()
  cooldown_until: Date | null;
}
