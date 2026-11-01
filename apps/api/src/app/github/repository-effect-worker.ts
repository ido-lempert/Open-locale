import { Injectable, Logger, BeforeApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AutomationsService } from '../automations/automations.service';
import { runRepositoryEffectStep } from './repository-effect-step';
import { pruneRepositoryEffects } from './repository-effect-retention';

// Explicit deployment opt-ins. No automatic local value writes.
// One bounded queue step per tick; leases coordinate multiple processes.
@Injectable()
export class RepositoryEffectWorker implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger('RepositoryEffects');
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  private stopped = false;
  private effectsEnabled = false;
  private retentionEnabled = false;
  private nextRetentionAt = 0;
  constructor(private readonly db: PrismaService,
    private readonly webhooks: WebhooksService,
    private readonly automations: AutomationsService) {}

  onModuleInit() {
    if (this.timer || this.stopped) return;
    this.effectsEnabled = process.env.REPOSITORY_EFFECT_WORKER_ENABLED === 'true';
    this.retentionEnabled = process.env.REPOSITORY_EFFECT_RETENTION_ENABLED === 'true';
    if (!this.effectsEnabled && !this.retentionEnabled) return;
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref();
  }
  private tick() {
    if (this.stopped || this.inFlight) return;
    this.inFlight = this.runTick()
      .then(() => undefined)
      .catch(() => { this.logger.warn('Repository effect step failed'); })
      .finally(() => { this.inFlight = undefined; });
  }
  private async runTick() {
    try {
      if (this.effectsEnabled) await runRepositoryEffectStep(this.db, this.webhooks, this.automations);
    } finally {
    // Independent opt-in cleanup still gets its due attempt after effect failure.
    // A long-running effect can still defer this; no real-time guarantee.
    if (!this.stopped && this.retentionEnabled && Date.now() >= this.nextRetentionAt) {
      // At most one bounded cleanup/minute per process, shared non-overlap/drain.
      // Set before attempt so a failure cannot cause aggressive5sec retries.
      this.nextRetentionAt = Date.now() + 60000;
      await this.db.$transaction(pruneRepositoryEffects);
    }
    }
  }
  async beforeApplicationShutdown() {
    this.stopped = true;
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
    await this.inFlight;
  }
}
