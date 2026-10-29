import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { ProjectsComponent } from './projects.component';
import { ApiService } from '../api.service';

class MockApi {
  token: string | null = null;
  listProjects = () => Promise.resolve([
    { id: 'p1', name: 'Shop', slug: 'shop', description: '', baseLocale: 'en',
      locales: [{ code: 'en' }, { code: 'he' }], _count: { keys: 3 } },
  ]);
}

describe('LoginComponent', () => {
  it('renders both auth tabs and submits are disabled only while busy', async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent], providers: [provideRouter([])],
    }).compileComponents();
    const el = TestBed.createComponent(LoginComponent).nativeElement as HTMLElement;
    const tabs = [...el.querySelectorAll('.tabs button')].map((b) => b.textContent?.trim());
    expect(tabs).toEqual(['Log in', 'Sign up']);
    expect(el.querySelector('button.primary')?.hasAttribute('disabled')).toBe(false);
  });
});

describe('ProjectsComponent', () => {
  it('lists projects from the API with locale and key counts', async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [provideRouter([]), { provide: ApiService, useClass: MockApi }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProjectsComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Shop');
    expect(el.textContent).toContain('2 locales');
    expect(el.textContent).toContain('3 keys');
  });
});

describe('EditorComponent input preservation', () => {
  it('does not wipe text the user typed while an add was in flight', async () => {
    let resolveCreate: (v: unknown) => void = () => undefined;
    const mock = {
      getProject: () => Promise.resolve({
        id: 'p1', name: 'P', slug: 'p', description: '', baseLocale: 'en',
        locales: [{ code: 'en' }], _count: { keys: 0 },
      }),
      listKeys: () => Promise.resolve([]),
      listGlossary: () => Promise.resolve([]),
      listBranches: () => Promise.resolve([]),
      createKey: () => new Promise((r) => { resolveCreate = r; }),
    };
    const { EditorComponent } = await import('./editor.component');
    const { ActivatedRoute, convertToParamMap } = await import('@angular/router');
    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mock },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EditorComponent);
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    comp.newKey.set('first.key');
    const pending = comp.addKey();
    // user keeps typing while the request is in flight
    comp.newKey.set('second.key');
    resolveCreate({ id: 'k1' });
    await pending;
    expect(comp.newKey()).toBe('second.key');
  });
});

describe('EditorComponent save/status ordering', () => {
  it('a review chosen mid-save is not clobbered by the late save response', async () => {
    let resolveUpsert: (v: unknown) => void = () => undefined;
    const setStatusCalls: string[] = [];
    const mock = {
      getProject: () => Promise.resolve({
        id: 'p1', name: 'P', slug: 'p', description: '', baseLocale: 'en',
        locales: [{ code: 'en' }], _count: { keys: 0 },
      }),
      listKeys: () => Promise.resolve([
        { id: 'k1', name: 'a.b', description: '', isPlural: false, maxLength: null,
          translations: [{ keyId: 'k1', localeCode: 'en', value: 'hi', status: 'UNVERIFIED' }] },
      ]),
      listGlossary: () => Promise.resolve([]),
      listBranches: () => Promise.resolve([]),
      upsertTranslation: () => new Promise((r) => { resolveUpsert = r; }),
      setStatus: (_p: string, _k: string, _l: string, st: string) => {
        setStatusCalls.push(st);
        return Promise.resolve({ keyId: 'k1', localeCode: 'en', value: 'hi!', status: st });
      },
    };
    const { EditorComponent } = await import('./editor.component');
    const { ActivatedRoute, convertToParamMap } = await import('@angular/router');
    await TestBed.configureTestingModule({
      imports: [EditorComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mock },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EditorComponent);
    await fixture.whenStable();
    const comp = fixture.componentInstance;
    const key = comp.keys()[0];
    comp.edit(key, 'en', 'hi!');
    const saving = comp.save(key, 'en');
    // While the save is in flight the reviewer marks it REVIEWED.
    await comp.setReview(key, 'en', 'REVIEWED');
    resolveUpsert({ keyId: 'k1', localeCode: 'en', value: 'hi!', status: 'UNVERIFIED' });
    await saving;
    expect(comp.cell('k1', 'en')().review).toBe('REVIEWED');
    // The review was re-sent after the save landed so server state matches.
    expect(setStatusCalls).toEqual(['REVIEWED', 'REVIEWED']);
  });
});

describe('TasksComponent latest-request-wins', () => {
  const task = (id: string, title: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE') => ({
    id, title, description: '', status, dueDate: null, createdAt: '2026-10-29T00:00:00Z',
    assignee: null, assigneeGroup: null, dependsOn: null, lockKeys: false, keys: [], creator: null,
  });

  const setup = async () => {
    const { BehaviorSubject } = await import('rxjs');
    const { convertToParamMap, ActivatedRoute } = await import('@angular/router');
    const { TasksComponent } = await import('./tasks.component');
    const calls: { pid: string; status?: string; mine?: boolean; resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
    const mock = {
      listTasks: (pid: string, status?: string, mine?: boolean) =>
        new Promise((res, rej) => { calls.push({ pid, status, mine, resolve: res, reject: rej }); }),
      listMembers: () => Promise.resolve([]),
      listGroups: () => Promise.resolve([]),
      listKeys: () => Promise.resolve([]),
    };
    const paramMap$ = new BehaviorSubject(convertToParamMap({ id: 'p1' }));
    await TestBed.configureTestingModule({
      imports: [TasksComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: mock },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable(), snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TasksComponent);
    fixture.detectChanges();
    return { fixture, cmp: fixture.componentInstance, calls, paramMap$, convertToParamMap };
  };

  it('applies only the newest fetch when filter-change responses arrive out of order', async () => {
    const { fixture, cmp, calls } = await setup();
    localStorage.clear();
    expect(calls.length).toBe(1); // initial load
    cmp.setFilter('OPEN');
    cmp.setMine('me');
    expect(calls.length).toBe(3);
    expect(calls[2].status).toBe('OPEN');
    expect(calls[2].mine).toBe(true);
    // Newest resolves first; stale responses arrive afterwards in reverse.
    calls[2].resolve([task('t3', 'Mine open', 'OPEN')]);
    await fixture.whenStable();
    calls[0].reject(new Error('stale failure'));
    await fixture.whenStable();
    calls[1].resolve([task('t1', 'Stale all-status', 'IN_PROGRESS')]);
    await fixture.whenStable();
    expect(cmp.tasks().map((t) => t.id)).toEqual(['t3']);
    expect(cmp.error()).toBe('');
    expect(cmp.loading()).toBe(false);
    fixture.destroy();
  });

  it('re-initializes on project switch: new project id, own filters, stale p1 response ignored', async () => {
    const { fixture, cmp, calls, paramMap$, convertToParamMap } = await setup();
    localStorage.clear();
    expect(calls.length).toBe(1);
    expect(calls[0].pid).toBe('p1');
    // Persist a filter choice for p2 only.
    localStorage.setItem('ol.taskFilters.p2', JSON.stringify({ status: 'DONE', mine: 'me' }));
    paramMap$.next(convertToParamMap({ id: 'p2' }));
    fixture.detectChanges();
    expect(cmp.projectId).toBe('p2');
    expect(cmp.statusFilter()).toBe('DONE');
    expect(cmp.mineFilter()).toBe('me');
    expect(calls.length).toBe(2);
    expect(calls[1].pid).toBe('p2');
    expect(calls[1].status).toBe('DONE');
    // The p1 response landing after the switch must not render p1 rows.
    calls[0].resolve([task('old', 'From p1', 'OPEN')]);
    await fixture.whenStable();
    expect(cmp.tasks().map((t) => t.id)).toEqual([]);
    calls[1].resolve([task('new', 'From p2', 'DONE')]);
    await fixture.whenStable();
    expect(cmp.tasks().map((t) => t.id)).toEqual(['new']);
    fixture.destroy();
  });
});
