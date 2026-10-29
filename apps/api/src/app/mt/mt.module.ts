import { Module } from '@nestjs/common';
import { MtController } from './mt.controller';
import { MtService } from './mt.service';
import { ProjectsModule } from '../projects/projects.module';
import { ActivityModule } from '../activity/activity.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ProjectsModule, ActivityModule, WebhooksModule, AuthModule],
  controllers: [MtController],
  providers: [MtService],
  exports: [MtService],
})
export class MtModule {}
