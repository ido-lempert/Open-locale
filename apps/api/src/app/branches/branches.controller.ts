import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionOnlyGuard } from '../auth/session-only.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/)
  name!: string;
}

class MergeBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  into!: string;

  @IsString()
  @IsOptional()
  previewedAt?: string;
}

@Controller('projects/:projectId/branches')
@UseGuards(JwtAuthGuard, SessionOnlyGuard)
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.branches.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateBranchDto) {
    return this.branches.create(user.userId, projectId, dto.name);
  }

  @Delete(':branchId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('branchId') branchId: string) {
    return this.branches.remove(user.userId, projectId, branchId);
  }

  @Post(':branchId/merge/preview')
  preview(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('branchId') branchId: string, @Body() dto: MergeBranchDto) {
    return this.branches.previewMerge(user.userId, projectId, branchId, dto.into);
  }

  @Post(':branchId/merge')
  merge(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('branchId') branchId: string, @Body() dto: MergeBranchDto) {
    return this.branches.merge(user.userId, projectId, branchId, dto.into, dto.previewedAt);
  }
}
