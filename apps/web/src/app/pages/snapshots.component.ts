import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, SnapshotMeta } from '../api.service';

@Component({
  selector: 'ol-snapshots',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Snapshots</h1>
    </header>
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      @if (notice(); as n) { <p class="notice" role="status">{{ n }}</p> }
      <form class="snapshot-create" (ngSubmit)="create($event)">
        <input aria-label="Snapshot label" [(ngModel)]="label" name="label"
               placeholder="Label, e.g. before release 1.4" maxlength="200" />
        <button type="submit" [disabled]="creating()">Take snapshot</button>
      </form>
      <ul class="snapshot-list">
        @for (s of items(); track s.id) {
          <li class="snapshot-row">
            <span class="snapshot-label">{{ s.label }}</span>
            @if (s.automatic) { <span class="auto-badge">auto</span> }
            <span class="muted">{{ s.keyCount }} keys, {{ s.translationCount }} translations</span>
            <time class="muted">{{ s.createdAt | date:'short' }}</time>
            <button class="restore" (click)="restore(s)" [disabled]="restoring()">Restore</button>
          </li>
        } @empty {
          <li class="muted">{{ loading() ? 'Loading…' : 'No snapshots yet' }}</li>
        }
      </ul>
    </main>
  `,
})
export class SnapshotsComponent implements OnInit {
  projectId = '';
  items = signal<SnapshotMeta[]>([]);
  label = '';
  loading = signal(true);
  creating = signal(false);
  restoring = signal(false);
  error = signal('');
  notice = signal('');

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
  }

  async reload() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.items.set(await this.api.listSnapshots(this.projectId));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load snapshots');
    } finally {
      this.loading.set(false);
    }
  }

  async create(event: Event) {
    event.preventDefault();
    const label = this.label.trim();
    if (!label || this.creating()) return;
    this.creating.set(true);
    this.error.set('');
    try {
      await this.api.createSnapshot(this.projectId, label);
      this.label = '';
      this.notice.set('Snapshot captured');
      await this.reload();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to create snapshot');
    } finally {
      this.creating.set(false);
    }
  }

  async restore(s: SnapshotMeta) {
    if (this.restoring()) return;
    if (!confirm(
      `Restore the project to "${s.label}"?\n\n` +
      `- Keys and translations return to the snapshot state.\n` +
      `- Keys added after this snapshot are permanently removed, with their comments and screenshots.\n` +
      `- Keys deleted after this snapshot come back, but their old comments and screenshot links are not recovered.`,
    )) return;
    this.restoring.set(true);
    this.error.set('');
    try {
      const r = await this.api.restoreSnapshot(this.projectId, s.id);
      this.notice.set(`Restored: ${r.valuesChanged} value(s) recovered, ${r.keysRemoved} key(s) removed`);
      await this.reload();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      this.restoring.set(false);
    }
  }
}
