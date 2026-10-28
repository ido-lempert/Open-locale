import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { ImportJsonDto, SetStatusDto, UpsertTranslationDto } from './dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Put('keys/:keyId/translations')
  upsert(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: UpsertTranslationDto) {
    return this.translations.upsert(user.userId, projectId, keyId, dto.locale, dto.value);
  }

  @Patch('keys/:keyId/translations/:locale/status')
  setStatus(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Param('locale') locale: string, @Body() dto: SetStatusDto) {
    return this.translations.setStatus(user.userId, projectId, keyId, locale, dto.status);
  }

  @Get('keys/:keyId/translations/:locale/history')
  history(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Param('locale') locale: string) {
    return this.translations.history(user.userId, projectId, keyId, locale);
  }

  @Get('export/:locale')
  exportJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('flat') flat?: string) {
    return this.translations.exportJson(user.userId, projectId, locale, flat === 'true');
  }

  @Post('import/:locale')
  importJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Body() dto: ImportJsonDto) {
    return this.translations.importJson(user.userId, projectId, locale, dto.entries);
  }
}
