import { GitHubContentsClient } from './contents-client';
import { RepositoryCoordinates, repositoryUrl } from './repository-target';

// Deployment-managed read credential for one exact repository. No fallback to
// development publishing credentials or caller-supplied tokens. No stored grant.
export class RepositoryReadUnavailable extends Error {}
export function repositoryReader(target: RepositoryCoordinates) {
  repositoryUrl(target);
  const owner = process.env.GITHUB_READ_OWNER,
    repo = process.env.GITHUB_READ_REPO,
    token = process.env.GITHUB_READ_TOKEN;
  if (
    !owner ||
    !repo ||
    !token ||
    owner !== target.owner ||
    repo !== target.repo
  )
    throw new RepositoryReadUnavailable(
      'Repository read access is not configured for this target',
    );
  // Loopback is a fixture-only override; production transport remains fixed.
  const origin =
    process.env.NODE_ENV === 'test'
      ? process.env.GITHUB_READ_FIXTURE_ORIGIN
      : undefined;
  try {
    return new GitHubContentsClient(token, origin);
  } catch {
    throw new RepositoryReadUnavailable(
      'Repository read access configuration is invalid',
    );
  }
}
