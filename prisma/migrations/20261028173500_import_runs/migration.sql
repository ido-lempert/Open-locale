-- Recoverable import runs: the row is created before any key is touched and its
-- counters move inside the same transaction as each key change, so a crash
-- leaves accurate audited progress instead of silent partial imports.
CREATE TABLE "import_runs" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"  UUID NOT NULL,
  "localeCode" TEXT NOT NULL,
  "actorId"    UUID,
  "status"     TEXT NOT NULL DEFAULT 'RUNNING',
  "keysCreated" INTEGER NOT NULL DEFAULT 0,
  "translationsUpserted" INTEGER NOT NULL DEFAULT 0,
  "unchangedSkipped" INTEGER NOT NULL DEFAULT 0,
  "failed"     INTEGER NOT NULL DEFAULT 0,
  "error"      TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "import_runs_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
  CONSTRAINT "import_runs_actor_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "import_runs_project_created_idx" ON "import_runs" ("projectId", "createdAt");
