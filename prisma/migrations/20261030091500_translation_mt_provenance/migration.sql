-- MT provenance on translations: set by pre-translate fills, cleared by
-- human edits, imports and restores. Existing rows are all human-written.
ALTER TABLE "translations" ADD COLUMN "mtScore" integer;
ALTER TABLE "translations" ADD COLUMN "mtProvider" text;
