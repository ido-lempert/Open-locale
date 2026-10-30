import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, BranchInfo, ProgressReport, QualityReport, TaskReport, UsageReport } from '../api.service';

@Component({
  selector: 'ol-reports',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Reports</h1>
      <select aria-label="Branch" name="reportBranch" [ngModel]="branch()" (ngModelChange)="branch.set($event); void fetch()">
        @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
      </select>
    </header>
    <main>
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      @if (report(); as r) {
        <p class="muted">{{ r.totalKeys }} keys on {{ r.branch }}. A key counts as translated when its value is not empty; status counts cover non-empty values only.</p>
        <div class="table-scroll">
        <table class="qa-table progress-table">
          <thead>
            <tr class="group-row">
              <th rowspan="2" class="row-head">Locale</th>
              <th rowspan="2" class="progress-bar-col">Progress</th>
              <th colspan="2" class="group-label">Filled values</th>
              @if (statusColumns().length) { <th [attr.colspan]="statusColumns().length" class="group-label status-group">Workflow status</th> }
            </tr>
            <tr>
              <th>Translated</th><th>Untranslated</th>
              @for (s of statusColumns(); track s) { <th [class.status-group]="s === statusColumns()[0]">{{ s.toLowerCase() }}</th> }
            </tr>
          </thead>
          <tbody>
            @for (l of r.locales; track l.locale) {
              <tr>
                <td><code>{{ l.locale }}</code>@if (l.base) { <span class="muted"> base</span> }</td>
                <td class="progress-bar-col">
                  <div class="progress-bar" role="img" [attr.aria-label]="l.locale + ' ' + l.percent + '% translated'">
                    <div class="progress-fill" [style.width.%]="l.percent"></div>
                  </div>
                  <span class="muted">{{ l.percent }}%</span>
                </td>
                <td>{{ l.translated }} / {{ l.total }}</td>
                <td>{{ l.untranslated }}</td>
                @for (s of statusColumns(); track s) { <td [class.status-group]="s === statusColumns()[0]">{{ l.byStatus[s] ?? 0 }}</td> }
              </tr>
            }
          </tbody>
        </table>
        </div>
      } @else if (!error()) {
        <p class="muted">Loading…</p>
      }

      <h2>Quality</h2>
      @if (quality(); as q) {
        <p class="muted">{{ q.totalIssues }} open findings across {{ q.keysWithIssues }} keys on {{ q.branch }}.</p>
        @if (q.totalIssues > 0) {
          <div class="table-scroll">
          <table class="qa-table quality-table">
            <thead>
              <tr><th class="row-head">Locale</th><th>Total</th>@for (t of q.types; track t) { <th>{{ t.split('_').join(' ') }}</th> }</tr>
            </thead>
            <tbody>
              @for (l of q.locales; track l.locale) {
                <tr><td><code>{{ l.locale }}</code></td><td>{{ l.total }}</td>@for (t of q.types; track t) { <td>{{ l.byType[t] ?? 0 }}</td> }</tr>
              }
            </tbody>
          </table>
          </div>
        }
      }

      <h2>Usage <span class="muted">last {{ usage()?.days ?? 30 }} days</span></h2>
      @if (usage(); as u) {
        <p class="muted">{{ u.totalEvents }} events touching {{ u.activeKeys }} keys.</p>
        <div class="table-scroll">
        <table class="qa-table usage-table">
          <thead><tr><th class="row-head">Action</th><th>Events</th></tr></thead>
          <tbody>@for (a of actionRows(u); track a.action) { <tr><td><code>{{ a.action }}</code></td><td>{{ a.count }}</td></tr> }</tbody>
        </table>
        <table class="qa-table usage-table">
          <thead><tr><th class="row-head">Actor</th><th>Events</th></tr></thead>
          <tbody>@for (a of u.topActors; track a.name) { <tr><td>{{ a.name }}</td><td>{{ a.count }}</td></tr> }</tbody>
        </table>
        </div>
      }

      <h2>Tasks</h2>
      @if (taskReport(); as t) {
        <p class="muted">{{ t.total }} tasks: {{ t.byStatus['OPEN'] ?? 0 }} open, {{ t.byStatus['IN_PROGRESS'] ?? 0 }} in progress, {{ t.byStatus['DONE'] ?? 0 }} done.
          <span [class.error]="t.overdue > 0">{{ t.overdue }} overdue</span>, {{ t.dueSoon }} due within 7 days.</p>
        @if (t.perAssignee.length > 0) {
          <div class="table-scroll">
          <table class="qa-table tasks-table">
            <thead><tr><th class="row-head">Assignee</th><th>Open tasks</th></tr></thead>
            <tbody>@for (a of t.perAssignee; track a.name) { <tr><td>{{ a.name }}</td><td>{{ a.count }}</td></tr> }</tbody>
          </table>
          </div>
        }
      }
    </main>
  `,
})
export class ReportsComponent implements OnInit {
  projectId = '';
  report = signal<ProgressReport | null>(null);
  quality = signal<QualityReport | null>(null);
  usage = signal<UsageReport | null>(null);
  taskReport = signal<TaskReport | null>(null);
  branches = signal<BranchInfo[]>([]);
  branch = signal('main');
  statusColumns = signal<string[]>([]);
  error = signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  async ngOnInit() {
    this.projectId = this.route.snapshot.paramMap.get('id') ?? '';
    this.branches.set(await this.api.listBranches(this.projectId).catch(() => []));
    await this.fetch();
    await this.ngOnInitDashboards();
  }

  actionRows(u: UsageReport) {
    return Object.entries(u.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => ({ action, count }));
  }

  async fetch() {
    this.error.set('');
    try {
      const r = await this.api.getProgress(this.projectId, this.branch());
      this.report.set(r);
      const cols: string[] = [];
      for (const l of r.locales) for (const s of Object.keys(l.byStatus)) if (!cols.includes(s)) cols.push(s);
      this.statusColumns.set(cols);
      this.quality.set(await this.api.getQuality(this.projectId, this.branch()));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
  }

  async ngOnInitDashboards() {
    this.usage.set(await this.api.getUsage(this.projectId).catch(() => null));
    this.taskReport.set(await this.api.getTaskReport(this.projectId).catch(() => null));
  }
}
