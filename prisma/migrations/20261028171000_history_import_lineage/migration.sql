-- History lineage: previous value + import batch id
ALTER TABLE "translation_history"
  ADD COLUMN "previousValue" TEXT,
  ADD COLUMN "importId" UUID;

CREATE INDEX "translation_history_import_idx" ON "translation_history" ("importId");
