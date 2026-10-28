-- Branches: keys belong to a branch; every project's existing keys move to a
-- new 'main' branch. Uniqueness moves from (project, name) to (branch, name).
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_projectId_name_key" ON "branches"("projectId", "name");

-- Default branch per project.
INSERT INTO "branches" ("id", "projectId", "name")
SELECT gen_random_uuid(), "id", 'main' FROM "projects";

ALTER TABLE "keys" ADD COLUMN "branchId" UUID;
UPDATE "keys" k SET "branchId" = b."id" FROM "branches" b
  WHERE b."projectId" = k."projectId" AND b."name" = 'main';
ALTER TABLE "keys" ALTER COLUMN "branchId" SET NOT NULL;

DROP INDEX "keys_projectId_name_key";
CREATE UNIQUE INDEX "keys_branchId_name_key" ON "keys"("branchId", "name");

ALTER TABLE "branches" ADD CONSTRAINT "branches_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "keys" ADD CONSTRAINT "keys_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
