import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, BranchInfo, Project, QaIssue } from '../api.service';

@Component({
  selector: 'ol-qa',
  imports: [FormsModule, RouterLink],
  styles: [` .qa-table.qa-empty {min-width:0;} .qa-empty thead {display:none;} .qa-table.qa-empty td:nth-child(-n+3) {white-space:normal;max-width:none;} .qa-table { width:100%; min-width:680px; border-collapse:collapse; } .qa-table th,.qa-table td { text-align:left; padding:.5rem; vertical-align:top; border-bottom:1px solid #e5e7eb; } .qa-table td { overflow-wrap:anywhere; } .qa-table th:nth-child(-n+3),.qa-table td:nth-child(-n+3) { white-space:nowrap; } `],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>QA checks</h1>
      <select aria-label="QA branch" name="qaBranch" [attr.aria-busy]="branchesLoading()" [ngModel]="branch()" (ngModelChange)="branch.set($event); void fetch()">
        @if (!branches().length) { <option value="main">main</option> }
        @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
      </select>
    </header>
    <main [attr.aria-busy]="loading()">
      <p class="muted" name="qaBranchScope">Checks cover saved translations on branch {{ branch() }} only. To fix findings, open Editor and select this branch.</p>
      @if (branchesLoading()) { <p role="status" name="qaBranchesLoading">Loading branch options. Main checks load independently.</p> }
      @if (branchesError()) { <p role="alert" class="error" name="qaBranchesError">Branch options unavailable. Current checks remain available.</p><button type="button" name="retryQaBranches" (click)="void loadBranches()">Retry branch options</button> }
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p><button type="button" name="retryQa" (click)="void fetch()">Retry QA checks</button> }
      @if (localesLoading()) { <p role="status" name="qaLocalesLoading">Loading locale filter options. Checks load independently.</p> }
      @if (localesError()) { <p class="error" role="alert" name="qaLocalesError">Locale filter options unavailable. Checks remain available.</p><button type="button" name="retryQaLocales" (click)="void loadLocales()">Retry locale options</button> }
      <div class="toolbar">
        <select aria-label="Filter by locale" name="qaLocale" [attr.aria-busy]="localesLoading()" [ngModel]="locale()" (ngModelChange)="locale.set($event); void fetch()">
          <option value="">all target locales</option>
          @for (l of targetLocales(); track l) { <option [value]="l">{{ l }}</option> }
        </select>
        @if (!error()) { <button type="button" name="refreshQa" [disabled]="loading()" (click)="refresh()">Run checks again</button> }
        @if (!loading() && !error()) { <span class="muted" name="qaCount">{{ issues().length }} issue{{ issues().length === 1 ? '' : 's' }}</span> }
      </div>
      <div class="toolbar">
        <label>Issue type <select name="qaType" [ngModel]="issueType()" (ngModelChange)="setIssueType($event)"><option value="">all issue types</option>@for(type of issueTypes;track type){<option [value]="type">{{ label(type) }}</option>}</select></label>
        <button type="button" name="clearQaType" [disabled]="!issueType()" (click)="setIssueType('')">Clear type filter</button>
        @if (!loading() && !error()) { <span class="muted" role="status" name="qaTypeCount">{{ visibleIssues().length }} of {{ issues().length }} loaded findings shown. Local search and type filtering do not run checks again.</span> }
      </div>
      <label>Find in loaded keys, locales or details <input type="search" name="qaSearch" maxlength="200" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></label>
      <button type="button" name="clearQaSearch" [disabled]="!query()" (click)="setQuery('')">Clear search</button>
      <p class="muted" name="qaSearchScope">Search is a literal, case-insensitive substring in loaded findings. It combines with the issue-type filter and does not run checks again.</p>
      <button type="button" name="downloadQa" [disabled]="loading() || !!error()" (click)="download()">Download findings (.json)</button>
      <p class="muted" name="qaDownloadScope">Downloads all current loaded findings, regardless of local search or the type filter, and project, branch and locale scope, not newer server changes or live editor drafts. The file can contain private project text. Downloading does not share it.</p>
      @if (downloadNotice()) { <p role="status" name="qaDownloadNotice">{{ downloadNotice() }}</p> }
      @if (loading()) { <p role="status" name="qaLoading">Loading QA checks...</p> }
      @if (!loading() && !error()) {
      <div class="table-scroll"><table class="qa-table" [class.qa-empty]="!visibleIssues().length">
        <thead><tr><th>Key</th><th>Locale</th><th>Issue</th><th>Detail</th></tr></thead>
        <tbody>
          @for (i of visibleIssues(); track $index) {
            <tr>
              <td>@if (branch() === 'main') { <a class="qa-key" [routerLink]="['/projects', projectId]">{{ i.key }}</a> } @else { <code>{{ i.key }}</code> }</td>
              <td><code>{{ i.locale }}</code></td>
              <td><span [class]="'qa-badge qa-' + i.type">{{ label(i.type) }}</span></td>
              <td class="muted">{{ i.detail }}</td>
            </tr>
          } @empty {
            <tr name="qaEmpty"><td colspan="4" class="muted">{{ emptyLabel() }}</td></tr>
          }
        </tbody>
      </table></div> }
    </main>
  `,
})
export class QaComponent implements OnInit, OnDestroy {
  projectId = '';
  issues = signal<QaIssue[]>([]);
  readonly issueTypes:QaIssue['type'][]=['untranslated','placeholder_mismatch','max_length','whitespace','number_mismatch','html_mismatch'];
  issueType=signal<QaIssue['type']|''>('');
  query=signal('');
  setQuery(value:string){if(!this.destroyed)this.query.set(value.slice(0,200));}
  visibleIssues=computed(()=>{const type=this.issueType(),query=this.query().trim().toLowerCase();if(!type&&!query)return this.issues();return this.issues().filter(i=>(!type||i.type===type)&&(!query||[i.key,i.locale,i.detail??''].some(value=>value.toLowerCase().includes(query))));});
  setIssueType(type:string) {if(!this.destroyed&&(type===''||this.issueTypes.includes(type as QaIssue['type'])))this.issueType.set(type as QaIssue['type']|'');}
  targetLocales = signal<string[]>([]);
  locale = signal('');
  branch=signal('main');branches=signal<BranchInfo[]>([]);branchesLoading=signal(false);branchesError=signal(false);
  private branchGeneration=0;
  localesLoading=signal(false);
  localesError=signal(false);
  private localeGeneration=0;
  loading = signal(true);
  error = signal('');downloadNotice=signal('');

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  private subscription?: Subscription;
  private generation=0;
  private projectGeneration=0;
  private destroyed=false;

  ngOnInit() {
    this.subscription=this.route.paramMap.subscribe(params=>{void this.loadProject(params.get('id')??'');});
  }
  async loadProject(projectId:string) {
    if(this.destroyed)return;
    ++this.projectGeneration;this.projectId=projectId;this.locale.set('');this.targetLocales.set([]);this.branch.set('main');this.branches.set([]);this.issueType.set('');this.query.set('');
    await Promise.all([this.loadLocales(),this.loadBranches(),this.fetch()]);
  }
  async loadBranches() {
    if(this.destroyed)return;
    const scope=this.projectGeneration,generation=++this.branchGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.branchGeneration;
    this.branchesLoading.set(true);this.branchesError.set(false);
    try { const branches=await this.api.listBranches(projectId);if(current())this.branches.set(branches); }
    catch {if(current())this.branchesError.set(true);}
    finally {if(current())this.branchesLoading.set(false);}
  }
  async loadLocales() {
    if(this.destroyed)return;
    const scope=this.projectGeneration,generation=++this.localeGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.localeGeneration;
    this.localesLoading.set(true);this.localesError.set(false);
    try {const p:Project=await this.api.getProject(projectId);if(current())this.targetLocales.set(p.locales.map(l=>l.code).filter(c=>c!==p.baseLocale));}
    catch {if(current())this.localesError.set(true);}
    finally {if(current())this.localesLoading.set(false);}
  }
  ngOnDestroy() { this.destroyed=true;++this.generation;++this.projectGeneration;this.subscription?.unsubscribe(); }

  refresh() { if(!this.loading())void this.fetch(); }

  async fetch() {
    if(this.destroyed)return;
    const generation=++this.generation,scope=this.projectGeneration,projectId=this.projectId,locale=this.locale()||undefined,branch=this.branch();
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.generation;
    this.loading.set(true);this.error.set('');this.issues.set([]);this.downloadNotice.set('');
    try {
      const res=await this.api.runQa(projectId,locale,branch);
      if(current())this.issues.set(res.issues);
    } catch { if(current())this.error.set('QA checks unavailable. No findings are shown. Retry checks or reload this page.'); }
    finally { if(current())this.loading.set(false); }
  }

  download() {
    if(this.destroyed||this.loading()||this.error())return;
    let url:string|undefined;
    try {
      const content=JSON.stringify({schemaVersion:1,projectId:this.projectId,branch:this.branch(),locale:this.locale()||null,issues:this.issues()},null,2)+'\n';
      url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='qa-findings.json';anchor.click();
      this.downloadNotice.set('Download requested for the loaded findings. This does not confirm the file was saved or shared.');
    } catch { this.downloadNotice.set('Download could not be started. Try again from the current findings.'); }
    finally {if(url)URL.revokeObjectURL(url);}
  }

  emptyLabel() { if(this.query().trim())return 'No loaded findings match this search and current issue-type filter. Clear search or type filter to show other loaded findings.';if(this.issueType())return 'No loaded findings of type '+this.label(this.issueType() as QaIssue['type'])+' in the current branch and locale scope. Clear type filter to show all loaded findings.';return (this.locale() ? 'No QA issues found for ' + this.locale() : 'No QA issues found') + ' on branch ' + this.branch(); }

  label(type: QaIssue['type']): string {
    switch (type) {
      case 'untranslated': return 'Untranslated';
      case 'placeholder_mismatch': return 'Placeholder mismatch';
      case 'max_length': return 'Too long';
      case 'whitespace': return 'Whitespace';
      case 'number_mismatch': return 'Number mismatch';
      case 'html_mismatch': return 'HTML mismatch';
    }
  }
}
