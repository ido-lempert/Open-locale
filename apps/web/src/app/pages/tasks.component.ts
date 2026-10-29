import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      <section class="panel">
        <h2>New task</h2>
        <form class="task-form" (ngSubmit)="create()">
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
          <button class="primary" type="submit">Create task</button>
        </form>
      </section>
      <ul class="task-list">
        @for (t of tasks(); track t.id) {
          <li class="task-row">
            <span class="task-status task-{{ t.status.toLowerCase().replace('_', '-') }}">{{ t.status.toLowerCase().replace('_', ' ') }}</span>
            <div class="task-body">
              <strong>{{ t.title }}</strong>
              @if (t.description) { <span class="muted">{{ t.description }}</span> }
              <span class="muted">waits on:
                <select class="depends-select" [attr.aria-label]="'Depends on for ' + t.title" [ngModel]="t.dependsOn?.id ?? ''"
                  (change)="update(t, { dependsOnId: $any($event.target).value || null }, $any($event.target), t.dependsOn?.id ?? '')">
                  <option value="">no predecessor</option>
                  @for (p of tasks(); track p.id) { @if (p.id !== t.id) { <option [value]="p.id">{{ p.title }} ({{ p.status.toLowerCase().replace('_', ' ') }})</option> } }
                </select>
              </span>
              @if (t.lockKeys && t.keys.length) { <span class="muted lock-chip">locks {{ t.keys.length }} key(s): {{ lockedNames(t) }}</span> }
            </div>
            <select [attr.aria-label]="'Status for ' + t.title" [ngModel]="t.status"
              (change)="update(t, { status: $any($event.target).value }, $any($event.target), t.status)">
              <option value="OPEN">open</option>
              <option value="IN_PROGRESS">in progress</option>
              <option value="DONE">done</option>
            </select>
            <select [attr.aria-label]="'Assignee for ' + t.title" [ngModel]="assigneeValue(t)"
              (change)="update(t, assigneePatch($any($event.target).value), $any($event.target), assigneeValue(t))">
              <option value="">unassigned</option>
              @for (m of members(); track m.id) { <option [value]="m.id">{{ m.displayName }}</option> }
              @for (g of groups(); track g.id) { <option [value]="'g:' + g.id">Group: {{ g.name }}</option> }
            </select>
            @if (t.dueDate) { <time class="muted">due {{ t.dueDate | date:'mediumDate' }}</time> }
            <button class="danger" [attr.aria-label]="'Delete task ' + t.title" (click)="remove(t)">&times;</button>
          </li>
        } @empty {
          <li class="muted">{{ loading() ? 'Loading…' : 'No tasks yet' }}</li>
        }
      </ul>
    </main>
  `,
})
export class TasksComponent implements OnInit {
  projectId = '';
  tasks = signal<TaskItem[]>([]);
  members = signal<MemberInfo[]>([]);
  groups = signal<GroupInfo[]>([]);
  keys = signal<Key[]>([]);
  selectedKeyIds = signal<string[]>([]);
  lockKeys = signal(false);
  statusFilter = signal('');
  mineFilter = signal('');
  loading = signal(true);
  error = signal('');
  title = signal('');
  description = signal('');
  dueDate = signal('');
  assigneeId = signal('');
  dependsOnId = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
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
    void this.api.listMembers(this.projectId)
      .then((m) => this.members.set(m))
      .catch(() => this.members.set([]));
    void this.api.listGroups(this.projectId)
      .then((g) => this.groups.set(g))
      .catch(() => this.groups.set([]));
    void this.api.listKeys(this.projectId)
      .then((k) => this.keys.set(k))
      .catch(() => this.keys.set([]));
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

  private filterKey(): string {
    return 'ol.taskFilters.' + this.projectId;
  }

  private persistFilters() {
    try {
      localStorage.setItem(this.filterKey(), JSON.stringify({ status: this.statusFilter(), mine: this.mineFilter() }));
    } catch { /* private mode/quota: persistence is best-effort */ }
  }

  async fetch() {
    this.loading.set(true);
    try {
      this.tasks.set(await this.api.listTasks(this.projectId, this.statusFilter() || undefined, this.mineFilter() === 'me'));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load tasks'); }
    finally { this.loading.set(false); }
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
    if (!title) return;
    try {
      await this.api.createTask(this.projectId, {
        title,
        ...(this.description().trim() ? { description: this.description().trim() } : {}),
        ...(this.dueDate() ? { dueDate: this.dueDate() } : {}),
        ...this.assigneePatch(this.assigneeId()),
        ...(this.dependsOnId() ? { dependsOnId: this.dependsOnId() } : {}),
        ...(this.selectedKeyIds().length ? { keyIds: this.selectedKeyIds(), lockKeys: this.lockKeys() } : {}),
      });
      this.title.set(''); this.description.set(''); this.dueDate.set(''); this.assigneeId.set(''); this.dependsOnId.set('');
      this.selectedKeyIds.set([]); this.lockKeys.set(false);
      await this.fetch();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to create task'); }
  }

  async update(t: TaskItem, patch: Record<string, unknown>, el?: HTMLSelectElement, revertValue?: string) {
    try {
      await this.api.updateTask(this.projectId, t.id, patch);
      await this.fetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to update task');
      // Revert the control to the last server-known value (the model never
      // drifted, so a binding alone would not push the old value back).
      if (el && revertValue !== undefined) el.value = revertValue;
      await this.fetch();
    }
  }

  async remove(t: TaskItem) {
    try {
      await this.api.deleteTask(this.projectId, t.id);
      await this.fetch();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to delete task'); }
  }
}
