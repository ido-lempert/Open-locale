import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { KeysService } from './keys.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateCommentDto, CreateKeyDto, ListKeysQueryDto, SetTagsDto, UpdateKeyDto } from './dto';

@Controller('projects/:projectId/keys')
@UseGuards(JwtAuthGuard)
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query() query: ListKeysQueryDto) {
    return this.keys.list(user.userId, projectId, query);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateKeyDto) {
    return this.keys.create(user.userId, projectId, dto);
  }

  @Patch(':keyId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: UpdateKeyDto) {
    return this.keys.update(user.userId, projectId, keyId, dto);
  }

  @Patch(':keyId/tags')
  setTags(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: SetTagsDto) {
    return this.keys.setTags(user.userId, projectId, keyId, dto.tags);
  }

  @Get(':keyId/comments')
  listComments(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Query('locale') locale?: string) {
    return this.keys.listComments(user.userId, projectId, keyId, locale);
  }

  @Post(':keyId/comments')
  addComment(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: CreateCommentDto) {
    return this.keys.addComment(user.userId, projectId, keyId, dto.body, dto.locale, dto.parentId);
  }

  @Post(':keyId/screenshots')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadScreenshot(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    return this.keys.uploadScreenshot(user.userId, projectId, keyId, file);
  }

  @Get(':keyId/screenshots')
  listScreenshots(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string) {
    return this.keys.listScreenshots(user.userId, projectId, keyId);
  }

  @Get(':keyId/screenshots/:screenshotId')
  async getScreenshot(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('keyId') keyId: string, @Param('screenshotId') screenshotId: string,
    @Res({ passthrough: true }) res: Response) {
    const shot = await this.keys.getScreenshot(user.userId, projectId, keyId, screenshotId);
    res.set({
      'Content-Type': shot.mimeType,
      'Content-Length': String(shot.byteSize),
      'Content-Disposition': `inline; filename="${shot.filename.replace(/[^\w.\- ]/g, '_')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(shot.data);
  }

  @Delete(':keyId/screenshots/:screenshotId')
  deleteScreenshot(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('keyId') keyId: string, @Param('screenshotId') screenshotId: string) {
    return this.keys.deleteScreenshot(user.userId, projectId, keyId, screenshotId);
  }

  @Delete(':keyId/comments/:commentId')
  deleteComment(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Param('commentId') commentId: string) {
    return this.keys.deleteComment(user.userId, projectId, keyId, commentId);
  }

  @Delete(':keyId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string) {
    return this.keys.remove(user.userId, projectId, keyId);
  }
}
