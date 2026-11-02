import { RepositoryTargetsComponent } from './repository-targets.component';
import {
  ApiService,
  RepositoryTargetConfig,
  RepositorySyncPreview,
  RepositoryResolutionDraft,
} from '../api.service';
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
  it('clears old comparison on retry failure without deleting configurations', async () => {
    const c = setup({
      previewRepositoryTarget: async () => {
        throw new Error('Baseline changed');
      },
    });
    c.previewResult.set({
      targetId: 't',
      decisions: [],
    } as unknown as RepositorySyncPreview);
    c.previewPage.set(3);
    await c.preview(target);
    expect(c.previewResult()).toBeNull();
    expect(c.previewPage()).toBe(0);
    expect(c.targets()).toEqual([target]);
    expect(c.error()).toBe('Baseline changed');
    expect(c.busy()).toBe(false);
  });
  it('ignores late comparison after destruction and project navigation', async () => {
    for (const action of ['destroy', 'navigate']) {
      let finish!: (v: unknown) => void;
      const c = setup({
        previewRepositoryTarget: () => new Promise((r) => (finish = r)),
        getProject: async () => ({
          baseLocale: 'en',
          locales: [{ code: 'en' }],
        }),
        listBranches: async () => [],
        listRepositoryTargets: async () => ({ targets: [] }),
      });
      const pending = c.preview(target);
      if (action === 'destroy') c.ngOnDestroy();
      else await c.load('second');
      finish({ targetId: 't', decisions: [{ key: 'private old data' }] });
      await pending;
      expect(c.previewResult()).toBeNull();
      expect(c.message()).toBe('');
    }
  });
  it('guards duplicate comparisons and invalidates on edit and baseline reload', async () => {
    let finish!: (v: unknown) => void,
      calls = 0;
    const c = setup({
      previewRepositoryTarget: () => {
        calls++;
        return new Promise((r) => (finish = r));
      },
      getRepositoryBaseline: async () => ({
        targetId: 't',
        targetRevision: 1,
        baseline: null,
      }),
    });
    const first = c.preview(target);
    await c.preview(target);
    expect(calls).toBe(1);
    finish({ targetId: 't', decisions: [] });
    await first;
    expect(c.previewResult()?.targetId).toBe('t');
    c.edit(target);
    expect(c.previewResult()).toBeNull();
    c.previewResult.set({
      targetId: 't',
      decisions: [],
    } as unknown as RepositorySyncPreview);
    await c.loadBaseline(target);
    expect(c.previewResult()).toBeNull();
    expect(c.display(null)).toBe('[missing]');
    expect(c.display('')).toBe('[empty string]');
  });
  it('requires explicit choices, guards duplicate resolve, clears draft on selection edit', async () => {
    let finish!: (v: unknown) => void,
      calls = 0;
    const c = setup({
      resolveRepositoryPreview: () => {
        calls++;
        return new Promise((r) => (finish = r));
      },
    });
    c.previewResult.set({
      targetId: 't',
      targetRevision: 1,
      fingerprint: 'f',
      decisions: [{ key: 'x', kind: 'conflict' }],
    } as unknown as RepositorySyncPreview);
    await c.resolve(target);
    expect(calls).toBe(0);
    c.choose('unknown', 'local');
    expect(c.choices().size).toBe(0);
    c.choose('x', 'local');
    const pending = c.resolve(target);
    await c.resolve(target);
    expect(calls).toBe(1);
    c.choose('x', 'remote');
    expect(c.choices().get('x')).toBe('local');
    finish({ json: '{}' });
    await pending;
    expect(c.draft()?.json).toBe('{}');
    c.choose('x', 'remote');
    expect(c.draft()).toBeNull();
  });
  it('resolve failure discards compared sources and choices for fresh review', async () => {
    const c = setup({
      resolveRepositoryPreview: async () => {
        throw new Error('Repository preview changed');
      },
    });
    c.previewResult.set({
      targetId: 't',
      targetRevision: 1,
      decisions: [{ key: 'x', kind: 'local-only' }],
    } as unknown as RepositorySyncPreview);
    c.choose('x', 'local');
    await c.resolve(target);
    expect(c.previewResult()).toBeNull();
    expect(c.choices().size).toBe(0);
    expect(c.draft()).toBeNull();
    expect(c.busy()).toBe(false);
    expect(c.error()).toContain('changed');
  });
  it('late resolve result cannot restore old draft after destroy or navigation', async () => {
    for (const action of ['destroy', 'navigate']) {
      let finish!: (v: unknown) => void;
      const c = setup({
        resolveRepositoryPreview: () => new Promise((r) => (finish = r)),
        getProject: async () => ({
          baseLocale: 'en',
          locales: [{ code: 'en' }],
        }),
        listBranches: async () => [],
        listRepositoryTargets: async () => ({ targets: [] }),
      });
      c.previewResult.set({
        targetId: 't',
        targetRevision: 1,
        decisions: [],
      } as unknown as RepositorySyncPreview);
      const pending = c.resolve(target);
      if (action === 'destroy') c.ngOnDestroy();
      else await c.load('second');
      finish({ json: 'private old draft' });
      await pending;
      expect(c.draft()).toBeNull();
      expect(c.choices().size).toBe(0);
    }
  });
  it('bounds local change rows and resets page when draft review is invalidated', () => {
    const c = setup({});
    const changes = Array.from({ length: 121 }, (_, n) => ({
      key: 'key' + n,
      action: 'set-value',
      expectedValue: null,
      nextValue: 'v',
    }));
    c.draft.set({
      json: '{}',
      localChangePlan: { changes },
    } as unknown as RepositoryResolutionDraft);
    expect(c.changePages()).toBe(3);
    expect(c.changeRows().length).toBe(50);
    c.changePage.set(2);
    expect(c.changeRows().length).toBe(21);
    c.clearDraft();
    expect(c.changePage()).toBe(0);
    expect(c.changeRows()).toEqual([]);
    expect(c.changePages()).toBe(1);
  });
  function reviewed(c: RepositoryTargetsComponent) {
    c.previewResult.set({targetId:'t',targetRevision:1,decisions:[]} as unknown as RepositorySyncPreview);
    c.draft.set({targetId:'t',targetRevision:1,previewFingerprint:'a'.repeat(64),contentDigest:'b'.repeat(64),localChangePlan:{changes:[{key:'k',action:'set-value',nextValue:'v'}]}} as unknown as RepositoryResolutionDraft);
    c.choices.set(new Map([['k','remote']]));
  }
  it('requires confirmation before apply and sends exact reviewed binding', async () => {
    const send=jest.fn(async()=>({updatedValues:1,removedValues:0,pendingEffectIntents:1}));
    const c=setup({applyRepositoryLocal:send});reviewed(c);
    await c.apply(target);expect(send).not.toHaveBeenCalled();c.confirmApply.set(true);await c.apply(target);
    expect(send).toHaveBeenCalledWith('p','t',{expectedRevision:1,expectedFingerprint:'a'.repeat(64),expectedDraftDigest:'b'.repeat(64),choices:{k:'remote'}});
    expect(c.draft()).toBeNull();expect(c.confirmApply()).toBe(false);expect(c.message()).toContain('Sync not completed');
  });
  it('failed apply clears reviewed bytes and warns about uncertain response',async()=>{
    const c=setup({applyRepositoryLocal:async()=>{throw new Error('Network lost');}});reviewed(c);c.confirmApply.set(true);await c.apply(target);
    expect(c.draft()).toBeNull();expect(c.previewResult()).toBeNull();expect(c.confirmApply()).toBe(false);expect(c.error()).toContain('may already have changed');
  });
  it('changed choice clears apply confirmation',()=>{
    const c=setup({});reviewed(c);c.previewResult.set({targetId:'t',decisions:[{key:'k',kind:'conflict'}]} as unknown as RepositorySyncPreview);c.confirmApply.set(true);c.choose('k','local');expect(c.confirmApply()).toBe(false);expect(c.draft()).toBeNull();
  });
  it('late apply response after navigation cannot show old scope feedback',async()=>{
    let finish!:(v:unknown)=>void;
    const c=setup({applyRepositoryLocal:()=>new Promise(r=>finish=r),getProject:async()=>({baseLocale:'en',locales:[]}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});
    reviewed(c);c.confirmApply.set(true);const pending=c.apply(target);await c.load('other');finish({updatedValues:1,removedValues:0,pendingEffectIntents:1});await pending;
    expect(c.projectId).toBe('other');expect(c.message()).toBe('');expect(c.error()).toBe('');expect(c.draft()).toBeNull();expect(c.confirmApply()).toBe(false);
  });

});

describe('effect summary lifecycle', () => {
  const summary={channelCheckpoints:{webhook:1,automation:0,both:0},targetId:'t',counts:{pending:1,leased:0,completed:0,dead:0},expiredLeases:0,oldestPendingAt:null,asOf:'2026-01-01T00:00:00.000Z',source:'repository-effect-bookkeeping',deliveryConfirmed:false,syncAccepted:false} as const;
  it('loads summary only on explicit action',async()=>{let calls=0;const c=setup({repositoryEffectSummary:async()=>{calls++;return summary;}});expect(c.effectSummary()).toBeNull();expect(calls).toBe(0);await c.loadEffects(target);expect(c.effectSummary()).toEqual(summary);expect(calls).toBe(1);expect(c.busy()).toBe(false);});
  it('clears prior summary before refresh and on failure',async()=>{let fail=false;const c=setup({repositoryEffectSummary:async()=>{if(fail)throw new Error('private raw error');return summary;}});await c.loadEffects(target);fail=true;await c.loadEffects(target);expect(c.effectSummary()).toBeNull();expect(c.error()).toContain('No effects were run');expect(c.error()).not.toContain('private');});
  it('ignores late response after route load or destruction',async()=>{for(const action of ['load','destroy']){let finish!:(v:unknown)=>void;const c=setup({repositoryEffectSummary:()=>new Promise(r=>finish=r),getProject:async()=>({locales:[],baseLocale:'en'}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});const pending=c.loadEffects(target);if(action==='load')await c.load('other');else c.ngOnDestroy();finish(summary);await pending;expect(c.effectSummary()).toBeNull();}});
});

describe('deletion audit metadata lifecycle',()=>{
 const page={source:'local-deletion-audit-metadata',audits:[],nextCursor:'next',snapshotIncluded:false,canRestore:false};
 it('loads only explicitly and forwards older cursor',async()=>{const send=jest.fn(async()=>page);const c=setup({listDeletionAudits:send});expect(c.auditPage()).toBeNull();expect(send).not.toHaveBeenCalled();await c.loadAudits();expect(send).toHaveBeenLastCalledWith('p',undefined);await c.loadAudits('next');expect(send).toHaveBeenLastCalledWith('p','next');expect(c.auditPage()).toEqual(page);});
 it('clears previous page immediately and after failure without raw error',async()=>{let fail=false;let finish!:(v:unknown)=>void;const c=setup({listDeletionAudits:()=>fail?Promise.reject(new Error('private-error')):new Promise(r=>finish=r)});const pending=c.loadAudits();expect(c.auditPage()).toBeNull();finish(page);await pending;fail=true;await c.loadAudits('next');expect(c.auditPage()).toBeNull();expect(c.error()).toContain('Nothing was restored or deleted');expect(c.error()).not.toContain('private-error');expect(c.busy()).toBe(false);});
 it('ignores late audit response after navigation or destruction',async()=>{for(const action of ['load','destroy']){let finish!:(v:unknown)=>void;const c=setup({listDeletionAudits:()=>new Promise(r=>finish=r),getProject:async()=>({locales:[],baseLocale:'en'}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});const pending=c.loadAudits();if(action==='load')await c.load('other');else c.ngOnDestroy();finish(page);await pending;expect(c.auditPage()).toBeNull();}});
});

describe('audit navigation accessibility',()=>{
 it('announces loading and focuses heading only after current success',async()=>{let finish!:(v:unknown)=>void;const c=setup({listDeletionAudits:()=>new Promise(r=>finish=r)});const focus=jest.fn(),scrollIntoView=jest.fn();c.auditHeading={nativeElement:{focus,scrollIntoView}} as never;const pending=c.loadAudits('older');expect(c.auditLoading()).toBe(true);expect(focus).not.toHaveBeenCalled();finish({audits:[],nextCursor:null});await pending;expect(c.auditLoading()).toBe(false);expect(focus).toHaveBeenCalledWith({preventScroll:true});expect(scrollIntoView).toHaveBeenCalledWith({block:'start',behavior:'instant'});});
 it('does not move focus on error and clears loading',async()=>{const c=setup({listDeletionAudits:async()=>{throw new Error('failure');}});const focus=jest.fn();c.auditHeading={nativeElement:{focus}} as never;await c.loadAudits();expect(c.auditLoading()).toBe(false);expect(focus).not.toHaveBeenCalled();});
 it('navigation clears loading and late response never steals focus',async()=>{let finish!:(v:unknown)=>void;const c=setup({listDeletionAudits:()=>new Promise(r=>finish=r),getProject:async()=>({locales:[],baseLocale:'en'}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});const focus=jest.fn();c.auditHeading={nativeElement:{focus}} as never;const pending=c.loadAudits();await c.load('other');expect(c.auditLoading()).toBe(false);finish({audits:[]});await pending;expect(focus).not.toHaveBeenCalled();});
});

describe('read-only recovery eligibility UI',()=>{
 const result={source:'deletion-recovery-eligibility-preview',eligibleNow:true,reason:'current-flat-value-absence',canRestore:false,snapshotIncluded:false,historyReplay:false,reservationHeld:false};
 function withPage(mock:Record<string,unknown>){const c=setup(mock);c.auditPage.set({audits:[{id:'a'}],nextCursor:null} as never);return c;}
 it('checks only explicit listed audit and never sends mutation',async()=>{const send=jest.fn(async()=>result);const c=withPage({previewDeletionRecovery:send});await c.checkRecovery('other');expect(send).not.toHaveBeenCalled();await c.checkRecovery('a');expect(send).toHaveBeenCalledWith('p','a');expect(c.recoveryPreview()?.result).toEqual(result);});
 it('failed check clears previous result and hides raw error',async()=>{const c=withPage({previewDeletionRecovery:async()=>{throw new Error('private-error');}});c.recoveryPreview.set({auditId:'a',result} as never);await c.checkRecovery('a');expect(c.recoveryPreview()).toBeNull();expect(c.error()).toContain('No value was restored');expect(c.error()).not.toContain('private');});
 it('late response after navigation cannot restore old eligibility',async()=>{let finish!:(v:unknown)=>void;const c=withPage({previewDeletionRecovery:()=>new Promise(r=>finish=r),getProject:async()=>({locales:[],baseLocale:'en'}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});const pending=c.checkRecovery('a');await c.load('other');finish(result);await pending;expect(c.recoveryPreview()).toBeNull();});
 it('uses safe fixed reason text for unknown reasons',()=>{const c=setup({});expect(c.recoveryReason({...result,eligibleNow:false,reason:'<private>'} as never)).toBe('Current recovery checks do not pass.');});
});


describe('explicit archived value review UI',()=>{
 const result={source:'deletion-recovery-value-review',asOf:'2026-11-02T00:00:00.000Z',reviewAvailable:true,reason:'current-flat-value-absence',value:'private value',maxValueBytes:32768,canRestore:false,snapshotIncluded:false,historyReplay:false,reservationHeld:false};
 function withPage(mock:Record<string,unknown>){const c=setup(mock);c.auditPage.set({audits:[{id:'a'}],nextCursor:null} as never);return c;}
 it('loads only explicit listed value review',async()=>{const read=jest.fn(async()=>result);const c=withPage({reviewDeletionRecoveryValue:read});expect(read).not.toHaveBeenCalled();await c.reviewRecoveryValue('other');expect(read).not.toHaveBeenCalled();await c.reviewRecoveryValue('a');expect(read).toHaveBeenCalledWith('p','a');expect(c.recoveryValue()?.result).toEqual(result);});
 it('clears private value on error without raw failure',async()=>{const c=withPage({reviewDeletionRecoveryValue:async()=>{throw new Error('private failure');}});c.recoveryValue.set({auditId:'a',result} as never);await c.reviewRecoveryValue('a');expect(c.recoveryValue()).toBeNull();expect(c.error()).toContain('No value was restored');expect(c.error()).not.toContain('private');});
 it('clears value on audit refresh',async()=>{const c=withPage({listDeletionAudits:async()=>({audits:[],nextCursor:null})});c.recoveryValue.set({auditId:'a',result} as never);await c.loadAudits();expect(c.recoveryValue()).toBeNull();});
 it('late private value cannot cross route change',async()=>{let finish!:(v:unknown)=>void;const c=withPage({reviewDeletionRecoveryValue:()=>new Promise(r=>finish=r),getProject:async()=>({locales:[],baseLocale:'en'}),listBranches:async()=>[],listRepositoryTargets:async()=>({targets:[]})});const pending=c.reviewRecoveryValue('a');await c.load('other');finish(result);await pending;expect(c.recoveryValue()).toBeNull();});
});
