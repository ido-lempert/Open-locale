import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Key, Project } from '../api.service';

interface CellState { value: string; saved: string; status: 'idle' | 'saving' | 'saved' | 'error'; }

@Component({
  selector: 'ol-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a routerLink="/projects" class="back">&larr; Projects</a>
      <h1>{{ project()?.name ?? 'Loading…' }}</h1>
      <a [routerLink]="['/projects', projectId, 'settings']" class="settings-link">Settings</a>
      <span class="muted">{{ keys().length }} keys</span>
    </header>
    <main>
      @if (project(); as p) {
        <section class="toolbar">
          <input class="search" placeholder="Search keys" aria-label="Search keys" [ngModel]="search()" (ngModelChange)="search.set($event); onSearch()" />
          <form class="inline" (ngSubmit)="addKey()">
            <input placeholder="new.key.name" aria-label="New key name" [ngModel]="newKey()" (ngModelChange)="newKey.set($event)" name="newKey" required />
            <button type="submit">Add key</button>
          </form>
          <form class="inline" (ngSubmit)="addLocale()">
            <input placeholder="locale (e.g. fr)" aria-label="New locale code" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit">Add locale</button>
          </form>
          <button (click)="exportJson()">Export JSON</button>
          <label class="import">Import JSON <input type="file" accept=".json" (change)="importJson($event)" hidden /></label>
          <select [ngModel]="ioLocale()" (ngModelChange)="ioLocale.set($event)" name="ioLocale" aria-label="Import/export locale">
            @for (l of p.locales; track l.code) { <option [value]="l.code">{{ l.code }}</option> }
          </select>
        </section>
        @if (notice()) { <p class="notice">{{ notice() }}</p> }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (keys().length === 0) {
          <p class="muted empty">No keys yet. Add one above - for example <code>home.title</code>.</p>
        }
        <table class="grid">
          <thead><tr><th>Key</th>@for (l of p.locales; track l.code) { <th>{{ l.code }}</th> }<th></th></tr></thead>
          <tbody>
            @for (k of keys(); track k.id) {
              <tr>
                <td class="key"><code>{{ k.name }}</code></td>
                @for (l of p.locales; track l.code) {
                  <td [attr.data-locale]="l.code">
                    <textarea rows="1" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                      [ngModel]="cell(k.id, l.code)().value"
                      (ngModelChange)="edit(k, l.code, $event)"
                      (blur)="save(k, l.code)"
                      [attr.aria-label]="k.name + ' in ' + l.code"></textarea>
                    @if (cell(k.id, l.code)().status === 'error') {
                      <button class="cell-status retry" (click)="save(k, l.code, true)">save failed - retry</button>
                    } @else {
                      <span class="cell-status">{{ statusText(k.id, l.code) }}</span>
                    }
                  </td>
                }
                <td><button class="danger" [attr.aria-label]="'Delete key ' + k.name" title="Delete key" (click)="removeKey(k)">&times;</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </main>
  `,
})
export class EditorComponent implements OnInit {
  project = signal<Project | null>(null);
  keys = signal<Key[]>([]);
  cells = new Map<string, WritableSignal<CellState>>();
  search = signal(''); newKey = signal(''); newLocale = signal(''); ioLocale = signal('en');
  notice = signal(''); error = signal('');
  projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() {
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p); this.ioLocale.set(p.baseLocale);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load project'); }
  }
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 250);
  }
  async reload() {
    try {
      const keys = await this.api.listKeys(this.projectId, this.search() || undefined);
      this.keys.set(keys);
      this.cells.clear();
      for (const k of keys) for (const t of k.translations) {
        this.cells.set(`${k.id}:${t.localeCode}`, signal({ value: t.value, saved: t.value, status: 'idle' }));
      }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load keys'); }
  }
  cell(keyId: string, locale: string): WritableSignal<CellState> {
    let s = this.cells.get(`${keyId}:${locale}`);
    if (!s) {
      s = signal<CellState>({ value: '', saved: '', status: 'idle' });
      this.cells.set(`${keyId}:${locale}`, s);
    }
    return s;
  }
  edit(k: Key, locale: string, value: string) {
    this.cell(k.id, locale).update((c) => ({ ...c, value }));
  }
  async save(k: Key, locale: string, force = false) {
    const sig = this.cell(k.id, locale);
    const c = sig();
    if (!force && c.value === c.saved) return;
    if (c.status === 'saving') return;
    sig.set({ ...c, status: 'saving' });
    try {
      await this.api.upsertTranslation(this.projectId, k.id, locale, c.value);
      const latest = sig();
      sig.set({ value: latest.value, saved: c.value, status: latest.value === c.value ? 'saved' : 'idle' });
    } catch {
      // Keep saved pointing at what the server actually holds so a retry re-sends.
      sig.update((cur) => ({ ...cur, status: 'error' }));
    }
  }
  statusText(keyId: string, locale: string): string {
    const s = this.cell(keyId, locale)().status;
    return s === 'saving' ? 'saving…' : s === 'saved' ? 'saved' : s === 'error' ? 'save failed' : '';
  }
  isRtl(code: string) { return ['he', 'ar', 'fa', 'ur'].some((r) => code.startsWith(r)); }
  async addKey() {
    const submitted = this.newKey();
    try {
      await this.api.createKey(this.projectId, { name: submitted });
      if (this.newKey() === submitted) this.newKey.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async removeKey(k: Key) {
    try { await this.api.deleteKey(this.projectId, k.id); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async addLocale() {
    const submitted = this.newLocale().trim();
    try {
      await this.api.addLocale(this.projectId, submitted);
      if (this.newLocale().trim() === submitted) this.newLocale.set('');
      this.project.set(await this.api.getProject(this.projectId));
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async exportJson() {
    try {
      const data = await this.api.exportJson(this.projectId, this.ioLocale());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.project()?.slug ?? 'export'}.${this.ioLocale()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Export failed'); }
  }
  async importJson(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const entries = JSON.parse(await file.text()) as Record<string, unknown>;
      const res = await this.api.importJson(this.projectId, this.ioLocale(), entries);
      this.notice.set(`Imported ${res.keysCreated} keys, ${res.translationsUpserted} translations (${this.ioLocale()}).`);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Import failed: invalid JSON'); }
  }
}
