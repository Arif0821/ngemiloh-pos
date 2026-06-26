import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class VerifyOtpDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email tidak valid' })
  email?: string = undefined;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Kode OTP harus 6 digit' })
  @MaxLength(6, { message: 'Kode OTP harus 6 digit' })
  otp?: string = undefined;
}
