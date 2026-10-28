CREATE TABLE "activity_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "actorId" UUID,
  "action" TEXT NOT NULL,
  "keyName" TEXT,
  "localeCode" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "activity_events_projectId_createdAt_idx" ON "activity_events"("projectId", "createdAt");
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
