-- Translation review statuses + full version history
CREATE TYPE "TranslationStatus" AS ENUM ('UNVERIFIED', 'TRANSLATED', 'REVIEWED');

ALTER TABLE "translations"
  ADD COLUMN "status" "TranslationStatus" NOT NULL DEFAULT 'UNVERIFIED';

CREATE TABLE "translation_history" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keyId"        UUID NOT NULL,
  "localeCode"   TEXT NOT NULL,
  "value"        TEXT NOT NULL,
  "status"       "TranslationStatus" NOT NULL,
  "changedById"  UUID,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "translation_history_translation_fkey"
    FOREIGN KEY ("keyId", "localeCode")
    REFERENCES "translations" ("keyId", "localeCode") ON DELETE CASCADE,
  CONSTRAINT "translation_history_changedBy_fkey"
    FOREIGN KEY ("changedById") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "translation_history_key_locale_created_idx"
  ON "translation_history" ("keyId", "localeCode", "createdAt");
