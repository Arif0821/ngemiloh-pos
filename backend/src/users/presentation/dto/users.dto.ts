import { IsString, IsNumber, IsBoolean, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCashierDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pin: string;
}

export class ResetPinDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  pin: string;
}

export class ToggleStatusDto {
  @IsBoolean()
  is_active: boolean;
}

export class CreateCustomerDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  phone: string;
}

export class AddLoyaltyPointsDto {
  @Type(() => Number)
  @IsNumber()
  points: number;
}
