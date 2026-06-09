import { IsString, IsOptional, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint()
export class IsCredentialPair implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as LoginDto;
    // Must have at least one identifier AND one secret
    const hasIdentifier = !!(obj.username || obj.email);
    const hasSecret = !!(obj.pin || obj.password);
    return hasIdentifier && hasSecret;
  }

  defaultMessage() {
    return 'Login requires either username or email, combined with either pin or password';
  }
}

export class LoginDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  pin?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @Validate(IsCredentialPair)
  credentials?: never;
}
