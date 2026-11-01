import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AutomationsModule } from '../automations/automations.module';
import { RepositoryEffectWorker } from './repository-effect-worker';

@Module({ imports: [PrismaModule, WebhooksModule, AutomationsModule],
  providers: [RepositoryEffectWorker] })
export class RepositoryEffectsModule {}
