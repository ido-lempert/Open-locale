-- Screenshots attached to keys: binary payloads in Postgres for Phase 1
-- (2MB cap enforced in the API), object storage is a Phase 2 scale item.
CREATE TABLE "screenshots" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keyId"      UUID NOT NULL,
  "projectId"  UUID NOT NULL,
  "filename"   TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL,
  "byteSize"   INTEGER NOT NULL,
  "data"       BYTEA NOT NULL,
  "uploadedById" UUID,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "screenshots_key_fkey" FOREIGN KEY ("keyId") REFERENCES "keys" ("id") ON DELETE CASCADE,
  CONSTRAINT "screenshots_uploader_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "screenshots_key_created_idx" ON "screenshots" ("keyId", "createdAt");
