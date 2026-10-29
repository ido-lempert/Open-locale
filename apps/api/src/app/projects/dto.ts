import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TeamRole } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,60}$/, { message: 'slug must be lowercase letters, digits and dashes' })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  baseLocale?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  locales!: string[];
}

export class AddLocaleDto {
  @IsString()
  @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { message: 'locale must look like en, he, pt-BR' })
  code!: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  customStatuses?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  embedOrigins?: string[];
}

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedLocales?: string[];
}

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedLocales?: string[];
}

export class CreateGroupDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @IsIn(['MEMBER', 'ADMIN']) role!: TeamRole;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedLocales?: string[];
}

export class UpdateGroupDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100) name?: string;
  @IsOptional() @IsIn(['MEMBER', 'ADMIN']) role?: TeamRole;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedLocales?: string[];
}
