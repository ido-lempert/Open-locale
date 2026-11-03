import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

@Controller('projects/:projectId/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('progress')
  progress(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('branch') branch?: string) {
    return this.reports.progress(user.userId, projectId, branch);
  }

  @Get('quality')
  quality(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('branch') branch?: string) {
    return this.reports.quality(user.userId, projectId, branch);
  }

  @Get('usage')
  usage(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('days') days?: string) {
    if(days!==undefined&&(typeof days!=='string'||! /^-?\d+$/.test(days)))throw new BadRequestException('Usage days must be an integer');
    return this.reports.usage(user.userId, projectId, days===undefined?undefined:Number(days));
  }

  @Get('tasks')
  tasks(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.reports.tasks(user.userId, projectId);
  }
}
