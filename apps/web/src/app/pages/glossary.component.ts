import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, GlossaryTermItem, Project } from '../api.service';

@Component({
  selector: 'ol-glossary',
  imports: [FormsModule, RouterLink],
  styles: [`
    @media (max-width: 600px) {
      .glossary-table, .glossary-table tbody, .glossary-table tr, .glossary-table td { display:block; width:100%; box-sizing:border-box; }
      .glossary-table thead { display:none; }
      .glossary-table tr { padding:0.75rem 0; border-bottom:1px solid #dce1ea; }
      .glossary-table td { padding:0.3rem 0; overflow-wrap:anywhere; }
      .glossary-table td[data-label]::before { content:attr(data-label); display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.2rem; }
      .glossary-table input { width:100%; min-width:0; box-sizing:border-box; }
    }
  `],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Glossary</h1>
    </header>
    <main [attr.aria-busy]="loading()">
      @if (createNotice(); as message) { <p role="status" name="glossaryCreateNotice">{{ message }}</p> }
      @if (createUnknown()) { <p class="error" role="alert" name="glossaryCreateUnknown">Adding term outcome unconfirmed. Your new-term form is kept here. Copy local translation drafts, then refresh the glossary and check the list before adding again. Do not repeat the request without checking.</p> }
      @if (error(); as e) { @if (!createUnknown() || e !== 'Adding term failed. Check the glossary before trying again.') { <p class="error" role="alert">{{ e }}</p> } }
      <section class="panel">
        <h2>New term</h2>
        @if (hasNewTermDraft()) { <p role="status" name="glossaryNewTermDraft">{{ newTermDraftLabel() }}</p> }
        <form class="task-form" [attr.aria-busy]="creating()" (ngSubmit)="create()">
          <input aria-label="Term" placeholder="e.g. checkout" maxlength="200" name="gTerm"
            [ngModel]="term()" (ngModelChange)="draftDownloadNotice.set('');term.set($event)" required />
          <input aria-label="Notes (optional)" placeholder="Context for translators" name="gNotes"
            [ngModel]="notes()" (ngModelChange)="draftDownloadNotice.set('');notes.set($event)" />
          <label class="dnt"><input type="checkbox" name="gDnt"
            [ngModel]="doNotTranslate()" (ngModelChange)="draftDownloadNotice.set('');doNotTranslate.set($event)" /> do not translate</label>
          <button class="primary" type="submit" [disabled]="creating() || createUnknown()">Add term</button>
          @if (creating()) { <span role="status" name="glossaryCreating">Adding term...</span> }
        </form>
      </section>
      @if (listError()) { <p class="error" role="alert" name="glossaryListError">Glossary unavailable. No terms are shown. Retry this read or reload the page.</p><button type="button" name="retryGlossaryList" (click)="void fetch()">Retry glossary</button> }
      @if (loading()) { <p role="status" name="glossaryListLoading">Loading glossary...</p> }
      @if (localesError()) { <p class="error" role="alert" name="glossaryLocalesError">Translation columns unavailable. Terms remain available.</p><button type="button" name="retryGlossaryLocales" (click)="void loadLocales()">Retry translation columns</button> }
      @if (localesLoading()) { <p role="status" name="glossaryLocalesLoading">Loading translation columns...</p> }
      @if (!listError()) { <button type="button" name="refreshGlossaryList" [disabled]="loading() || mutationsPending()" (click)="refresh()">Refresh glossary</button><p class="muted" name="glossaryRefreshHint">Refresh replaces translation fields with server values. Your new-term draft stays here.</p> }
      @if(localReset();as pending){<section role="region" aria-label="Confirm local text reset" name="glossaryResetConfirmation"><p>Discard unsaved local translation text for "{{pending.row.term}}"? This restores the last loaded or confirmed values in this page only. It does not read newer server values or undo server changes. Copy or download the local draft first if you need it.</p><button type="button" name="confirmGlossaryLocalReset" (pointerdown)="$event.preventDefault()" (click)="confirmLocalReset()">Discard local translation text</button><button type="button" name="cancelGlossaryLocalReset" (pointerdown)="$event.preventDefault()" (click)="localReset.set(null)">Keep local text</button></section>}
      <button type="button" name="downloadGlossaryDraft" (pointerdown)="$event.preventDefault()" [disabled]="!draftDownloadReady()" (click)="downloadDraft()">Download local glossary draft (.json)</button>
      <p class="muted" name="glossaryDraftScope">Backup of all loaded local terms, notes and translation text, regardless of search, plus your new-term form. Includes private content and may include unsaved or unconfirmed changes. For reference only, not an import or proof of server state. Copy text separately while loading or saving. Downloading does not share or save changes to the project.</p>
      @if(draftDownloadNotice()){<p role="status" name="glossaryDraftNotice">{{draftDownloadNotice()}}</p>}
      <label>Find in loaded terms, notes or translations <input type="search" name="glossarySearch" maxlength="200" [ngModel]="query()" (ngModelChange)="search($event)" /></label>
      <button type="button" name="clearGlossarySearch" [disabled]="!query()" (click)="search('')">Clear search</button>
      @if (!loading() && !listError()) { <p class="muted" role="status" name="glossaryMatches">{{ visibleTerms().length }} of {{ terms().length }} terms match. Search is a literal, case-insensitive substring in loaded rows, including local translation text. It does not read newer server changes.</p> }
      @if (!listError()) { <table class="glossary-table">
        <thead><tr><th>Term</th>@for (l of locales(); track l) { <th>{{ l }}</th> }<th>Notes</th><th></th></tr></thead>
        <tbody>
          @for (t of visibleTerms(); track t.id) {
            <tr [attr.aria-busy]="rowPending(t.id)">
              <td data-label="Term"><code>{{ t.term }}</code>@if (t.doNotTranslate) { <span class="dnt-badge">do not translate</span> }</td>
              @for (l of locales(); track l) {
                <td [attr.data-label]="l">
                  <input [readOnly]="unknownSaveIds().includes(t.id)" [disabled]="rowPending(t.id) && !unknownSaveIds().includes(t.id)" [attr.aria-label]="t.term + ' in ' + l" [ngModel]="t.translations[l] ?? ''"
                    (ngModelChange)="setTranslation(t, l, $event)" (blur)="saveTranslations(t)" />
                </td>
              }
              <td class="muted" data-label="Notes">{{ t.notes }}</td>
              <td data-label="Actions">@if (localTextChanged(t)) { <span role="status" name="glossaryLocalDraft">Unsaved local text. Leave the translation field to save, or copy/download the local draft before refreshing.</span><button type="button" name="resetGlossaryLocalText" (pointerdown)="$event.preventDefault()" (click)="resetLocalText(t)">Reset local translation text</button> }@if (unknownSaveIds().includes(t.id)) { <span class="error" role="alert" name="glossarySaveUnknown">Save unconfirmed. Copy text before Refresh.</span> }@if (unknownDeleteIds().includes(t.id)) { <span class="error" role="alert" name="glossaryDeleteUnknown">Delete unconfirmed. Refresh required.</span> }@if (savingIds().includes(t.id)) { <span role="status" name="glossarySaving">Saving translation...</span> }@if (deletingIds().includes(t.id)) { <span role="status" name="glossaryDeleting">Deleting term...</span> }<button [disabled]="rowPending(t.id)" class="danger" [attr.aria-label]="'Delete term ' + t.term" (click)="remove(t)">&times;</button></td>
            </tr>
          } @empty {
            @if (!loading() && !listError()) { <tr name="glossaryListEmpty"><td colspan="9" class="muted">{{ query() ? 'No loaded terms match this search. Clear search to show all loaded terms.' : 'No glossary terms yet' }}</td></tr> }
          }
        </tbody>
      </table> }
    </main>
  `,
})
export class GlossaryComponent implements OnInit, OnDestroy {
  projectId = '';
  draftDownloadNotice=signal('');
  loaded=signal(false);
  terms = signal<GlossaryTermItem[]>([]);
  query=signal('');
  visibleTerms=computed(()=>{const query=this.query().toLowerCase();return query?this.terms().filter(t=>[t.term,t.notes??'',...Object.values(t.translations)].some(value=>value.toLowerCase().includes(query))):this.terms();});
  search(query:string) {if(!this.destroyed)this.query.set(query.slice(0,200));}
  locales = signal<string[]>([]);
  localesError=signal(false);
  localesLoading=signal(false);
  loading = signal(true);
  error = signal(''); createNotice = signal('');
  creating=signal(false);
  createUnknown=signal(false);private createEpoch=0;
  deletingIds=signal<string[]>([]);
  savingIds=signal<string[]>([]);
  unknownDeleteIds=signal<string[]>([]);
  unknownSaveIds=signal<string[]>([]);
  private saveEpoch=0;
  listError = signal(false);
  private fetchSeq=0;
  private savedTranslations=new Map<string,Record<string,string>>();
  private projectGeneration=0;
  private routeSub?:Subscription;
  private destroyed=false;
  hasNewTermDraft=computed(()=>!!(this.term()||this.notes()||this.doNotTranslate()));
  newTermDraftLabel=computed(()=>this.creating()?'Adding a term is pending. Current new-term fields are kept here; they may differ from the submitted term. Do not add again.':this.createUnknown()?'Current new-term form is kept here, but adding the term is unconfirmed. Copy the form before leaving and check the glossary before adding again.':'New-term form has local text or choices. It is not automatically saved or restored after leaving. Copy the form before leaving, or download the local glossary draft when available. A copy does not add a term.');
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
    this.localReset.set(null);this.loaded.set(false);this.draftDownloadNotice.set('');this.terms.set([]);this.locales.set([]);this.error.set('');this.createNotice.set('');this.listError.set(false);this.creating.set(false);this.deletingIds.set([]);this.savingIds.set([]);this.unknownDeleteIds.set([]);this.unknownSaveIds.set([]);++this.saveEpoch;this.createUnknown.set(false);++this.createEpoch;
    this.term.set('');this.notes.set('');this.doNotTranslate.set(false);this.query.set('');
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
  ngOnDestroy() { this.localReset.set(null);this.destroyed=true;++this.fetchSeq;++this.projectGeneration;this.routeSub?.unsubscribe(); }

  draftDownloadReady() {return !this.destroyed&&this.loaded()&&!this.loading()&&!this.listError()&&!this.mutationsPending();}
  downloadDraft() {
    if(!this.draftDownloadReady())return;
    let url:string|undefined;
    try {
      const content=JSON.stringify({schemaVersion:1,projectId:this.projectId,scope:'all-loaded-local-glossary-drafts',serverStateConfirmed:false,importable:false,newTermDraft:{term:this.term(),notes:this.notes(),doNotTranslate:this.doNotTranslate(),createOutcomeUnconfirmed:this.createUnknown()},terms:this.terms().map(t=>({id:t.id,term:t.term,notes:t.notes??null,doNotTranslate:t.doNotTranslate,translations:{...t.translations},saveOutcomeUnconfirmed:this.unknownSaveIds().includes(t.id),deleteOutcomeUnconfirmed:this.unknownDeleteIds().includes(t.id)}))},null,2);
      url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='glossary-local-draft.json';anchor.click();
      this.draftDownloadNotice.set('Download requested for the local glossary draft. This does not confirm the file was saved or any change reached the server.');
    }catch{this.draftDownloadNotice.set('Download could not be started. Copy your local text before refreshing.');}
    finally{if(url)URL.revokeObjectURL(url);}
  }

  mutationsPending() { return this.creating()||this.savingIds().length>0||this.deletingIds().length>0; }
  refresh() { if(!this.loading()&&!this.mutationsPending())void this.fetch(); }

  async fetch() {
    if(this.destroyed||this.deletingIds().length>0)return;
    const seq=++this.fetchSeq,epoch=this.saveEpoch,pendingSave=this.savingIds().length>0,createEpoch=this.createEpoch,pendingCreate=this.creating();
    this.localReset.set(null);this.loaded.set(false);this.draftDownloadNotice.set('');this.terms.set([]);this.listError.set(false);this.loading.set(true);
    try {
      const terms=await this.api.listGlossary(this.projectId);
      if(seq===this.fetchSeq){this.loaded.set(true);this.terms.set(terms);if(!pendingCreate&&!this.creating()&&createEpoch===this.createEpoch){if(this.createUnknown()&&this.error()==='Adding term failed. Check the glossary before trying again.')this.error.set('');this.createUnknown.set(false);}this.savedTranslations=new Map(terms.map(t=>[t.id,{...t.translations} ]));if(this.unknownDeleteIds().length&&this.error()==='Delete outcome unconfirmed. Copy local translation drafts, then refresh the glossary before trying again.')this.error.set('');this.unknownDeleteIds.set([]);if(!pendingSave&&!this.savingIds().length&&epoch===this.saveEpoch){if(this.unknownSaveIds().length&&this.error()==='Save outcome unconfirmed. Copy local translation drafts, then refresh the glossary before trying again.')this.error.set('');this.unknownSaveIds.set([]);}}
    } catch { if(seq===this.fetchSeq)this.listError.set(true); }
    finally { if(seq===this.fetchSeq)this.loading.set(false); }
  }

  async create() {
    const term = this.term().trim();
    if (!term||this.destroyed||this.creating()||this.createUnknown()) return;
    const scope=this.projectGeneration,pid=this.projectId,listGeneration=this.fetchSeq;
    const draft={term:this.term(),notes:this.notes(),doNotTranslate:this.doNotTranslate()};
    this.draftDownloadNotice.set('');++this.createEpoch;this.creating.set(true);this.error.set('');this.createNotice.set('');
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
    } catch { if(this.current(scope)){++this.createEpoch;this.createUnknown.set(true);this.error.set('Adding term failed. Check the glossary before trying again.');} }
    finally {if(this.current(scope))this.creating.set(false);}
  }

  setTranslation(t: GlossaryTermItem, locale: string, value: string) {
    if(this.destroyed||this.unknownSaveIds().includes(t.id))return;
    this.localReset.set(null);this.draftDownloadNotice.set('');
    this.terms.update((all) => all.map((x) => x.id === t.id
      ? { ...x, translations: { ...x.translations, [locale]: value } } : x));
  }

  localTextChanged(t:GlossaryTermItem) {
    if(this.destroyed||this.loading()||this.listError()||this.rowPending(t.id))return false;
    const row=this.terms().find(x=>x===t),saved=this.savedTranslations.get(t.id);
    return !!row&&!!saved&&(Object.keys(saved).length!==Object.keys(row.translations).length||Object.entries(row.translations).some(([locale,value])=>saved[locale]!==value));
  }

  localReset=signal<{row:GlossaryTermItem,saved:Record<string,string>,scope:number,generation:number}|null>(null);
  resetLocalText(t:GlossaryTermItem) {
    if(!this.localTextChanged(t))return;
    const saved=this.savedTranslations.get(t.id);if(!saved)return;
    this.localReset.set({row:t,saved,scope:this.projectGeneration,generation:this.fetchSeq});
  }
  confirmLocalReset() {
    const pending=this.localReset();this.localReset.set(null);if(!pending)return;
    const {row,saved,scope,generation}=pending;
    if(!this.current(scope)||generation!==this.fetchSeq||saved!==this.savedTranslations.get(row.id)||!this.localTextChanged(row))return;
    this.draftDownloadNotice.set('');
    this.terms.update(all=>all.map(t=>t===row?{...t,translations:{...saved}}:t));
  }

  rowPending(id:string) {return this.deletingIds().includes(id)||this.savingIds().includes(id)||this.unknownDeleteIds().includes(id)||this.unknownSaveIds().includes(id);}

  async saveTranslations(t: GlossaryTermItem) {
    if(this.destroyed||this.rowPending(t.id))return;
    const scope=this.projectGeneration,pid=this.projectId;
    // Read the current immutable row, not an older event-handler snapshot.
    const row=this.terms().find(x=>x.id===t.id);
    if(!row)return;
    const translations={...row.translations},saved=this.savedTranslations.get(t.id),listGeneration=this.fetchSeq;
    if(saved&&Object.keys(saved).length===Object.keys(translations).length&&Object.entries(translations).every(([key,value])=>saved[key]===value))return;
    this.localReset.set(null);this.draftDownloadNotice.set('');++this.saveEpoch;this.savingIds.update(ids=>[...ids,t.id]);this.error.set('');
    try {
      const updated=await this.api.updateGlossaryTerm(pid, t.id, { translations });
      if(!this.current(scope))return;
      const confirmed={...updated.translations};
      // Preserve later local text, but advance its comparison on this same read.
      // A newer list owns its own comparison and must not be overwritten.
      if(listGeneration===this.fetchSeq&&this.terms().some(x=>x.id===t.id))this.savedTranslations.set(t.id,confirmed);
      if(this.terms().find(x=>x.id===t.id)===row){
        this.terms.update(all=>all.map(x=>x===row?{...x,translations:confirmed}:x));
      }
    } catch {if(this.current(scope)){++this.saveEpoch;this.unknownSaveIds.update(ids=>[...new Set([...ids,t.id])]);this.error.set('Save outcome unconfirmed. Copy local translation drafts, then refresh the glossary before trying again.');}}
    finally {if(this.current(scope))this.savingIds.update(ids=>ids.filter(id=>id!==t.id));}
  }

  async remove(t: GlossaryTermItem) {
    if(this.destroyed||this.loading()||this.listError()||this.rowPending(t.id)||!this.terms().some(x=>x.id===t.id))return;
    const scope=this.projectGeneration,pid=this.projectId,listGeneration=this.fetchSeq;
    this.localReset.set(null);this.draftDownloadNotice.set('');this.deletingIds.update(ids=>[...ids,t.id]);this.error.set('');
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
