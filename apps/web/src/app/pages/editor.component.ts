import { Component, OnInit, signal } from '@angular/core';
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
      <span class="muted">{{ keys().length }} keys</span>
    </header>
    <main>
      @if (project(); as p) {
        <section class="toolbar">
          <input class="search" placeholder="Search keys" [(ngModel)]="search" (ngModelChange)="onSearch()" />
          <form class="inline" (ngSubmit)="addKey()">
            <input placeholder="new.key.name" [(ngModel)]="newKey" name="newKey" required />
            <button type="submit">Add key</button>
          </form>
          <form class="inline" (ngSubmit)="addLocale()">
            <input placeholder="locale (e.g. fr)" [(ngModel)]="newLocale" name="newLocale" required maxlength="10" />
            <button type="submit">Add locale</button>
          </form>
          <button (click)="exportJson()">Export JSON</button>
          <label class="import">Import JSON <input type="file" accept=".json" (change)="importJson($event)" hidden /></label>
          <select [(ngModel)]="ioLocale" name="ioLocale" aria-label="Import/export locale">
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
                  <td>
                    <textarea rows="1" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                      [ngModel]="cell(k.id, l.code).value"
                      (ngModelChange)="edit(k, l.code, $event)"
                      (blur)="save(k, l.code)"
                      [attr.aria-label]="k.name + ' in ' + l.code"></textarea>
                    <span class="cell-status" [class.error]="cell(k.id, l.code).status === 'error'">
                      {{ statusText(k.id, l.code) }}</span>
                  </td>
                }
                <td><button class="danger" title="Delete key" (click)="removeKey(k)">&times;</button></td>
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
  cells = new Map<string, CellState>();
  search = ''; newKey = ''; newLocale = ''; ioLocale = 'en';
  notice = signal(''); error = signal('');
  private projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() {
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p); this.ioLocale = p.baseLocale;
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
      const keys = await this.api.listKeys(this.projectId, this.search || undefined);
      this.keys.set(keys);
      this.cells.clear();
      for (const k of keys) for (const t of k.translations) {
        this.cells.set(`${k.id}:${t.localeCode}`, { value: t.value, saved: t.value, status: 'idle' });
      }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load keys'); }
  }
  cell(keyId: string, locale: string): CellState {
    return this.cells.get(`${keyId}:${locale}`) ?? { value: '', saved: '', status: 'idle' };
  }
  edit(k: Key, locale: string, value: string) {
    this.cells.set(`${k.id}:${locale}`, { ...this.cell(k.id, locale), value });
  }
  async save(k: Key, locale: string) {
    const c = this.cell(k.id, locale);
    if (c.value === c.saved) return;
    this.cells.set(`${k.id}:${locale}`, { ...c, status: 'saving' });
    try {
      await this.api.upsertTranslation(this.projectId, k.id, locale, c.value);
      this.cells.set(`${k.id}:${locale}`, { value: c.value, saved: c.value, status: 'saved' });
    } catch {
      this.cells.set(`${k.id}:${locale}`, { ...c, status: 'error' });
    }
  }
  statusText(keyId: string, locale: string): string {
    const s = this.cell(keyId, locale).status;
    return s === 'saving' ? 'saving…' : s === 'saved' ? 'saved' : s === 'error' ? 'save failed' : '';
  }
  isRtl(code: string) { return ['he', 'ar', 'fa', 'ur'].some((r) => code.startsWith(r)); }
  async addKey() {
    try {
      await this.api.createKey(this.projectId, { name: this.newKey });
      this.newKey = ''; await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async removeKey(k: Key) {
    try { await this.api.deleteKey(this.projectId, k.id); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async addLocale() {
    try {
      await this.api.addLocale(this.projectId, this.newLocale.trim());
      this.newLocale = '';
      this.project.set(await this.api.getProject(this.projectId));
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async exportJson() {
    try {
      const data = await this.api.exportJson(this.projectId, this.ioLocale);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.project()?.slug ?? 'export'}.${this.ioLocale}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Export failed'); }
  }
  async importJson(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const entries = JSON.parse(await file.text()) as Record<string, unknown>;
      const res = await this.api.importJson(this.projectId, this.ioLocale, entries);
      this.notice.set(`Imported ${res.keysCreated} keys, ${res.translationsUpserted} translations (${this.ioLocale}).`);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Import failed: invalid JSON'); }
  }
}
