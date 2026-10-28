import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  locale!: string;

  @IsString()
  value!: string;
}

export class ImportJsonDto {
  @IsString()
  @IsNotEmpty()
  locale!: string;

  @IsObject()
  entries!: Record<string, unknown>;
}
