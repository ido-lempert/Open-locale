CREATE TABLE repository_automation_rule_checkpoints (
  "intentId" UUID NOT NULL REFERENCES repository_local_effect_intents(id) ON DELETE CASCADE,
  "ruleId" UUID NOT NULL,
  "ruleRevision" INTEGER NOT NULL,
  "handledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("intentId", "ruleId")
);
