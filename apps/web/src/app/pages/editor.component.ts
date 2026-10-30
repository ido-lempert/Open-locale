import { DatePipe } from '@angular/common';
import { Component, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { hintsForTarget, GlossaryHint } from '../glossary-match';
import { detectImportFormat, IoFormat } from '../import-format';
import { ApiService, BranchInfo, ScreenshotMeta, TmSuggestion, GlossaryTermItem, CommentEntry, HistoryEntry, Key, Project, TranslationStatus } from '../api.service';

interface CellState {
  value: string; saved: string;
  // Per-CLDR-category text for plural keys; {} for plain keys.
  forms: Record<string, string>; savedForms: Record<string, string>;
  status: 'idle' | 'saving' | 'saved' | 'error';
  errorMsg: string;
  review: TranslationStatus;
}

@Component({
  selector: 'ol-editor',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a routerLink="/projects" class="back">&larr; Projects</a>
      <h1>{{ project()?.name ?? 'Loading…' }}</h1>
      <a [routerLink]="['/projects', projectId, 'qa']" class="qa-link">QA</a>
      <a [routerLink]="['/projects', projectId, 'reports']" class="reports-link">Progress</a>
      <a [routerLink]="['/projects', projectId, 'glossary']" class="glossary-link">Glossary</a>
      <a [routerLink]="['/projects', projectId, 'tasks']" class="tasks-link">Tasks</a>
      <a [routerLink]="['/projects', projectId, 'activity']" class="activity-link">Activity</a>
      <a [routerLink]="['/projects', projectId, 'snapshots']" class="snapshots-link">Snapshots</a>
      <a [routerLink]="['/projects', projectId, 'settings']" class="settings-link">Settings</a>
      <span class="muted">{{ keys().length }} keys</span>
    </header>
    <main>
      @if (project(); as p) {
        <section class="toolbar">
          <select aria-label="Branch" [ngModel]="branch()" (ngModelChange)="switchBranch($event)" name="branch">
            @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
          </select>
          <form class="branch-form" (ngSubmit)="addBranch()">
            <input placeholder="new-empty-branch" aria-label="New branch name" [ngModel]="newBranch()" (ngModelChange)="newBranch.set($event)" name="newBranch" maxlength="40" />
            <button type="submit">Add empty branch</button>
          </form>
          @if (branch() !== 'main') {
            <button (click)="mergeIntoMain()">Merge {{ branch() }} into main</button>
          }
          <input class="search" placeholder="Search keys" aria-label="Search keys" [ngModel]="search()" (ngModelChange)="search.set($event); onSearch()" />
          <input class="tag-filter" placeholder="tag" aria-label="Filter by tag" [ngModel]="filterTag()" (ngModelChange)="filterTag.set($event); onSearch()" />
          <select aria-label="Filter by review status" [ngModel]="filterStatus()" (ngModelChange)="filterStatus.set($event); onSearch()">
            <option value="">all statuses</option>
            @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
          </select>
          @if (filterStatus()) {
            <span class="review-queue">
              queue: {{ ioLocale() }}
              <select aria-label="Bulk set status" [ngModel]="bulkStatus()" (ngModelChange)="bulkStatus.set($event)" name="bulkStatus">
                @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
              </select>
              <button (click)="bulkMark()">Mark all</button>
            </span>
          }
          <form class="inline" (ngSubmit)="addKey()">
            <input placeholder="new.key.name" aria-label="New key name" [ngModel]="newKey()" (ngModelChange)="newKey.set($event)" name="newKey" required />
            <button type="submit">Add key</button>
          </form>
          <form class="inline" (ngSubmit)="addLocale()">
            <input placeholder="locale (e.g. fr)" aria-label="New locale code" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit">Add locale</button>
          </form>
          <select [ngModel]="ioFormat()" (ngModelChange)="onFormatPick($event)" name="ioFormat" aria-label="Import/export format">
            <option value="json">JSON</option>
            <option value="csv">CSV (spreadsheet-safe)</option>
            <option value="android">Android XML</option>
            <option value="po">PO (gettext)</option>
            <option value="pot">POT (gettext template)</option>
            <option value="xliff">XLIFF 1.2</option>
            <option value="resx">RESX (.NET)</option>
            <option value="properties">Java properties</option>
            <option value="arb">ARB (Flutter)</option>
            <option value="yaml">YAML</option>
            <option value="ios">iOS strings</option>
          </select>
          <button (click)="exportFile()">Export {{ formatLabel() }}</button>
          <button (click)="exportBundleFile()" title="Download every locale as one zip in the selected format">Export all (.zip)</button>
          <button (click)="exportTmxFile()" title="Download the translation memory for the selected locale as TMX 1.4 (export-only)">Export TM (TMX)</button>
          <label class="import">Import {{ formatLabel() }} <input type="file" name="importFile" accept=".json,.csv,.xml,.strings,.po,.pot,.xlf,.xliff,.properties,.arb,.yaml,.yml,.resx" (change)="importFile($event)" hidden /></label>
          <label class="import">Preview import <input type="file" name="previewFile" accept=".json,.csv,.xml,.strings,.po,.pot,.xlf,.xliff,.properties,.arb,.yaml,.yml,.resx" (change)="previewFile($event)" hidden /></label>
          <label class="import" title="Upload a store-only zip from Export all (.zip); compressed zips from other tools are rejected. Each locale imports independently: skipped entries and failed locales are reported, not rolled back.">Import bundle (.zip) <input type="file" name="bundleFile" accept=".zip" (change)="bundleFile($event)" hidden /></label>
          <div class="muted csv-note">.zip bundles: store-only archives from Export all (.zip) only - compressed zips are rejected. Each locale imports independently; skipped entries and failed locales are reported, not rolled back.</div>
          @if (ioFormat() === 'csv') {
            <div class="muted csv-note">CSV exports are spreadsheet-safe: values starting with formula characters get a protective prefix, so re-importing a safe export keeps those prefixes and changes stored values. For a lossless roundtrip use the API with <code>mode=raw</code>.</div>
          }
          @if (importConflict(); as c) {
            <div class="import-conflict" role="alert">
              <span>{{ c.filename }} has a .{{ c.ext }} extension, which usually means {{ labelFor(c.detected) }}, but the format is set to {{ labelFor(c.current) }}. Nothing was imported yet.</span>
              <button type="button" (click)="resolveImportConflict(true)">{{ c.dryRun ? 'Preview as' : 'Import as' }} {{ labelFor(c.detected) }}</button>
              <button type="button" (click)="resolveImportConflict(false)">{{ c.dryRun ? 'Preview as' : 'Keep' }} {{ labelFor(c.current) }}</button>
              <button type="button" (click)="importConflict.set(null)">Cancel</button>
            </div>
          }
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
                <td class="key"><code>{{ k.name }}</code>
                  <span class="tags">
                    @for (t of k.tags; track t) { <span class="tag-chip">{{ t }}</span> }
                    @if (tagEditFor() === k.id) {
                      <input class="tag-edit" aria-label="Edit tags (comma separated)"
                        [ngModel]="tagDraft()" (ngModelChange)="tagDraft.set($event)"
                        (blur)="saveTags(k)" (keydown.enter)="saveTags(k)" />
                    } @else {
                      <button class="tags-toggle" (click)="openTagEdit(k)">tags</button>
                    }
                  </span>
                  <button class="history-toggle" [attr.aria-expanded]="historyFor() === k.id"
                    (click)="toggleHistory(k)">history</button>
                  <button class="comments-toggle" [attr.aria-expanded]="commentsFor() === k.id"
                    (click)="toggleComments(k)">comments{{ k._count?.comments ? ' (' + k._count.comments + ')' : '' }}</button>
                  <button class="shots-toggle" [attr.aria-expanded]="shotsFor() === k.id"
                    (click)="toggleShots(k)">shots{{ k._count?.screenshots ? ' (' + k._count.screenshots + ')' : '' }}</button></td>
                @for (l of p.locales; track l.code) {
                  <td [attr.data-locale]="l.code">
                    <textarea rows="1" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                      [ngModel]="cell(k.id, l.code)().value"
                      (ngModelChange)="edit(k, l.code, $event)"
                      (focus)="onCellFocus(k, l.code)"
                      (blur)="save(k, l.code)"
                      [attr.aria-label]="k.name + ' in ' + l.code"></textarea>
                    @if (k.isPlural) {
                      <div class="plural-forms">
                        @for (cat of pluralCategories(l.code); track cat) {
                          <label class="plural-field"><span class="plural-cat">{{ cat }}</span>
                            <input type="text" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                              [ngModel]="cell(k.id, l.code)().forms[cat] ?? ''"
                              (ngModelChange)="editForm(k, l.code, cat, $event)"
                              (blur)="save(k, l.code)"
                              [attr.aria-label]="k.name + ' ' + cat + ' form in ' + l.code" />
                          </label>
                        }
                      </div>
                    }
                    @if (suggestFor() === k.id + ':' + l.code && suggestions().length > 0) {
                      <div class="tm-suggest">
                        @for (sg of suggestions(); track sg.targetText) {
                          <button type="button" class="tm-pick"
                            (mousedown)="applySuggestion(k, l.code, sg.targetText); $event.preventDefault()">
                            <span [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'">{{ sg.targetText }}</span>
                            <span class="muted">memory {{ Math.round(sg.score * 100) }}%</span>
                          </button>
                        }
                      </div>
                    }
                    <div class="cell-foot">
                      <select class="review" [class]="'review review-' + cell(k.id, l.code)().review.toLowerCase()"
                        [ngModel]="cell(k.id, l.code)().review"
                        (ngModelChange)="setReview(k, l.code, $event)"
                        [attr.aria-label]="'Review status for ' + k.name + ' in ' + l.code">
                        @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
                        @if (!statuses.includes(cell(k.id, l.code)().review)) {
                          <option [value]="cell(k.id, l.code)().review">{{ cell(k.id, l.code)().review.toLowerCase() }} (removed)</option>
                        }
                      </select>
                      @if (cell(k.id, l.code)().status === 'error') {
                        <button class="cell-status retry" (click)="save(k, l.code, true)">save failed - retry</button>
                        @if (cell(k.id, l.code)().errorMsg) {
                          <span class="cell-error-reason">{{ cell(k.id, l.code)().errorMsg }}</span>
                        }
                      } @else {
                        <span class="cell-status">{{ statusText(k.id, l.code) }}</span>
                      }
                    </div>
                    @if (l.code !== p.baseLocale && glossaryHints(k, l.code).length) {
                      <div class="glossary-hints">
                        @for (h of glossaryHints(k, l.code); track h.term + '-' + h.locale) {
                          <div class="glossary-hint" [title]="h.notes">glossary &middot; {{ h.locale }}: <code>{{ h.term }}</code> &rarr; <strong [attr.dir]="isRtl(h.locale) ? 'rtl' : 'ltr'">{{ h.value }}</strong></div>
                        }
                      </div>
                    }
                  </td>
                }
                <td><button class="danger" [attr.aria-label]="'Delete key ' + k.name" title="Delete key" (click)="removeKey(k)">&times;</button></td>
              </tr>
              @if (shotsFor() === k.id) {
                <tr class="history-row shots-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (shotsLoading()) { <p class="muted">Loading screenshots…</p> }
                  @else {
                    @if (shots().length === 0) { <p class="muted">No screenshots yet. Add one to give translators visual context.</p> }
                    <ul class="shots-list">
                      @for (sh of shots(); track sh.id) {
                        <li>
                          <img [src]="shotUrls()[sh.id]" [alt]="'Screenshot ' + sh.filename" width="160" />
                          <span class="muted">{{ sh.filename }} · {{ sh.uploader?.displayName ?? 'unknown' }}</span>
                          <button class="danger" [attr.aria-label]="'Delete screenshot ' + sh.filename" (click)="deleteShot(k, sh.id)">&times;</button>
                        </li>
                      }
                    </ul>
                    <label class="shot-upload">Add screenshot (PNG, JPEG, GIF or WebP, max 2 MB)
                      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Upload screenshot"
                        (change)="uploadShot(k, $event)" />
                    </label>
                  }
                </td></tr>
              }
              @if (commentsFor() === k.id) {
                <tr class="history-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (commentsLoading()) { <p class="muted">Loading comments…</p> }
                  @else {
                    @if (comments().length === 0) { <p class="muted">No comments yet.</p> }
                    <ul class="history-list">
                      @for (cm of comments(); track cm.id) {
                        <li>
                          <code>{{ cm.localeCode ?? 'all' }}</code>
                          <span>{{ cm.body }}</span>
                          <span class="muted">{{ cm.author?.displayName ?? 'unknown' }} · {{ cm.createdAt | date:'short' }}</span>
                          <button class="danger" [attr.aria-label]="'Delete comment'" (click)="deleteComment(k, cm.id)">&times;</button>
                        </li>
                      }
                    </ul>
                    <form class="comment-form" (ngSubmit)="addComment(k)">
                      <input aria-label="New comment" placeholder="Add a comment…" maxlength="2000"
                        [ngModel]="commentDraft()" (ngModelChange)="commentDraft.set($event)" name="commentDraft" required />
                      <select aria-label="Comment scope" [ngModel]="commentLocale()" (ngModelChange)="commentLocale.set($event)" name="commentLocale">
                        <option value="">all languages</option>
                        @for (l of p.locales; track l.code) { <option [value]="l.code">{{ l.code }}</option> }
                      </select>
                      <button type="submit">Post</button>
                    </form>
                  }
                </td></tr>
              }
              @if (historyFor() === k.id) {
                <tr class="history-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (historyLoading()) { <p class="muted">Loading history…</p> }
                  @else if (historyEntries().length === 0) { <p class="muted">No changes recorded yet.</p> }
                  @else {
                    <ul class="history-list">
                      @for (h of historyEntries(); track h.id) {
                        <li>
                          <code>{{ h.locale }}</code>
                          <span class="review review-{{ h.status.toLowerCase() }}">{{ h.status.toLowerCase() }}</span>
                          <span class="h-value" [attr.dir]="isRtl(h.locale) ? 'rtl' : 'ltr'">{{ h.value || '(empty)' }}</span>
                          <span class="muted">{{ h.changedBy?.displayName ?? 'unknown' }} · {{ h.createdAt | date:'short' }}</span>
                        </li>
                      }
                    </ul>
                  }
                </td></tr>
              }
            }
          </tbody>
        </table>
      }
    </main>
    @if (mergePreview(); as mp) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-label="Merge preview">
          <h3>Merge {{ mp.from }} into main</h3>
          <p class="muted">Copy-forward: {{ mp.from }} itself stays as it is.</p>
          <ul class="merge-diff">
            @for (line of mp.lines; track line) {
              <li [class.warn]="line.startsWith('WARNING')">{{ line }}</li>
            }
          </ul>
          <p class="muted">An automatic snapshot of the current state is taken first, and every overwritten translation keeps its previous value in history. Anything changed on main after this preview is skipped, not overwritten.</p>
          <div class="modal-actions">
            <button class="primary" (click)="confirmMerge()">Merge now</button>
            <button (click)="mergePreview.set(null)">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EditorComponent implements OnInit {
  project = signal<Project | null>(null);
  keys = signal<Key[]>([]);
  cells = new Map<string, WritableSignal<CellState>>();
  search = signal(''); newKey = signal(''); newLocale = signal(''); ioLocale = signal('en'); bulkStatus = signal('REVIEWED');
  branch = signal('main'); branches = signal<BranchInfo[]>([]); newBranch = signal('');
  mergePreview = signal<{ branchId: string; from: string; lines: string[]; previewAt: string } | null>(null); ioFormat = signal<'json' | 'csv' | 'android' | 'ios' | 'po' | 'pot' | 'xliff' | 'properties' | 'arb' | 'yaml' | 'resx'>('json');
  ioFormatTouched = signal(false);
  importConflict = signal<{ filename: string; ext: string; detected: IoFormat; current: IoFormat; text: string; dryRun: boolean } | null>(null);
  glossary = signal<GlossaryTermItem[]>([]);
  filterTag = signal(''); filterStatus = signal<'' | TranslationStatus>('');
  tagEditFor = signal<string | null>(null);
  tagDraft = signal('');
  historyFor = signal<string | null>(null);
  suggestFor = signal<string | null>(null);
  suggestions = signal<TmSuggestion[]>([]);
  Math = Math;
  shotsFor = signal<string | null>(null);
  shots = signal<ScreenshotMeta[]>([]);
  shotUrls = signal<Record<string, string>>({});
  shotsLoading = signal(false);
  commentsFor = signal<string | null>(null);
  comments = signal<CommentEntry[]>([]);
  commentDraft = signal('');
  commentLocale = signal('');
  commentsLoading = signal(false);
  historyEntries = signal<(HistoryEntry & { locale: string })[]>([]);
  historyLoading = signal(false);
  readonly baseStatuses = ['UNVERIFIED', 'TRANSLATED', 'REVIEWED'];
  get statuses(): string[] { return [...this.baseStatuses, ...(this.project()?.customStatuses ?? [])]; }
  notice = signal(''); error = signal('');
  projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() {
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p); this.ioLocale.set(p.baseLocale);
      this.branches.set(await this.api.listBranches(this.projectId));
      this.api.listGlossary(this.projectId).then((g) => this.glossary.set(g)).catch(() => this.glossary.set([]));
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
      const keys = await this.api.listKeys(this.projectId, {
        search: this.search() || undefined,
        tag: this.filterTag() || undefined,
        status: this.filterStatus() || undefined,
        locale: this.filterStatus() ? this.ioLocale() : undefined,
        branch: this.branch(),
      });
      this.keys.set(keys);
      this.cells.clear();
      for (const k of keys) for (const t of k.translations) {
        this.cells.set(`${k.id}:${t.localeCode}`,
          signal({ value: t.value, saved: t.value, status: 'idle', errorMsg: '', review: t.status ?? 'UNVERIFIED',
            forms: { ...(t.pluralForms ?? {}) }, savedForms: { ...(t.pluralForms ?? {}) } }));
      }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load keys'); }
  }
  cell(keyId: string, locale: string): WritableSignal<CellState> {
    let s = this.cells.get(`${keyId}:${locale}`);
    if (!s) {
      s = signal<CellState>({ value: '', saved: '', status: 'idle', errorMsg: '', review: 'UNVERIFIED', forms: {}, savedForms: {} });
      this.cells.set(`${keyId}:${locale}`, s);
    }
    return s;
  }
  edit(k: Key, locale: string, value: string) {
    this.cell(k.id, locale).update((c) => ({ ...c, value }));
  }
  editForm(k: Key, locale: string, category: string, value: string) {
    this.cell(k.id, locale).update((c) => ({ ...c, forms: { ...c.forms, [category]: value } }));
  }
  pluralCategories(locale: string): string[] {
    // Browser ICU (Intl.PluralRules) is the same CLDR source the API
    // validates against; invalid locale codes fall back to "other" only.
    try { return new Intl.PluralRules(locale).resolvedOptions().pluralCategories; }
    catch { return ['other']; }
  }
  private sameForms(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
  }
  async save(k: Key, locale: string, force = false) {
    const sig = this.cell(k.id, locale);
    const c = sig();
    if (!force && c.value === c.saved && this.sameForms(c.forms, c.savedForms)) return;
    if (c.status === 'saving') return;
    const reviewAtSend = c.review;
    // Plural keys send every category the locale supports (empty string when
    // untouched), so the required "other" is always present.
    const formsAtSend = k.isPlural
      ? Object.fromEntries(this.pluralCategories(locale).map((cat) => [cat, c.forms[cat] ?? '']))
      : undefined;
    sig.set({ ...c, status: 'saving' });
    try {
      const res = await this.api.upsertTranslation(this.projectId, k.id, locale, c.value, formsAtSend);
      const latest = sig();
      const newerReview = latest.review !== reviewAtSend;
      // A review the user chose while the save was in flight wins over the
      // (older) save response, and is re-sent so the server ends consistent.
      sig.set({ value: latest.value, saved: c.value, errorMsg: '',
        forms: latest.forms, savedForms: formsAtSend ?? latest.savedForms,
        status: latest.value === c.value && this.sameForms(latest.forms, c.forms) ? 'saved' : 'idle',
        review: newerReview ? latest.review : (res.status ?? 'UNVERIFIED') });
      if (newerReview) {
        const st = await this.api.setStatus(this.projectId, k.id, locale, latest.review);
        sig.update((cur) => ({ ...cur, review: st.status }));
      }
    } catch (e) {
      // Keep saved pointing at what the server actually holds so a retry
      // re-sends. Surface the server's reason (e.g. a task key lock) so the
      // user can resolve the cause instead of blind-retrying.
      const msg = e instanceof Error && e.message ? e.message : 'save failed';
      sig.update((cur) => ({ ...cur, status: 'error', errorMsg: msg }));
    }
  }
  statusText(keyId: string, locale: string): string {
    const s = this.cell(keyId, locale)().status;
    return s === 'saving' ? 'saving…' : s === 'saved' ? 'saved' : s === 'error' ? 'save failed' : '';
  }
  isRtl(code: string) { return ['he', 'ar', 'fa', 'ur'].some((r) => code.startsWith(r)); }
  glossaryHints(k: Key, targetLocale: string): GlossaryHint[] {
    const p = this.project();
    if (!p || targetLocale === p.baseLocale || !this.glossary().length) return [];
    const source = this.cell(k.id, p.baseLocale)().value;
    return hintsForTarget(source, targetLocale, this.glossary());
  }

  async setReview(k: Key, locale: string, status: TranslationStatus) {
    const sig = this.cell(k.id, locale);
    try {
      const res = await this.api.setStatus(this.projectId, k.id, locale, status);
      sig.update((c) => ({ ...c, review: res.status }));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to set status'); }
  }
  openTagEdit(k: Key) {
    this.tagEditFor.set(k.id);
    this.tagDraft.set(k.tags.join(', '));
  }
  async saveTags(k: Key) {
    if (this.tagEditFor() !== k.id) return;
    const tags = this.tagDraft().split(',').map((t) => t.trim()).filter(Boolean);
    this.tagEditFor.set(null);
    try {
      await this.api.setTags(this.projectId, k.id, tags);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to save tags'); }
  }
  async toggleComments(k: Key) {
    if (this.commentsFor() === k.id) { this.commentsFor.set(null); return; }
    this.commentsFor.set(k.id); this.commentsLoading.set(true); this.comments.set([]);
    this.commentDraft.set(''); this.commentLocale.set('');
    try {
      this.comments.set(await this.api.listComments(this.projectId, k.id));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load comments'); }
    finally { this.commentsLoading.set(false); }
  }
  async addComment(k: Key) {
    const body = this.commentDraft().trim();
    if (!body) return;
    try {
      await this.api.addComment(this.projectId, k.id, body, this.commentLocale() || undefined);
      await this.reload();
      this.comments.set(await this.api.listComments(this.projectId, k.id));
      this.commentDraft.set('');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to add comment'); }
  }
  // Translation memory: only for empty cells with a base-locale source.
  // Applying is an explicit click and saves through the normal path - the
  // cell stays unverified until a human reviews it.
  async onCellFocus(k: Key, locale: string) {
    const base = this.project()?.baseLocale;
    if (!base || locale === base || this.cell(k.id, locale)().value.trim()) {
      this.suggestFor.set(null); this.suggestions.set([]);
      return;
    }
    const source = this.cell(k.id, base)().value.trim();
    if (!source) { this.suggestFor.set(null); this.suggestions.set([]); return; }
    const id = `${k.id}:${locale}`;
    this.suggestFor.set(id);
    try {
      const res = await this.api.suggestTm(this.projectId, locale, source);
      if (this.suggestFor() === id) this.suggestions.set(res.suggestions.slice(0, 3));
    } catch { if (this.suggestFor() === id) this.suggestions.set([]); }
  }
  async applySuggestion(k: Key, locale: string, text: string) {
    this.cell(k.id, locale).update((c) => ({ ...c, value: text }));
    this.suggestFor.set(null); this.suggestions.set([]);
    await this.save(k, locale, true);
  }
  async toggleShots(k: Key) {
    if (this.shotsFor() === k.id) { this.shotsFor.set(null); return; }
    this.shotsFor.set(k.id); this.shotsLoading.set(true); this.shots.set([]); this.shotUrls.set({});
    try {
      const list = await this.api.listScreenshots(this.projectId, k.id);
      this.shots.set(list);
      const urls: Record<string, string> = {};
      for (const sh of list) urls[sh.id] = await this.api.screenshotUrl(this.projectId, k.id, sh.id);
      this.shotUrls.set(urls);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load screenshots'); }
    finally { this.shotsLoading.set(false); }
  }
  async uploadShot(k: Key, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.api.uploadScreenshot(this.projectId, k.id, file);
      await this.reload();
      this.shotsFor.set(null);
      await this.toggleShots(k);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to upload screenshot'); }
    finally { input.value = ''; }
  }
  async deleteShot(k: Key, shotId: string) {
    try {
      await this.api.deleteScreenshot(this.projectId, k.id, shotId);
      await this.reload();
      this.shotsFor.set(null);
      await this.toggleShots(k);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to delete screenshot'); }
  }
  async deleteComment(k: Key, commentId: string) {
    try {
      await this.api.deleteComment(this.projectId, k.id, commentId);
      await this.reload();
      this.comments.set(await this.api.listComments(this.projectId, k.id));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to delete comment'); }
  }
  async toggleHistory(k: Key) {
    if (this.historyFor() === k.id) { this.historyFor.set(null); return; }
    this.historyFor.set(k.id); this.historyLoading.set(true); this.historyEntries.set([]);
    try {
      const locales = this.project()?.locales ?? [];
      const all = await Promise.all(
        locales.map(async (l) =>
          (await this.api.getHistory(this.projectId, k.id, l.code)).map((h) => ({ ...h, locale: l.code }))),
      );
      this.historyEntries.set(
        all.flat().sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()).slice(0, 50),
      );
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load history'); }
    finally { this.historyLoading.set(false); }
  }
  async addKey() {
    const submitted = this.newKey();
    try {
      await this.api.createKey(this.projectId, { name: submitted, branch: this.branch() });
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
      const data = await this.api.exportJson(this.projectId, this.ioLocale(), this.branch());
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.project()?.slug ?? 'export'}.${this.ioLocale()}.json`;
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Export failed'); }
  }
  async switchBranch(name: string) {
    this.branch.set(name);
    this.notice.set('');
    this.error.set('');
    await this.reload();
  }
  async addBranch() {
    const name = this.newBranch().trim();
    if (!name) return;
    this.error.set('');
    try {
      await this.api.createBranch(this.projectId, name);
      this.newBranch.set('');
      this.branches.set(await this.api.listBranches(this.projectId));
      this.notice.set(`Empty branch ${name} created. Branches start with no keys - they do not copy ${this.branch()} or any other branch. Pick it from the branch list to work there.`);
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Failed to create branch'); }
  }
  async mergeIntoMain() {
    const from = this.branch();
    const b = this.branches().find((x) => x.name === from);
    if (!b) return;
    this.error.set('');
    try {
      const p = await this.api.previewMergeBranch(this.projectId, b.id, 'main');
      const lines = [
        `${p.keysCreated} new key(s) added to main`,
        `${p.keysExisting} key(s) exist on both; main gets ${from}'s description, plural and tag settings`,
        `${p.translationsAdded} translation(s) added`,
        `${p.translationsIdentical} identical, skipped`,
      ];
      if (p.translationsOverwritten > 0) {
        lines.push(`WARNING: ${p.translationsOverwritten} existing main translation(s) will be OVERWRITTEN by ${from}'s version`);
      } else {
        lines.push('No existing main translation is overwritten.');
      }
      lines.push(`${p.targetOnlyKeys} key(s) only on main are kept untouched`);
      this.mergePreview.set({ branchId: b.id, from, lines, previewAt: p.previewAt });
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Merge preview failed'); }
  }
  async confirmMerge() {
    const mp = this.mergePreview();
    if (!mp) return;
    this.error.set('');
    try {
      const res = await this.api.mergeBranch(this.projectId, mp.branchId, 'main', mp.previewAt);
      this.mergePreview.set(null);
      const skipped = res.translationsSkipped > 0 || res.keysSkipped > 0
        ? ` ${res.keysSkipped} key(s) and ${res.translationsSkipped} translation(s) changed on main after the preview were skipped - preview again to re-check them.`
        : '';
      this.notice.set(`Merged ${res.merged}: ${res.keysMerged} keys, ${res.translationsMerged} translations copied.${skipped}`);
      await this.reload();
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Merge failed'); }
  }
  // Review queue: set one status for the translations the CURRENT filter
  // selects in the selected locale. Previews the exact affected count first;
  // the server re-checks status/value at write time, so rows edited between
  // preview and confirm are excluded. Empty translations are never marked.
  async bulkMark() {
    this.error.set('');
    const scope = { locale: this.ioLocale(), status: this.bulkStatus(), from: this.filterStatus() || undefined, search: this.search() || undefined, tag: this.filterTag() || undefined, branch: this.branch() };
    try {
      const preview = await this.api.bulkSetStatus(this.projectId, { ...scope, dryRun: true });
      const bits = [];
      if (scope.from) bits.push(`currently ${scope.from.toLowerCase()}`);
      if (scope.search) bits.push(`keys matching "${scope.search}"`);
      if (scope.tag) bits.push(`tagged ${scope.tag}`);
      const scopeText = bits.length ? ` (${bits.join(', ')})` : '';
      if (!confirm(`Mark up to ${preview.matched} translations in ${scope.locale} on branch ${scope.branch}${scopeText} as ${scope.status.toLowerCase()}?\nOnly branch ${scope.branch} is touched. Empty translations are skipped, and anything saved after this preview is excluded.`)) return;
      const res = await this.api.bulkSetStatus(this.projectId, { ...scope, notChangedSince: preview.previewAt ?? undefined });
      this.notice.set(`Marked ${res.updated} translations in ${scope.locale} as ${scope.status.toLowerCase()}.`);
      await this.reload();
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Bulk update failed'); }
  }
  async bundleFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.notice.set(''); this.error.set('');
    try {
      const res = await this.api.importBundle(this.projectId, this.ioFormat(), file, this.branch());
      const parts = res.imported.map((r) => `${r.locale}: ${r.keysCreated} created, ${r.translationsUpserted} updated, ${r.unchangedSkipped} unchanged${r.failed ? `, ${r.failed} failed` : ''}`);
      const skips = res.skipped.map((x) => `skipped ${x.name} (${x.reason})`);
      const fails = res.failedLocales.map((x) => `${x.locale} failed (${x.error})`);
      const summary = [...parts, ...skips, ...fails].join('; ');
      this.notice.set(`Bundle import (${this.formatLabel()}, ${res.branch}): ${summary || 'no entries'}. Each locale imported independently - skipped/failed entries above were not rolled back.`);
      await this.reload();
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Bundle import failed'); }
  }
  async exportBundleFile() {
    const fmt = this.ioFormat();
    try {
      const blob = await this.api.exportBundle(this.projectId, fmt, this.branch());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.project()?.slug ?? 'export'}-${fmt}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
      this.notice.set(`All locales exported as one zip (${this.formatLabel()}${fmt === 'csv' ? ', spreadsheet-safe' : ''}).`);
      this.error.set('');
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Bundle export failed'); }
  }
  async exportTmxFile() {
    const locale = this.ioLocale();
    try {
      const content = await this.api.exportTmx(this.projectId, locale);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'application/x-tmx+xml' }));
      a.download = `${this.project()?.slug ?? 'export'}-${locale}.tmx`;
      a.click(); URL.revokeObjectURL(a.href);
      this.notice.set(`Translation memory for ${locale} exported as TMX 1.4 (export-only; there is no TMX import).`);
      this.error.set('');
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'TMX export failed'); }
  }

  async exportFile() {
    const fmt = this.ioFormat();
    const locale = this.ioLocale();
    try {
      let content: string, type: string, ext: string;
      if (fmt === 'json') {
        content = JSON.stringify(await this.api.exportJson(this.projectId, locale, this.branch()), null, 2);
        type = 'application/json'; ext = 'json';
      } else if (fmt === 'csv') {
        content = await this.api.exportCsv(this.projectId, locale, undefined, this.branch());
        type = 'text/csv'; ext = 'csv';
      } else {
        content = await this.api.exportText(this.projectId, locale, fmt, this.branch());
        type = fmt === 'android' || fmt === 'xliff' || fmt === 'resx' ? 'text/xml' : fmt === 'arb' ? 'application/json' : fmt === 'yaml' ? 'text/yaml' : 'text/plain';
        ext = fmt === 'android' ? 'xml' : fmt === 'po' ? 'po' : fmt === 'pot' ? 'pot' : fmt === 'xliff' ? 'xlf' : fmt === 'properties' ? 'properties' : fmt === 'arb' ? 'arb' : fmt === 'yaml' ? 'yaml' : fmt === 'resx' ? 'resx' : 'strings';
      }
      const blob = new Blob([content], { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${this.project()?.slug ?? 'export'}.${locale}.${ext}`;
      a.click(); URL.revokeObjectURL(a.href);
      if (fmt === 'csv') this.notice.set('CSV exported (spreadsheet-safe). For a lossless roundtrip export use the API with mode=raw.');
    } catch (err) { this.error.set(err instanceof Error ? err.message : 'Export failed'); }
  }
  labelFor(fmt: IoFormat): string {
    return fmt === 'json' ? 'JSON' : fmt === 'csv' ? 'CSV' : fmt === 'android' ? 'Android XML' : fmt === 'po' ? 'PO (gettext)' : fmt === 'pot' ? 'POT (gettext template)' : fmt === 'xliff' ? 'XLIFF 1.2' : fmt === 'properties' ? 'Java properties' : fmt === 'arb' ? 'ARB (Flutter)' : fmt === 'yaml' ? 'YAML' : fmt === 'resx' ? 'RESX (.NET)' : 'iOS strings';
  }
  formatLabel(): string {
    return this.labelFor(this.ioFormat());
  }
  onFormatPick(fmt: IoFormat) {
    this.ioFormat.set(fmt);
    this.ioFormatTouched.set(true);
    this.importConflict.set(null);
  }
  async importFile(event: Event) {
    return this.handleFile(event, false);
  }
  async previewFile(event: Event) {
    return this.handleFile(event, true);
  }
  private async handleFile(event: Event, dryRun: boolean) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // A new pick supersedes any earlier result AND any open conflict prompt:
    // never let a stale notice or a banner for a different file sit next to
    // this pick's outcome, and never let a banner's mode outlive its file.
    this.notice.set('');
    this.error.set('');
    this.importConflict.set(null);
    const text = await file.text();
    input.value = '';
    // Extension detection never overrides a deliberate format choice. A
    // conflict is presented for an explicit decision before anything is
    // imported; an unknown extension always keeps the current selection.
    const detected = detectImportFormat(file.name);
    if (detected && detected !== this.ioFormat()) {
      if (this.ioFormatTouched()) {
        this.importConflict.set({ filename: file.name, ext: file.name.split('.').pop() ?? '', detected, current: this.ioFormat(), text, dryRun });
        return;
      }
      this.ioFormat.set(detected);
    }
    await this.runImport(text, dryRun);
  }
  async resolveImportConflict(useDetected: boolean) {
    const c = this.importConflict();
    if (!c) return;
    this.importConflict.set(null);
    this.notice.set('');
    this.error.set('');
    if (useDetected) {
      this.ioFormat.set(c.detected);
      this.ioFormatTouched.set(true); // an explicit click on the banner choice
    }
    await this.runImport(c.text, c.dryRun);
  }
  private async runImport(text: string, dryRun: boolean) {
    const fmt = this.ioFormat();
    try {
      const payload = fmt === 'json' ? { entries: JSON.parse(text) }
        : fmt === 'csv' ? { csv: text }
        : fmt === 'android' ? { xml: text } : fmt === 'po' ? { po: text } : fmt === 'pot' ? { pot: text } : fmt === 'xliff' ? { xliff: text } : fmt === 'properties' ? { properties: text } : fmt === 'arb' ? { arb: text } : fmt === 'yaml' ? { yaml: text } : fmt === 'resx' ? { resx: text } : { strings: text };
      const res = await this.api.importPayload(this.projectId, this.ioLocale(), payload, this.branch(), dryRun);
      this.error.set('');
      this.notice.set(dryRun
        ? `Preview only - nothing imported: would create ${res.keysCreated} keys, update ${res.translationsUpserted} translations, ${res.unchangedSkipped} unchanged${res.failed ? `, ${res.failed} would fail: ${(res.failures ?? []).join('; ')}` : ''} (${this.formatLabel()}, ${this.ioLocale()}).`
        : `Imported ${res.keysCreated} keys, ${res.translationsUpserted} translations (${this.formatLabel()}, ${this.ioLocale()}).`);
      if (!dryRun) await this.reload();
    } catch (err) { this.notice.set(''); this.error.set(err instanceof Error ? err.message : `${dryRun ? 'Preview' : 'Import'} failed: invalid ${this.formatLabel()}`); }
  }
}
