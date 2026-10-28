import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityEntry, ApiService } from '../api.service';

const ACTION_LABELS: Record<string, string> = {
  'key.created': 'created key',
  'key.deleted': 'deleted key',
  'key.tags': 'updated tags on',
  'translation.value': 'edited translation',
  'translation.status': 'changed status',
  'comment.added': 'commented on',
  'comment.deleted': 'deleted a comment on',
  'project.renamed': 'renamed the project',
  'project.import': 'imported translations',
  'locale.added': 'added locale',
  'locale.removed': 'removed locale',
};

@Component({
  selector: 'ol-activity',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Activity</h1>
      <select aria-label="Filter by action" [ngModel]="actionFilter()" (ngModelChange)="setFilter($event)">
        <option value="">all actions</option>
        @for (a of actions; track a) { <option [value]="a">{{ label(a) }}</option> }
      </select>
    </header>
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      <ul class="activity-list">
        @for (ev of items(); track ev.id) {
          <li class="activity-row">
            <span class="activity-actor">{{ ev.actor?.displayName ?? 'Former user' }}</span>
            <span class="activity-action">{{ label(ev.action) }}</span>
            @if (ev.keyName) { <code class="activity-key">{{ ev.keyName }}</code> }
            @if (ev.localeCode) { <span class="locale-badge">{{ ev.localeCode }}</span> }
            @if (detailText(ev)) { <span class="muted activity-detail">{{ detailText(ev) }}</span> }
            <time class="muted">{{ ev.createdAt | date:'short' }}</time>
          </li>
        } @empty {
          <li class="muted">{{ loading() ? 'Loading…' : 'No activity yet' }}</li>
        }
      </ul>
      @if (nextCursor()) {
        <button class="load-more" (click)="loadMore()">Load more</button>
      }
    </main>
  `,
})
export class ActivityComponent implements OnInit {
  projectId = '';
  items = signal<ActivityEntry[]>([]);
  nextCursor = signal<string | null>(null);
  actionFilter = signal('');
  loading = signal(true);
  error = signal('');
  actions = Object.keys(ACTION_LABELS);

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.fetch(true);
  }

  label(action: string) { return ACTION_LABELS[action] ?? action; }

  detailText(ev: ActivityEntry): string {
    const d = ev.detail ?? {};
    switch (ev.action) {
      case 'translation.value':
        return d['previousValue'] ? `"${d['previousValue']}" → "${d['value']}"` : `"${d['value']}"`;
      case 'translation.status':
        return `${d['from']} → ${d['to']}`;
      case 'key.tags':
        return Array.isArray(d['tags']) && (d['tags'] as string[]).length ? (d['tags'] as string[]).join(', ') : '(tags cleared)';
      case 'project.renamed':
        return `"${d['from']}" → "${d['to']}"`;
      case 'project.import':
        return `${d['translationsUpserted']} updated, ${d['unchangedSkipped']} unchanged, ${d['keysCreated']} new keys`;
      case 'comment.deleted':
        return d['excerpt'] ? `"${d['excerpt']}"` : '';
      default:
        return '';
    }
  }

  setFilter(action: string) {
    this.actionFilter.set(action);
    void this.fetch(true);
  }

  loadMore() { void this.fetch(false); }

  private async fetch(reset: boolean) {
    if (reset) { this.items.set([]); this.nextCursor.set(null); this.loading.set(true); }
    try {
      const res = await this.api.listActivity(this.projectId, {
        action: this.actionFilter() || undefined,
        cursor: reset ? undefined : this.nextCursor() ?? undefined,
      });
      this.items.set(reset ? res.items : [...this.items(), ...res.items]);
      this.nextCursor.set(res.nextCursor);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load activity');
    } finally {
      this.loading.set(false);
    }
  }
}
