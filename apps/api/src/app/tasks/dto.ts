import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'DONE'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'DONE';

  // null clears the field; absence leaves it untouched
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsISO8601()
  dueDate?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  assigneeId?: string | null;
}
