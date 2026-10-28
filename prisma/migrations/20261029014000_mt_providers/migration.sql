CREATE TABLE "mt_providers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mt_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mt_providers_projectId_name_key" ON "mt_providers"("projectId", "name");

ALTER TABLE "mt_providers" ADD CONSTRAINT "mt_providers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
