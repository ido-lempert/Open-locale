import type { Prisma } from '@prisma/client';

// Lock before evaluating the clock/token. A blocked checkpoint writer must not
// use eligibility observed before a lease reclaim/expiry. No effect/network here.
export async function checkpointRepositoryRule(
  tx: Prisma.TransactionClient, intentId: string, token: string,
  rule: { id: string; revision: number },
) {
  await tx.$queryRaw`SELECT id FROM repository_local_effect_intents
    WHERE id=${intentId}::uuid FOR UPDATE`;
  const rows = await tx.$queryRaw<{ ruleId: string }[]>`
    INSERT INTO repository_automation_rule_checkpoints ("intentId","ruleId","ruleRevision")
    SELECT id,${rule.id}::uuid,${rule.revision} FROM repository_local_effect_intents
    WHERE id=${intentId}::uuid AND state='leased'
      AND "leaseToken"=${token}::uuid AND "leaseUntil">clock_timestamp()
    ON CONFLICT ("intentId","ruleId") DO NOTHING RETURNING "ruleId"`;
  return rows.length === 1;
}
