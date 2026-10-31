import { localDraftPlan } from './local-draft-plan';
import { createHash } from 'node:crypto';
const fingerprint = 'a'.repeat(64);
describe('local draft change materialization', () => {
  it('distinguishes unchanged absent empty set and locale-only removal', () => {
    const decisions = [
      { key: 'z', local: 'remove' },
      { key: 'a', local: null },
      { key: 'b', local: '' },
      { key: 'c', local: 'same' },
      { key: 'd', local: null },
    ];
    const json = '{"a":"","b":"new","c":"same"}\n';
    const p = localDraftPlan(decisions, json, fingerprint);
    expect(p.changes).toEqual([
      { key: 'a', action: 'set-value', expectedValue: null, nextValue: '' },
      { key: 'b', action: 'set-value', expectedValue: '', nextValue: 'new' },
      {
        key: 'z',
        action: 'remove-locale-value',
        expectedValue: 'remove',
        nextValue: null,
      },
    ]);
    expect(p).toMatchObject({
      setValues: 2,
      removeLocaleValues: 1,
      unchangedValues: 2,
      deletesKeys: false,
      touchesOtherLocales: false,
      canApply: false,
      previewFingerprint: fingerprint,
      draftContentDigest: createHash('sha256').update(json).digest('hex'),
    });
    expect(decisions[0].key).toBe('z');
  });
  it('no-op draft creates no changes', () => {
    expect(
      localDraftPlan([{ key: 'x', local: 'v' }], '{"x":"v"}', fingerprint)
        .changes,
    ).toEqual([]);
  });
  it('retains flat parser rejection of prototype-like keys', () => {
    expect(() =>
      localDraftPlan(
        [{ key: 'constructor', local: null }],
        '{"constructor":"v"}',
        fingerprint,
      ),
    ).toThrow('Unsupported sync key');
  });
  it('rejects extra duplicate or unsupported draft data and invalid binding', () => {
    expect(() => localDraftPlan([], '{"extra":"v"}', fingerprint)).toThrow(
      'Draft keys',
    );
    expect(() =>
      localDraftPlan(
        [
          { key: 'x', local: null },
          { key: 'x', local: null },
        ],
        '{}',
        fingerprint,
      ),
    ).toThrow('Draft keys');
    expect(() =>
      localDraftPlan([], '{"x":{"nested":"v"}}', fingerprint),
    ).toThrow();
    expect(() => localDraftPlan([], '{}', 'bad')).toThrow('fingerprint');
  });
});
