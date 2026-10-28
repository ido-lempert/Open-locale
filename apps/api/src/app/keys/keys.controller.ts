import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
    return this.keys.addComment(user.userId, projectId, keyId, dto.body, dto.locale);
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
