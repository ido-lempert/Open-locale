import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { KeysService } from './keys.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateKeyDto, UpdateKeyDto } from './dto';

@Controller('projects/:projectId/keys')
@UseGuards(JwtAuthGuard)
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('search') search?: string) {
    return this.keys.list(user.userId, projectId, search);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateKeyDto) {
    return this.keys.create(user.userId, projectId, dto);
  }

  @Patch(':keyId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string, @Body() dto: UpdateKeyDto) {
    return this.keys.update(user.userId, projectId, keyId, dto);
  }

  @Delete(':keyId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('keyId') keyId: string) {
    return this.keys.remove(user.userId, projectId, keyId);
  }
}
