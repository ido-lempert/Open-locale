import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
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
    <main [attr.aria-busy]="branchLoading() || dashboardsLoading()">
      @if (error(); as e) { <p class="error" role="alert" name="branchReportError">{{ e }}</p> }
      @if (branchLoading()) { <p role="status" name="branchReportLoading">Loading progress and quality reports for {{ branch() }}...</p> }
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
        } @else { <p class="muted" name="qualityEmpty">No findings from the current quality checks on {{ q.branch }}.</p> }
      }

      <p class="muted" name="projectDashboardScope">Usage and tasks cover the whole project. The branch selector filters progress and quality only.</p>
      <h2>Usage <span class="muted">last {{ usage()?.days ?? 30 }} days</span></h2>
      @if (dashboardsLoading()) { <p role="status">Loading usage and task reports...</p> }
      @if (usageError()) { <p class="error" role="alert" name="usageReportError">Usage report unavailable. No usage figures are shown. Reload this page to try again.</p> }
      @if (usage(); as u) {
        <p class="muted">{{ u.totalEvents }} events touching {{ u.activeKeys }} keys.</p>
        <p class="muted" name="usageWindow" style="overflow-wrap:anywhere">Captured window: <time>{{ u.since }}</time> through <time>{{ u.asOf }}</time>. UTC calendar days. Separate reads are not one database snapshot.</p>
        <div class="table-scroll">
        <table class="qa-table usage-table">
          <thead><tr><th class="row-head">Action</th><th>Events</th></tr></thead>
          <tbody>@for (a of actionRows(u); track a.action) { <tr><td><code>{{ a.action }}</code></td><td>{{ a.count }}</td></tr> } @empty { <tr name="usageActionsEmpty"><td colspan="2" class="muted">No activity in this window.</td></tr> }</tbody>
        </table>
        <table class="qa-table usage-table">
          <thead><tr><th class="row-head">Top 5 actors</th><th>Events</th></tr></thead>
          <tbody>@for (a of u.topActors; track a.actorId) { <tr><td>{{ a.name }}<small class="muted" style="display:block;overflow-wrap:anywhere">{{ a.actorId }}</small></td><td>{{ a.count }}</td></tr> } @empty { <tr name="usageActorsEmpty"><td colspan="2" class="muted">No attributed actors in this window.</td></tr> }</tbody>
        </table>
        </div>
      }

      <h2>Tasks</h2>
      @if (taskReportError()) { <p class="error" role="alert" name="taskReportError">Task report unavailable. No task figures are shown. Reload this page to try again.</p> }
      @if (taskReport(); as t) {
        <p class="muted">{{ t.total }} tasks: {{ t.byStatus['OPEN'] ?? 0 }} open, {{ t.byStatus['IN_PROGRESS'] ?? 0 }} in progress, {{ t.byStatus['DONE'] ?? 0 }} done.
          <span [class.error]="t.overdue > 0">{{ t.overdue }} overdue</span>, {{ t.dueSoon }} due within 7 days.</p>
        <p class="muted" name="taskWindow" style="overflow-wrap:anywhere">Deadline cutoff: <time>{{ t.asOf }}</time>. Due soon includes this cutoff through <time>{{ t.dueSoonThrough }}</time>. Workload is read separately, not one database snapshot.</p>
        @if (t.perAssignee.length > 0) {
          <div class="table-scroll">
          <table class="qa-table tasks-table">
            <thead><tr><th class="row-head">Assignee</th><th>Open tasks</th></tr></thead>
            <tbody>@for (a of t.perAssignee; track a.kind + ':' + (a.assigneeId ?? a.assigneeGroupId ?? '')) { <tr><td>{{ a.name }}<small class="muted" style="display:block;overflow-wrap:anywhere">{{ a.kind === 'group' ? 'Group: ' + a.assigneeGroupId : a.assigneeId ?? 'No assignee' }}</small></td><td>{{ a.count }}</td></tr> }</tbody>
          </table>
          </div>
        } @else { <p class="muted" name="taskWorkloadEmpty">No open tasks.</p> }
      }
    </main>
  `,
})
export class ReportsComponent implements OnInit, OnDestroy {
  projectId = '';
  report = signal<ProgressReport | null>(null);
  quality = signal<QualityReport | null>(null);
  usage = signal<UsageReport | null>(null);
  taskReport = signal<TaskReport | null>(null);
  branches = signal<BranchInfo[]>([]);
  branch = signal('main');
  statusColumns = signal<string[]>([]);
  error = signal('');
  branchLoading=signal(false);
  usageError=signal(false);
  taskReportError=signal(false);
  dashboardsLoading=signal(false);
  private generation=0;
  private destroyed=false;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  private projectGeneration=0;
  private subscription?: Subscription;
  ngOnInit() {
    this.subscription=this.route.paramMap.subscribe(params=>{void this.loadProject(params.get('id')??'');});
  }
  async loadProject(projectId:string) {
    if(this.destroyed)return;
    const scope=++this.projectGeneration;++this.generation;this.projectId=projectId;
    this.branch.set('main');this.branches.set([]);this.report.set(null);this.quality.set(null);
    this.usage.set(null);this.taskReport.set(null);this.statusColumns.set([]);this.error.set('');this.branchLoading.set(true);this.usageError.set(false);this.taskReportError.set(false);this.dashboardsLoading.set(true);
    const branches=await this.api.listBranches(projectId).catch(()=>[]);
    if(this.destroyed||scope!==this.projectGeneration)return;
    this.branches.set(branches);
    await Promise.all([this.fetch(),this.ngOnInitDashboards()]);
  }

  actionRows(u: UsageReport) {
    return Object.entries(u.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => ({ action, count }));
  }

  ngOnDestroy() { this.destroyed=true;++this.generation;++this.projectGeneration;this.subscription?.unsubscribe(); }

  async fetch() {
    if(this.destroyed)return;
    const generation=++this.generation,projectId=this.projectId,branch=this.branch();
    this.error.set('');this.branchLoading.set(true);this.report.set(null);this.quality.set(null);this.statusColumns.set([]);
    try {
      const [r,q]=await Promise.all([this.api.getProgress(projectId,branch),this.api.getQuality(projectId,branch)]);
      if(this.destroyed||generation!==this.generation)return;
      const cols: string[] = [];
      for (const l of r.locales) for (const s of Object.keys(l.byStatus)) if (!cols.includes(s)) cols.push(s);
      this.report.set(r);this.statusColumns.set(cols);this.quality.set(q);
    } catch { if(!this.destroyed&&generation===this.generation)this.error.set('Progress and quality reports unavailable. No branch figures are shown. Choose a branch again or reload this page to retry.'); }
    finally { if(!this.destroyed&&generation===this.generation)this.branchLoading.set(false); }
  }

  async ngOnInitDashboards() {
    if(this.destroyed)return;
    const scope=this.projectGeneration,projectId=this.projectId;
    this.usage.set(null);this.taskReport.set(null);this.usageError.set(false);this.taskReportError.set(false);this.dashboardsLoading.set(true);
    const [usage,tasks]=await Promise.allSettled([this.api.getUsage(projectId),this.api.getTaskReport(projectId)]);
    if(this.destroyed||scope!==this.projectGeneration)return;
    this.usage.set(usage.status==='fulfilled'?usage.value:null);this.usageError.set(usage.status==='rejected');
    this.taskReport.set(tasks.status==='fulfilled'?tasks.value:null);this.taskReportError.set(tasks.status==='rejected');
    this.dashboardsLoading.set(false);
  }
}
