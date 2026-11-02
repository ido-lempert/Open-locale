import { LocalRecoveryInput, RepositoryTargetConfig } from '../api.service';

// Client preparation guard only. The API revalidates authority and current state.
export function reviewedRecoveryInput(raw: unknown, target: RepositoryTargetConfig): LocalRecoveryInput | undefined {
  if (!raw || typeof raw !== 'object') return;
  const { recovery, repository } = raw as Record<string, unknown>;
  if (!recovery || typeof recovery !== 'object' || !repository || typeof repository !== 'object') return;
  const r=recovery as Record<string,unknown>,repo=repository as Record<string,unknown>;
  const positive = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 2147483647;
  const matches = (s: unknown, re: RegExp): s is string => typeof s === 'string' && re.test(s);
  if (!matches(r['expectedBranchId'], /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i) ||
      !matches(r['expectedKeyUpdatedAt'], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) ||
      !Number.isFinite(Date.parse(r['expectedKeyUpdatedAt'])) ||
      !positive(r['expectedKeyRevision']) || !matches(r['expectedValueDigest'], /^[a-f0-9]{64}$/) ||
      !positive(repo['targetRevision']) || repo['targetRevision'] !== target.revision || repo['targetId'] !== target.id ||
      !matches(repo['branch'], /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,39}$/) || repo['branch'] !== target.localBranch ||
      typeof repo['locale'] !== 'string' || !repo['locale'].length || repo['locale'].length > 64 || repo['locale'] !== target.locale ||
      !positive(repo['baselineVersion']) || !matches(repo['baselineSha'], /^[a-f0-9]{40}$/) ||
      !matches(repo['baselineDigest'], /^[a-f0-9]{64}$/)) return;
  return { confirmation: 'recover-local-value', expectedBranchId: r['expectedBranchId'],
    expectedKeyUpdatedAt: r['expectedKeyUpdatedAt'], expectedKeyRevision: r['expectedKeyRevision'],
    expectedValueDigest: r['expectedValueDigest'], targetRevision: repo['targetRevision'],
    branch: repo['branch'], locale: repo['locale'], baselineVersion: repo['baselineVersion'],
    baselineSha: repo['baselineSha'], baselineDigest: repo['baselineDigest'] };
}
