import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.service';
import { CreateTaskDto, UpdateTaskDto } from './dto';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('status') status?: string, @Query('assignee') assignee?: string) {
    return this.tasks.list(user.userId, projectId, status, assignee === 'me');
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.userId, projectId, dto);
  }

  @Patch(':taskId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user.userId, projectId, taskId, dto);
  }

  @Delete(':taskId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId', new ParseUUIDPipe()) projectId: string, @Param('taskId', new ParseUUIDPipe()) taskId: string) {
    return this.tasks.remove(user.userId, projectId, taskId);
  }
}
