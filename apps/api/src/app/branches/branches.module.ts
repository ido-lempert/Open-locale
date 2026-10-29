import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { LocksModule } from '../locks/locks.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [AuthModule, ProjectsModule, LocksModule, SnapshotsModule, TasksModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
