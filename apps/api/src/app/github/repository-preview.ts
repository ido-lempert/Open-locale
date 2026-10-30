import { createHash } from 'node:crypto';
import { GitHubContentsClient } from './contents-client';
import { parseSyncJson, previewSync } from './sync-preview';

export interface RepositoryTarget {
  owner: string;
  repo: string;
  path: string;
  branch: string;
}
export interface RepositoryBaseline {
  text: string;
  sha: string;
}
export function gitBlobSha(text: string): string {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1')
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

// Read-only orchestration. Caller owns project authorization and credential
// provenance. Never wired to HTTP request-supplied tokens or dev push secrets.
// Baseline bytes must match their stored SHA, but this check does NOT prove
// the baseline ever came from GitHub or was accepted as a sync baseline.
export class RepositoryPreview {
  constructor(private readonly contents: GitHubContentsClient) {}
  async preview(
    target: RepositoryTarget,
    baseline: RepositoryBaseline,
    localJson: string,
  ) {
    // Snapshot mutable caller objects before the first await so returned
    // scope and baseline identity cannot drift away from the actual request.
    target = { ...target };
    baseline = baseline && { ...baseline };
    if (!baseline || !/^[a-f0-9]{40}$/.test(baseline.sha))
      throw new Error('Baseline SHA required');
    const base = parseSyncJson(baseline.text),
      local = parseSyncJson(localJson);
    if (gitBlobSha(baseline.text) !== baseline.sha)
      throw new Error('Baseline blob SHA mismatch');
    const remote = await this.contents.read(
      target.owner,
      target.repo,
      target.path,
      target.branch,
    );
    const plan = previewSync(
      base,
      local,
      parseSyncJson(remote.text),
      remote.sha,
    );
    // Bind repository identity too: identical file content in another branch
    // or repository must never be treated as the same preview for execution.
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          target.owner,
          target.repo,
          target.path,
          target.branch,
          baseline.sha,
          plan.fingerprint,
        ]),
      )
      .digest('hex');
    return {
      ...plan,
      fingerprint,
      target: { ...target },
      baselineSha: baseline.sha,
      source: 'contents-adapter-read' as const,
      baselineProvenanceVerified: false as const,
      canApply: false as const,
    };
  }
}
