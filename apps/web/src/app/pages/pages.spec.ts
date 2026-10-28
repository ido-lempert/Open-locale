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
