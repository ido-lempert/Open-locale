-- Webhooks: per-project HTTP callbacks signed with an HMAC secret.
CREATE TABLE "webhooks" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "webhooks"
  ADD CONSTRAINT "webhooks_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE;
