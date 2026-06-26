import { IsEmail, IsOptional } from 'class-validator';

export class ResendOtpDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email tidak valid' })
  email?: string = undefined;
}
