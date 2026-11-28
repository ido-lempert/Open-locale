import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { SnapshotsService } from './snapshots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

class CreateSnapshotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label!: string;
}

@Controller('projects/:projectId/snapshots')
@UseGuards(JwtAuthGuard)
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.snapshots.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() dto: CreateSnapshotDto) {
    const label = dto.label.trim();
    if (!label) throw new BadRequestException('label must not be blank');
    return this.snapshots.create(user.userId, projectId, label);
  }

  @Post(':snapshotId/restore')
  restore(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string) {
    return this.snapshots.restore(user.userId, projectId, snapshotId);
  }
}
