-- OTA publications: immutable per-branch translation bundles, authenticated pull only.
CREATE TABLE "ota_publications" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ota_publications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ota_publications_projectId_branchId_version_key" ON "ota_publications"("projectId", "branchId", "version");

ALTER TABLE "ota_publications" ADD CONSTRAINT "ota_publications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ota_publications" ADD CONSTRAINT "ota_publications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
