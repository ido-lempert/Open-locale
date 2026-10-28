-- Per-key discussion threads, optionally scoped to one language
CREATE TABLE "comments" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "keyId"      UUID NOT NULL,
  "localeCode" TEXT,
  "body"       TEXT NOT NULL,
  "authorId"   UUID,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "comments_key_fkey" FOREIGN KEY ("keyId") REFERENCES "keys" ("id") ON DELETE CASCADE,
  CONSTRAINT "comments_author_fkey" FOREIGN KEY ("authorId") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "comments_key_created_idx" ON "comments" ("keyId", "createdAt");
