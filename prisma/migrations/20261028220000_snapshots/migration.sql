-- CreateTable
CREATE TABLE "snapshots" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "keys" JSONB NOT NULL,
    "translations" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "snapshots_projectId_idx" ON "snapshots"("projectId");

-- AddForeignKey
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
