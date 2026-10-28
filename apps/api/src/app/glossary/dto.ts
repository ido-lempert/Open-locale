import { IsBoolean, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class GlossaryTermDto {
  @IsString()
  @Length(1, 200)
  term!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  doNotTranslate?: boolean;

  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;
}

export class UpdateGlossaryTermDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  term?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  doNotTranslate?: boolean;

  @IsOptional()
  @IsObject()
  translations?: Record<string, string>;
}
