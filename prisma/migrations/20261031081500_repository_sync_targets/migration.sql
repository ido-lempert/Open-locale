-- Configuration only: no secret, accepted baseline or execution status.
CREATE TABLE "repository_sync_targets" (
 "id" UUID NOT NULL,
 "projectId" UUID NOT NULL,
 "branchId" UUID NOT NULL,
 "localBranch" TEXT NOT NULL,
 "locale" TEXT NOT NULL,
 "owner" TEXT NOT NULL,
 "repo" TEXT NOT NULL,
 "path" TEXT NOT NULL,
 "remoteBranch" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "repository_sync_targets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "repository_sync_targets_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "repository_sync_targets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "repository_sync_targets_projectId_localBranch_locale_key" ON "repository_sync_targets"("projectId","localBranch","locale");
