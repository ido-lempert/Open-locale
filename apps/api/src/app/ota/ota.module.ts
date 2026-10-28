import { Module } from '@nestjs/common';
import { OtaController } from './ota.controller';
import { OtaService } from './ota.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [AuthModule, ProjectsModule, BranchesModule],
  controllers: [OtaController],
  providers: [OtaService],
})
export class OtaModule {}
