import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ApiService,
  RepositoryTargetInput,
  RepositoryTargetConfig,
  RepositoryFileSnapshot,
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
        max-width: 1000px;
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
            <p>No sync connection or accepted baseline. Sync cannot run.</p>
            <button
              name="targetRead"
              type="button"
              (click)="read(t)"
              [disabled]="busy()"
            >
              Read repository file
            </button>
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
    this.subscription?.unsubscribe();
  }
  async load(id: string) {
    const generation = ++this.generation;
    this.projectId = id;
    this.snapshot.set(null);
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
  async remove(t: RepositoryTargetConfig) {
    if (this.busy() || this.removing()?.id !== t.id) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.snapshot.set(null);
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
