import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService, SyncPreviewRecord } from '../api.service';

@Component({
  selector: 'ol-sync-history',
  imports: [RouterLink, DatePipe, FormsModule],
  styles: [
    `
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
      .records {
        display: grid;
        gap: 12px;
        padding: 0;
        list-style: none;
      }
      article {
        padding: 16px;
        border: 1px solid #dce2eb;
        border-radius: 8px;
        background: white;
      }
      h2 {
        font-size: 1.1rem;
        margin: 0 0 8px;
      }
      code {
        overflow-wrap: anywhere;
        word-break: break-all;
      }
      dl {
        display: grid;
        grid-template-columns: 130px minmax(0, 1fr);
        gap: 8px;
        margin: 12px 0 0;
      }
      dt {
        color: #56647b;
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .muted {
        color: #56647b;
      }
      @media (max-width: 600px) {
        main {
          padding: 16px;
        }
        dl {
          grid-template-columns: 1fr;
          gap: 4px;
        }
        dd {
          margin-bottom: 8px;
        }
      }
    `,
  ],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId, 'sync']" class="back"
        >&larr; File preview</a
      >
      <h1>Diagnostic preview history</h1>
    </header>
    <main>
      <p class="notice">
        Diagnostic records only, not completed syncs or accepted baselines.
        Files and SHA labels were caller-supplied, not verified with GitHub. No
        record can apply changes. Records contain counts and fingerprints, not
        translation text.
      </p>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (loading()) {
        <p role="status">Loading diagnostic history...</p>
      } @else if (!error()) {
        <p class="muted">
          Latest {{ records().length }} record{{
            records().length === 1 ? '' : 's'
          }}
          loaded, up to 50. Up to 100 are retained per project. Ordinary
          comparison does not create a record. Records currently require an
          explicit API request.
        </p>
        <label
          >Find loaded diagnostics
          <input
            type="search"
            name="syncHistorySearch"
            maxlength="200"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
        /></label>
        <button
          type="button"
          name="clearSyncHistorySearch"
          [disabled]="!query()"
          (click)="query.set('')"
        >
          Clear search
        </button>
        <p class="muted" role="status" name="syncHistoryMatches">
          Showing {{ filteredRecords().length }} of
          {{ records().length }} loaded records. Search matches branch, locale,
          caller SHA or fingerprint as a literal, case-insensitive substring. It
          does not read newer records or verify caller labels.
        </p>
        <ul class="records">
          @for (r of filteredRecords(); track r.id) {
            <li>
              <article>
                <h2>{{ r.branch }} / {{ r.locale }}</h2>
                <p>
                  {{ r.createdAt | date: 'medium' }} · Caller-file diagnostic,
                  not applied
                </p>
                <p>
                  {{ r.summary.total }} keys ·
                  {{ r.summary.conflict }} conflict{{
                    r.summary.conflict === 1 ? '' : 's'
                  }}
                  · {{ r.summary.manual }} key{{
                    r.summary.manual === 1 ? '' : 's'
                  }}
                  need manual review
                </p>
                <dl>
                  <dt>Fingerprint</dt>
                  <dd>
                    <code>{{ r.fingerprint }}</code>
                  </dd>
                  <dt>Caller blob SHA</dt>
                  <dd>
                    <code>{{ r.remoteSha }}</code>
                  </dd>
                </dl>
              </article>
            </li>
          } @empty {
            <li class="empty" role="status">
              {{
                records().length
                  ? 'No loaded diagnostic records match this search. Clear search to show all loaded records.'
                  : 'No diagnostic preview records. Comparing files alone does not save history.'
              }}
            </li>
          }
        </ul>
      }
      <button
        type="button"
        name="syncHistoryRefresh"
        [disabled]="loading()"
        (click)="refresh()"
      >
        Refresh history
      </button>
    </main>
  `,
})
export class SyncHistoryComponent implements OnInit, OnDestroy {
  projectId = '';
  query = signal('');
  filteredRecords = computed(() => {
    const query = this.query().trim().toLowerCase();
    return query
      ? this.records().filter((r) =>
          [r.branch, r.locale, r.remoteSha, r.fingerprint].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : this.records();
  });
  records = signal<SyncPreviewRecord[]>([]);
  loading = signal(true);
  error = signal('');
  private generation = 0;
  private destroyed = false;
  private subscription?: Subscription;
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}
  ngOnInit() {
    this.subscription = this.route.paramMap.subscribe((p) => {
      void this.load(p.get('id') ?? '');
    });
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.generation++;
    this.subscription?.unsubscribe();
  }
  refresh() {
    if (!this.destroyed && !this.loading()) void this.load(this.projectId);
  }
  async load(id: string) {
    if (this.destroyed) return;
    const generation = ++this.generation;
    if (this.projectId !== id) this.query.set('');
    this.projectId = id;
    this.records.set([]);
    this.error.set('');
    this.loading.set(true);
    try {
      const result = await this.api.listSyncPreviewRecords(id);
      if (generation === this.generation) this.records.set(result.records);
    } catch {
      if (generation === this.generation)
        this.error.set(
          'Diagnostic history unavailable. Project admin access is required. Try Refresh history or reload the page.',
        );
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }
}
