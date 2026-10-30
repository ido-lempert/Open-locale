import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';

@Controller('projects/:projectId/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.webhooks.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.userId, projectId, dto);
  }

  @Patch(':hookId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('hookId') hookId: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooks.update(user.userId, projectId, hookId, dto);
  }

  @Get(':hookId/deliveries')
  deliveries(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('hookId') hookId: string) {
    return this.webhooks.listDeliveries(user.userId, projectId, hookId);
  }

  @Delete(':hookId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('hookId') hookId: string) {
    return this.webhooks.remove(user.userId, projectId, hookId);
  }
}
