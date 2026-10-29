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

export class TotpSetupDto {
  // Fresh-password step-up: changing the account's second factor always
  // requires the current password, even inside an active session.
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class TotpCodeDto {
  @IsString()
  @IsNotEmpty()
  password!: string;

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

export class OidcCallbackDto {
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) state!: string;
}

export class OidcCompleteDto {
  @IsString() @MinLength(1) pendingToken!: string;
  @IsString() @MinLength(1) totpCode!: string;
}
