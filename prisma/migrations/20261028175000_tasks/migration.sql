CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');

CREATE TABLE "tasks" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId"  UUID NOT NULL,
  "title"      TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status"     "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate"    TIMESTAMPTZ,
  "assigneeId" UUID,
  "creatorId"  UUID,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "tasks_project_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
  CONSTRAINT "tasks_assignee_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL,
  CONSTRAINT "tasks_creator_fkey" FOREIGN KEY ("creatorId") REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE INDEX "tasks_project_status_created_idx" ON "tasks" ("projectId", "status", "createdAt");
