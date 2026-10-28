import { BadRequestException, Body, Controller, Get, Header, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
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
  @Header('Cache-Control', 'no-store')
  exportJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('flat') flat?: string, @Query('format') format?: string) {
    return this.translations.exportJson(user.userId, projectId, locale, flat === 'true' || format === 'flat');
  }

  @Get('export/:locale/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('mode') mode?: string) {
    return this.translations.exportCsv(user.userId, projectId, locale, mode);
  }

  @Get('export/:locale/android')
  @Header('Content-Type', 'text/xml; charset=utf-8')
  exportAndroid(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string) {
    return this.translations.exportAndroid(user.userId, projectId, locale);
  }

  @Get('export/:locale/ios')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  exportIos(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string) {
    return this.translations.exportIos(user.userId, projectId, locale);
  }

  @Get('tm/suggest')
  suggest(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Query('locale') locale?: string, @Query('source') source?: string) {
    return this.translations.suggest(user.userId, projectId, locale ?? '', source ?? '');
  }

  @Get('imports')
  listImportRuns(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.translations.listImportRuns(user.userId, projectId);
  }

  @Post('import/:locale')
  importJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Body() dto: ImportJsonDto) {
    if (dto.csv != null) return this.translations.importCsv(user.userId, projectId, locale, dto.csv);
    if (dto.xml != null) return this.translations.importAndroid(user.userId, projectId, locale, dto.xml);
    if (dto.strings != null) return this.translations.importIos(user.userId, projectId, locale, dto.strings);
    if (dto.entries != null) return this.translations.importJson(user.userId, projectId, locale, dto.entries);
    throw new BadRequestException('Provide entries (JSON), csv, xml or strings');
  }
}
