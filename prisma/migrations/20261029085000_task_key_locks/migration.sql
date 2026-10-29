ALTER TABLE "tasks" ADD COLUMN "lockKeys" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "task_keys" (
    "taskId" UUID NOT NULL,
    "keyId" UUID NOT NULL,

    CONSTRAINT "task_keys_pkey" PRIMARY KEY ("taskId", "keyId")
);

ALTER TABLE "task_keys" ADD CONSTRAINT "task_keys_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_keys" ADD CONSTRAINT "task_keys_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "task_keys_keyId_idx" ON "task_keys"("keyId");
