import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
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

export class ListKeysQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @IsIn(['UNVERIFIED', 'TRANSLATED', 'REVIEWED'])
  status?: 'UNVERIFIED' | 'TRANSLATED' | 'REVIEWED';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}

export class SetTagsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];
}
