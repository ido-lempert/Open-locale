import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateKeyDto {
  @IsString()
  @Matches(/^[\w.-]{1,200}$/, { message: 'key name: letters, digits, dot, dash, underscore' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPlural?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number;
}

export class UpdateKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPlural?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number;
}
