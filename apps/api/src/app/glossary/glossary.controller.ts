import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GlossaryService } from './glossary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { GlossaryTermDto, UpdateGlossaryTermDto } from './dto';

@Controller('projects/:projectId/glossary')
@UseGuards(JwtAuthGuard)
export class GlossaryController {
  constructor(private readonly glossary: GlossaryService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.glossary.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: GlossaryTermDto) {
    return this.glossary.create(user.userId, projectId, dto);
  }

  @Patch(':termId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('termId') termId: string, @Body() dto: UpdateGlossaryTermDto) {
    return this.glossary.update(user.userId, projectId, termId, dto);
  }

  @Delete(':termId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('termId') termId: string) {
    return this.glossary.remove(user.userId, projectId, termId);
  }
}
