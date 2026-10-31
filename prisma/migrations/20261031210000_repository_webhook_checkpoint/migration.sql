-- Handler bookkeeping only, not a receiver receipt. Existing rows retry channel.
ALTER TABLE "repository_local_effect_intents" ADD COLUMN "webhookHandledAt" TIMESTAMP(3);
