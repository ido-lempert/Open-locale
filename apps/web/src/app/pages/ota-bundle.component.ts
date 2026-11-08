import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ApiService, OtaBundle } from '../api.service';

@Component({
 selector:'ol-ota-bundle',imports:[RouterLink,DatePipe,FormsModule],
 styles:[`.bundle-scope,.bundle-key,.bundle-value{overflow-wrap:anywhere}.bundle-list{list-style:none;padding:0}.bundle-row{padding:1rem 0;border-bottom:1px solid #ddd}.bundle-value{white-space:pre-wrap;margin:.5rem 0}.bundle-pages{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}`],
 template:`
 <header class="bar"><a [routerLink]="['/projects',projectId,'settings']">&larr; Settings</a><h1>OTA bundle</h1></header>
 <main>
   <p class="bundle-scope">Branch: <code>{{branch}}</code>; version: {{version}}; locale: <code>{{locale}}</code></p>
   <p class="bundle-scope muted" name="bundleIdentity">{{publicationId===undefined?'Unpinned legacy link: branch recreation can select another publication. Open a fresh Inspect link from Settings to pin it.':'Pinned publication ID: '+publicationId}}</p>
   <p class="muted">Read-only retained publication, not live editor content. Empty values and unreviewed translations can be included. Publishing keeps up to 25 recent versions per branch; deleted or pruned bundles cannot be read here. This view does not publish or confirm client delivery.</p>
   <button type="button" name="refreshBundle" (click)="refresh()" [disabled]="loading()" [attr.aria-busy]="loading()">Refresh bundle</button>
   <button type="button" name="downloadBundle" [disabled]="loading() || error() || !bundle()" (click)="download()">Download loaded locale bundle (.json)</button>
   <p class="muted" name="bundleDownloadScope">Downloads all loaded retained translation values in this locale, regardless of search, value filter or page. Includes private translation content and publication context, not live editor changes. An unpinned link remains unpinned in the file. Downloading does not share, publish or confirm client delivery.</p>
   @if(downloadNotice()){<p role="status" name="bundleDownloadNotice">{{downloadNotice()}}</p>}
   @if(loading()){<p role="status" name="bundleLoading">Loading published bundle...</p>}
   @if(error()){<p role="alert" class="error">Bundle unavailable. Project membership and a retained publication are required. No translation values are shown. Try refreshing.</p>}
   @if(bundle();as b){
     <p class="bundle-scope muted">Project: {{b.project}}; published <time [attr.datetime]="b.publishedAt">{{b.publishedAt|date:'medium'}} {{b.publishedAt|date:'z'}}</time>. {{rows().length}} translation values. Showing {{visibleRows().length}} on page {{page()+1}} of {{pageCount()}}.</p>
     <label>Published value <select name="bundleValueFilter" [ngModel]="valueFilter()" (ngModelChange)="setValueFilter($event)"><option value="">all values</option><option value="empty">empty values</option><option value="nonempty">non-empty values</option></select></label>
     <button type="button" name="clearBundleValueFilter" [disabled]="!valueFilter()" (click)="setValueFilter('')">Clear value filter</button>
     <p class="muted" name="bundleValueScope">Empty means exactly an empty string in this retained locale. Whitespace is non-empty. This filter does not find missing keys, run QA, read live editor values or confirm client delivery.</p>
     <label>Find in published keys or values <input type="search" name="bundleSearch" maxlength="200" [ngModel]="query()" (ngModelChange)="search($event)" /></label>
     <button type="button" name="clearBundleSearch" [disabled]="!query()" (click)="search('')">Clear search</button>
     <p class="muted" role="status" name="bundleMatches">{{filteredRows().length}} of {{rows().length}} values match. Search is a literal, case-insensitive substring in this downloaded locale only and combines with the value filter.</p>
     <nav class="bundle-pages" aria-label="Bundle pages"><button type="button" name="previousBundlePage" [disabled]="page()===0" (click)="changePage(-1)">Previous</button><span>{{page()+1}} / {{pageCount()}}</span><button type="button" name="nextBundlePage" [disabled]="page()+1>=pageCount()" (click)="changePage(1)">Next</button></nav>
     <ul class="bundle-list" aria-live="polite">
       @for(row of visibleRows();track row[0]){<li class="bundle-row"><code class="bundle-key">{{row[0]}}</code><pre class="bundle-value">{{row[1]}}</pre>@if(row[1]===''){<span class="muted">Empty value</span>}</li>}
       @empty{<li class="muted" name="bundleEmpty">{{emptyLabel()}}</li>}
     </ul>
   }
 </main>`,
})
export class OtaBundleComponent implements OnInit,OnDestroy{
 publicationId:string|undefined;projectId='';branch='main';version='';locale='';bundle=signal<OtaBundle|null>(null);rows=signal<[string,string][]>([]);page=signal(0);loading=signal(false);error=signal(false);
 query=signal('');valueFilter=signal<''|'empty'|'nonempty'>('');downloadNotice=signal('');
 filteredRows=computed(()=>{const query=this.query().toLowerCase(),filter=this.valueFilter();if(!query&&!filter)return this.rows();return this.rows().filter(([key,value])=>(!query||key.toLowerCase().includes(query)||value.toLowerCase().includes(query))&&(!filter||(filter==='empty'?value==='':value!=='')));});
 setValueFilter(value:string){if(this.destroyed||!['','empty','nonempty'].includes(value))return;this.valueFilter.set(value as ''|'empty'|'nonempty');this.page.set(0);}
 emptyLabel(){if(this.valueFilter())return 'No retained values match this value filter and search. Clear value filter or search to show other retained values.';return this.query()?'No published keys or values match this search.':'No translation values in this published locale.';}
 private generation=0;private destroyed=false;private sub?:Subscription;
 constructor(private readonly route:ActivatedRoute,private readonly api:ApiService){}
 ngOnInit(){this.sub=combineLatest([this.route.paramMap,this.route.queryParamMap]).subscribe(([p,q])=>this.visit(p.get('id')??'',q.get('branch')??'main',p.get('version')??'',p.get('locale')??'',q.get('publicationId')??undefined));}
 visit(projectId:string,branch:string,version:string,locale:string,publicationId?:string){if(this.destroyed)return;this.projectId=projectId;this.branch=branch;this.version=version;this.locale=locale;this.publicationId=publicationId;this.query.set('');this.valueFilter.set('');void this.reload();}
 search(query:string){if(this.destroyed)return;this.query.set(query.slice(0,200));this.page.set(0);}
 visibleRows(){return this.filteredRows().slice(this.page()*50,(this.page()+1)*50);}
 pageCount(){return Math.max(1,Math.ceil(this.filteredRows().length/50));}
 changePage(delta:number){this.page.set(Math.max(0,Math.min(this.pageCount()-1,this.page()+delta)));}
 refresh(){if(!this.loading())void this.reload();}
 async reload(){
   if(this.destroyed)return;
   const generation=++this.generation,{projectId,branch,version,locale,publicationId}=this,current=()=>!this.destroyed&&generation===this.generation;
   this.downloadNotice.set('');this.bundle.set(null);this.rows.set([]);this.page.set(0);this.error.set(false);this.loading.set(true);
   try{const b=await this.api.getOtaBundle(projectId,branch,version,locale,publicationId);if(current()){this.rows.set(Object.entries(b.translations));this.bundle.set(b);}}
   catch{if(current())this.error.set(true);}
   finally{if(current())this.loading.set(false);}
 }
 download(){
   const b=this.bundle();if(this.destroyed||this.loading()||this.error()||!b)return;
   let url:string|undefined;
   try{
     const content=JSON.stringify({schemaVersion:1,projectId:this.projectId,publicationId:this.publicationId??null,scope:'all-loaded-retained-locale-values',bundle:{project:b.project,branch:b.branch,locale:b.locale,version:b.version,publishedAt:b.publishedAt,translations:b.translations}},null,2);
     url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));
     const anchor=document.createElement('a');anchor.href=url;anchor.download='ota-locale-bundle.json';anchor.click();
     this.downloadNotice.set('Download requested for the loaded retained locale bundle. This does not confirm the file was saved, shared or delivered to clients.');
   }catch{this.downloadNotice.set('Download could not be started. Try again from the current locale bundle.');}
   finally{if(url)URL.revokeObjectURL(url);}
 }
 ngOnDestroy(){this.destroyed=true;++this.generation;this.sub?.unsubscribe();}
}
