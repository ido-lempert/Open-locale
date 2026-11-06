import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, Key, MemberInfo, TaskItem, GroupInfo } from '../api.service';

@Component({
  selector: 'ol-tasks',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Tasks</h1>
      <select aria-label="Filter by assignee" [ngModel]="mineFilter()" (ngModelChange)="setMine($event)">
        <option value="">everyone</option>
        <option value="me">assigned to me</option>
      </select>
      <select aria-label="Filter by status" [ngModel]="statusFilter()" (ngModelChange)="setFilter($event)">
        <option value="">all statuses</option>
        <option value="OPEN">open</option>
        <option value="IN_PROGRESS">in progress</option>
        <option value="DONE">done</option>
      </select>
    </header>
    <main [attr.aria-busy]="loading()">
      @if (createNotice(); as message) { <p role="status" name="taskCreateNotice">{{ message }}</p> }
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      <section class="panel">
        <h2>New task</h2>
        <form class="task-form" [attr.aria-busy]="creating()" (ngSubmit)="create()">
          <input aria-label="Task title" placeholder="e.g. Translate checkout to Hebrew" maxlength="200"
            [ngModel]="title()" (ngModelChange)="title.set($event)" name="taskTitle" required />
          <input aria-label="Description (optional)" placeholder="Details, key names, context"
            [ngModel]="description()" (ngModelChange)="description.set($event)" name="taskDescription" />
          <input aria-label="Due date (optional)" type="date"
            [ngModel]="dueDate()" (ngModelChange)="dueDate.set($event)" name="taskDue" />
          <select aria-label="Assignee (optional)" [ngModel]="assigneeId()" (ngModelChange)="assigneeId.set($event)" name="taskAssignee">
            <option value="">unassigned</option>
            @for (m of members(); track m.id) { <option [value]="m.id">{{ m.displayName }}</option> }
            @for (g of groups(); track g.id) { <option [value]="'g:' + g.id">Group: {{ g.name }}</option> }
          </select>
          <select aria-label="Depends on (optional)" [ngModel]="dependsOnId()" (ngModelChange)="dependsOnId.set($event)" name="taskDependsOn">
            <option value="">no predecessor</option>
            @for (t of tasks(); track t.id) { <option [value]="t.id">{{ t.title }}</option> }
          </select>
          <select multiple aria-label="Locked keys (optional)" size="4"
            [ngModel]="selectedKeyIds()" (ngModelChange)="selectedKeyIds.set($event)" name="taskLockKeys">
            @for (k of keys(); track k.id) { <option [value]="k.id">{{ k.name }}</option> }
          </select>
          <label class="lock-toggle">
            <input type="checkbox" [ngModel]="lockKeys()" (ngModelChange)="lockKeys.set($event)" name="taskLockToggle" />
            lock the selected keys while this task is open
          </label>
          <span class="muted lock-scope-note">A lock blocks editor saves, status changes, MT fills, branch merges, snapshot restores and key deletion for everyone except the assignee and team admins. Imports skip locked keys and report them in the run; other keys still import.</span>
          <button class="primary" type="submit" [disabled]="creating()">Create task</button>
          @if (creating()) { <span role="status" name="taskCreating">Creating task...</span> }
        </form>
      </section>
      @if (listError()) { <p class="error" role="alert" name="taskListError">Tasks unavailable. No tasks are shown. Retry this read or reload the page.</p><button type="button" name="retryTaskList" (click)="void fetch()">Retry tasks</button> }
      @if (loading()) { <p role="status" name="taskListLoading">Loading tasks...</p> }
      @if (!listError()) { <button type="button" name="refreshTaskList" [disabled]="loading() || mutationsPending()" (click)="refresh()">Refresh tasks</button> }
      <ul class="task-list">
        @for (t of tasks(); track t.id) {
          <li class="task-row" [attr.aria-busy]="rowPending(t.id)">
            <span class="task-status task-{{ t.status.toLowerCase().replace('_', '-') }}">{{ t.status.toLowerCase().replace('_', ' ') }}</span>
            <div class="task-body">
              <strong>{{ t.title }}</strong>
              @if (t.description) { <span class="muted">{{ t.description }}</span> }
              <span class="muted">waits on:
                <select [disabled]="rowPending(t.id)" class="depends-select" [attr.aria-label]="'Depends on for ' + t.title" [ngModel]="t.dependsOn?.id ?? ''"
                  (change)="update(t, { dependsOnId: $any($event.target).value || null }, $any($event.target), t.dependsOn?.id ?? '')">
                  <option value="">no predecessor</option>
                  @for (p of tasks(); track p.id) { @if (p.id !== t.id) { <option [value]="p.id">{{ p.title }} ({{ p.status.toLowerCase().replace('_', ' ') }})</option> } }
                </select>
              </span>
              @if (t.lockKeys && t.keys.length) { <span class="muted lock-chip">locks {{ t.keys.length }} key(s): {{ lockedNames(t) }}</span> }
            </div>
            <select [disabled]="rowPending(t.id)" [attr.aria-label]="'Status for ' + t.title" [ngModel]="t.status"
              (change)="update(t, { status: $any($event.target).value }, $any($event.target), t.status)">
              <option value="OPEN">open</option>
              <option value="IN_PROGRESS">in progress</option>
              <option value="DONE">done</option>
            </select>
            <select [disabled]="rowPending(t.id)" [attr.aria-label]="'Assignee for ' + t.title" [ngModel]="assigneeValue(t)"
              (change)="update(t, assigneePatch($any($event.target).value), $any($event.target), assigneeValue(t))">
              <option value="">unassigned</option>
              @for (m of members(); track m.id) { <option [value]="m.id">{{ m.displayName }}</option> }
              @for (g of groups(); track g.id) { <option [value]="'g:' + g.id">Group: {{ g.name }}</option> }
            </select>
            @if (t.dueDate) { <time class="muted">due {{ t.dueDate | date:'mediumDate' }}</time> }
            @if (updatingIds().includes(t.id)) { <span role="status" name="taskUpdating">Updating task...</span> }
            @if (deletingIds().includes(t.id)) { <span role="status" name="taskDeleting">Deleting task...</span> }
            <button [disabled]="rowPending(t.id)" class="danger" [attr.aria-label]="'Delete task ' + t.title" (click)="remove(t)">&times;</button>
          </li>
        } @empty {
          @if (!loading() && !listError()) { <li class="muted" name="taskListEmpty">{{ hasFilters() ? 'No tasks match these filters' : 'No tasks yet' }}</li> }
        }
      </ul>
    </main>
  `,
})
export class TasksComponent implements OnInit, OnDestroy {
  projectId = '';
  tasks = signal<TaskItem[]>([]);
  members = signal<MemberInfo[]>([]);
  groups = signal<GroupInfo[]>([]);
  keys = signal<Key[]>([]);
  selectedKeyIds = signal<string[]>([]);
  lockKeys = signal(false);
  statusFilter = signal('');
  mineFilter = signal('');
  listError = signal(false);
  loading = signal(true);
  error = signal(''); createNotice = signal('');
  creating = signal(false);
  updatingIds = signal<string[]>([]);
  deletingIds = signal<string[]>([]);
  title = signal('');
  description = signal('');
  dueDate = signal('');
  assigneeId = signal('');
  dependsOnId = signal('');

  private routeSub?: Subscription;
  private fetchSeq = 0;
  private destroyed = false;
  private projectGeneration = 0;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    // Subscribe rather than snapshot: the router reuses this component when
    // only the project id changes, and each project needs its own restored
    // filters and fresh lists.
    this.routeSub = this.route.paramMap.subscribe((pm) => this.initForProject(pm.get('id') ?? ''));
  }

  ngOnDestroy() {
    this.destroyed=true;++this.fetchSeq;++this.projectGeneration;
    this.routeSub?.unsubscribe();
  }

  private initForProject(pid: string) {
    if(this.destroyed)return;
    const scope=++this.projectGeneration;
    this.projectId = pid;
    this.fetchSeq++; // invalidate every in-flight fetch from the previous project
    this.error.set('');this.createNotice.set('');this.creating.set(false);this.updatingIds.set([]);this.deletingIds.set([]);
    this.tasks.set([]); this.members.set([]); this.groups.set([]); this.keys.set([]);
    this.title.set(''); this.description.set(''); this.dueDate.set('');
    this.assigneeId.set(''); this.dependsOnId.set(''); this.selectedKeyIds.set([]); this.lockKeys.set(false);
    this.statusFilter.set(''); this.mineFilter.set('');
    // Restore the assignee/status filters chosen on a previous visit to
    // this project's tasks page (best-effort; storage may be unavailable).
    try {
      const raw = localStorage.getItem(this.filterKey());
      if (raw) {
        const saved = JSON.parse(raw) as { status?: string; mine?: string };
        if (saved.status && ['OPEN', 'IN_PROGRESS', 'DONE'].includes(saved.status)) this.statusFilter.set(saved.status);
        if (saved.mine === 'me') this.mineFilter.set('me');
      }
    } catch { /* corrupt or unavailable storage: fall back to defaults */ }
    void this.fetch();
    void this.api.listMembers(pid)
      .then((m) => { if (!this.destroyed && scope === this.projectGeneration) this.members.set(m); })
      .catch(() => { if (!this.destroyed && scope === this.projectGeneration) this.members.set([]); });
    void this.api.listGroups(pid)
      .then((g) => { if (!this.destroyed && scope === this.projectGeneration) this.groups.set(g); })
      .catch(() => { if (!this.destroyed && scope === this.projectGeneration) this.groups.set([]); });
    void this.api.listKeys(pid)
      .then((k) => { if (!this.destroyed && scope === this.projectGeneration) this.keys.set(k); })
      .catch(() => { if (!this.destroyed && scope === this.projectGeneration) this.keys.set([]); });
  }

  setFilter(status: string) {
    this.statusFilter.set(status);
    this.persistFilters();
    void this.fetch();
  }

  setMine(v: string) {
    this.mineFilter.set(v);
    this.persistFilters();
    void this.fetch();
  }

  hasFilters() { return !!(this.statusFilter()||this.mineFilter()==='me'); }

  private filterKey(): string {
    return 'ol.taskFilters.' + this.projectId;
  }

  private persistFilters() {
    try {
      localStorage.setItem(this.filterKey(), JSON.stringify({ status: this.statusFilter(), mine: this.mineFilter() }));
    } catch { /* private mode/quota: persistence is best-effort */ }
  }

  mutationsPending() { return this.creating()||this.updatingIds().length>0||this.deletingIds().length>0; }
  refresh() { if(!this.loading()&&!this.mutationsPending())void this.fetch(); }

  async fetch() {
    // Latest-request-wins: rapid filter changes (or a project switch) fire
    // overlapping fetches; only the newest response may touch the list,
    // the error banner or the loading flag.
    if(this.destroyed)return;
    const seq = ++this.fetchSeq;
    this.tasks.set([]);this.listError.set(false);
    this.loading.set(true);
    try {
      const list = await this.api.listTasks(this.projectId, this.statusFilter() || undefined, this.mineFilter() === 'me');
      if (seq !== this.fetchSeq) return;
      this.tasks.set(list);
    } catch {
      if (seq === this.fetchSeq) this.listError.set(true);
    } finally {
      if (seq === this.fetchSeq) this.loading.set(false);
    }
  }

  assigneeValue(t: TaskItem): string {
    return t.assignee?.id ?? (t.assigneeGroup ? 'g:' + t.assigneeGroup.id : '');
  }

  assigneePatch(v: string): Record<string, unknown> {
    if (!v) return { assigneeId: null, assigneeGroupId: null };
    if (v.startsWith('g:')) return { assigneeGroupId: v.slice(2) };
    return { assigneeId: v };
  }

  lockedNames(t: TaskItem): string {
    const names = t.keys.map((k) => k.key.name);
    return names.length > 3 ? names.slice(0, 3).join(', ') + ', …' : names.join(', ');
  }

  async create() {
    const title = this.title().trim();
    if (!title||this.creating()||this.destroyed) return;
    const scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration;
    const draft={title:this.title(),description:this.description(),dueDate:this.dueDate(),
      assigneeId:this.assigneeId(),dependsOnId:this.dependsOnId(),keyIds:[...this.selectedKeyIds()],lockKeys:this.lockKeys()};
    this.creating.set(true);this.error.set('');this.createNotice.set('');
    try {
      await this.api.createTask(projectId, {
        title,
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        ...this.assigneePatch(draft.assigneeId),
        ...(draft.dependsOnId ? { dependsOnId: draft.dependsOnId } : {}),
        ...(draft.keyIds.length ? { keyIds: draft.keyIds, lockKeys: draft.lockKeys } : {}),
      });
      if(!current())return;
      this.createNotice.set(`Task "${title}" was created. The list below uses the current assignee and status filters; a new task may not match. If the list is unavailable, retry the read without creating the task again.`);
      // Inputs remain editable during POST. Never clear a newer whole draft.
      if(this.title()===draft.title&&this.description()===draft.description&&this.dueDate()===draft.dueDate&&
        this.assigneeId()===draft.assigneeId&&this.dependsOnId()===draft.dependsOnId&&this.lockKeys()===draft.lockKeys&&
        this.selectedKeyIds().length===draft.keyIds.length&&this.selectedKeyIds().every((id,i)=>id===draft.keyIds[i])){
        this.title.set(''); this.description.set(''); this.dueDate.set(''); this.assigneeId.set(''); this.dependsOnId.set('');
        this.selectedKeyIds.set([]); this.lockKeys.set(false);
      }
      await this.fetch();
    } catch { if(current())this.error.set('Task creation failed. Check the task list before trying again.'); }
    finally {if(current())this.creating.set(false);}
  }

  rowPending(id:string) { return this.updatingIds().includes(id)||this.deletingIds().includes(id); }

  async update(t: TaskItem, patch: Record<string, unknown>, el?: HTMLSelectElement, revertValue?: string) {
    if(this.destroyed||this.rowPending(t.id))return;
    const scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration;
    this.updatingIds.update(ids=>[...ids,t.id]);this.error.set('');
    try {
      await this.api.updateTask(projectId, t.id, patch);
      if(current())await this.fetch();
    } catch (e) {
      if(!current())return;
      // Preserve actionable domain guidance only for exact reviewed messages.
      const known=e instanceof Error&&['Task is blocked until its predecessor is done','Task dependency would create a cycle'].includes(e.message)?e.message:null;
      this.error.set(known??'Task update failed. Check the task list before trying again.');
      // Revert the control before a fresh server read settles uncertain outcomes.
      if (el && revertValue !== undefined) el.value = revertValue;
      await this.fetch();
    } finally { if(current())this.updatingIds.update(ids=>ids.filter(id=>id!==t.id)); }
  }

  async remove(t: TaskItem) {
    if(this.destroyed||this.rowPending(t.id))return;
    const scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration;
    this.deletingIds.update(ids=>[...ids,t.id]);this.error.set('');
    try {
      await this.api.deleteTask(projectId, t.id);
      if(current())await this.fetch();
    } catch {
      if(!current())return;
      this.error.set('Task deletion failed. Check the task list before trying again.');
      await this.fetch();
    } finally { if(current())this.deletingIds.update(ids=>ids.filter(id=>id!==t.id)); }
  }
}
