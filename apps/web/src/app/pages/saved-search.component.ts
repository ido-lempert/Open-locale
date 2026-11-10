import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, BranchInfo } from '../api.service';
@Component({
 selector:'ol-saved-search',imports:[FormsModule,RouterLink],
 styles:[`.search-form {display:flex;flex-wrap:wrap;gap:.75rem;align-items:end;margin:1rem 0;} label {display:flex;flex-direction:column;gap:.25rem;max-width:100%;} input {max-width:100%;box-sizing:border-box;} .value-context {display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem;} h2 {font-size:.95rem;margin:.75rem 0 0;} .result {padding:1rem;background:white;border:1px solid #e5e7eb;border-radius:.5rem;margin:.75rem 0;overflow-wrap:anywhere;} pre {white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:.5rem 0 0;}`],
 template:`<header class="bar"><a [routerLink]="['/projects',projectId]">&larr; Editor</a><h1>Find saved text</h1></header>
 <main>
 <p name="savedSearchQuickScope">Find saved base values in one branch and locale. Read-only; local drafts and plural-form text are not searched.</p>
 <details name="savedSearchHelp"><summary name="savedSearchHelpToggle">Search rules and loaded context</summary><p name="savedSearchScope">Read-only search in saved base translation values for one branch and locale. Literal, case-insensitive matching, up to 200 characters. Choose substring or whole value. Whole value includes every space; no trimming is applied. Does not search key names, plural-form text or unsaved editor drafts. Matching target values include the loaded saved source-language context when different. Missing and empty source values are labeled. Optional status filtering applies to the selected matching locale, not the source locale. Optional key tag is an exact, case-sensitive tag (up to 40 characters); spaces are not trimmed. Leave blank for any tag. Key descriptions and displayed tags are loaded context only and may differ from newer server changes. Descriptions are not searched; tags only filter through the optional exact key tag field. No translations are changed.</p></details>
 @if(optionsLoading()){<p role="status">Loading branch and locale options...</p>}
 @if(optionsError()){<p role="alert">Search options unavailable. Retry to check current branches and locales.</p><button type="button" name="retrySavedOptions" (click)="loadProject(projectId)">Retry options</button>}
 <form class="search-form" (ngSubmit)="search()">
 <label>Branch<select name="savedSearchBranch" [disabled]="!ready()" [ngModel]="branch()" (ngModelChange)="setBranch($event)">@for(b of branches();track b.id){<option [value]="b.name">{{b.name}}</option>}</select></label>
 <label>Locale<select name="savedSearchLocale" [disabled]="!ready()" [ngModel]="locale()" (ngModelChange)="setLocale($event)">@for(l of locales();track l){<option [value]="l">{{l}}</option>}</select></label>
 <label>Match<select name="savedSearchMatch" [disabled]="!ready()" [ngModel]="match()" (ngModelChange)="setMatch($event)"><option value="contains">Contains text</option><option value="exact">Whole value</option></select></label>
 <label>Saved status<select name="savedSearchStatus" [disabled]="!ready()" [ngModel]="status()" (ngModelChange)="setStatus($event)"><option value="">Any status</option>@for(s of statuses();track s){<option [value]="s">{{s}}</option>}</select></label>
 <label>Saved text<input #searchText type="search" name="savedSearchText" maxlength="200" [disabled]="!ready()" [ngModel]="query()" (ngModelChange)="setQuery($event)" /></label>
 <label>Exact key tag (optional)<input name="savedSearchTag" maxlength="40" [disabled]="!ready()" [ngModel]="tag()" (ngModelChange)="setTag($event)" /></label>
 <button type="submit" name="runSavedSearch" [disabled]="!canSearch()">Search saved values</button>
 <button type="button" name="clearSavedSearchFilters" [disabled]="!canClearFilters()" (click)="clearFilters()">Clear search filters</button>
 </form>
 <p class="muted" name="savedSearchClearScope">Clear text, status and tag filters and return to Contains text. Keeps this branch and locale. Clears loaded results without searching or changing translations.</p>
 @if(loading()){<p role="status" name="savedSearchLoading">Searching saved values...</p>}
 @if(error()){<p #searchOutcome tabindex="-1" role="alert" name="savedSearchError">Saved text search unavailable. No results are shown. Try Search saved values again.</p>}
 @if(searched()&&!loading()&&!error()){
 <p #searchOutcome tabindex="-1" role="status" name="savedSearchCount">{{results().length}} matching key{{results().length===1?'':'s'}} on branch {{branch()}} in {{locale()}} for "{{query()}}" ({{match()==='exact'?'whole value':'contains text'}}; {{status()||'any status'}}; tag: {{tag()||'any tag'}}). Loaded saved values, not newer server changes.</p>
 <button type="button" name="downloadSavedSearch" [disabled]="!canDownload()" (click)="download()">Download loaded matches (.json)</button>
 <p class="muted" name="savedSearchDownloadScope">Downloads only these loaded matches and their query scope, including saved source and matched values. Not a complete project export, import file, plural-form report or newer server snapshot. The file can contain private translation text. Downloading does not upload or share it.</p>
 @if(downloadNotice()){<p role="status" name="savedSearchDownloadNotice">{{downloadNotice()}}</p>}
 <p class="muted" name="savedSearchCopyScope">Copy puts only the chosen loaded matched value on your clipboard. It may contain private text. Clearing results or leaving does not cancel a copy already started or clear the clipboard.</p>
 @if(copyNotice()){<p role="status" name="savedSearchCopyNotice">{{copyNotice()}}</p>}
 @for(row of results();track row.id){<article class="result" name="savedSearchResult"><code>{{row.key}}</code><section name="savedSearchTags"><h2>Loaded key tags</h2>@if(row.tags===null){<p class="muted">Tags unavailable in these results.</p>}@else if(!row.tags.length){<p class="muted">No saved key tags.</p>}@else{<ul>@for(tag of row.tags;track $index){<li>{{tag}}</li>}</ul>}</section><section name="savedSearchDescription"><h2>Loaded key description</h2>@if(row.description===null){<p class="muted">Description unavailable in these results.</p>}@else if(row.description===''){<p class="muted">No saved key description.</p>}@else{<pre>{{row.description}}</pre>}</section><div class="value-context">@if(sourceLocale()!==locale()){<section name="savedSearchSource"><h2>Saved source ({{sourceLocale()}})</h2>@if(row.sourceValue===null){<p class="muted">No saved source translation row in these results.</p>}@else if(row.sourceValue===''){<p class="muted">Saved source value is empty.</p>}@else{<pre>{{row.sourceValue}}</pre>}</section>}<section name="savedSearchMatched"><h2>Matched saved value ({{locale()}})</h2><p class="muted" name="savedSearchRowStatus">Loaded saved status: {{row.status===null?'not available in these results':row.status}}. Not a live review confirmation.</p><pre>{{row.value}}</pre><button type="button" name="copySavedSearchValue" [disabled]="!canCopy(row.id)||copyPending()" (click)="copyValue(row.id)">Copy matched value</button></section></div></article>}@empty{<p name="savedSearchEmpty">No saved base values match this text, status and tag filter in this branch and locale. Other locales, branches, plural forms or local drafts may differ.</p>}
 }@else if(!loading()&&!error()&&ready()){<p class="muted" name="savedSearchIdle">Choose the scope and enter text, then search. Changing the scope or text clears previous results.</p>}
 </main>`
})
export class SavedSearchComponent implements OnInit,OnDestroy {
 projectId='';sourceLocale=signal('');statuses=signal<string[]>([]);status=signal('');tag=signal('');branches=signal<BranchInfo[]>([]);locales=signal<string[]>([]);branch=signal('main');locale=signal('');query=signal('');match=signal<'contains'|'exact'>('contains');
 downloadNotice=signal('');copyNotice=signal('');copyPending=signal(false);
 optionsLoading=signal(false);optionsError=signal(false);loading=signal(false);error=signal(false);searched=signal(false);results=signal<{id:string;key:string;value:string;sourceValue:string|null;status:string|null;description:string|null;tags:string[]|null}[]>([]);
 @ViewChild('searchText') private searchText?:ElementRef<HTMLInputElement>;
 @ViewChild('searchOutcome') private searchOutcome?:ElementRef<HTMLElement>;
 private focusTimer:ReturnType<typeof setTimeout>|undefined;
 private focusAfterRender(destination:'text'|'outcome',generation:number){if(this.focusTimer!==undefined)clearTimeout(this.focusTimer);this.focusTimer=setTimeout(()=>{this.focusTimer=undefined;if(!this.destroyed&&generation===this.generation)(destination==='text'?this.searchText:this.searchOutcome)?.nativeElement.focus();},0);}
 private destroyed=false;private generation=0;private optionsGeneration=0;private subscription?:Subscription;
 constructor(private route:ActivatedRoute,private api:ApiService){}
 ngOnInit(){this.subscription=this.route.paramMap.subscribe(p=>void this.loadProject(p.get('id')??''));}
 ngOnDestroy(){if(this.focusTimer!==undefined)clearTimeout(this.focusTimer);this.destroyed=true;++this.generation;++this.optionsGeneration;this.subscription?.unsubscribe();}
 ready(){return !this.destroyed&&!this.optionsLoading()&&!this.optionsError()&&this.branches().some(b=>b.name===this.branch())&&this.locales().includes(this.locale());}
 canSearch(){return this.ready()&&!this.loading()&&!!this.query().trim()&&this.query().length<=200;}
 canClearFilters(){return this.ready()&&!!(this.query()||this.status()||this.tag()||this.match()!=='contains'||this.searched()||this.loading()||this.error()||this.downloadNotice());}
 clearFilters(){if(!this.canClearFilters())return;this.clear();this.query.set('');this.status.set('');this.tag.set('');this.match.set('contains');this.focusAfterRender('text',this.generation);}
 private clear(){if(this.focusTimer!==undefined)clearTimeout(this.focusTimer);this.focusTimer=undefined;++this.generation;this.downloadNotice.set('');this.copyNotice.set('');this.loading.set(false);this.error.set(false);this.searched.set(false);this.results.set([]);}
 setTag(value:string){if(this.destroyed)return;this.clear();this.tag.set(value.slice(0,40));}
 setStatus(value:string){if(this.destroyed||(value!==''&&!this.statuses().includes(value)))return;this.clear();this.status.set(value);}
 setMatch(value:string){if(this.destroyed||(value!=='contains'&&value!=='exact'))return;this.clear();this.match.set(value);}
 setQuery(value:string){if(this.destroyed)return;this.clear();this.query.set(value.slice(0,200));}
 setBranch(value:string){if(this.destroyed||!this.branches().some(b=>b.name===value))return;this.clear();this.branch.set(value);}
 setLocale(value:string){if(this.destroyed||!this.locales().includes(value))return;this.clear();this.locale.set(value);}
 async loadProject(projectId:string){
  if(this.destroyed)return;const generation=++this.optionsGeneration;this.projectId=projectId;this.clear();this.branches.set([]);this.locales.set([]);this.branch.set('main');this.locale.set('');this.sourceLocale.set('');this.statuses.set([]);this.status.set('');this.tag.set('');this.query.set('');this.match.set('contains');this.optionsLoading.set(true);this.optionsError.set(false);
  const current=()=>!this.destroyed&&generation===this.optionsGeneration;
  try{const [project,branches]=await Promise.all([this.api.getProject(projectId),this.api.listBranches(projectId)]);if(current()){this.branches.set(branches);this.locales.set(project.locales.map(l=>l.code));this.locale.set(project.baseLocale);this.sourceLocale.set(project.baseLocale);this.statuses.set([...new Set(['UNVERIFIED','TRANSLATED','REVIEWED',...(project.customStatuses??[])])]);}}
  catch{if(current())this.optionsError.set(true);}finally{if(current())this.optionsLoading.set(false);}
 }
 canCopy(id:string){return this.canDownload()&&this.results().some(row=>row.id===id);}
 async copyValue(id:string){
  if(!this.canCopy(id)||this.copyPending())return;
  const row=this.results().find(row=>row.id===id)!;const generation=this.generation;
  this.copyNotice.set('');this.copyPending.set(true);
  try{await navigator.clipboard.writeText(row.value);if(!this.destroyed&&generation===this.generation)this.copyNotice.set('Matched value copied to clipboard. Loaded text only, not newer server changes.');}
  catch{if(!this.destroyed&&generation===this.generation)this.copyNotice.set('Copy could not be confirmed. Select the matched value and copy it manually.');}
  finally{this.copyPending.set(false);}
 }
 canDownload(){return this.ready()&&!!this.projectId&&this.searched()&&!this.loading()&&!this.error();}
 download(){
  if(!this.canDownload())return;
  let url='';
  try{
   const content=JSON.stringify({schemaVersion:1,kind:'loaded-saved-text-matches',scope:'current-loaded-matches-only',completeProject:false,importFile:false,projectId:this.projectId,filters:{branch:this.branch(),locale:this.locale(),query:this.query(),match:this.match(),status:this.status()||null,tag:this.tag()||null},sourceLocale:this.sourceLocale(),matches:this.results().map(row=>({id:row.id,key:row.key,value:row.value,sourceValue:row.sourceValue}))},null,2);
   url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
   const anchor=document.createElement('a');anchor.href=url;anchor.download='saved-text-matches.json';anchor.click();
   this.downloadNotice.set('Download requested for loaded matches only. This does not confirm the file was saved or shared.');
  }catch{this.downloadNotice.set('Download could not be started. Try again from the current results.');}
  finally{if(url)URL.revokeObjectURL(url);}
 }
 async search(){
  if(!this.canSearch())return;const generation=++this.generation,projectId=this.projectId,branch=this.branch(),locale=this.locale(),query=this.query(),match=this.match(),sourceLocale=this.sourceLocale(),status=this.status(),tag=this.tag();const current=()=>!this.destroyed&&generation===this.generation;
  this.downloadNotice.set('');this.copyNotice.set('');this.loading.set(true);this.error.set(false);this.searched.set(false);this.results.set([]);
  try{const keys=await this.api.listKeys(projectId,{branch,locale,valueSearch:query,...(status?{status}:{}),...(tag?{tag}:{}),...(match==='exact'?{valueMatch:'exact' as const}:{})});if(current()){this.results.set(keys.map(k=>({id:k.id,key:k.name,value:k.translations.find(t=>t.localeCode===locale)?.value??'',sourceValue:k.translations.find(t=>t.localeCode===sourceLocale)?.value??null,status:k.translations.find(t=>t.localeCode===locale)?.status??null,description:k.description??null,tags:Array.isArray(k.tags)?[...k.tags]:null})));this.searched.set(true);}}
  catch{if(current())this.error.set(true);}finally{if(current()){this.loading.set(false);this.focusAfterRender('outcome',generation);}}
 }
}
