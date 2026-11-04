import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, GlossaryTermItem, Project } from '../api.service';

@Component({
  selector: 'ol-glossary',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Glossary</h1>
    </header>
    <main [attr.aria-busy]="loading()">
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p> }
      <section class="panel">
        <h2>New term</h2>
        <form class="task-form" [attr.aria-busy]="creating()" (ngSubmit)="create()">
          <input aria-label="Term" placeholder="e.g. checkout" maxlength="200" name="gTerm"
            [ngModel]="term()" (ngModelChange)="term.set($event)" required />
          <input aria-label="Notes (optional)" placeholder="Context for translators" name="gNotes"
            [ngModel]="notes()" (ngModelChange)="notes.set($event)" />
          <label class="dnt"><input type="checkbox" name="gDnt"
            [ngModel]="doNotTranslate()" (ngModelChange)="doNotTranslate.set($event)" /> do not translate</label>
          <button class="primary" type="submit" [disabled]="creating()">Add term</button>
          @if (creating()) { <span role="status" name="glossaryCreating">Adding term...</span> }
        </form>
      </section>
      @if (listError()) { <p class="error" role="alert" name="glossaryListError">Glossary unavailable. No terms are shown. Retry this read or reload the page.</p><button type="button" name="retryGlossaryList" (click)="void fetch()">Retry glossary</button> }
      @if (loading()) { <p role="status" name="glossaryListLoading">Loading glossary...</p> }
      <table class="glossary-table">
        <thead><tr><th>Term</th>@for (l of locales(); track l) { <th>{{ l }}</th> }<th>Notes</th><th></th></tr></thead>
        <tbody>
          @for (t of terms(); track t.id) {
            <tr>
              <td><code>{{ t.term }}</code>@if (t.doNotTranslate) { <span class="dnt-badge">do not translate</span> }</td>
              @for (l of locales(); track l) {
                <td>
                  <input [attr.aria-label]="t.term + ' in ' + l" [ngModel]="t.translations[l] ?? ''"
                    (ngModelChange)="setTranslation(t, l, $event)" (blur)="saveTranslations(t)" />
                </td>
              }
              <td class="muted">{{ t.notes }}</td>
              <td><button class="danger" [attr.aria-label]="'Delete term ' + t.term" (click)="remove(t)">&times;</button></td>
            </tr>
          } @empty {
            @if (!loading() && !listError()) { <tr name="glossaryListEmpty"><td colspan="9" class="muted">No glossary terms yet</td></tr> }
          }
        </tbody>
      </table>
    </main>
  `,
})
export class GlossaryComponent implements OnInit, OnDestroy {
  projectId = '';
  terms = signal<GlossaryTermItem[]>([]);
  locales = signal<string[]>([]);
  loading = signal(true);
  error = signal('');
  creating=signal(false);
  listError = signal(false);
  private fetchSeq=0;
  private projectGeneration=0;
  private routeSub?:Subscription;
  private destroyed=false;
  term = signal('');
  notes = signal('');
  doNotTranslate = signal(false);

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    this.routeSub=this.route.paramMap.subscribe(pm=>this.initForProject(pm.get('id')??''));
  }

  private initForProject(pid:string) {
    if(this.destroyed)return;
    const scope=++this.projectGeneration;
    this.projectId=pid;++this.fetchSeq;
    this.terms.set([]);this.locales.set([]);this.error.set('');this.listError.set(false);this.creating.set(false);
    this.term.set('');this.notes.set('');this.doNotTranslate.set(false);
    void this.fetch();
    void this.api.getProject(pid)
      .then((p:Project)=>{if(this.current(scope))this.locales.set(p.locales.map(l=>l.code).filter(c=>c!==p.baseLocale));})
      .catch(()=>{if(this.current(scope))this.locales.set([]);});
  }

  private current(scope:number) { return !this.destroyed&&scope===this.projectGeneration; }
  ngOnDestroy() { this.destroyed=true;++this.fetchSeq;++this.projectGeneration;this.routeSub?.unsubscribe(); }

  async fetch() {
    if(this.destroyed)return;
    const seq=++this.fetchSeq;
    this.terms.set([]);this.listError.set(false);this.loading.set(true);
    try {
      const terms=await this.api.listGlossary(this.projectId);
      if(seq===this.fetchSeq)this.terms.set(terms);
    } catch { if(seq===this.fetchSeq)this.listError.set(true); }
    finally { if(seq===this.fetchSeq)this.loading.set(false); }
  }

  async create() {
    const term = this.term().trim();
    if (!term||this.destroyed||this.creating()) return;
    const scope=this.projectGeneration,pid=this.projectId;
    this.creating.set(true);this.error.set('');
    try {
      await this.api.createGlossaryTerm(pid, {
        term,
        ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
        doNotTranslate: this.doNotTranslate(),
      });
      if(!this.current(scope))return;
      this.term.set(''); this.notes.set(''); this.doNotTranslate.set(false);
      await this.fetch();
    } catch { if(this.current(scope))this.error.set('Adding term failed. Check the glossary before trying again.'); }
    finally {if(this.current(scope))this.creating.set(false);}
  }

  setTranslation(t: GlossaryTermItem, locale: string, value: string) {
    this.terms.update((all) => all.map((x) => x.id === t.id
      ? { ...x, translations: { ...x.translations, [locale]: value } } : x));
  }

  async saveTranslations(t: GlossaryTermItem) {
    if(this.destroyed)return;
    const scope=this.projectGeneration,pid=this.projectId;
    try {
      await this.api.updateGlossaryTerm(pid, t.id, { translations: t.translations });
    } catch (e) { if(this.current(scope))this.error.set(e instanceof Error ? e.message : 'Failed to save translation'); }
  }

  async remove(t: GlossaryTermItem) {
    if(this.destroyed)return;
    const scope=this.projectGeneration,pid=this.projectId;
    try {
      await this.api.deleteGlossaryTerm(pid, t.id);
      if(this.current(scope))await this.fetch();
    } catch (e) { if(this.current(scope))this.error.set(e instanceof Error ? e.message : 'Failed to delete term'); }
  }
}
