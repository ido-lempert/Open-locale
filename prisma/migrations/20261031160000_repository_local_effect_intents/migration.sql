CREATE TABLE "repository_local_effect_intents" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "projectId" UUID NOT NULL,
 "targetId" UUID NOT NULL, "actorId" UUID NOT NULL, "keyId" UUID NOT NULL,
 "keyName" TEXT NOT NULL, "branchId" UUID NOT NULL, "branch" TEXT NOT NULL,
 "locale" TEXT NOT NULL, "operation" TEXT NOT NULL, "value" TEXT,
 "draftContentDigest" TEXT NOT NULL, "previewFingerprint" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "repository_local_effect_intents_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "repository_local_effect_intents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "repository_local_effect_intents_operation_check" CHECK (("operation"='set-value' AND "value" IS NOT NULL) OR ("operation"='remove-locale-value' AND "value" IS NULL))
);
CREATE INDEX "repository_local_effect_intents_projectId_createdAt_idx" ON "repository_local_effect_intents"("projectId","createdAt");
