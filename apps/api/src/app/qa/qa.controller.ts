import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { QaService } from './qa.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

@Controller('projects/:projectId/qa')
@UseGuards(JwtAuthGuard)
export class QaController {
  constructor(private readonly qa: QaService) {}

  @Get()
  run(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('locale') locale?: string, @Query('branch') branch?: string) {
    return this.qa.run(user.userId, projectId, locale, branch);
  }
}
