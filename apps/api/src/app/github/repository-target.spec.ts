import { repositoryUrl } from './repository-target';
const target = {
  owner: 'owner',
  repo: 'repo',
  path: 'locales/en.json',
  branch: 'feature/test',
};
describe('shared repository coordinate validation', () => {
  it('preserves explicit slash branch and encodes path segments', () => {
    expect(repositoryUrl({ ...target, path: 'locales/he שלום.json' })).toBe(
      'https://api.github.com/repos/owner/repo/contents/locales/he%20%D7%A9%D7%9C%D7%95%D7%9D.json',
    );
  });
  it('rejects non-string coordinates without coercion', () => {
    for (const field of ['owner', 'repo', 'path', 'branch'])
      for (const value of [undefined, null, 42, {}, []])
        expect(() =>
          repositoryUrl({ ...target, [field]: value } as never),
        ).toThrow();
  });
  it('rejects traversal, separators and control bytes', () => {
    for (const path of [
      '/absolute',
      'a//b',
      'a/../b',
      'a/./b',
      'a\\b',
      'a\u0000b',
    ])
      expect(() => repositoryUrl({ ...target, path })).toThrow();
  });
  it('bounds each coordinate and rejects empty values', () => {
    for (const [field, value] of Object.entries({
      owner: 'a'.repeat(40),
      repo: 'a'.repeat(101),
      path: 'x'.repeat(1025),
      branch: 'x'.repeat(256),
    }))
      expect(() => repositoryUrl({ ...target, [field]: value })).toThrow();
    for (const field of ['owner', 'repo', 'path', 'branch'])
      expect(() => repositoryUrl({ ...target, [field]: '' })).toThrow();
  });
  it('rejects URL-shaped owner and whitespace branch, encodes literal percent path', () => {
    expect(() =>
      repositoryUrl({ ...target, owner: 'https://evil.example' }),
    ).toThrow();
    expect(() => repositoryUrl({ ...target, branch: 'bad branch' })).toThrow();
    expect(repositoryUrl({ ...target, path: '%2e%2e/en.json' })).toContain(
      '/contents/%252e%252e/en.json',
    );
  });
});
