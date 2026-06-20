import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePinDto {
  @IsString()
  current_pin: string;

  @IsString()
  @MinLength(8, { message: 'PIN baru minimal 8 digit' })
  @MaxLength(8, { message: 'PIN baru maksimal 8 digit' })
  @Matches(/^\d+$/, { message: 'PIN baru harus berupa angka' })
  new_pin: string;
}
