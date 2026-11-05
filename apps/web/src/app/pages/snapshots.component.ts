import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
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
      @if (listError()) { <p class="error" role="alert" name="snapshotListError">Snapshots unavailable. No snapshots are shown. Retry this read or reload the page.</p><button type="button" name="retrySnapshotList" (click)="void reload()">Retry snapshots</button> }
      @if (loading()) { <p role="status" name="snapshotListLoading">Loading snapshots...</p> }
      @if (!loading() && !listError()) { <ul class="snapshot-list">
        @for (s of items(); track s.id) {
          <li class="snapshot-row">
            <span class="snapshot-label">{{ s.label }}</span>
            @if (s.automatic) { <span class="auto-badge">auto</span> }
            <span class="muted">{{ s.keyCount }} keys, {{ s.translationCount }} translations</span>
            <time class="muted">{{ s.createdAt | date:'short' }}</time>
            <button class="restore" (click)="restore(s)" [disabled]="restoring()">Restore</button>
          </li>
        } @empty {
          <li class="muted" name="snapshotListEmpty">No snapshots yet</li>
        }
      </ul> }
    </main>
  `,
})
export class SnapshotsComponent implements OnInit, OnDestroy {
  projectId = '';
  items = signal<SnapshotMeta[]>([]);
  label = '';
  listError = signal(false);
  private readGeneration=0;
  private destroyed=false;
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

  ngOnDestroy() { this.destroyed=true;++this.readGeneration; }

  async reload() {
    if(this.destroyed)return;
    const generation=++this.readGeneration;
    const current=()=>!this.destroyed&&generation===this.readGeneration;
    this.items.set([]);this.listError.set(false);this.loading.set(true);
    try {
      const items=await this.api.listSnapshots(this.projectId);
      if(current())this.items.set(items);
    } catch {
      if(current())this.listError.set(true);
    } finally {
      if(current())this.loading.set(false);
    }
  }

  async create(event: Event) {
    event.preventDefault();
    const label = this.label.trim();
    if (!label || this.destroyed || this.creating()) return;
    const draft=this.label;
    this.creating.set(true);
    this.error.set('');this.notice.set('');
    try {
      await this.api.createSnapshot(this.projectId, label);
      if(this.destroyed)return;
      if(this.label===draft)this.label = '';
      this.notice.set('Snapshot captured');
      await this.reload();
    } catch {
      if(this.destroyed)return;
      this.error.set('Capturing snapshot failed. Your label is kept here. Check snapshots before trying again.');
    } finally {
      if(!this.destroyed)this.creating.set(false);
    }
  }

  async restore(s: SnapshotMeta) {
    if (this.restoring()) return;
    if (!confirm(
      `Restore the project to "${s.label}"?\n\n` +
      `- Keys and translations return to the snapshot state.\n` +
      `- Keys added after this snapshot are permanently removed, with their comments and screenshots.\n` +
      `- Keys deleted after this snapshot come back, but their old comments and screenshot links are not recovered.\n` +
      `- A snapshot of the current state is taken first, so this restore is itself recoverable.`,
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
