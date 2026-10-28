import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { AddLocaleDto, CreateProjectDto, UpdateProjectDto } from './dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.projects.listFor(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateProjectDto) {
    return this.projects.createFor(user.userId, dto);
  }

  @Get(':id/members')
  listMembers(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.projects.listMembers(user.userId, id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.projects.getFor(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.updateFor(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.projects.removeFor(user.userId, id);
  }

  @Post(':id/locales')
  addLocale(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: AddLocaleDto) {
    return this.projects.addLocale(user.userId, id, dto.code);
  }

  @Delete(':id/locales/:code')
  removeLocale(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('code') code: string) {
    return this.projects.removeLocale(user.userId, id, code);
  }
}
