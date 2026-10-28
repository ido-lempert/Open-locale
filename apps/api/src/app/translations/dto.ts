import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  locale!: string;

  @IsString()
  value!: string;

  // Optimistic concurrency: when present, the write commits only if the row's
  // current version equals this value (0 = the client expects no row yet).
  @IsOptional() @IsInt() @Min(0)
  expectedVersion?: number;

  // Immutable row identity, checked together with expectedVersion when both
  // are sent: protects against delete/recreate ABA where a recreated row
  // climbs back to the same version number.
  @IsOptional() @IsUUID()
  expectedRowId?: string;
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

  // Only rows currently at this status are touched (the visible queue filter).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @IsOptional()
  @IsString({ each: true })
  keyIds?: string[];

  // Branch scope of the visible queue. Defaults to main; the editor always
  // sends the selected branch so a bulk mark on a feature branch can never
  // touch same-named keys on main (key ids differ per branch anyway, but the
  // filter-only path must be scoped too).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branch?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  // From the dry-run response: exclude rows written after the preview.
  @IsOptional()
  @IsString()
  @MaxLength(40)
  notChangedSince?: string;
}
