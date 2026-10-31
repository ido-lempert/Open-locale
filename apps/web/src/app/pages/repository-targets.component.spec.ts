import { RepositoryTargetsComponent } from './repository-targets.component';
import { ApiService, RepositoryTargetConfig } from '../api.service';
import { ActivatedRoute } from '@angular/router';
const target: RepositoryTargetConfig = {
  id: 't',
  revision: 1,
  localBranch: 'main',
  locale: 'en',
  owner: 'owner',
  repo: 'repo',
  path: 'en.json',
  remoteBranch: 'main',
};
function setup(mock: Record<string, unknown>) {
  const c = new RepositoryTargetsComponent(
    {} as ActivatedRoute,
    mock as unknown as ApiService,
  );
  c.projectId = 'p';
  c.targets.set([target]);
  c.locales.set(['en']);
  c.edit(target);
  return c;
}
describe('repository target UI lifecycle', () => {
  it('preserves typed edit and revision on failed save', async () => {
    const c = setup({
      saveRepositoryTarget: async () => {
        throw new Error('Repository target changed');
      },
    });
    c.form.path = 'my-edit.json';
    await c.save();
    expect(c.form.path).toBe('my-edit.json');
    expect(c.editing()?.revision).toBe(1);
    expect(c.targets()[0].path).toBe('en.json');
    expect(c.busy()).toBe(false);
    expect(c.error()).toContain('changed');
  });
  it('ignores late save after destruction', async () => {
    let finish!: (v: unknown) => void;
    const c = setup({
      saveRepositoryTarget: () => new Promise((r) => (finish = r)),
    });
    const pending = c.save();
    c.ngOnDestroy();
    finish({ target: { ...target, path: 'late.json' } });
    await pending;
    expect(c.targets()[0].path).toBe('en.json');
    expect(c.message()).toBe('');
  });
  it('ignores late save after project navigation and keeps new loading state', async () => {
    let finish!: (v: unknown) => void;
    const c = setup({
      saveRepositoryTarget: () => new Promise((r) => (finish = r)),
      getProject: async () => ({ baseLocale: 'he', locales: [{ code: 'he' }] }),
      listBranches: async () => [],
      listRepositoryTargets: async () => ({ targets: [] }),
    });
    const pending = c.save();
    await c.load('second');
    finish({ target: { ...target, path: 'late.json' } });
    await pending;
    expect(c.projectId).toBe('second');
    expect(c.targets()).toEqual([]);
    expect(c.form.owner).toBe('');
    expect(c.form.locale).toBe('he');
    expect(c.ready()).toBe(true);
    expect(c.busy()).toBe(false);
    expect(c.message()).toBe('');
  });
  it('requires selected removal and preserves target on failure', async () => {
    let calls = 0;
    const c = setup({
      removeRepositoryTarget: async () => {
        calls++;
        throw new Error('Changed');
      },
    });
    await c.remove(target);
    expect(calls).toBe(0);
    c.removing.set(target);
    await c.remove(target);
    expect(calls).toBe(1);
    expect(c.targets()).toEqual([target]);
    expect(c.removing()?.id).toBe('t');
    expect(c.busy()).toBe(false);
  });
  it('prevents duplicate save submissions and snapshots outgoing data', async () => {
    let finish!: (v: unknown) => void;
    let calls = 0;
    let body: unknown;
    const c = setup({
      saveRepositoryTarget: (_p: string, input: unknown) => {
        calls++;
        body = input;
        return new Promise((r) => (finish = r));
      },
    });
    c.form.path = 'selected.json';
    const first = c.save();
    c.form.path = 'later';
    await c.save();
    expect(calls).toBe(1);
    expect((body as { path: string }).path).toBe('selected.json');
    finish({ target: { ...target, path: 'selected.json' } });
    await first;
    expect(c.targets()[0].path).toBe('selected.json');
  });
  it('refresh failure retains form and records, success explicitly resets edit', async () => {
    let fail = true;
    const c = setup({
      listRepositoryTargets: async () => {
        if (fail) throw new Error('Temporary');
        return { targets: [{ ...target, revision: 2 }] };
      },
    });
    c.form.path = 'preserved';
    await c.refresh();
    expect(c.form.path).toBe('preserved');
    expect(c.targets()[0].revision).toBe(1);
    fail = false;
    await c.refresh();
    expect(c.form.path).toBe('');
    expect(c.editing()).toBeNull();
    expect(c.targets()[0].revision).toBe(2);
  });
  it('read failure clears old snapshot and retains target configuration', async () => {
    const c = setup({
      readRepositoryTarget: async () => {
        throw new Error('Not configured');
      },
    });
    c.snapshot.set({
      targetId: 't',
      targetRevision: 1,
      json: '{}',
      remoteSha: 'sha',
      contentDigest: 'digest',
      remoteVerified: true,
      baselineAccepted: false,
      canApply: false,
    });
    await c.read(target);
    expect(c.snapshot()).toBeNull();
    expect(c.targets()).toEqual([target]);
    expect(c.error()).toBe('Not configured');
    expect(c.busy()).toBe(false);
  });
  it('late read cannot restore bytes after destruction or scope navigation', async () => {
    for (const action of ['destroy', 'navigate']) {
      let finish!: (v: unknown) => void;
      const c = setup({
        readRepositoryTarget: () => new Promise((r) => (finish = r)),
        getProject: async () => ({
          baseLocale: 'en',
          locales: [{ code: 'en' }],
        }),
        listBranches: async () => [],
        listRepositoryTargets: async () => ({ targets: [] }),
      });
      const pending = c.read(target);
      if (action === 'destroy') c.ngOnDestroy();
      else await c.load('second');
      finish({ targetId: 't', json: 'private old bytes' });
      await pending;
      expect(c.snapshot()).toBeNull();
      expect(c.message()).toBe('');
    }
  });
  it('editing or refreshing target clears fetched snapshot', async () => {
    const c = setup({
      readRepositoryTarget: async () => ({ targetId: 't', json: '{}' }),
      listRepositoryTargets: async () => ({ targets: [target] }),
    });
    await c.read(target);
    expect(c.snapshot()?.json).toBe('{}');
    c.edit(target);
    expect(c.snapshot()).toBeNull();
    await c.read(target);
    await c.refresh();
    expect(c.snapshot()).toBeNull();
  });
  it('baseline acceptance requires explicit confirmation and both reviewed views', async () => {
    let calls = 0;
    const c = setup({
      acceptRepositoryBaseline: async () => {
        calls++;
        return { baseline: { version: 1 } };
      },
    });
    await c.acceptBaseline(target);
    expect(calls).toBe(0);
    c.snapshot.set({
      targetId: 't',
      targetRevision: 1,
      json: '{}',
      remoteSha: 'sha',
      contentDigest: 'digest',
      remoteVerified: true,
      baselineAccepted: false,
      canApply: false,
    });
    c.baselineView.set({
      targetId: 't',
      targetRevision: 1,
      baseline: null,
      baselineAccepted: false,
      canApply: false,
    });
    await c.acceptBaseline(target);
    expect(calls).toBe(0);
    c.confirmBaseline.set(true);
    await c.acceptBaseline(target);
    expect(calls).toBe(1);
    expect(c.confirmBaseline()).toBe(false);
    expect(c.baselineView()?.baseline?.version).toBe(1);
  });
  it('baseline acceptance failure discards stale views and keeps configuration', async () => {
    const c = setup({
      acceptRepositoryBaseline: async () => {
        throw new Error('Repository file changed');
      },
    });
    c.snapshot.set({
      targetId: 't',
      targetRevision: 1,
      json: '{}',
      remoteSha: 'sha',
      contentDigest: 'digest',
      remoteVerified: true,
      baselineAccepted: false,
      canApply: false,
    });
    c.baselineView.set({
      targetId: 't',
      targetRevision: 1,
      baseline: null,
      baselineAccepted: false,
      canApply: false,
    });
    c.confirmBaseline.set(true);
    await c.acceptBaseline(target);
    expect(c.snapshot()).toBeNull();
    expect(c.baselineView()).toBeNull();
    expect(c.targets()).toEqual([target]);
    expect(c.error()).toContain('changed');
  });
  it('late acceptance cannot restore baseline after project navigation', async () => {
    let finish!: (v: unknown) => void;
    const c = setup({
      acceptRepositoryBaseline: () => new Promise((r) => (finish = r)),
      getProject: async () => ({ baseLocale: 'en', locales: [{ code: 'en' }] }),
      listBranches: async () => [],
      listRepositoryTargets: async () => ({ targets: [] }),
    });
    c.snapshot.set({
      targetId: 't',
      targetRevision: 1,
      json: '{}',
      remoteSha: 'sha',
      contentDigest: 'digest',
      remoteVerified: true,
      baselineAccepted: false,
      canApply: false,
    });
    c.baselineView.set({
      targetId: 't',
      targetRevision: 1,
      baseline: null,
      baselineAccepted: false,
      canApply: false,
    });
    c.confirmBaseline.set(true);
    const pending = c.acceptBaseline(target);
    await c.load('second');
    finish({ baseline: { version: 1, text: 'old bytes' } });
    await pending;
    expect(c.baselineView()).toBeNull();
    expect(c.snapshot()).toBeNull();
    expect(c.message()).toBe('');
    expect(c.projectId).toBe('second');
  });
});
