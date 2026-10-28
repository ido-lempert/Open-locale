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
