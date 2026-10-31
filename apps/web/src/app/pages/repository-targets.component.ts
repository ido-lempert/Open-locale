import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ApiService,
  RepositoryTargetInput,
  RepositoryTargetConfig,
  RepositoryFileSnapshot,
  RepositoryBaselineView,
  RepositorySyncPreview,
  RepositoryResolutionDraft,
  SyncResolutionChoice,
  BranchInfo,
} from '../api.service';
const empty = (): RepositoryTargetInput => ({
  localBranch: 'main',
  locale: '',
  owner: '',
  repo: '',
  path: '',
  remoteBranch: 'main',
});
@Component({
  selector: 'ol-repository-targets',
  imports: [FormsModule, RouterLink],
  styles: [
    `
      .table-wrap {
        overflow-x: auto;
      }
      table {
        min-width: 1050px;
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 10px;
        border-bottom: 1px solid #dce2eb;
        vertical-align: top;
        min-width: 100px;
        max-width: 240px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .manual {
        background: #fff4e8;
      }
      fieldset {
        min-width: 0;
        border: 1px solid #dce2eb;
        border-radius: 8px;
      }
      .digest {
        overflow-wrap: anywhere;
      }
      textarea {
        width: 100%;
        min-height: 180px;
        box-sizing: border-box;
        font-family: monospace;
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .notice {
        color: #654b12;
        background: #fff8e7;
        border: 1px solid #e7cb85;
        border-radius: 8px;
        padding: 16px;
        line-height: 1.5;
      }
      .fields {
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
      select {
        width: 100%;
        box-sizing: border-box;
      }
      article {
        background: white;
        border: 1px solid #dce2eb;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .success {
        color: #25603c;
      }
      h2 {
        font-size: 1.2rem;
      }
      code {
        overflow-wrap: anywhere;
      }
      button {
        min-height: 36px;
      }
      @media (max-width: 600px) {
        main {
          padding: 16px;
        }
        .fields {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: ` <header class="bar">
      <a class="back" [routerLink]="['/projects', projectId, 'sync']"
        >&larr; File preview</a
      >
      <h1>Repository targets</h1>
    </header>
    <main>
      <p class="notice">
        Configuration only. These coordinates do not connect to GitHub, grant
        credentials, accept a baseline or run sync. Reading a file requires
        separately configured deployment read access. No repository files or
        translations change. Session admins only. Do not paste tokens or
        passwords here.
      </p>
      @if (error()) {
        <p role="alert" class="error">{{ error() }}</p>
      }
      @if (message()) {
        <p role="status" class="success">{{ message() }}</p>
      }
      @if (ready()) {
        <button
          type="button"
          name="targetRefresh"
          (click)="refresh()"
          [disabled]="busy()"
        >
          Refresh configurations
        </button>
        <h2>
          {{
            editing() ? 'Edit target configuration' : 'Add target configuration'
          }}
        </h2>
        <form (ngSubmit)="save()">
          <fieldset [disabled]="busy()">
            <div class="fields">
              <label
                >Local branch<select
                  name="targetLocalBranch"
                  [(ngModel)]="form.localBranch"
                  required
                >
                  @for (b of branches(); track b.id) {
                    <option [value]="b.name">{{ b.name }}</option>
                  }
                </select></label
              >
              <label
                >Locale<select
                  name="targetLocale"
                  [(ngModel)]="form.locale"
                  required
                >
                  @for (l of locales(); track l) {
                    <option [value]="l">{{ l }}</option>
                  }
                </select></label
              >
              <label
                >Repository owner<input
                  name="targetOwner"
                  [(ngModel)]="form.owner"
                  maxlength="39"
                  required
                  autocomplete="off"
                  placeholder="owner"
              /></label>
              <label
                >Repository name<input
                  name="targetRepo"
                  [(ngModel)]="form.repo"
                  maxlength="100"
                  required
                  autocomplete="off"
                  placeholder="repository"
              /></label>
              <label
                >File path (relative to repository)<input
                  name="targetPath"
                  [(ngModel)]="form.path"
                  maxlength="1024"
                  required
                  autocomplete="off"
                  placeholder="locales/en.json"
              /></label>
              <label
                >Remote branch<input
                  name="targetRemoteBranch"
                  [(ngModel)]="form.remoteBranch"
                  maxlength="255"
                  required
                  autocomplete="off"
              /></label>
            </div>
            <p>
              One target per local branch and locale; up to 100 per project. No
              credentials are stored.
            </p>
            <div class="actions">
              <button name="targetSave" type="submit">
                {{
                  busy()
                    ? 'Saving...'
                    : editing()
                      ? 'Save configuration'
                      : 'Add configuration'
                }}
              </button>
              @if (editing()) {
                <button name="targetCancel" type="button" (click)="cancel()">
                  Cancel edit
                </button>
              }
            </div>
          </fieldset>
        </form>
        <h2>Saved configurations ({{ targets().length }})</h2>
        @for (t of targets(); track t.id) {
          <article [attr.data-target-id]="t.id">
            <h2>{{ t.localBranch }} / {{ t.locale }}</h2>
            <p>{{ t.owner }} / {{ t.repo }}</p>
            <p>
              File: <code>{{ t.path }}</code>
            </p>
            <p>
              Remote branch: {{ t.remoteBranch }}. Revision {{ t.revision }}.
            </p>
            <p>
              No sync connection. Sync cannot run. A comparison baseline is
              separate from synchronization.
            </p>
            <button
              name="targetLoadBaseline"
              type="button"
              (click)="loadBaseline(t)"
              [disabled]="busy()"
            >
              View accepted baseline
            </button>
            <button
              name="targetRead"
              type="button"
              (click)="read(t)"
              [disabled]="busy()"
            >
              Read repository file
            </button>
            <button
              name="targetPreview"
              type="button"
              (click)="preview(t)"
              [disabled]="busy()"
            >
              Compare repository with local translations
            </button>
            @if (previewResult()?.targetId === t.id) {
              <section aria-label="Repository comparison">
                <h3>Repository comparison - not applied</h3>
                <p class="notice">
                  Accepted baseline version
                  {{ previewResult()!.baselineVersion }}, current local
                  {{ previewResult()!.branch }} / {{ previewResult()!.locale }},
                  and fresh verified repository bytes. Conflicts and missing
                  values need manual review. Nothing is imported, pushed or
                  saved.
                </p>
                <p>
                  {{ previewResult()!.decisions.length }} keys compared.
                  {{
                    previewResult()!.requiresManual
                      ? 'Manual review needed.'
                      : 'No conflicts or deletions requiring manual review.'
                  }}
                </p>
                <p class="digest">
                  Remote blob SHA: {{ previewResult()!.remoteSha }}
                </p>
                <p>Scroll the table horizontally on smaller screens.</p>
                <div
                  class="table-wrap"
                  tabindex="0"
                  role="region"
                  aria-label="Repository comparison table"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Accepted baseline</th>
                        <th>Local</th>
                        <th>Repository</th>
                        <th>Difference</th>
                        <th>Draft selection</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (d of previewRows(); track d.key) {
                        <tr [class.manual]="d.suggested === 'manual'">
                          <td>{{ d.key }}</td>
                          <td>{{ display(d.base) }}</td>
                          <td>{{ display(d.local) }}</td>
                          <td>{{ display(d.remote) }}</td>
                          <td>
                            {{ d.kind
                            }}{{
                              d.suggested === 'manual' ? ' - manual review' : ''
                            }}
                          </td>
                          <td>
                            @if (
                              d.kind !== 'unchanged' && d.kind !== 'converged'
                            ) {
                              <select
                                [attr.aria-label]="'Draft value for ' + d.key"
                                [attr.data-repo-choice]="d.key"
                                [ngModel]="choices().get(d.key) ?? ''"
                                (ngModelChange)="choose(d.key, $event)"
                                [disabled]="busy()"
                              >
                                <option value="">Choose...</option>
                                <option value="base">Accepted baseline</option>
                                <option value="local">Local</option>
                                <option value="remote">Repository</option>
                              </select>
                            } @else {
                              Same value retained
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6">No translated keys to compare.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (previewPages() > 1) {
                  <nav aria-label="Repository comparison pages">
                    <button
                      name="targetPreviewPrevious"
                      type="button"
                      (click)="previewPage.set(previewPage() - 1)"
                      [disabled]="previewPage() === 0"
                    >
                      Previous</button
                    ><span
                      >Page {{ previewPage() + 1 }} of
                      {{ previewPages() }}</span
                    ><button
                      name="targetPreviewNext"
                      type="button"
                      (click)="previewPage.set(previewPage() + 1)"
                      [disabled]="previewPage() + 1 >= previewPages()"
                    >
                      Next
                    </button>
                  </nav>
                }
                <section aria-label="Prepare repository draft">
                  <h3>Prepare draft JSON</h3>
                  <p>
                    Select a value for every differing key, including one-sided
                    changes. Selecting a missing value omits that key from the
                    draft only. This does not import translations, write
                    repository files or run sync.
                  </p>
                  <p>
                    {{ choices().size }} of {{ requiredChoices() }} differing
                    keys selected.
                  </p>
                  <button
                    name="targetResolve"
                    type="button"
                    (click)="resolve(t)"
                    [disabled]="busy() || choices().size !== requiredChoices()"
                  >
                    {{ busy() ? 'Preparing draft...' : 'Prepare draft JSON' }}
                  </button>
                  @if (draft(); as d) {
                    <p class="notice">
                      Draft only - not applied. {{ d.outputKeys }} output keys;
                      {{ d.absentKeys }} absent keys omitted. No translations or
                      repository files have changed. The repository may change
                      after this read.
                    </p>
                    <label
                      >Draft JSON<textarea
                        name="targetDraft"
                        readonly
                        [value]="d.json"
                        spellcheck="false"
                      ></textarea>
                    </label>
                    <p class="digest">SHA256: {{ d.contentDigest }}</p>
                    <button
                      name="targetDownloadDraft"
                      type="button"
                      (click)="downloadDraft()"
                    >
                      Download draft JSON
                    </button>
                  }
                </section>
              </section>
            }
            @if (snapshot()?.targetId === t.id) {
              <section aria-label="Repository file snapshot">
                <h3>Verified file snapshot. Not an accepted baseline.</h3>
                <p>
                  Read at {{ readAt() }}. Target revision
                  {{ snapshot()!.targetRevision }}. No import or sync was run.
                  The repository may change after this read.
                </p>
                <p class="digest">Blob SHA: {{ snapshot()!.remoteSha }}</p>
                <p class="digest">SHA256: {{ snapshot()!.contentDigest }}</p>
                <label
                  >Repository JSON<textarea
                    name="targetSnapshot"
                    readonly
                    [value]="snapshot()!.json"
                    spellcheck="false"
                  ></textarea>
                </label>
              </section>
            }
            @if (baselineView()?.targetId === t.id) {
              <section aria-label="Accepted comparison baseline">
                @if (baselineView()!.baseline; as b) {
                  <h3>
                    Accepted comparison baseline - version {{ b.version }}
                  </h3>
                  <p>
                    Accepted at {{ b.acceptedAt }} by account {{ b.actorId }}.
                    This does not mean local translations match the repository
                    or that sync completed.
                  </p>
                  <p class="digest">Accepted blob SHA: {{ b.remoteSha }}</p>
                  <label
                    >Accepted baseline JSON<textarea
                      name="targetBaseline"
                      readonly
                      [value]="b.text"
                      spellcheck="false"
                    ></textarea>
                  </label>
                } @else {
                  <p>No accepted comparison baseline.</p>
                }
                @if (snapshot()?.targetId === t.id) {
                  @if (confirmBaseline()) {
                    <p class="notice">
                      Use the displayed verified file snapshot as the comparison
                      baseline? This replaces the current baseline only. It does
                      not import translations, change repository files or grant
                      permission to apply a future plan.
                    </p>
                    <button
                      name="targetConfirmBaseline"
                      type="button"
                      (click)="acceptBaseline(t)"
                      [disabled]="busy()"
                    >
                      Accept comparison baseline
                    </button>
                    <button
                      name="targetCancelBaseline"
                      type="button"
                      (click)="confirmBaseline.set(false)"
                      [disabled]="busy()"
                    >
                      Keep current baseline
                    </button>
                  } @else {
                    <button
                      name="targetPrepareBaseline"
                      type="button"
                      (click)="confirmBaseline.set(true)"
                      [disabled]="busy()"
                    >
                      Use snapshot as comparison baseline...
                    </button>
                  }
                }
              </section>
            }
            @if (removing()?.id === t.id) {
              <p class="notice">
                Remove this configuration only? Repository files and
                translations will not be deleted.
              </p>
              <div class="actions">
                <button
                  name="targetConfirmRemove"
                  type="button"
                  (click)="remove(t)"
                  [disabled]="busy()"
                >
                  Remove configuration</button
                ><button
                  name="targetCancelRemove"
                  type="button"
                  (click)="removing.set(null)"
                  [disabled]="busy()"
                >
                  Keep configuration
                </button>
              </div>
            } @else {
              <div class="actions">
                <button
                  name="targetEdit"
                  type="button"
                  (click)="edit(t)"
                  [disabled]="busy()"
                >
                  Edit configuration</button
                ><button
                  name="targetRemove"
                  type="button"
                  (click)="removing.set(t)"
                  [disabled]="busy()"
                >
                  Remove...
                </button>
              </div>
            }
          </article>
        } @empty {
          <p>No repository target configurations.</p>
        }
      } @else if (!error()) {
        <p role="status">Loading configurations...</p>
      }
    </main>`,
})
export class RepositoryTargetsComponent implements OnInit, OnDestroy {
  projectId = '';
  form = empty();
  targets = signal<RepositoryTargetConfig[]>([]);
  branches = signal<BranchInfo[]>([]);
  locales = signal<string[]>([]);
  editing = signal<RepositoryTargetConfig | null>(null);
  removing = signal<RepositoryTargetConfig | null>(null);
  ready = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');
  snapshot = signal<RepositoryFileSnapshot | null>(null);
  readAt = signal('');
  previewResult = signal<RepositorySyncPreview | null>(null);
  choices = signal(new Map<string, SyncResolutionChoice>());
  draft = signal<RepositoryResolutionDraft | null>(null);
  requiredChoices = computed(
    () =>
      this.previewResult()?.decisions.filter(
        (d) => d.kind !== 'unchanged' && d.kind !== 'converged',
      ).length ?? 0,
  );
  clearDraft() {
    this.choices.set(new Map());
    this.draft.set(null);
  }
  choose(key: string, value: string) {
    if (this.busy()) return;
    const p = this.previewResult();
    if (
      !p?.decisions.some(
        (d) =>
          d.key === key && d.kind !== 'unchanged' && d.kind !== 'converged',
      )
    )
      return;
    const next = new Map(this.choices());
    if (value === 'base' || value === 'local' || value === 'remote')
      next.set(key, value);
    else next.delete(key);
    this.choices.set(next);
    this.draft.set(null);
    this.error.set('');
  }
  async resolve(t: RepositoryTargetConfig) {
    const p = this.previewResult();
    if (
      this.busy() ||
      p?.targetId !== t.id ||
      this.choices().size !== this.requiredChoices()
    )
      return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.draft.set(null);
    this.error.set('');
    this.message.set('');
    try {
      const draft = await this.api.resolveRepositoryPreview(
        this.projectId,
        t.id,
        {
          expectedRevision: p.targetRevision,
          expectedFingerprint: p.fingerprint,
          choices: Object.fromEntries(this.choices()),
        },
      );
      if (generation === this.generation) this.draft.set(draft);
    } catch (e) {
      if (generation !== this.generation) return;
      // A failure may mean any compared source changed. Require a fresh review.
      this.previewResult.set(null);
      this.clearDraft();
      this.previewPage.set(0);
      this.error.set(
        e instanceof Error ? e.message : 'Could not prepare repository draft',
      );
    } finally {
      if (generation === this.generation) this.busy.set(false);
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
    a.download = 'open-locale-repository-draft.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  previewPage = signal(0);
  previewPages = computed(() =>
    Math.max(1, Math.ceil((this.previewResult()?.decisions.length ?? 0) / 50)),
  );
  previewRows = computed(
    () =>
      this.previewResult()?.decisions.slice(
        this.previewPage() * 50,
        (this.previewPage() + 1) * 50,
      ) ?? [],
  );
  baselineView = signal<RepositoryBaselineView | null>(null);
  confirmBaseline = signal(false);
  private generation = 0;
  private subscription?: Subscription;
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}
  ngOnInit() {
    this.subscription = this.route.paramMap.subscribe(
      (p) => void this.load(p.get('id') ?? ''),
    );
  }
  ngOnDestroy() {
    this.generation++;
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.subscription?.unsubscribe();
  }
  async load(id: string) {
    const generation = ++this.generation;
    this.projectId = id;
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.ready.set(false);
    this.busy.set(false);
    this.targets.set([]);
    this.branches.set([]);
    this.locales.set([]);
    this.editing.set(null);
    this.removing.set(null);
    this.form = empty();
    this.error.set('');
    this.message.set('');
    try {
      const [project, branches, result] = await Promise.all([
        this.api.getProject(id),
        this.api.listBranches(id),
        this.api.listRepositoryTargets(id),
      ]);
      if (generation !== this.generation) return;
      this.branches.set(branches);
      this.locales.set(project.locales.map((l) => l.code));
      this.form.locale = project.baseLocale;
      this.targets.set(result.targets);
      this.ready.set(true);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not load configurations',
        );
    }
  }
  edit(t: RepositoryTargetConfig) {
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.editing.set({ ...t });
    this.form = {
      localBranch: t.localBranch,
      locale: t.locale,
      owner: t.owner,
      repo: t.repo,
      path: t.path,
      remoteBranch: t.remoteBranch,
    };
    this.removing.set(null);
    this.error.set('');
    this.message.set('');
  }
  cancel() {
    this.error.set('');
    this.message.set('');
    this.editing.set(null);
    this.form = { ...empty(), locale: this.locales()[0] ?? '' };
  }
  async refresh() {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.listRepositoryTargets(this.projectId);
      if (generation !== this.generation) return;
      this.targets.set(result.targets);
      this.cancel();
      this.removing.set(null);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async save() {
    if (this.busy()) return;
    const generation = ++this.generation;
    const form = { ...this.form },
      editing = this.editing();
    this.busy.set(true);
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.saveRepositoryTarget(
        this.projectId,
        form,
        editing?.id,
        editing?.revision,
      );
      if (generation !== this.generation) return;
      this.targets.update((items) =>
        editing
          ? items.map((t) => (t.id === editing.id ? result.target : t))
          : [...items, result.target],
      );
      this.cancel();
      this.message.set('Configuration saved. Not connected; no sync was run.');
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async read(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const snapshot = await this.api.readRepositoryTarget(
        this.projectId,
        t.id,
        t.revision,
      );
      if (generation !== this.generation) return;
      this.snapshot.set(snapshot);
      this.readAt.set(new Date().toLocaleString());
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not read repository file',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  display(value: string | null) {
    return value === null
      ? '[missing]'
      : value === ''
        ? '[empty string]'
        : value;
  }
  async preview(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.snapshot.set(null);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.previewRepositoryTarget(
        this.projectId,
        t.id,
        t.revision,
      );
      if (generation !== this.generation) return;
      this.previewResult.set(result);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not compare repository',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async loadBaseline(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.confirmBaseline.set(false);
    this.baselineView.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.message.set('');
    try {
      const view = await this.api.getRepositoryBaseline(this.projectId, t.id);
      if (generation !== this.generation) return;
      if (view.targetRevision !== t.revision)
        throw new Error('Repository target changed; refresh configurations');
      this.baselineView.set(view);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not load baseline',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async acceptBaseline(t: RepositoryTargetConfig) {
    const snapshot = this.snapshot(),
      view = this.baselineView();
    if (
      this.busy() ||
      !this.confirmBaseline() ||
      snapshot?.targetId !== t.id ||
      view?.targetId !== t.id
    )
      return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.acceptRepositoryBaseline(
        this.projectId,
        t.id,
        {
          expectedRevision: snapshot.targetRevision,
          expectedRemoteSha: snapshot.remoteSha,
          expectedContentDigest: snapshot.contentDigest,
          expectedBaselineVersion: view.baseline?.version ?? 0,
        },
      );
      if (generation !== this.generation) return;
      this.baselineView.set({
        ...view,
        baseline: result.baseline,
        baselineAccepted: true,
      });
      this.confirmBaseline.set(false);
      this.message.set(
        'Comparison baseline accepted. No import, repository write or sync was run.',
      );
    } catch (e) {
      if (generation !== this.generation) return;
      this.snapshot.set(null);
      this.previewResult.set(null);
      this.clearDraft();
      this.previewPage.set(0);
      this.baselineView.set(null);
      this.confirmBaseline.set(false);
      this.error.set(
        e instanceof Error ? e.message : 'Could not accept baseline',
      );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async remove(t: RepositoryTargetConfig) {
    if (this.busy() || this.removing()?.id !== t.id) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.snapshot.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.removeRepositoryTarget(this.projectId, t.id, t.revision);
      if (generation !== this.generation) return;
      this.targets.update((items) => items.filter((item) => item.id !== t.id));
      this.removing.set(null);
      if (this.editing()?.id === t.id) this.cancel();
      this.message.set(
        'Configuration removed. Repository files and translations unchanged.',
      );
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
