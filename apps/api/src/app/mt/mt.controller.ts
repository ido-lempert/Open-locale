import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { MtService } from './mt.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateMtProviderDto, PretranslateDto, UpdateMtProviderDto } from './dto';

@Controller('projects/:projectId/mt')
@UseGuards(JwtAuthGuard)
export class MtController {
  constructor(private readonly mt: MtService) {}

  @Get('providers')
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.mt.listProviders(user.userId, projectId);
  }

  @Post('providers')
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateMtProviderDto) {
    return this.mt.createProvider(user.userId, projectId, dto);
  }

  @Patch('providers/:providerId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('providerId') providerId: string, @Body() dto: UpdateMtProviderDto) {
    return this.mt.updateProvider(user.userId, projectId, providerId, dto);
  }

  @Delete('providers/:providerId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('providerId') providerId: string) {
    return this.mt.removeProvider(user.userId, projectId, providerId);
  }

  @Post('pretranslate')
  pretranslate(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: PretranslateDto) {
    return this.mt.pretranslate(user.userId, projectId, dto);
  }
}
