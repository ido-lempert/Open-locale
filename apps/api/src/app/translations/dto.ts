import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  locale!: string;

  @IsString()
  value!: string;
}

export class ImportJsonDto {
  @IsOptional() @IsString() @MaxLength(2_000_000)
  csv?: string;

  @IsOptional() @IsString() @MaxLength(2_000_000)
  xml?: string;

  @IsOptional() @IsString() @MaxLength(2_000_000)
  strings?: string;
  @IsOptional() @IsString()
  locale?: string;

  @IsOptional() @IsObject()
  entries?: Record<string, unknown>;
}

export class SetStatusDto {
  @IsIn(['UNVERIFIED', 'TRANSLATED', 'REVIEWED'])
  status!: 'UNVERIFIED' | 'TRANSLATED' | 'REVIEWED';
}
