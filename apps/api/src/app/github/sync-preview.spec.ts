import { parseSyncJson, previewSync } from './sync-preview';
const sha = 'a'.repeat(40);
describe('flat JSON sync preview (no mutations)', () => {
  it('classifies unchanged/local-only/remote-only/converged/conflict', () => {
    const p = previewSync(
      { same: 'v', l: 'old', r: 'old', both: 'old', conflict: 'old' },
      { same: 'v', l: 'local', r: 'old', both: 'new', conflict: 'local' },
      { same: 'v', l: 'old', r: 'remote', both: 'new', conflict: 'remote' },
      sha,
    );
    expect(p.decisions.map((d) => [d.key, d.kind, d.suggested])).toEqual([
      ['both', 'converged', 'none'],
      ['conflict', 'conflict', 'manual'],
      ['l', 'local-only', 'push'],
      ['r', 'remote-only', 'pull'],
      ['same', 'unchanged', 'none'],
    ]);
    expect(p.requiresManual).toBe(true);
  });
  it('distinguishes missing from empty and never auto-deletes', () => {
    const p = previewSync(
      { deleted: 'v', empty: 'v' },
      { empty: '' },
      { deleted: 'v', empty: 'v' },
      sha,
    );
    expect(p.decisions[0]).toMatchObject({
      key: 'deleted',
      local: null,
      suggested: 'manual',
    });
    expect(p.decisions[1]).toMatchObject({
      key: 'empty',
      local: '',
      suggested: 'push',
    });
  });
  it('handles additions in both directions without inventing baseline', () => {
    expect(
      previewSync({}, { l: 'v' }, { r: 'v' }, sha).decisions.map(
        (d) => d.suggested,
      ),
    ).toEqual(['push', 'pull']);
  });
  it('does not mutate input maps', () => {
    const b = Object.freeze({ a: 'b' }),
      l = Object.freeze({ a: 'l' }),
      r = Object.freeze({ a: 'r' });
    previewSync(b, l, r, sha);
    expect(b.a).toBe('b');
    expect(l.a).toBe('l');
    expect(r.a).toBe('r');
  });
  it('fingerprint ignores map order but binds all content and remote SHA', () => {
    const p = previewSync(
      { a: '1', b: '2' },
      { a: '1', b: '2' },
      { a: '1', b: '2' },
      sha,
    );
    expect(
      previewSync(
        { b: '2', a: '1' },
        { b: '2', a: '1' },
        { b: '2', a: '1' },
        sha,
      ).fingerprint,
    ).toBe(p.fingerprint);
    expect(
      previewSync(
        { a: '1', b: '2' },
        { a: 'changed', b: '2' },
        { a: '1', b: '2' },
        sha,
      ).fingerprint,
    ).not.toBe(p.fingerprint);
    expect(
      previewSync(
        { a: '1', b: '2' },
        { a: '1', b: '2' },
        { a: '1', b: '2' },
        'b'.repeat(40),
      ).fingerprint,
    ).not.toBe(p.fingerprint);
  });
  it('parses flat maps with braces, commas and escaped strings safely', () => {
    expect(parseSyncJson('{"a":"x,{}\\\"","b":""}')).toEqual({
      a: 'x,{}"',
      b: '',
    });
  });
  it.each(['{"a":"one","a":"two"}', '{"a":"one","\\u0061":"two"}'])(
    'rejects duplicate properties %s',
    (text) => {
      expect(() => parseSyncJson(text)).toThrow('Duplicate');
    },
  );
  it.each([
    '[]',
    'null',
    '{"a":1}',
    '{"a":{"b":"c"}}',
    '{"a":["b"]}',
    '{"__proto__":"x"}',
    '{"constructor":"x"}',
  ])('rejects unsupported JSON shape %s', (text) => {
    expect(() => parseSyncJson(text)).toThrow();
  });
  it('rejects non-flat duplicate values even if overwritten by a string', () => {
    expect(() => parseSyncJson('{"a":{"b":"c"},"a":"ok"}')).toThrow();
    expect(() => parseSyncJson('{"a":1,"a":"ok"}')).toThrow();
  });
  it('rejects malformed JSON, invalid SHA and overlarge maps', () => {
    expect(() => parseSyncJson('{')).toThrow('Malformed');
    expect(() => previewSync({}, {}, {}, '')).toThrow('SHA');
    expect(() =>
      parseSyncJson(JSON.stringify({ a: 'x'.repeat(512 * 1024) })),
    ).toThrow('bounds');
  });
});

describe('preview bounds and missing-key conflict edges', () => {
  it('remote removal and delete-versus-edit require manual resolution', () => {
    expect(
      previewSync({ a: 'old' }, { a: 'old' }, {}, sha).decisions[0],
    ).toMatchObject({ kind: 'remote-only', suggested: 'manual' });
    expect(
      previewSync({ a: 'old' }, { a: 'new' }, {}, sha).decisions[0],
    ).toMatchObject({ kind: 'conflict', suggested: 'manual' });
    expect(previewSync({ a: 'old' }, {}, {}, sha).decisions[0]).toMatchObject({
      kind: 'converged',
      suggested: 'none',
    });
  });
  it('bounds total key union even when each input is within limit', () => {
    const map = (prefix: string) =>
      Object.fromEntries(
        Array.from({ length: 5001 }, (_, i) => [prefix + i, 'v']),
      );
    expect(() => previewSync({}, map('a'), map('b'), sha)).toThrow('union');
  });
  it('bounds individual key counts and lengths', () => {
    expect(() =>
      previewSync(
        {},
        Object.fromEntries(
          Array.from({ length: 10001 }, (_, i) => [String(i), 'v']),
        ),
        {},
        sha,
      ),
    ).toThrow('bounds');
    expect(() =>
      parseSyncJson(JSON.stringify({ ['x'.repeat(501)]: 'v' })),
    ).toThrow('key');
    expect(() => parseSyncJson('{"\\u0000":"v"}')).toThrow('key');
  });
  it('does not expand dotted keys into objects', () => {
    expect(parseSyncJson('{"a":"scalar","a.b":"flat"}')).toEqual({
      a: 'scalar',
      'a.b': 'flat',
    });
    expect(previewSync({}, {}, { 'a.b': 'flat' }, sha).decisions[0].key).toBe(
      'a.b',
    );
  });
});
