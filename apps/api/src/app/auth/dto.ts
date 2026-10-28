import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

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
