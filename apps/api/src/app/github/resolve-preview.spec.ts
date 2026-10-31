import { parseSyncJson, previewSync } from './sync-preview';
import { resolvePreview, ResolutionInput } from './resolve-preview';
const sha = 'a'.repeat(40);
function input(
  base: string,
  local: string,
  remote: string,
  choices: ResolutionInput['choices'],
): ResolutionInput {
  return {
    baselineJson: base,
    localJson: local,
    remoteJson: remote,
    remoteSha: sha,
    expectedFingerprint: previewSync(
      parseSyncJson(base),
      parseSyncJson(local),
      parseSyncJson(remote),
      sha,
    ).fingerprint,
    choices,
  };
}
describe('explicit sync preview draft resolution', () => {
  it('requires an explicit choice for each differing key, not only conflicts', () => {
    const i = input(
      '{"a":"old","b":"old","c":"old"}',
      '{"a":"local","b":"old","c":"L"}',
      '{"a":"old","b":"remote","c":"R"}',
      { a: 'local', b: 'remote', c: 'base' },
    );
    expect(JSON.parse(resolvePreview(i).json)).toEqual({
      a: 'local',
      b: 'remote',
      c: 'old',
    });
    expect(() => resolvePreview({ ...i, choices: { c: 'local' } })).toThrow(
      'every differing',
    );
  });
  it('carries unchanged/converged values without choices and never grants apply', () => {
    const r = resolvePreview(
      input(
        '{"a":"same","b":"old"}',
        '{"a":"same","b":"new"}',
        '{"a":"same","b":"new"}',
        {},
      ),
    );
    expect(JSON.parse(r.json)).toEqual({ a: 'same', b: 'new' });
    expect(r).toMatchObject({
      canApply: false,
      baselineProvenanceVerified: false,
      explicitChoices: 0,
      outputKeys: 2,
      absentKeys: 0,
    });
  });
  it('distinguishes chosen absence from empty string', () => {
    const r = resolvePreview(
      input(
        '{"a":"old","b":"old"}',
        '{"b":""}',
        '{"a":"remote","b":"remote"}',
        { a: 'local', b: 'local' },
      ),
    );
    expect(JSON.parse(r.json)).toEqual({ b: '' });
    expect(r.absentKeys).toBe(1);
  });
  it('rejects stale local/remote/baseline/SHA against exact preview fingerprint', () => {
    const i = input('{"a":"old"}', '{"a":"local"}', '{"a":"remote"}', {
      a: 'remote',
    });
    for (const changed of [
      { baselineJson: '{}' },
      { localJson: '{}' },
      { remoteJson: '{}' },
      { remoteSha: 'b'.repeat(40) },
    ])
      expect(() => resolvePreview({ ...i, ...changed })).toThrow(
        'Preview changed',
      );
  });
  it('rejects extra, invalid, inherited and array choices', () => {
    const i = input('{"a":"old"}', '{"a":"local"}', '{"a":"remote"}', {
      a: 'remote',
    });
    for (const choices of [
      { a: 'push' },
      { z: 'local' },
      { a: 'local', z: 'local' },
      [],
      Object.create({ a: 'remote' }),
      null,
    ])
      expect(() =>
        resolvePreview({ ...i, choices } as ResolutionInput),
      ).toThrow();
  });
  it('rejects duplicate/prototype/dangerous properties through original parser', () => {
    const i = input('{}', '{"a":"local"}', '{}', { a: 'local' });
    for (const text of [
      '{"a":"one","a":"two"}',
      '{"__proto__":"x"}',
      '{"constructor":"x"}',
    ])
      expect(() => resolvePreview({ ...i, localJson: text })).toThrow();
  });
  it('produces deterministic sorted bytes and digest without mutating inputs', () => {
    const i = input('{}', '{"z":"Z","a":"A"}', '{}', {
        z: 'local',
        a: 'local',
      }),
      before = JSON.stringify(i),
      r = resolvePreview(i);
    expect(r.json).toBe('{\n  "a": "A",\n  "z": "Z"\n}\n');
    expect(
      resolvePreview({ ...i, choices: { a: 'local', z: 'local' } })
        .contentDigest,
    ).toBe(r.contentDigest);
    expect(JSON.stringify(i)).toBe(before);
  });
  it('renders HTML-looking content as JSON data, not executable markup', () => {
    const r = resolvePreview(
      input('{}', '{"x":"<script>alert(1)</script>"}', '{}', { x: 'local' }),
    );
    expect(JSON.parse(r.json).x).toBe('<script>alert(1)</script>');
  });
  it('rejects a combined result beyond bounds even when each input fits', () => {
    const local = JSON.stringify({ a: 'x'.repeat(270000) });
    const remote = JSON.stringify({ b: 'y'.repeat(270000) });
    expect(() =>
      resolvePreview(input('{}', local, remote, { a: 'local', b: 'remote' })),
    ).toThrow('bounds');
  });
  it('allows empty maps and rejects choices for converged values', () => {
    expect(resolvePreview(input('{}', '{}', '{}', {})).json).toBe('{}\n');
    expect(() =>
      resolvePreview(input('{}', '{"a":"x"}', '{"a":"x"}', { a: 'local' })),
    ).toThrow('every differing');
  });
});
