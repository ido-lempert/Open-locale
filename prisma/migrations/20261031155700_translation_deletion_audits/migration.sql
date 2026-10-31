CREATE TABLE "translation_deletion_audits" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "projectId" UUID NOT NULL,
 "keyId" UUID NOT NULL, "keyName" TEXT NOT NULL, "localeCode" TEXT NOT NULL,
 "actorId" UUID, "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "translation_deletion_audits_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "translation_deletion_audits_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "translation_deletion_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "translation_deletion_audits_projectId_createdAt_idx" ON "translation_deletion_audits"("projectId","createdAt");
