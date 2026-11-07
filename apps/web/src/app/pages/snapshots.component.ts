import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
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
      @if (error(); as e) { @if (!captureUnknown()) { <p class="error" role="alert">{{ e }}</p> } }
      @if (creating()) { <p role="status" name="snapshotCreating">Capturing snapshot...</p> }
      @if (restoreUnknown()) { <p class="error" role="alert" name="snapshotRestoreUnknown">Restore outcome unconfirmed. Check the project, then refresh snapshots before capturing or restoring again. Do not repeat the restore without checking.</p> }
      @if (captureUnknown()) { <p class="error" role="alert" name="snapshotCaptureUnknown">Capture outcome unconfirmed. Your label is kept here. Check the snapshot list, then refresh snapshots before capturing or restoring again. Do not repeat the capture without checking.</p> }
      @if (restoring()) { <p role="status" name="snapshotRestoring">Restoring snapshot...</p> }
      @if (notice(); as n) { <p class="notice" role="status">{{ n }}</p> }
      <form class="snapshot-create" (ngSubmit)="create($event)">
        <input aria-label="Snapshot label" [(ngModel)]="label" name="label"
               placeholder="Label, e.g. before release 1.4" maxlength="200" />
        <button type="submit" [disabled]="creating() || restoring() || restoreUnknown() || captureUnknown() || !label.trim()" [attr.aria-busy]="creating() || restoring()">Take snapshot</button>
      </form>
      @if (listError()) { <p class="error" role="alert" name="snapshotListError">Snapshots unavailable. No snapshots are shown. Retry this read or reload the page.</p><button type="button" name="retrySnapshotList" (click)="void reload()">Retry snapshots</button> }
      @if (!listError()) { <button type="button" name="refreshSnapshots" [disabled]="loading() || creating() || restoring()" (click)="refresh()">Refresh snapshots</button> }
      <div class="toolbar" style="margin-top:1rem">
        <label>Search loaded snapshots <input name="snapshotSearch" maxlength="200" placeholder="Label contains" [ngModel]="search()" (ngModelChange)="setSearch($event)" /></label>
        <button type="button" name="clearSnapshotSearch" [disabled]="!search()" (click)="setSearch('')">Clear search</button>
        @if (!loading() && !listError()) { <span class="muted" role="status" name="snapshotSearchCount">{{ visibleItems().length }} of {{ items().length }} loaded snapshots shown. Search matches labels only. Refresh snapshots reads newer changes.</span> }
      </div>
      @if (loading()) { <p role="status" name="snapshotListLoading">Loading snapshots...</p> }
      @if (!loading() && !listError()) { <ul class="snapshot-list">
        @for (s of visibleItems(); track s.id) {
          <li class="snapshot-row">
            <span class="snapshot-label">{{ s.label }}</span>
            @if (s.automatic) { <span class="auto-badge">auto</span> }
            <span class="muted">{{ s.keyCount }} keys, {{ s.translationCount }} translations</span>
            <time class="muted">{{ s.createdAt | date:'short' }}</time>
            <button class="restore" [attr.aria-label]="'Restore snapshot ' + s.label" (click)="restore(s)" [disabled]="!restoreReady(s)">Restore</button>
          </li>
        } @empty {
          <li class="muted" name="snapshotListEmpty">{{ search().trim() ? 'No loaded snapshots match this label search. Clear search to show all loaded snapshots.' : 'No snapshots yet' }}</li>
        }
      </ul> }
    </main>
  `,
})
export class SnapshotsComponent implements OnInit, OnDestroy {
  projectId = '';
  items = signal<SnapshotMeta[]>([]);
  search=signal('');
  visibleItems=computed(()=>{const query=this.search().trim().toLowerCase();return query?this.items().filter(item=>item.label.toLowerCase().includes(query)):this.items();});
  setSearch(value:string) {if(!this.destroyed)this.search.set(value.slice(0,200));}
  label = '';
  listError = signal(false);
  private readGeneration=0;
  private projectGeneration=0;
  private routeSub?:Subscription;
  private destroyed=false;
  loading = signal(true);
  creating = signal(false);
  restoring = signal(false);
  restoreUnknown = signal(false);
  private restoreEpoch=0;
  captureUnknown = signal(false);
  private captureEpoch=0;
  error = signal('');
  notice = signal('');

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit() {
    this.routeSub=this.route.paramMap.subscribe(pm=>this.initForProject(pm.get('id')??''));
  }

  private initForProject(id:string) {
    if(this.destroyed)return;
    ++this.projectGeneration;++this.readGeneration;this.projectId=id;
    this.items.set([]);this.search.set('');this.label='';this.listError.set(false);this.error.set('');this.notice.set('');
    this.creating.set(false);this.restoring.set(false);this.restoreUnknown.set(false);++this.restoreEpoch;this.captureUnknown.set(false);++this.captureEpoch;void this.reload();
  }
  private current(scope:number) { return !this.destroyed&&scope===this.projectGeneration; }
  ngOnDestroy() { this.destroyed=true;++this.readGeneration;++this.projectGeneration;this.routeSub?.unsubscribe(); }

  refresh() {
    if(this.loading() || this.creating() || this.restoring())return;
    void this.reload();
  }

  async reload() {
    if(this.destroyed)return;
    const generation=++this.readGeneration,epoch=this.restoreEpoch,pendingRestore=this.restoring(),captureEpoch=this.captureEpoch,pendingCapture=this.creating();
    const current=()=>!this.destroyed&&generation===this.readGeneration;
    this.items.set([]);this.listError.set(false);this.loading.set(true);
    try {
      const items=await this.api.listSnapshots(this.projectId);
      if(current()){this.items.set(items);if(!pendingCapture&&!this.creating()&&captureEpoch===this.captureEpoch){if(this.captureUnknown()&&this.error()==='Capturing snapshot failed. Your label is kept here. Check snapshots before trying again.')this.error.set('');this.captureUnknown.set(false);}if(!pendingRestore&&!this.restoring()&&epoch===this.restoreEpoch){if(this.restoreUnknown()&&this.error()==='Restoring snapshot failed. Check the project before trying again.')this.error.set('');this.restoreUnknown.set(false);}}
    } catch {
      if(current())this.listError.set(true);
    } finally {
      if(current())this.loading.set(false);
    }
  }

  async create(event: Event) {
    event.preventDefault();
    const label = this.label.trim();
    if (!label || this.destroyed || this.creating() || this.restoring() || this.restoreUnknown() || this.captureUnknown()) return;
    const draft=this.label,scope=this.projectGeneration,projectId=this.projectId;
    ++this.captureEpoch;this.creating.set(true);
    this.error.set('');this.notice.set('');
    try {
      await this.api.createSnapshot(projectId, label);
      if(!this.current(scope))return;
      if(this.label===draft)this.label = '';
      this.notice.set('Snapshot captured');
      await this.reload();
    } catch {
      if(!this.current(scope))return;
      ++this.captureEpoch;this.captureUnknown.set(true);
      this.error.set('Capturing snapshot failed. Your label is kept here. Check snapshots before trying again.');
    } finally {
      if(this.current(scope))this.creating.set(false);
    }
  }

  restoreReady(s: SnapshotMeta) {
    return !this.destroyed && !this.loading() && !this.listError() && !this.restoring() && !this.creating() && !this.restoreUnknown() && !this.captureUnknown() && this.items().some(item=>item===s);
  }

  async restore(s: SnapshotMeta) {
    if (!this.restoreReady(s)) return;
    const scope=this.projectGeneration,projectId=this.projectId,generation=this.readGeneration;
    if (!confirm(
      `Restore the project to "${s.label}"?\n\n` +
      `- Keys and translations return to the snapshot state.\n` +
      `- Keys added after this snapshot are permanently removed, with their comments and screenshots.\n` +
      `- Keys deleted after this snapshot come back, but their old comments and screenshot links are not recovered.\n` +
      `- A snapshot of the current state is taken first, so this restore is itself recoverable.`,
    )) return;
    if(!this.current(scope) || generation!==this.readGeneration || !this.restoreReady(s))return;
    ++this.restoreEpoch;this.restoring.set(true);
    this.error.set('');this.notice.set('');
    try {
      const r = await this.api.restoreSnapshot(projectId, s.id);
      if(!this.current(scope))return;
      this.notice.set(`Restored: ${r.valuesChanged} value(s) recovered, ${r.keysRemoved} key(s) removed`);
      await this.reload();
    } catch {
      if(!this.current(scope))return;
      ++this.restoreEpoch;this.restoreUnknown.set(true);
      this.error.set('Restoring snapshot failed. Check the project before trying again.');
    } finally {
      if(this.current(scope))this.restoring.set(false);
    }
  }
}
