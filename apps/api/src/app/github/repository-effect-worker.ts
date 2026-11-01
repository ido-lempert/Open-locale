import { Injectable, Logger, BeforeApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AutomationsService } from '../automations/automations.service';
import { runRepositoryEffectStep } from './repository-effect-step';

// Explicit deployment opt-in. No public apply endpoint or automatic local writes.
// One bounded queue step per tick; leases coordinate multiple processes.
@Injectable()
export class RepositoryEffectWorker implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger('RepositoryEffects');
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  private stopped = false;
  constructor(private readonly db: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly automations: AutomationsService) {}

  onModuleInit() {
    if (process.env.REPOSITORY_EFFECT_WORKER_ENABLED !== 'true' || this.timer || this.stopped) return;
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref();
  }
  private tick() {
    if (this.stopped || this.inFlight) return;
    this.inFlight = runRepositoryEffectStep(this.db, this.webhooks, this.automations)
      .then(() => undefined)
      .catch(() => { this.logger.warn('Repository effect step failed'); })
      .finally(() => { this.inFlight = undefined; });
  }
  async beforeApplicationShutdown() {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    await this.inFlight;
  }
}
