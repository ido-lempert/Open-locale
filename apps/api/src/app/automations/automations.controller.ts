import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateAutomationRuleDto, UpdateAutomationRuleDto } from './dto';

@Controller('projects/:projectId/automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.automations.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateAutomationRuleDto) {
    return this.automations.create(user.userId, projectId, dto);
  }

  @Patch(':ruleId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('ruleId') ruleId: string, @Body() dto: UpdateAutomationRuleDto) {
    return this.automations.update(user.userId, projectId, ruleId, dto);
  }

  @Delete(':ruleId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('ruleId') ruleId: string) {
    return this.automations.remove(user.userId, projectId, ruleId);
  }
}
