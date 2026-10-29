ALTER TABLE "tasks" ADD COLUMN "dependsOnId" UUID;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_no_self_dependency" CHECK ("id" <> "dependsOnId");

CREATE INDEX "tasks_dependsOnId_idx" ON "tasks"("dependsOnId");
