import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { BranchesModule } from '../branches/branches.module';
import { LocksModule } from '../locks/locks.module';

@Module({
  imports: [AuthModule, ProjectsModule, BranchesModule, LocksModule],
  controllers: [KeysController],
  providers: [KeysService],
})
export class KeysModule {}
