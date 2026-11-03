import { BadRequestException, Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

@Controller('projects/:projectId/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  private reportBranch(branch:unknown):string|undefined {
    if(branch===undefined)return undefined;
    if(typeof branch!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/.test(branch))throw new BadRequestException('Report branch must be a valid branch name');
    return branch;
  }

  @Get('progress')
  @Header('Cache-Control', 'no-store')
  progress(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Query('branch') branch?: string) {
    return this.reports.progress(user.userId, projectId, this.reportBranch(branch));
  }

  @Get('quality')
  @Header('Cache-Control', 'no-store')
  quality(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Query('branch') branch?: string) {
    return this.reports.quality(user.userId, projectId, this.reportBranch(branch));
  }

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  usage(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Query('days') days?: string) {
    if(days!==undefined&&(typeof days!=='string'||! /^-?\d+$/.test(days)))throw new BadRequestException('Usage days must be an integer');
    return this.reports.usage(user.userId, projectId, days===undefined?undefined:Number(days));
  }

  @Get('tasks')
  @Header('Cache-Control', 'no-store')
  tasks(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string) {
    return this.reports.tasks(user.userId, projectId);
  }
}
