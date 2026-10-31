// Shared configuration validation. A target is not a connected repository,
// credential grant, accepted baseline or permission to read/write remotely.
export interface RepositoryCoordinates {
  owner: string;
  repo: string;
  path: string;
  branch: string;
}
export function repositoryUrl(
  target: RepositoryCoordinates,
  origin = 'https://api.github.com',
) {
  const { owner, repo, path, branch } = target;
  if (
    typeof owner !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner) ||
    typeof repo !== 'string' ||
    !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) ||
    ['.', '..'].includes(repo)
  )
    throw new Error('Invalid repository');
  if (
    typeof path !== 'string' ||
    !path ||
    Buffer.byteLength(path) > 1024 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    /[\x00-\x1f\x7f]/.test(path) ||
    path.split('/').some((p) => !p || p === '.' || p === '..')
  )
    throw new Error('Invalid repository path');
  if (
    typeof branch !== 'string' ||
    !branch ||
    branch.length > 255 ||
    /[\x00-\x20\x7f]/.test(branch)
  )
    throw new Error('Invalid branch');
  return `${origin}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}
