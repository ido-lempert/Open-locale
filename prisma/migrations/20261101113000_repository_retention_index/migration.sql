CREATE INDEX "repository_local_effect_intents_finishedAt_id_idx"
ON "repository_local_effect_intents" ("finishedAt", "id")
WHERE state IN ('completed', 'dead');
