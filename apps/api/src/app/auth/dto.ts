import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  // Second factor: a 6-digit TOTP code or a XXXXX-XXXXX recovery code.
  @IsOptional()
  @IsString()
  totpCode?: string;
}

export class TotpCodeDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class CreateApiTokenDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
