import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, MemberInfo, TaskItem } from '../api.service';

@Component({
  selector: 'ol-tasks',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Tasks</h1>
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
          </select>
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
            </div>
            <select [attr.aria-label]="'Status for ' + t.title" [ngModel]="t.status"
              (ngModelChange)="update(t, { status: $event })">
              <option value="OPEN">open</option>
              <option value="IN_PROGRESS">in progress</option>
              <option value="DONE">done</option>
            </select>
            <select [attr.aria-label]="'Assignee for ' + t.title" [ngModel]="t.assignee?.id ?? ''"
              (ngModelChange)="update(t, { assigneeId: $event || null })">
              <option value="">unassigned</option>
              @for (m of members(); track m.id) { <option [value]="m.id">{{ m.displayName }}</option> }
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
  statusFilter = signal('');
  loading = signal(true);
  error = signal('');
  title = signal('');
  description = signal('');
  dueDate = signal('');
  assigneeId = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    void this.fetch();
    void this.api.listMembers(this.projectId)
      .then((m) => this.members.set(m))
      .catch(() => this.members.set([]));
  }

  setFilter(status: string) {
    this.statusFilter.set(status);
    void this.fetch();
  }

  async fetch() {
    this.loading.set(true);
    try {
      this.tasks.set(await this.api.listTasks(this.projectId, this.statusFilter() || undefined));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load tasks'); }
    finally { this.loading.set(false); }
  }

  async create() {
    const title = this.title().trim();
    if (!title) return;
    try {
      await this.api.createTask(this.projectId, {
        title,
        ...(this.description().trim() ? { description: this.description().trim() } : {}),
        ...(this.dueDate() ? { dueDate: this.dueDate() } : {}),
        ...(this.assigneeId() ? { assigneeId: this.assigneeId() } : {}),
      });
      this.title.set(''); this.description.set(''); this.dueDate.set(''); this.assigneeId.set('');
      await this.fetch();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to create task'); }
  }

  async update(t: TaskItem, patch: Record<string, unknown>) {
    try {
      await this.api.updateTask(this.projectId, t.id, patch);
      await this.fetch();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to update task'); }
  }

  async remove(t: TaskItem) {
    try {
      await this.api.deleteTask(this.projectId, t.id);
      await this.fetch();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to delete task'); }
  }
}
