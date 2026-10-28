import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, ArrayMaxSize } from 'class-validator';
import { supportedTypes } from './mt.providers';

export const MT_BATCH_CAP = 200;

export class CreateMtProviderDto {
  @IsString() @MaxLength(120) name!: string;
  @IsIn(supportedTypes(), { message: `type must be one of: ${supportedTypes().join(', ')}` }) type!: string;
  @IsOptional() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateMtProviderDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() config?: Record<string, unknown>;
}

export class PretranslateDto {
  @IsUUID() providerId!: string;
  @IsString() locale!: string;
  @IsOptional() @IsString() sourceLocale?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(MT_BATCH_CAP) @IsUUID(undefined, { each: true }) keyIds?: string[];
}
