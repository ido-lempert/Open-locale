import { Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { OtaService } from './ota.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SessionOnlyGuard } from '../auth/session-only.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';

class PublishDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  branch?: string;
}

@Controller('projects/:projectId/ota')
export class OtaController {
  constructor(private readonly ota: OtaService) {}

  // Publish is a release action: admin + signed-in session (like branches).
  @Post('publish')
  @UseGuards(JwtAuthGuard, SessionOnlyGuard)
  publish(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: PublishDto) {
    return this.ota.publish(user.userId, projectId, dto.branch);
  }

  // Pull endpoints: any project member or read-scope API token. Never public.
  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.ota.list(user.userId, projectId);
  }

  @Get('latest')
  @UseGuards(JwtAuthGuard)
  async latest(
    @CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Query('locale') locale: string, @Query('branch') branch: string | undefined,
    @Req() req: { headers: Record<string, string | undefined> }, @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.ota, user, projectId, { locale, branch }, req, res);
  }

  @Get(':version/:locale')
  @UseGuards(JwtAuthGuard)
  async version(
    @CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('version', ParseIntPipe) version: number, @Param('locale') locale: string,
    @Query('branch') branch: string | undefined,
    @Req() req: { headers: Record<string, string | undefined> }, @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(this.ota, user, projectId, { locale, branch, version }, req, res);
  }

  private async respond(
    ota: OtaService, user: AuthPrincipal, projectId: string,
    opts: { locale?: string; branch?: string; version?: number },
    req: { headers: Record<string, string | undefined> }, res: Response,
  ) {
    if (!opts.locale) throw new NotFoundException('locale query parameter is required');
    const { etag, sha256, body } = await ota.bundle(user.userId, projectId, { ...opts, locale: opts.locale });
    res.setHeader('ETag', etag);
    res.setHeader('X-OpenLocale-Bundle-SHA256', sha256);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (req.headers['if-none-match'] === etag) {
      // The digest header rides the 304 too: a client holding the body can
      // re-verify integrity without re-downloading it.
      res.status(304);
      return null;
    }
    return body;
  }
}
