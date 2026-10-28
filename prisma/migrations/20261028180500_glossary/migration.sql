CREATE TABLE "glossary_terms" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"  UUID NOT NULL,
  "term"       TEXT NOT NULL,
  "notes"      TEXT NOT NULL DEFAULT '',
  "doNotTranslate" BOOLEAN NOT NULL DEFAULT false,
  "translations" JSONB NOT NULL DEFAULT '{}',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "glossary_terms_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "glossary_terms_project_term_key" ON "glossary_terms" ("projectId", "term");
