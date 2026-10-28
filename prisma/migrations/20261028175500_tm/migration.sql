-- Translation memory: project-scoped source->target pairs, auto-populated on
-- save and import. keyId is lineage metadata, not a FK - memory outlives keys.
-- sourceLocaleCode keeps the pair's locale identity explicit (Phase 1 sources
-- from the project base locale).
CREATE TABLE "tm_entries" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"  UUID NOT NULL,
  "sourceLocaleCode" TEXT NOT NULL,
  "localeCode" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "targetText" TEXT NOT NULL,
  "keyId"      UUID,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tm_entries_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "tm_entries_pair_key" ON "tm_entries" ("projectId", "localeCode", "sourceLocaleCode", "sourceText");
CREATE INDEX "tm_entries_project_locale_idx" ON "tm_entries" ("projectId", "localeCode");
