CREATE INDEX "translation_deletion_audits_projectId_createdAt_id_idx"
ON "translation_deletion_audits" ("projectId", "createdAt", "id");
DROP INDEX "translation_deletion_audits_projectId_createdAt_idx";
