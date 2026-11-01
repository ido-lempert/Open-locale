-- No legacy backfill: absence alone cannot establish a deletion generation.
ALTER TABLE repository_local_effect_intents ADD COLUMN "removalAuditId" UUID;
CREATE TABLE repository_removal_generations (
  "projectId" UUID NOT NULL, "keyId" UUID NOT NULL, locale TEXT NOT NULL,
  "auditId" UUID NOT NULL,
  CONSTRAINT repository_removal_generations_pkey PRIMARY KEY ("projectId","keyId",locale),
  CONSTRAINT repository_removal_generations_projectId_fkey FOREIGN KEY ("projectId") REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE
);
