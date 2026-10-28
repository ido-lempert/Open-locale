import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [AuthModule, ProjectsModule, BranchesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
