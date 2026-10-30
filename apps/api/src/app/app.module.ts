import { LocalSyncPreviewModule } from './github/sync-preview.controller';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { KeysModule } from './keys/keys.module';
import { TranslationsModule } from './translations/translations.module';
import { ActivityModule } from './activity/activity.module';
import { TasksModule } from './tasks/tasks.module';
import { GlossaryModule } from './glossary/glossary.module';
import { QaModule } from './qa/qa.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DocsController } from './docs/docs.controller';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { LocksModule } from './locks/locks.module';
import { BranchesModule } from './branches/branches.module';
import { OtaModule } from './ota/ota.module';
import { MtModule } from './mt/mt.module';
import { AutomationsModule } from './automations/automations.module';
import { ReportsModule } from './reports/reports.module';
import { EmbedModule } from './embed/embed.module';

@Module({
  imports: [LocalSyncPreviewModule, PrismaModule, AuthModule, ProjectsModule, KeysModule, TranslationsModule, ActivityModule, TasksModule, GlossaryModule, QaModule, WebhooksModule, SnapshotsModule, LocksModule, BranchesModule, OtaModule, MtModule, AutomationsModule, ReportsModule, EmbedModule],
  controllers: [AppController, DocsController],
  providers: [AppService],
})
export class AppModule {}
