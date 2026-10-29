import { BadRequestException, Body, Controller, Get, Header, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { BulkStatusDto, ImportJsonDto, SetStatusDto, UpsertTranslationDto } from './dto';

@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Put('keys/:keyId/translations')
  upsert(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: UpsertTranslationDto) {
    return this.translations.upsert(user.userId, projectId, keyId, dto.locale, dto.value, dto.expectedVersion, dto.expectedRowId);
  }

  @Post('review/bulk-status')
  bulkSetStatus(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: BulkStatusDto) {
    return this.translations.bulkSetStatus(user.userId, projectId, dto);
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
  exportJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('flat') flat?: string, @Query('format') format?: string, @Query('branch') branch?: string) {
    return this.translations.exportJson(user.userId, projectId, locale, flat === 'true' || format === 'flat', branch);
  }

  @Get('export/:locale/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('mode') mode?: string, @Query('branch') branch?: string) {
    return this.translations.exportCsv(user.userId, projectId, locale, mode, branch);
  }

  @Get('export/:locale/android')
  @Header('Content-Type', 'text/xml; charset=utf-8')
  exportAndroid(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportAndroid(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/ios')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  exportIos(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportIos(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/po')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  exportPo(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportPo(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/xliff')
  @Header('Content-Type', 'application/x-xliff+xml; charset=utf-8')
  exportXliff(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportXliff(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/properties')
  @Header('Content-Type', 'text/x-java-properties; charset=utf-8')
  exportProperties(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportProperties(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/arb')
  @Header('Content-Type', 'application/arb+json; charset=utf-8')
  exportArb(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportArb(user.userId, projectId, locale, branch);
  }

  @Get('export/:locale/yaml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  exportYaml(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch?: string) {
    return this.translations.exportYaml(user.userId, projectId, locale, branch);
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
  importJson(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('locale') locale: string, @Query('branch') branch: string | undefined, @Query('dryRun') dryRun: string | undefined, @Body() dto: ImportJsonDto) {
    if (dryRun === 'true') return this.translations.importPreview(user.userId, projectId, locale, dto, branch);
    if (dto.po != null) return this.translations.importPo(user.userId, projectId, locale, dto.po, branch);
    if (dto.xliff != null) return this.translations.importXliff(user.userId, projectId, locale, dto.xliff, branch);
    if (dto.properties != null) return this.translations.importProperties(user.userId, projectId, locale, dto.properties, branch);
    if (dto.arb != null) return this.translations.importArb(user.userId, projectId, locale, dto.arb, branch);
    if (dto.yaml != null) return this.translations.importYaml(user.userId, projectId, locale, dto.yaml, branch);
    if (dto.csv != null) return this.translations.importCsv(user.userId, projectId, locale, dto.csv, branch);
    if (dto.xml != null) return this.translations.importAndroid(user.userId, projectId, locale, dto.xml, branch);
    if (dto.strings != null) return this.translations.importIos(user.userId, projectId, locale, dto.strings, branch);
    if (dto.entries != null) return this.translations.importJson(user.userId, projectId, locale, dto.entries, branch);
    throw new BadRequestException('Provide entries (JSON), csv, xml, strings, po, xliff, properties, arb or yaml');
  }
}
