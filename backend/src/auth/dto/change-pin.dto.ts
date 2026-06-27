import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

export class ChangePinDto {
  @IsOptional()
  @IsString()
  current_pin?: string = undefined;

  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'PIN baru minimal 4 digit' })
  @MaxLength(6, { message: 'PIN baru maksimal 6 digit' })
  @Matches(/^\d+$/, { message: 'PIN baru harus berupa angka' })
  new_pin?: string = undefined;
}
