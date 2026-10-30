import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, BranchInfo, LocalSyncPreview } from '../api.service';

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
        min-width: 700px;
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
      .manual {
        background: #fff4e8;
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
                </tr>
              </thead>
              <tbody>
                @for (d of p.decisions; track d.key) {
                  <tr [class.manual]="d.suggested === 'manual'">
                    <td>{{ d.key }}</td>
                    <td>{{ display(d.base) }}</td>
                    <td>{{ display(d.local) }}</td>
                    <td>{{ display(d.remote) }}</td>
                    <td>{{ direction(d.suggested) }} ({{ d.kind }})</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5">
                      No translated keys in these files or this project locale.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
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
    this.error.set('');
    this.loading.set(false);
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
    this.loading.set(true);
    this.error.set('');
    this.result.set(null);
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
