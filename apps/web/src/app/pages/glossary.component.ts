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
      @if (createNotice(); as message) { <p role="status" name="glossaryCreateNotice">{{ message }}</p> }
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
      @if (localesError()) { <p class="error" role="alert" name="glossaryLocalesError">Translation columns unavailable. Terms remain available.</p><button type="button" name="retryGlossaryLocales" (click)="void loadLocales()">Retry translation columns</button> }
      @if (localesLoading()) { <p role="status" name="glossaryLocalesLoading">Loading translation columns...</p> }
      @if (!listError()) { <button type="button" name="refreshGlossaryList" [disabled]="loading() || mutationsPending()" (click)="refresh()">Refresh glossary</button><p class="muted" name="glossaryRefreshHint">Refresh replaces translation fields with server values. Your new-term draft stays here.</p> }
      @if (!listError()) { <table class="glossary-table">
        <thead><tr><th>Term</th>@for (l of locales(); track l) { <th>{{ l }}</th> }<th>Notes</th><th></th></tr></thead>
        <tbody>
          @for (t of terms(); track t.id) {
            <tr [attr.aria-busy]="rowPending(t.id)">
              <td><code>{{ t.term }}</code>@if (t.doNotTranslate) { <span class="dnt-badge">do not translate</span> }</td>
              @for (l of locales(); track l) {
                <td>
                  <input [disabled]="rowPending(t.id)" [attr.aria-label]="t.term + ' in ' + l" [ngModel]="t.translations[l] ?? ''"
                    (ngModelChange)="setTranslation(t, l, $event)" (blur)="saveTranslations(t)" />
                </td>
              }
              <td class="muted">{{ t.notes }}</td>
              <td>@if (unknownDeleteIds().includes(t.id)) { <span class="error" role="alert" name="glossaryDeleteUnknown">Delete unconfirmed. Refresh required.</span> }@if (savingIds().includes(t.id)) { <span role="status" name="glossarySaving">Saving translation...</span> }@if (deletingIds().includes(t.id)) { <span role="status" name="glossaryDeleting">Deleting term...</span> }<button [disabled]="rowPending(t.id)" class="danger" [attr.aria-label]="'Delete term ' + t.term" (click)="remove(t)">&times;</button></td>
            </tr>
          } @empty {
            @if (!loading() && !listError()) { <tr name="glossaryListEmpty"><td colspan="9" class="muted">No glossary terms yet</td></tr> }
          }
        </tbody>
      </table> }
    </main>
  `,
})
export class GlossaryComponent implements OnInit, OnDestroy {
  projectId = '';
  terms = signal<GlossaryTermItem[]>([]);
  locales = signal<string[]>([]);
  localesError=signal(false);
  localesLoading=signal(false);
  loading = signal(true);
  error = signal(''); createNotice = signal('');
  creating=signal(false);
  deletingIds=signal<string[]>([]);
  savingIds=signal<string[]>([]);
  unknownDeleteIds=signal<string[]>([]);
  listError = signal(false);
  private fetchSeq=0;
  private savedTranslations=new Map<string,Record<string,string>>();
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
    ++this.projectGeneration;
    this.projectId=pid;++this.fetchSeq;this.savedTranslations.clear();
    this.terms.set([]);this.locales.set([]);this.error.set('');this.createNotice.set('');this.listError.set(false);this.creating.set(false);this.deletingIds.set([]);this.savingIds.set([]);this.unknownDeleteIds.set([]);
    this.term.set('');this.notes.set('');this.doNotTranslate.set(false);
    void this.fetch();
    this.localesLoading.set(false);this.localesError.set(false);
    void this.loadLocales();
  }

  async loadLocales() {
    if(this.destroyed||this.localesLoading())return;
    const scope=this.projectGeneration,pid=this.projectId;
    this.localesLoading.set(true);this.localesError.set(false);
    try {const p:Project=await this.api.getProject(pid);if(this.current(scope))this.locales.set(p.locales.map(l=>l.code).filter(c=>c!==p.baseLocale));}
    catch {if(this.current(scope)){this.locales.set([]);this.localesError.set(true);}}
    finally {if(this.current(scope))this.localesLoading.set(false);}
  }

  private current(scope:number) { return !this.destroyed&&scope===this.projectGeneration; }
  ngOnDestroy() { this.destroyed=true;++this.fetchSeq;++this.projectGeneration;this.routeSub?.unsubscribe(); }

  mutationsPending() { return this.creating()||this.savingIds().length>0||this.deletingIds().length>0; }
  refresh() { if(!this.loading()&&!this.mutationsPending())void this.fetch(); }

  async fetch() {
    if(this.destroyed||this.deletingIds().length>0)return;
    const seq=++this.fetchSeq;
    this.terms.set([]);this.listError.set(false);this.loading.set(true);
    try {
      const terms=await this.api.listGlossary(this.projectId);
      if(seq===this.fetchSeq){this.terms.set(terms);this.savedTranslations=new Map(terms.map(t=>[t.id,{...t.translations} ]));if(this.unknownDeleteIds().length&&this.error()==='Delete outcome unconfirmed. Copy local translation drafts, then refresh the glossary before trying again.')this.error.set('');this.unknownDeleteIds.set([]);}
    } catch { if(seq===this.fetchSeq)this.listError.set(true); }
    finally { if(seq===this.fetchSeq)this.loading.set(false); }
  }

  async create() {
    const term = this.term().trim();
    if (!term||this.destroyed||this.creating()) return;
    const scope=this.projectGeneration,pid=this.projectId,listGeneration=this.fetchSeq;
    const draft={term:this.term(),notes:this.notes(),doNotTranslate:this.doNotTranslate()};
    this.creating.set(true);this.error.set('');this.createNotice.set('');
    try {
      const created = await this.api.createGlossaryTerm(pid, {
        term,
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        doNotTranslate: draft.doNotTranslate,
      });
      if(!this.current(scope))return;
      // Inputs stay editable while the request is pending. Clear only its draft.
      if(this.term()===draft.term&&this.notes()===draft.notes&&this.doNotTranslate()===draft.doNotTranslate){
        this.term.set(''); this.notes.set(''); this.doNotTranslate.set(false);
      }
      const insert = listGeneration === this.fetchSeq && !this.loading() && !this.listError();
      if (insert && !this.terms().some(t => t.id === created.id)) {
        this.terms.update(terms => [...terms, created].sort((a,b) => a.term.localeCompare(b.term)));
        this.savedTranslations.set(created.id, { ...created.translations });
      }
      this.createNotice.set(`Term "${term}" was added.${insert ? ' Existing local translation values were kept.' : ' The current glossary was kept. Copy local translation drafts before refreshing to find the new term.'}`);
    } catch { if(this.current(scope))this.error.set('Adding term failed. Check the glossary before trying again.'); }
    finally {if(this.current(scope))this.creating.set(false);}
  }

  setTranslation(t: GlossaryTermItem, locale: string, value: string) {
    this.terms.update((all) => all.map((x) => x.id === t.id
      ? { ...x, translations: { ...x.translations, [locale]: value } } : x));
  }

  rowPending(id:string) {return this.deletingIds().includes(id)||this.savingIds().includes(id)||this.unknownDeleteIds().includes(id);}

  async saveTranslations(t: GlossaryTermItem) {
    if(this.destroyed||this.rowPending(t.id))return;
    const scope=this.projectGeneration,pid=this.projectId;
    // Read the current immutable row, not an older event-handler snapshot.
    const row=this.terms().find(x=>x.id===t.id);
    if(!row)return;
    const translations={...row.translations},saved=this.savedTranslations.get(t.id);
    if(saved&&Object.keys(saved).length===Object.keys(translations).length&&Object.entries(translations).every(([key,value])=>saved[key]===value))return;
    this.savingIds.update(ids=>[...ids,t.id]);this.error.set('');
    try {
      const updated=await this.api.updateGlossaryTerm(pid, t.id, { translations });
      if(!this.current(scope))return;
      const confirmed={...updated.translations};
      // Do not replace a row or its comparison refreshed/edited since submission.
      if(this.terms().find(x=>x.id===t.id)===row){
        this.savedTranslations.set(t.id,confirmed);
        this.terms.update(all=>all.map(x=>x===row?{...x,translations:confirmed}:x));
      }
    } catch {if(this.current(scope))this.error.set('Saving translation failed. Your text is kept here. Check the glossary before trying again.');}
    finally {if(this.current(scope))this.savingIds.update(ids=>ids.filter(id=>id!==t.id));}
  }

  async remove(t: GlossaryTermItem) {
    if(this.destroyed||this.loading()||this.listError()||this.rowPending(t.id)||!this.terms().some(x=>x.id===t.id))return;
    const scope=this.projectGeneration,pid=this.projectId,listGeneration=this.fetchSeq;
    this.deletingIds.update(ids=>[...ids,t.id]);this.error.set('');
    try {
      await this.api.deleteGlossaryTerm(pid, t.id);
      if(this.current(scope)&&listGeneration===this.fetchSeq){
        this.terms.update(all=>all.filter(x=>x.id!==t.id));this.savedTranslations.delete(t.id);
      }
    } catch {
      if(!this.current(scope))return;
      this.unknownDeleteIds.update(ids=>[...new Set([...ids,t.id])]);
      this.error.set('Delete outcome unconfirmed. Copy local translation drafts, then refresh the glossary before trying again.');
    } finally {if(this.current(scope))this.deletingIds.update(ids=>ids.filter(id=>id!==t.id));}
  }
}
