import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ProjectsService } from '../projects/projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

@Controller('projects/:projectId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly projects: ProjectsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    await this.projects.getFor(user.userId, projectId);
    return this.activity.list(projectId, {
      action: action || undefined,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 100),
      cursor: cursor || undefined,
    });
  }
}
