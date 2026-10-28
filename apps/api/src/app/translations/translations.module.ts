import { Module } from '@nestjs/common';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';

@Module({
  imports: [AuthModule, ProjectsModule, WebhooksModule, SnapshotsModule],
  controllers: [TranslationsController],
  providers: [TranslationsService],
})
export class TranslationsModule {}
