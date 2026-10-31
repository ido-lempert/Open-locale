ALTER TABLE "repository_local_effect_intents"
 ADD COLUMN "state" TEXT NOT NULL DEFAULT 'pending',
 ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "leaseToken" UUID,
 ADD COLUMN "leaseUntil" TIMESTAMP(3),
 ADD COLUMN "finishedAt" TIMESTAMP(3),
 ADD CONSTRAINT "repository_effect_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3),
 ADD CONSTRAINT "repository_effect_state_check" CHECK (
  ("state"='pending' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL AND "finishedAt" IS NULL) OR
  ("state"='leased' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL AND "finishedAt" IS NULL) OR
  ("state" IN ('completed','dead') AND "leaseToken" IS NULL AND "leaseUntil" IS NULL AND "finishedAt" IS NOT NULL)
 );
CREATE INDEX "repository_local_effect_intents_state_availableAt_idx" ON "repository_local_effect_intents"("state","availableAt");
