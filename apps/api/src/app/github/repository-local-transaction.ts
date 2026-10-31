import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { lockRepositoryWriteScope } from './repository-write-scope';
import type { RepositoryWriteScope } from './repository-write-scope';
import { localDraftPlan } from './local-draft-plan';
import { writeExistingLocalValues } from './local-value-writer';
import type { LocalPreconditions } from './local-preconditions';

export interface ReviewedLocalDraft {
  scope: RepositoryWriteScope;
  local: LocalPreconditions;
  json: string;
  contentDigest: string;
  previewFingerprint: string;
}
// Isolated composition, no public execution caller. Parent must obtain trusted
// fresh reviewed sources and authenticate the actor. This does not read GitHub,
// deliver webhooks/automations or advance a baseline. TM pairs commit with values.
export async function repositoryLocalTransaction(
  tx: Prisma.TransactionClient,
  reviewed: ReviewedLocalDraft,
  expectedDraftDigest: string,
  expectedPreviewFingerprint: string,
) {
  // Preserve the reviewed values over asynchronous guard/lock acquisition.
  reviewed = JSON.parse(JSON.stringify(reviewed));
  if (
    !/^[a-f0-9]{64}$/.test(expectedDraftDigest) ||
    !/^[a-f0-9]{64}$/.test(expectedPreviewFingerprint) ||
    reviewed.contentDigest !== expectedDraftDigest ||
    reviewed.previewFingerprint !== expectedPreviewFingerprint ||
    createHash('sha256').update(reviewed.json).digest('hex') !==
      expectedDraftDigest
  )
    throw new Error('Reviewed repository draft binding changed');
  const { scope, local } = reviewed;
  if (
    scope.projectId !== local.projectId ||
    scope.branchId !== local.branchId ||
    scope.branch !== local.branch ||
    scope.locale !== local.locale
  )
    throw new Error('Repository draft local scope mismatch');
  // Re-derive operations from exact draft bytes, never caller-supplied changes.
  // Unsupported remote-only new keys fail here before any mutation.
  const plan = localDraftPlan(
    local.keys.map((k) => ({
      key: k.key,
      local: k.translation?.value ?? null,
    })),
    reviewed.json,
    expectedPreviewFingerprint,
  );
  await lockRepositoryWriteScope(tx, scope);
  const result = await writeExistingLocalValues(
    tx,
    local,
    plan.changes,
    scope.actorId,
  );
  // Durable facts in the SAME transaction, never network delivery under locks.
  // One intent per actual operation. A replay that fails local generations cannot
  // enqueue duplicates; a no-op draft has no effects. Scalar lineage survives
  // key/target/actor deletion; project deletion removes the private payload.
  if (plan.changes.length) {
    const keys = new Map(local.keys.map((key) => [key.key, key.keyId]));
    await tx.repositoryLocalEffectIntent.createMany({
      data: plan.changes.map((change) => ({
        projectId: scope.projectId, targetId: scope.targetId,
        actorId: scope.actorId, keyId: keys.get(change.key)!,
        keyName: change.key, branchId: scope.branchId, branch: scope.branch,
        locale: scope.locale, operation: change.action, value: change.nextValue,
        draftContentDigest: expectedDraftDigest,
        previewFingerprint: expectedPreviewFingerprint,
      })),
    });
  }
  return {
    ...result,
    pendingEffectIntents: plan.changes.length,
    draftContentDigest: expectedDraftDigest,
    previewFingerprint: expectedPreviewFingerprint,
    source: 'internal-repository-local-transaction' as const,
  };
}
