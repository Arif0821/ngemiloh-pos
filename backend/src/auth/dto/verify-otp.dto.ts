import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail() email: string;

  @IsString()
  @MinLength(8, { message: 'Kode OTP harus 8 digit' })
  @MaxLength(8, { message: 'Kode OTP harus 8 digit' })
  otp: string;
}
