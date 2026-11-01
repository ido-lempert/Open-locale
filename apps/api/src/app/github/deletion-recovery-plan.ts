import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

// Internal read-only diagnostic, NOT authorization or a write precondition token.
// Any future executor must re-authorize and revalidate inside its write transaction.
export async function inspectDeletionRecovery(
  tx: Prisma.TransactionClient, projectId: string, auditId: string,
) {
  const deny = (reason: string) => ({ source: 'internal-deletion-recovery-plan' as const,
    eligible: false, reason, canRestore: false as const, snapshotIncluded: false as const });
  const audit = await tx.translationDeletionAudit.findFirst({ where: { id: auditId, projectId } });
  if (!audit) return deny('audit-unavailable');
  const serialized = JSON.stringify(audit.snapshot);
  if (Buffer.byteLength(serialized) > 512 * 1024) return deny('unsupported-snapshot');
  const snapshot = audit.snapshot as Record<string, unknown> | null;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return deny('unsupported-snapshot');
  const row = snapshot['row'] as Record<string, unknown> | null;
  const history = snapshot['history'];
  // Narrow candidate: flat value only. Archived history is retained,not replayed.
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      row['projectId'] !== projectId || row['keyId'] !== audit.keyId || row['localeCode'] !== audit.localeCode ||
      typeof row['value'] !== 'string' || row['pluralForms'] != null ||
      !Array.isArray(history) || history.length > 1000 || history.some(h =>
        !h || typeof h !== 'object' || Array.isArray(h) || h.keyId !== audit.keyId || h.localeCode !== audit.localeCode || typeof h.value !== 'string'))
    return deny('unsupported-snapshot');
  const key = await tx.key.findFirst({ where: { id: audit.keyId, projectId },
    select: { name: true, isPlural: true, maxLength: true, branchId: true, updatedAt: true } });
  if (!key || key.name !== audit.keyName) return deny('key-changed');
  if (key.isPlural || (key.maxLength !== null && [...row['value']].length > key.maxLength)) return deny('unsupported-current-key');
  const locale = await tx.projectLocale.findUnique({ where: { projectId_code: { projectId, code: audit.localeCode } } });
  if (!locale) return deny('locale-unavailable');
  if (await tx.translation.findUnique({ where: { keyId_localeCode: { keyId: audit.keyId, localeCode: audit.localeCode } }, select: { keyId: true } })) return deny('value-exists');
  const marker = await tx.repositoryRemovalGeneration.findUnique({ where: { projectId_keyId_locale: { projectId, keyId: audit.keyId, locale: audit.localeCode } } });
  if (marker?.auditId !== audit.id) return deny('deletion-generation-changed');
  return { source: 'internal-deletion-recovery-plan' as const, eligible: true, reason: 'current-flat-value-absence',
    auditId: audit.id, keyId: audit.keyId, branchId: key.branchId, keyUpdatedAt: key.updatedAt.toISOString(), locale: audit.localeCode,
    valueDigest: createHash('sha256').update(row['value']).digest('hex'),
    historyReplay: false as const, canRestore: false as const, snapshotIncluded: false as const };
}
