import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ApiService,
  BranchInfo,
  LocalSyncPreview,
  SyncResolutionChoice,
  SyncResolutionDraft,
} from '../api.service';

@Component({
  selector: 'ol-sync-preview',
  imports: [FormsModule, RouterLink],
  styles: [
    `
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 24px;
      }
      .scope,
      .files {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 12px 0;
        min-width: 0;
      }
      input,
      select,
      textarea {
        width: 100%;
        box-sizing: border-box;
      }
      textarea {
        min-height: 180px;
        font-family: monospace;
        resize: vertical;
      }
      .notice {
        color: #654b12;
        padding: 16px;
        background: #fff8e7;
        border: 1px solid #e7cb85;
        border-radius: 8px;
        line-height: 1.5;
      }
      .table-wrap {
        overflow-x: auto;
        margin-top: 16px;
      }
      table {
        width: 100%;
        min-width: 1000px;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 10px;
        text-align: left;
        border-bottom: 1px solid #dce2eb;
        vertical-align: top;
      }
      td {
        max-width: 230px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      th:first-child,
      td:first-child {
        min-width: 120px;
      }
      td select {
        min-width: 160px;
      }
      .manual {
        background: #fff4e8;
      }
      .digest {
        overflow-wrap: anywhere;
      }
      .muted {
        color: #56647b;
      }
      @media (max-width: 600px) {
        main {
          padding: 16px;
        }
        .scope,
        .files {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>File sync preview</h1>
      <a
        [routerLink]="['/projects', projectId, 'sync', 'history']"
        class="history-link"
        >Diagnostic history</a
      >
    </header>
    <main>
      <p class="notice">
        Preview only. Paste flat JSON string maps to compare with this project's
        stored translations. The baseline and remote file are supplied by you,
        not verified with GitHub. Nothing is uploaded, imported or saved.
        Conflicts and deletions need manual review. Session admins only. Plural
        keys are not supported.
      </p>
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (ready()) {
        <form (ngSubmit)="preview()">
          <div class="scope">
            <label
              >Project branch<select
                name="syncBranch"
                [ngModel]="branch"
                (ngModelChange)="branch = $event; invalidate()"
                required
              >
                @for (b of branches(); track b.id) {
                  <option [value]="b.name">{{ b.name }}</option>
                }
              </select></label
            >
            <label
              >Locale<select
                name="syncLocale"
                [ngModel]="locale"
                (ngModelChange)="locale = $event; invalidate()"
                required
              >
                @for (l of locales(); track l) {
                  <option [value]="l">{{ l }}</option>
                }
              </select></label
            >
          </div>
          <label
            >Remote blob SHA (caller-supplied, not verified)
            <input
              name="syncSha"
              [ngModel]="remoteSha"
              (ngModelChange)="remoteSha = $event; invalidate()"
              pattern="[a-f0-9]{40}"
              maxlength="40"
              required
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <div class="files">
            <label
              >Baseline JSON<textarea
                name="syncBaseline"
                [ngModel]="baselineJson"
                (ngModelChange)="baselineJson = $event; invalidate()"
                maxlength="32768"
                required
                spellcheck="false"
                placeholder='{"app.title":"Previous title"}'
              ></textarea>
            </label>
            <label
              >Remote JSON<textarea
                name="syncRemote"
                [ngModel]="remoteJson"
                (ngModelChange)="remoteJson = $event; invalidate()"
                maxlength="32768"
                required
                spellcheck="false"
                placeholder='{"app.title":"Remote title"}'
              ></textarea>
            </label>
          </div>
          <p class="muted">
            Each file: up to 32,768 characters. String values only, no nested
            objects or duplicate keys. Use your known last-synced baseline, not
            an invented empty file.
          </p>
          <button
            class="primary"
            name="syncPreview"
            type="submit"
            [disabled]="loading()"
          >
            {{ loading() ? 'Comparing...' : 'Compare files' }}
          </button>
        </form>
      }
      @if (result(); as p) {
        <section aria-label="Preview results" aria-live="polite">
          <h2>{{ p.branch }} / {{ p.locale }} preview</h2>
          <p class="notice">
            Not applied. {{ p.decisions.length }} keys compared.
            {{
              p.requiresManual
                ? 'Manual review needed.'
                : 'No conflicts or deletions requiring manual review.'
            }}
            Remote and baseline remain unverified.
          </p>
          <p class="muted">
            Scroll the comparison table horizontally to see all columns on
            smaller screens.
          </p>
          <div
            class="table-wrap"
            tabindex="0"
            role="region"
            aria-label="Scrollable key comparison"
          >
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Baseline</th>
                  <th>Local</th>
                  <th>Remote</th>
                  <th>Suggested direction</th>
                  <th>Draft selection</th>
                </tr>
              </thead>
              <tbody>
                @for (d of visibleDecisions(); track d.key) {
                  <tr [class.manual]="d.suggested === 'manual'">
                    <td>{{ d.key }}</td>
                    <td>{{ display(d.base) }}</td>
                    <td>{{ display(d.local) }}</td>
                    <td>{{ display(d.remote) }}</td>
                    <td>{{ direction(d.suggested) }} ({{ d.kind }})</td>
                    <td>
                      @if (needsChoice(d.kind)) {
                        <label
                          >Choose for {{ d.key }}
                          <select
                            [attr.data-resolution-key]="d.key"
                            [ngModel]="choices().get(d.key) ?? ''"
                            (ngModelChange)="choose(d.key, $event)"
                            [ngModelOptions]="{ standalone: true }"
                          >
                            <option value="">Choose explicitly</option>
                            <option value="base">
                              Baseline{{ d.base === null ? ' (omit key)' : '' }}
                            </option>
                            <option value="local">
                              Local{{ d.local === null ? ' (omit key)' : '' }}
                            </option>
                            <option value="remote">
                              Remote{{ d.remote === null ? ' (omit key)' : '' }}
                            </option>
                          </select>
                        </label>
                      } @else {
                        Kept automatically ({{ d.kind }})
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      No translated keys in these files or this project locale.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (p.decisions.length > pageSize) {
            <nav aria-label="Comparison pages" class="toolbar">
              <button
                type="button"
                name="syncPrevious"
                (click)="pageIndex.set(pageIndex() - 1)"
                [disabled]="pageIndex() === 0"
              >
                Previous
              </button>
              <span aria-live="polite"
                >Page {{ pageIndex() + 1 }} of {{ pageCount() }} ({{
                  pageSize
                }}
                keys per page)</span
              >
              <button
                type="button"
                name="syncNext"
                (click)="pageIndex.set(pageIndex() + 1)"
                [disabled]="pageIndex() + 1 >= pageCount()"
              >
                Next
              </button>
            </nav>
          }
          <section aria-label="Prepare draft JSON">
            <h3>Prepare draft JSON</h3>
            <p class="notice">
              Choose every differing key, including changes with a suggested
              direction. Selecting a missing value omits that key from the draft
              only. This does not import, save or send anything to GitHub. The
              baseline and remote remain unverified.
            </p>
            <p aria-live="polite">
              {{ choices().size }} of {{ requiredChoices() }} differing keys
              selected (all comparison pages).
            </p>
            <button
              type="button"
              name="syncResolve"
              (click)="resolve()"
              [disabled]="resolving() || choices().size !== requiredChoices()"
            >
              {{ resolving() ? 'Preparing draft...' : 'Prepare draft JSON' }}
            </button>
            @if (draft(); as draft) {
              <section aria-label="Draft JSON result" aria-live="polite">
                <h3>Draft only. Not applied.</h3>
                <p>
                  {{ draft.outputKeys }} output keys;
                  {{ draft.absentKeys }} absent keys omitted. No translations or
                  repository files have changed. Review the bytes before using
                  them elsewhere.
                </p>
                <label
                  >Draft JSON<textarea
                    name="syncDraft"
                    readonly
                    [value]="draft.json"
                    spellcheck="false"
                  ></textarea>
                </label>
                <p class="digest">SHA256: {{ draft.contentDigest }}</p>
                <button
                  type="button"
                  name="syncDownloadDraft"
                  (click)="downloadDraft()"
                >
                  Download draft JSON
                </button>
              </section>
            }
          </section>
        </section>
      }
    </main>
  `,
})
export class SyncPreviewComponent implements OnInit, OnDestroy {
  projectId = '';
  branch = 'main';
  locale = '';
  baselineJson = '';
  remoteJson = '';
  remoteSha = '';
  branches = signal<BranchInfo[]>([]);
  locales = signal<string[]>([]);
  ready = signal(false);
  loading = signal(false);
  error = signal('');
  result = signal<LocalSyncPreview | null>(null);
  choices = signal(new Map<string, SyncResolutionChoice>());
  draft = signal<SyncResolutionDraft | null>(null);
  resolving = signal(false);
  requiredChoices = computed(
    () =>
      this.result()?.decisions.filter((d) => this.needsChoice(d.kind)).length ??
      0,
  );
  readonly pageSize = 50;
  pageIndex = signal(0);
  pageCount = computed(() =>
    Math.max(
      1,
      Math.ceil((this.result()?.decisions.length ?? 0) / this.pageSize),
    ),
  );
  visibleDecisions = computed(
    () =>
      this.result()?.decisions.slice(
        this.pageIndex() * this.pageSize,
        (this.pageIndex() + 1) * this.pageSize,
      ) ?? [],
  );
  private generation = 0;
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}
  private routeSubscription?: Subscription;
  ngOnInit() {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      void this.load(params.get('id') ?? '');
    });
  }
  async load(id: string) {
    this.invalidate();
    const generation = this.generation;
    this.ready.set(false);
    this.projectId = id;
    this.branches.set([]);
    this.locales.set([]);
    this.branch = 'main';
    this.locale = '';
    this.baselineJson = '';
    this.remoteJson = '';
    this.remoteSha = '';
    try {
      const [project, branches] = await Promise.all([
        this.api.getProject(id),
        this.api.listBranches(id),
      ]);
      if (generation !== this.generation) return;
      this.branches.set(branches);
      this.locales.set(project.locales.map((l) => l.code));
      this.locale = project.baseLocale;
      this.ready.set(true);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not load project',
        );
    }
  }
  ngOnDestroy() {
    this.generation++;
    this.routeSubscription?.unsubscribe();
  }
  invalidate() {
    this.generation++;
    this.result.set(null);
    this.clearDraft();
    this.pageIndex.set(0);
    this.error.set('');
    this.loading.set(false);
  }
  private clearDraft() {
    this.choices.set(new Map());
    this.draft.set(null);
    this.resolving.set(false);
  }
  needsChoice(kind: string) {
    return kind !== 'unchanged' && kind !== 'converged';
  }
  choose(key: string, choice: string) {
    this.generation++;
    const next = new Map(this.choices());
    if (choice === 'base' || choice === 'local' || choice === 'remote')
      next.set(key, choice);
    else next.delete(key);
    this.choices.set(next);
    this.draft.set(null);
    this.resolving.set(false);
    this.error.set('');
  }
  async resolve() {
    const p = this.result();
    if (
      !p ||
      this.resolving() ||
      this.choices().size !== this.requiredChoices()
    )
      return;
    const generation = ++this.generation;
    this.resolving.set(true);
    this.error.set('');
    this.draft.set(null);
    try {
      const draft = await this.api.resolveLocalSync(this.projectId, {
        branch: this.branch,
        locale: this.locale,
        baselineJson: this.baselineJson,
        remoteJson: this.remoteJson,
        remoteSha: this.remoteSha,
        expectedFingerprint: p.fingerprint,
        choices: Object.fromEntries(this.choices()),
      });
      if (generation === this.generation) this.draft.set(draft);
    } catch (e) {
      if (generation !== this.generation) return;
      const message =
        e instanceof Error ? e.message : 'Could not prepare draft';
      if (message.includes('Preview changed')) {
        this.result.set(null);
        this.clearDraft();
      }
      this.error.set(message);
    } finally {
      if (generation === this.generation) this.resolving.set(false);
    }
  }
  downloadDraft() {
    const draft = this.draft();
    if (!draft) return;
    const url = URL.createObjectURL(
      new Blob([draft.json], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'open-locale-draft.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  display(value: string | null) {
    return value === null
      ? '[missing]'
      : value === ''
        ? '[empty string]'
        : value;
  }
  direction(value: string) {
    return (
      (
        {
          none: 'No change',
          push: 'Local to remote',
          pull: 'Remote to local',
          manual: 'Manual review',
        } as Record<string, string>
      )[value] ?? value
    );
  }
  async preview() {
    const generation = ++this.generation;
    this.clearDraft();
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
    this.pageIndex.set(0);
    try {
      const p = await this.api.previewLocalSync(this.projectId, {
        branch: this.branch,
        locale: this.locale,
        baselineJson: this.baselineJson,
        remoteJson: this.remoteJson,
        remoteSha: this.remoteSha,
      });
      if (generation === this.generation) this.result.set(p);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
