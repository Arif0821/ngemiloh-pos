import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  Matches,
  IsEmail,
} from 'class-validator';

export class RegisterMemberDto {
  @ApiProperty({ example: 'John Doe', description: 'Nama lengkap member' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string = '';

  @ApiProperty({ example: '081234567890', description: 'Nomor HP (unique)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[0-9]{8,15}$/, { message: 'Phone must be 8-15 digits' })
  phone: string = '';

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail({}, { message: 'Email tidak valid' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  email?: string = undefined;

  @ApiPropertyOptional({ example: 'a1b2c3d4' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  ref_code?: string = undefined;
}

export class RegisterMemberResponseDto {
  @ApiProperty()
  id: string = '';

  @ApiProperty({ example: 'MBR-A1B2C3' })
  member_code: string = '';

  @ApiProperty()
  name: string = '';

  @ApiProperty()
  phone: string = '';

  @ApiProperty({ example: 'Bronze' })
  tier: string = '';

  @ApiProperty({ example: 0 })
  loyalty_points: number = 0;

  @ApiProperty()
  registered_at: Date = new Date();
}
