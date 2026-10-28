import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
