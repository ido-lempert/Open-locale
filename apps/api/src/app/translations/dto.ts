import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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
  // Validated against base statuses + project customStatuses in the service.
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  status!: string;
}

export class BulkStatusDto {
  @IsString()
  @IsNotEmpty()
  locale!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  status!: string;

  @IsOptional()
  @IsString({ each: true })
  keyIds?: string[];
}
