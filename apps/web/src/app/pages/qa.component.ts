import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, Project, QaIssue } from '../api.service';

@Component({
  selector: 'ol-qa',
  imports: [FormsModule, RouterLink],
  styles: [` .qa-table { width:100%; min-width:680px; border-collapse:collapse; } .qa-table th,.qa-table td { text-align:left; padding:.5rem; vertical-align:top; border-bottom:1px solid #e5e7eb; } .qa-table td { overflow-wrap:anywhere; } .qa-table th:nth-child(-n+3),.qa-table td:nth-child(-n+3) { white-space:nowrap; } `],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>QA checks</h1>
    </header>
    <main [attr.aria-busy]="loading()">
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
      @if (loading()) { <p role="status" name="qaLoading">Loading QA checks...</p> }
      @if (!loading() && !error()) {
      <div class="table-scroll"><table class="qa-table">
        <thead><tr><th>Key</th><th>Locale</th><th>Issue</th><th>Detail</th></tr></thead>
        <tbody>
          @for (i of issues(); track $index) {
            <tr>
              <td><a class="qa-key" [routerLink]="['/projects', projectId]">{{ i.key }}</a></td>
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
  targetLocales = signal<string[]>([]);
  locale = signal('');
  localesLoading=signal(false);
  localesError=signal(false);
  private localeGeneration=0;
  loading = signal(true);
  error = signal('');

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
    ++this.projectGeneration;this.projectId=projectId;this.locale.set('');this.targetLocales.set([]);
    await Promise.all([this.loadLocales(),this.fetch()]);
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
    const generation=++this.generation,scope=this.projectGeneration,projectId=this.projectId,locale=this.locale()||undefined;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.generation;
    this.loading.set(true);this.error.set('');this.issues.set([]);
    try {
      const res=await this.api.runQa(projectId,locale);
      if(current())this.issues.set(res.issues);
    } catch { if(current())this.error.set('QA checks unavailable. No findings are shown. Retry checks or reload this page.'); }
    finally { if(current())this.loading.set(false); }
  }

  emptyLabel() { return this.locale() ? 'No QA issues found for ' + this.locale() : 'No QA issues found'; }

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
