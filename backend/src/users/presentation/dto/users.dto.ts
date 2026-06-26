import {
  IsString,
  IsNumber,
  IsBoolean,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCashierDto {
  @IsString()
  @MaxLength(100)
  name: string = '';

  @IsString()
  @MaxLength(50)
  username: string = '';

  @IsString()
  @MinLength(8, { message: 'PIN harus 8 digit' })
  @MaxLength(8, { message: 'PIN harus 8 digit' })
  pin: string = '';

  @IsString()
  @MaxLength(1)
  cashier_letter: string = ''; // A-Z, unique per kasir
}

export class ResetPinDto {
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  pin: string = '';
}

export class ToggleStatusDto {
  @IsBoolean()
  is_active: boolean = false;
}

export class CreateCustomerDto {
  @IsString()
  @MaxLength(100)
  name: string = '';

  @IsString()
  @MaxLength(20)
  phone: string = '';
}

export class AddLoyaltyPointsDto {
  @Type(() => Number)
  @IsNumber()
  points: number = 0;
}
