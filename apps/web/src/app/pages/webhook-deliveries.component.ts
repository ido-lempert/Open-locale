import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, WebhookDeliveryInfo } from '../api.service';

@Component({
  selector:'ol-webhook-deliveries',
  imports:[RouterLink,DatePipe],
  styles:[`.delivery-list{list-style:none;padding:0}.delivery-row{border-bottom:1px solid #ddd;padding:1rem 0;display:flex;gap:.75rem;flex-wrap:wrap}.delivery-event{overflow-wrap:anywhere;min-width:0}`],
  template:`
    <header class="bar"><a [routerLink]="['/projects',projectId,'settings']">&larr; Settings</a><h1>Webhook deliveries</h1></header>
    <main>
      <p class="delivery-event muted">Webhook ID: <code>{{hookId}}</code></p>
      <p class="muted">Read-only journal for this webhook. Up to 50 recent deliveries are retained. Refresh to check again; this page does not send or retry deliveries.</p>
      <p class="muted">Payloads and signing secrets are not shown. A recorded success means the receiver returned a successful HTTP status, not that it processed the event.</p>
      <button type="button" name="refreshDeliveries" [disabled]="loading()" [attr.aria-busy]="loading()" (click)="refresh()">Refresh deliveries</button>
      @if(loading()){<p role="status">Loading deliveries...</p>}
      @if(error()){<p role="alert" class="error">Deliveries unavailable. This journal requires project admin access and an existing webhook. No deliveries are shown. Try refreshing.</p>}
      @if(!loading()&&!error()){
        <p class="muted" role="status">{{items().length}} recorded deliveries. This is a snapshot from the last read.</p>
        <ul class="delivery-list">
          @for(d of items();track d.id){
            <li class="delivery-row">
              <strong>{{d.success?'Succeeded':'Failed'}}</strong><span class="delivery-event">{{d.event}}</span>
              <span>HTTP {{d.httpStatus===null?'unavailable':d.httpStatus}}</span><span>{{d.attempts}} attempt(s)</span>
              <span>{{d.durationMs}} ms</span><time [attr.datetime]="d.createdAt">{{d.createdAt|date:'medium'}} {{d.createdAt|date:'z'}}</time>
            </li>
          }@empty{<li name="deliveriesEmpty" class="muted">No recorded deliveries for this webhook.</li>}
        </ul>
      }
    </main>`,
})
export class WebhookDeliveriesComponent implements OnInit,OnDestroy {
  projectId='';hookId='';items=signal<WebhookDeliveryInfo[]>([]);loading=signal(false);error=signal(false);
  private generation=0;private destroyed=false;private routeSub?:Subscription;
  constructor(private readonly route:ActivatedRoute,private readonly api:ApiService){}
  ngOnInit(){this.routeSub=this.route.paramMap.subscribe(p=>this.visit(p.get('id')??'',p.get('hookId')??''));}
  visit(projectId:string,hookId:string){if(this.destroyed)return;this.projectId=projectId;this.hookId=hookId;void this.reload();}
  refresh(){if(!this.loading())void this.reload();}
  async reload(){
    if(this.destroyed)return;
    const generation=++this.generation,projectId=this.projectId,hookId=this.hookId;
    const current=()=>!this.destroyed&&generation===this.generation;
    this.items.set([]);this.error.set(false);this.loading.set(true);
    try{const rows=await this.api.listWebhookDeliveries(projectId,hookId);if(current())this.items.set(rows);}
    catch{if(current())this.error.set(true);}
    finally{if(current())this.loading.set(false);}
  }
  ngOnDestroy(){this.destroyed=true;++this.generation;this.routeSub?.unsubscribe();}
}
