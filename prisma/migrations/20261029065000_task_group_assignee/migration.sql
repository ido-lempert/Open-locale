ALTER TABLE "tasks" ADD COLUMN "assigneeGroupId" UUID;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeGroupId_fkey" FOREIGN KEY ("assigneeGroupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_single_assignee" CHECK ("assigneeId" IS NULL OR "assigneeGroupId" IS NULL);

CREATE INDEX "tasks_assigneeGroupId_idx" ON "tasks"("assigneeGroupId");
