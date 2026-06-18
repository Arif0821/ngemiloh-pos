import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail() email: string;

  @IsString()
  @MinLength(6, { message: 'Kode OTP harus 6 digit' })
  @MaxLength(6, { message: 'Kode OTP harus 6 digit' })
  otp: string;
}
