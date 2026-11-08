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
      <select aria-label="Branch" [attr.aria-busy]="branchListLoading()" name="reportBranch" [ngModel]="branch()" (ngModelChange)="branch.set($event); void fetch()">
        @if (!branches().length) { <option value="main">main</option> }
        @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
      </select>
    </header>
    <main [attr.aria-busy]="branchLoading() || dashboardsLoading()">
      @if (branchListLoading()) { <p role="status" name="branchListLoading">Loading branch list. Main reports are available independently.</p> }
      @if (branchListError()) { <p class="error" role="alert" name="branchListError">Branch list unavailable. Retry loading branches or reload this page.</p><button type="button" name="retryBranches" (click)="void loadBranches()">Retry branch list</button> }
      @if (error(); as e) { <p class="error" role="alert" name="branchReportError">{{ e }}</p><button type="button" name="retryBranchReports" (click)="void fetch()">Retry branch reports</button> }
      @if (!error()) { <button type="button" name="refreshBranchReports" [disabled]="branchLoading()" (click)="refreshBranch()">Refresh branch reports</button> }
      <button type="button" name="downloadBranchReports" [disabled]="branchLoading() || !!error() || !report() || !quality()" (click)="downloadBranch()">Download branch reports (.json)</button>
      <p class="muted" name="branchDownloadScope">Downloads loaded progress and quality for this branch, not usage, task reports, newer server changes or live drafts. These are separate reads, not one database snapshot. The file can contain private project data; downloading does not share it.</p>
      @if (downloadNotice()) { <p role="status" name="branchDownloadNotice">{{ downloadNotice() }}</p> }
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
      <button type="button" name="downloadProjectReports" [disabled]="!projectDownloadReady()" (click)="downloadProject()">Download loaded project dashboards (.json)</button>
      <p class="muted" name="projectDownloadScope">Downloads loaded usage and task dashboard figures for the whole project, regardless of the branch selector. Includes private actor/assignee names and IDs, not translation values, task descriptions or branch reports. Keeps each captured window and cutoff. Separate reads are not one database snapshot or newer server state. Downloading does not share or change the project.</p>
      @if(projectDownloadNotice()){<p role="status" name="projectDownloadNotice">{{projectDownloadNotice()}}</p>}
      <h2>Usage <span class="muted">last {{ usage()?.days ?? usageDays() }} days</span></h2>
      <label>Usage window <select name="usageDays" aria-label="Usage window" [ngModel]="usageDays()" (ngModelChange)="usageDays.set(+$event); void loadUsage()"><option [ngValue]="7">7 days</option><option [ngValue]="30">30 days</option><option [ngValue]="90">90 days</option></select></label>
      @if (!usageError()) { <button type="button" name="refreshUsageReport" [disabled]="usageLoading()" (click)="refreshUsage()">Refresh usage</button> }
      @if (usageLoading()) { <p role="status" name="usageLoading">Loading usage report...</p> }
      @if (usageError()) { <p class="error" role="alert" name="usageReportError">Usage report unavailable. No usage figures are shown. Retry the selected window or reload this page.</p><button type="button" name="retryUsage" (click)="void loadUsage()">Retry usage</button> }
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
      @if (!taskReportError()) { <button type="button" name="refreshTaskReport" [disabled]="tasksLoading()" (click)="refreshTasks()">Refresh task report</button> }
      @if (tasksLoading()) { <p role="status" name="tasksLoading">Loading task report...</p> }
      @if (taskReportError()) { <p class="error" role="alert" name="taskReportError">Task report unavailable. No task figures are shown. Retry tasks or reload this page.</p><button type="button" name="retryTasks" (click)="void loadTasks()">Retry tasks</button> }
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
  branchListError=signal(false);
  branchListLoading=signal(false);
  branch = signal('main');
  statusColumns = signal<string[]>([]);
  error = signal('');downloadNotice=signal('');projectDownloadNotice=signal('');
  branchLoading=signal(false);
  usageError=signal(false);
  taskReportError=signal(false);
  dashboardsLoading=signal(false);
  usageLoading=signal(false);
  usageDays=signal(30);
  private branchListGeneration=0;
  private usageGeneration=0;
  private taskGeneration=0;
  tasksLoading=signal(false);
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
    ++this.projectGeneration;++this.generation;this.projectId=projectId;
    this.usageDays.set(30);++this.usageGeneration;++this.taskGeneration;this.branch.set('main');this.branches.set([]);this.branchListError.set(false);this.branchListLoading.set(true);this.report.set(null);this.quality.set(null);
    this.usage.set(null);this.taskReport.set(null);this.statusColumns.set([]);this.error.set('');this.downloadNotice.set('');this.projectDownloadNotice.set('');this.branchLoading.set(true);this.usageError.set(false);this.taskReportError.set(false);this.dashboardsLoading.set(true);this.usageLoading.set(true);this.tasksLoading.set(true);
    await Promise.all([this.loadBranches(),this.fetch(),this.ngOnInitDashboards()]);
  }

  async loadBranches() {
    if(this.destroyed)return;
    const generation=++this.branchListGeneration,scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.branchListGeneration;
    this.branchListError.set(false);this.branchListLoading.set(true);
    try { const branches=await this.api.listBranches(projectId);if(current())this.branches.set(branches); }
    catch { if(current())this.branchListError.set(true); }
    finally { if(current())this.branchListLoading.set(false); }
  }

  actionRows(u: UsageReport) {
    return Object.entries(u.byAction).sort((a, b) => b[1] - a[1]).map(([action, count]) => ({ action, count }));
  }

  ngOnDestroy() { this.destroyed=true;++this.generation;++this.projectGeneration;this.subscription?.unsubscribe(); }

  refreshBranch() { if(!this.destroyed&&!this.branchLoading())void this.fetch(); }
  refreshUsage() { if(!this.destroyed&&!this.usageLoading())void this.loadUsage(); }
  refreshTasks() { if(!this.destroyed&&!this.tasksLoading())void this.loadTasks(); }

  async fetch() {
    if(this.destroyed)return;
    const generation=++this.generation,projectId=this.projectId,branch=this.branch();
    this.error.set('');this.downloadNotice.set('');this.branchLoading.set(true);this.report.set(null);this.quality.set(null);this.statusColumns.set([]);
    try {
      const [r,q]=await Promise.all([this.api.getProgress(projectId,branch),this.api.getQuality(projectId,branch)]);
      if(this.destroyed||generation!==this.generation)return;
      const cols: string[] = [];
      for (const l of r.locales) for (const s of Object.keys(l.byStatus)) if (!cols.includes(s)) cols.push(s);
      this.report.set(r);this.statusColumns.set(cols);this.quality.set(q);
    } catch { if(!this.destroyed&&generation===this.generation)this.error.set('Progress and quality reports unavailable. No branch figures are shown. Retry branch reports, choose a branch again or reload this page.'); }
    finally { if(!this.destroyed&&generation===this.generation)this.branchLoading.set(false); }
  }

  downloadBranch() {
    const progress=this.report(),quality=this.quality();
    if(this.destroyed||this.branchLoading()||this.error()||!progress||!quality)return;
    let url:string|undefined;
    try {
      const content=JSON.stringify({schemaVersion:1,projectId:this.projectId,branch:this.branch(),progress,quality},null,2)+'\n';
      url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='branch-reports.json';anchor.click();
      this.downloadNotice.set('Download requested for the loaded branch reports. This does not confirm the file was saved or shared.');
    } catch {this.downloadNotice.set('Download could not be started. Try again from the current branch reports.');}
    finally {if(url)URL.revokeObjectURL(url);}
  }

  projectDownloadReady() {return !this.destroyed&&!this.usageLoading()&&!this.tasksLoading()&&!this.usageError()&&!this.taskReportError()&&!!this.usage()&&!!this.taskReport();}
  downloadProject() {
    if(!this.projectDownloadReady())return;
    const u=this.usage()!,t=this.taskReport()!;
    let url:string|undefined;
    try {
      const content=JSON.stringify({schemaVersion:1,projectId:this.projectId,scope:'loaded-project-dashboards',singleDatabaseSnapshot:false,
        usage:{days:u.days,since:u.since,asOf:u.asOf,timezone:u.timezone,totalEvents:u.totalEvents,activeKeys:u.activeKeys,byAction:{...u.byAction},topActors:u.topActors.map(a=>({actorId:a.actorId,name:a.name,count:a.count}))},
        tasks:{asOf:t.asOf,dueSoonThrough:t.dueSoonThrough,total:t.total,byStatus:{...t.byStatus},overdue:t.overdue,dueSoon:t.dueSoon,perAssignee:t.perAssignee.map(a=>({kind:a.kind,assigneeId:a.assigneeId,assigneeGroupId:a.assigneeGroupId,name:a.name,count:a.count}))}},null,2)+'\n';
      url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='project-dashboards.json';anchor.click();
      this.projectDownloadNotice.set('Download requested for the loaded project dashboards. This does not confirm the file was saved or shared.');
    } catch {this.projectDownloadNotice.set('Download could not be started. Try again from the current project dashboards.');}
    finally {if(url)URL.revokeObjectURL(url);}
  }

  async loadUsage() {
    if(this.destroyed)return;
    const generation=++this.usageGeneration,scope=this.projectGeneration,projectId=this.projectId,days=this.usageDays();
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.usageGeneration;
    this.projectDownloadNotice.set('');this.usage.set(null);this.usageError.set(false);this.usageLoading.set(true);this.dashboardsLoading.set(true);
    try { const value=await this.api.getUsage(projectId,days);if(current())this.usage.set(value); }
    catch { if(current())this.usageError.set(true); }
    finally { if(current()){this.usageLoading.set(false);this.dashboardsLoading.set(this.tasksLoading());} }
  }

  async loadTasks() {
    if(this.destroyed)return;
    const generation=++this.taskGeneration,scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.taskGeneration;
    this.projectDownloadNotice.set('');this.taskReport.set(null);this.taskReportError.set(false);this.tasksLoading.set(true);this.dashboardsLoading.set(true);
    try { const value=await this.api.getTaskReport(projectId);if(current())this.taskReport.set(value); }
    catch { if(current())this.taskReportError.set(true); }
    finally { if(current()){this.tasksLoading.set(false);this.dashboardsLoading.set(this.usageLoading());} }
  }

  async ngOnInitDashboards() {
    if(this.destroyed)return;
    await Promise.all([this.loadUsage(),this.loadTasks()]);
  }
}
