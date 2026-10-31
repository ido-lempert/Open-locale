-- Existing intents lack generation evidence and must fail eligibility closed.
ALTER TABLE "repository_local_effect_intents"
 ADD COLUMN "targetRevision" INTEGER,
 ADD COLUMN "translationRowId" UUID,
 ADD COLUMN "translationVersion" INTEGER;
