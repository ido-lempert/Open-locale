import { Module } from '@nestjs/common';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { ActivityModule } from '../activity/activity.module';
import { MtModule } from '../mt/mt.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [AuthModule, ProjectsModule, ActivityModule, MtModule, TasksModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
