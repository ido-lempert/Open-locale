import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, Subscription } from 'rxjs';
import { ApiService, OtaBundle } from '../api.service';

@Component({
 selector:'ol-ota-bundle',imports:[RouterLink,DatePipe],
 styles:[`.bundle-scope,.bundle-key,.bundle-value{overflow-wrap:anywhere}.bundle-list{list-style:none;padding:0}.bundle-row{padding:1rem 0;border-bottom:1px solid #ddd}.bundle-value{white-space:pre-wrap;margin:.5rem 0}.bundle-pages{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}`],
 template:`
 <header class="bar"><a [routerLink]="['/projects',projectId,'settings']">&larr; Settings</a><h1>OTA bundle</h1></header>
 <main>
   <p class="bundle-scope">Branch: <code>{{branch}}</code>; version: {{version}}; locale: <code>{{locale}}</code></p>
   <p class="bundle-scope muted" name="bundleIdentity">{{publicationId===undefined?'Unpinned legacy link: branch recreation can select another publication. Open a fresh Inspect link from Settings to pin it.':'Pinned publication ID: '+publicationId}}</p>
   <p class="muted">Read-only retained publication, not live editor content. Empty values and unreviewed translations can be included. Publishing keeps up to 25 recent versions per branch; deleted or pruned bundles cannot be read here. This view does not publish or confirm client delivery.</p>
   <button type="button" name="refreshBundle" (click)="refresh()" [disabled]="loading()" [attr.aria-busy]="loading()">Refresh bundle</button>
   @if(loading()){<p role="status" name="bundleLoading">Loading published bundle...</p>}
   @if(error()){<p role="alert" class="error">Bundle unavailable. Project membership and a retained publication are required. No translation values are shown. Try refreshing.</p>}
   @if(bundle();as b){
     <p class="bundle-scope muted">Project: {{b.project}}; published <time [attr.datetime]="b.publishedAt">{{b.publishedAt|date:'medium'}} {{b.publishedAt|date:'z'}}</time>. {{rows().length}} translation values. Showing {{visibleRows().length}} on page {{page()+1}} of {{pageCount()}}.</p>
     <nav class="bundle-pages" aria-label="Bundle pages"><button type="button" name="previousBundlePage" [disabled]="page()===0" (click)="changePage(-1)">Previous</button><span>{{page()+1}} / {{pageCount()}}</span><button type="button" name="nextBundlePage" [disabled]="page()+1>=pageCount()" (click)="changePage(1)">Next</button></nav>
     <ul class="bundle-list" aria-live="polite">
       @for(row of visibleRows();track row[0]){<li class="bundle-row"><code class="bundle-key">{{row[0]}}</code><pre class="bundle-value">{{row[1]}}</pre>@if(row[1]===''){<span class="muted">Empty value</span>}</li>}
       @empty{<li class="muted" name="bundleEmpty">No translation values in this published locale.</li>}
     </ul>
   }
 </main>`,
})
export class OtaBundleComponent implements OnInit,OnDestroy{
 publicationId:string|undefined;projectId='';branch='main';version='';locale='';bundle=signal<OtaBundle|null>(null);rows=signal<[string,string][]>([]);page=signal(0);loading=signal(false);error=signal(false);
 private generation=0;private destroyed=false;private sub?:Subscription;
 constructor(private readonly route:ActivatedRoute,private readonly api:ApiService){}
 ngOnInit(){this.sub=combineLatest([this.route.paramMap,this.route.queryParamMap]).subscribe(([p,q])=>this.visit(p.get('id')??'',q.get('branch')??'main',p.get('version')??'',p.get('locale')??'',q.get('publicationId')??undefined));}
 visit(projectId:string,branch:string,version:string,locale:string,publicationId?:string){if(this.destroyed)return;this.projectId=projectId;this.branch=branch;this.version=version;this.locale=locale;this.publicationId=publicationId;void this.reload();}
 visibleRows(){return this.rows().slice(this.page()*50,(this.page()+1)*50);}
 pageCount(){return Math.max(1,Math.ceil(this.rows().length/50));}
 changePage(delta:number){this.page.set(Math.max(0,Math.min(this.pageCount()-1,this.page()+delta)));}
 refresh(){if(!this.loading())void this.reload();}
 async reload(){
   if(this.destroyed)return;
   const generation=++this.generation,{projectId,branch,version,locale,publicationId}=this,current=()=>!this.destroyed&&generation===this.generation;
   this.bundle.set(null);this.rows.set([]);this.page.set(0);this.error.set(false);this.loading.set(true);
   try{const b=await this.api.getOtaBundle(projectId,branch,version,locale,publicationId);if(current()){this.rows.set(Object.entries(b.translations));this.bundle.set(b);}}
   catch{if(current())this.error.set(true);}
   finally{if(current())this.loading.set(false);}
 }
 ngOnDestroy(){this.destroyed=true;++this.generation;this.sub?.unsubscribe();}
}
