import { SyncPreviewComponent } from './sync-preview.component';
import {
  ApiService,
  LocalSyncPreview,
  SyncResolutionDraft,
} from '../api.service';
import { ActivatedRoute } from '@angular/router';
const plan: LocalSyncPreview = {
  projectId: 'p',
  branch: 'main',
  locale: 'en',
  fingerprint: 'f',
  remoteSha: 'a'.repeat(40),
  baselineVerified: false,
  remoteVerified: false,
  canApply: false,
  requiresManual: true,
  decisions: [
    {
      key: 'a',
      base: 'old',
      local: 'new',
      remote: null,
      kind: 'conflict',
      suggested: 'manual',
    },
  ],
};
const draft: SyncResolutionDraft = {
  json: '{}\n',
  contentDigest: 'digest',
  previewFingerprint: 'f',
  explicitChoices: 1,
  outputKeys: 0,
  absentKeys: 1,
  canApply: false,
  baselineVerified: false,
  remoteVerified: false,
};
function setup(
  resolveLocalSync: (...args: unknown[]) => Promise<SyncResolutionDraft>,
) {
  const c = new SyncPreviewComponent(
    {} as ActivatedRoute,
    { resolveLocalSync } as unknown as ApiService,
  );
  c.result.set(plan);
  c.projectId = 'p';
  c.locale = 'en';
  c.choose('a', 'remote');
  return c;
}
describe('draft resolution lifecycle', () => {
  it('preserves choices after transient failure, clears old draft', async () => {
    const c = setup(async () => {
      throw new Error('Temporary');
    });
    c.draft.set(draft);
    await c.resolve();
    expect(c.choices().get('a')).toBe('remote');
    expect(c.draft()).toBeNull();
    expect(c.error()).toBe('Temporary');
    expect(c.resolving()).toBe(false);
  });
  it('clears stale preview and choices on server stale review', async () => {
    const c = setup(async () => {
      throw new Error('Preview changed; review a fresh preview');
    });
    await c.resolve();
    expect(c.result()).toBeNull();
    expect(c.choices().size).toBe(0);
    expect(c.error()).toContain('Preview changed');
  });
  it('cannot restore late response after input, choice or destruction', async () => {
    for (const action of ['input', 'choice', 'destroy']) {
      let finish!: (d: SyncResolutionDraft) => void;
      const c = setup(() => new Promise((r) => (finish = r)));
      const pending = c.resolve();
      if (action === 'input') c.invalidate();
      else if (action === 'choice') c.choose('a', 'local');
      else c.ngOnDestroy();
      finish(draft);
      await pending;
      expect(c.draft()).toBeNull();
    }
  });
  it('cannot overwrite newer request draft or loading state', async () => {
    let finish!: (d: SyncResolutionDraft) => void;
    let calls = 0;
    const c = setup(() =>
      ++calls === 1
        ? new Promise((r) => (finish = r))
        : Promise.resolve({ ...draft, json: '{"a":"new"}\n' }),
    );
    const first = c.resolve();
    c.choose('a', 'local');
    await c.resolve();
    finish(draft);
    await first;
    expect(c.draft()?.json).toBe('{"a":"new"}\n');
    expect(c.resolving()).toBe(false);
  });
  it('does not request when a choice is missing and clears draft on deselection', async () => {
    let calls = 0;
    const c = setup(async () => {
      calls++;
      return draft;
    });
    c.draft.set(draft);
    c.choose('a', '');
    await c.resolve();
    expect(calls).toBe(0);
    expect(c.draft()).toBeNull();
    expect(c.choices().size).toBe(0);
  });
});
