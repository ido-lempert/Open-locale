import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { AddLocaleDto, AddMemberDto, CreateGroupDto, CreateProjectDto, UpdateGroupDto, UpdateMemberDto, UpdateProjectDto } from './dto';

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

  @Post(':id/members')
  addMember(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: AddMemberDto) {
    return this.projects.addMember(user.userId, id, dto.email, dto.role ?? 'MEMBER', dto.allowedLocales ?? []);
  }

  @Patch(':id/members/:userId')
  updateMember(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateMemberDto) {
    return this.projects.updateMember(user.userId, id, userId, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projects.removeMember(user.userId, id, userId);
  }

  @Get(':id/groups')
  listGroups(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.projects.listGroups(user.userId, id);
  }

  @Post(':id/groups')
  createGroup(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: CreateGroupDto) {
    return this.projects.createGroup(user.userId, id, dto.name, dto.role, dto.allowedLocales ?? []);
  }

  @Patch(':id/groups/:groupId')
  updateGroup(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return this.projects.updateGroup(user.userId, id, groupId, dto);
  }

  @Delete(':id/groups/:groupId')
  deleteGroup(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('groupId') groupId: string) {
    return this.projects.deleteGroup(user.userId, id, groupId);
  }

  @Put(':id/groups/:groupId/members/:userId')
  addGroupMember(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('groupId') groupId: string, @Param('userId') targetUserId: string) {
    return this.projects.addGroupMember(user.userId, id, groupId, targetUserId);
  }

  @Delete(':id/groups/:groupId/members/:userId')
  removeGroupMember(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Param('groupId') groupId: string, @Param('userId') targetUserId: string) {
    return this.projects.removeGroupMember(user.userId, id, groupId, targetUserId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.projects.getFor(user.userId, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthPrincipal, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    // Embed origins grant a host page a postMessage channel into the embedded
    // editor. Like OTA publish and branch management, a leaked CI/SDK token
    // must not be able to widen that trust boundary - session principals only.
    if (dto.embedOrigins !== undefined && user.via !== 'jwt') {
      throw new ForbiddenException('Embed origin management requires a signed-in session, not an API token');
    }
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
