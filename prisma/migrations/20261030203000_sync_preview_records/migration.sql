-- Diagnostic preview history only. No file values, credentials or executable status.
CREATE TABLE "sync_preview_records" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "branch" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "remoteSha" TEXT NOT NULL,
  "summary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sync_preview_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sync_preview_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sync_preview_records_projectId_createdAt_idx" ON "sync_preview_records"("projectId", "createdAt");
