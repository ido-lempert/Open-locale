import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

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

export class SetStatusDto {
  @IsIn(['UNVERIFIED', 'TRANSLATED', 'REVIEWED'])
  status!: 'UNVERIFIED' | 'TRANSLATED' | 'REVIEWED';
}
