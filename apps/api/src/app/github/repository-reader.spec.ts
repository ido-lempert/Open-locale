import { repositoryReader } from './repository-reader';
const target = {
  owner: 'owner',
  repo: 'repo',
  path: 'en.json',
  branch: 'main',
};
describe('deployment scoped repository read access', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });
  it('requires exact owner/repo/token, never caller or publishing fallback', () => {
    delete process.env.GITHUB_READ_OWNER;
    delete process.env.GITHUB_READ_REPO;
    delete process.env.GITHUB_READ_TOKEN;
    expect(() => repositoryReader(target)).toThrow('not configured');
    process.env.GITHUB_READ_OWNER = 'owner';
    process.env.GITHUB_READ_REPO = 'repo';
    process.env.GITHUB_READ_TOKEN = 'fixture';
    expect(() => repositoryReader(target)).not.toThrow();
    expect(() => repositoryReader({ ...target, owner: 'another' })).toThrow(
      'not configured',
    );
    expect(() => repositoryReader({ ...target, repo: 'another' })).toThrow(
      'not configured',
    );
  });
  it('sanitizes malformed token errors', () => {
    Object.assign(process.env, {
      GITHUB_READ_OWNER: 'owner',
      GITHUB_READ_REPO: 'repo',
      GITHUB_READ_TOKEN: 'bad token',
    });
    expect(() => repositoryReader(target)).toThrow('configuration is invalid');
  });
  it('rejects nonloopback fixture origins and ignores fixture override in production', () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      GITHUB_READ_OWNER: 'owner',
      GITHUB_READ_REPO: 'repo',
      GITHUB_READ_TOKEN: 'fixture',
      GITHUB_READ_FIXTURE_ORIGIN: 'https://evil.example',
    });
    expect(() => repositoryReader(target)).toThrow('configuration is invalid');
    process.env.NODE_ENV = 'production';
    expect(() => repositoryReader(target)).not.toThrow();
  });
  it('validates coordinates before credential selection', () => {
    expect(() => repositoryReader({ ...target, path: '../escape' })).toThrow(
      'Invalid repository path',
    );
  });
});
