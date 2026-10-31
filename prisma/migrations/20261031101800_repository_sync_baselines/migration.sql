-- One current explicitly accepted remote snapshot, not a completed sync.
CREATE TABLE "repository_sync_baselines" (
 "targetId" UUID NOT NULL PRIMARY KEY,
 "version" INTEGER NOT NULL CHECK ("version" > 0),
 "targetRevision" INTEGER NOT NULL CHECK ("targetRevision" > 0),
 "remoteSha" TEXT NOT NULL,
 "contentDigest" TEXT NOT NULL,
 "text" TEXT NOT NULL,
 "actorId" UUID NOT NULL,
 "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "repository_sync_baselines_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "repository_sync_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
