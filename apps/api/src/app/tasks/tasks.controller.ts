import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  list(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Query('status') status?: string) {
    return this.tasks.list(user.userId, projectId, status);
  }

  @Post()
  create(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user.userId, projectId, dto);
  }

  @Patch(':taskId')
  update(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string,
    @Param('taskId') taskId: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(user.userId, projectId, taskId, dto);
  }

  @Delete(':taskId')
  remove(@CurrentUser() user: AuthPrincipal, @Param('projectId') projectId: string, @Param('taskId') taskId: string) {
    return this.tasks.remove(user.userId, projectId, taskId);
  }
}
