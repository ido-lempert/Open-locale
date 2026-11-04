import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActivityEntry, ApiService, MemberInfo } from '../api.service';

const ACTION_LABELS: Record<string, string> = {
  'screenshot.added': 'added screenshot',
  'screenshot.deleted': 'deleted screenshot',
  'task.created': 'created task',
  'task.updated': 'updated task',
  'task.deleted': 'deleted task',
  'glossary.created': 'created glossary term',
  'glossary.updated': 'updated glossary term',
  'glossary.deleted': 'deleted glossary term',
  'project.embedOrigins.updated': 'updated embed origins',
  'mt.pretranslate': 'ran pretranslation',
  'automation.run': 'ran automation',
  'key.created': 'created key',
  'key.deleted': 'deleted key',
  'key.tags': 'updated tags on',
  'translation.value': 'edited translation',
  'translation.status': 'changed status',
  'comment.added': 'commented on',
  'comment.deleted': 'deleted a comment on',
  'project.renamed': 'renamed the project',
  'project.import': 'imported translations',
  'snapshot.created': 'captured a snapshot',
  'snapshot.restored': 'restored a snapshot',
  'locale.added': 'added locale',
  'locale.removed': 'removed locale',
  'branch.created': 'created branch',
  'branch.deleted': 'deleted branch',
  'branch.merged': 'merged branch',
  'ota.published': 'published an OTA bundle',
  'member.added': 'added member',
  'member.updated': 'updated member',
  'member.removed': 'removed member',
  'group.created': 'created group',
  'group.updated': 'updated group',
  'group.deleted': 'deleted group',
  'group.member.added': 'added a member to group',
  'group.member.removed': 'removed a member from group',
};

// Older or incomplete audit snapshots must never break rendering the whole feed.
function roleSnapshot(value: unknown): value is { role: string; allowedLocales: string[] } {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const snapshot=value as Record<string,unknown>;
  return typeof snapshot['role']==='string'&&Array.isArray(snapshot['allowedLocales'])&&snapshot['allowedLocales'].every(locale=>typeof locale==='string');
}

@Component({
  selector: 'ol-activity',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Activity</h1>
      <select aria-label="Filter by action" [ngModel]="actionFilter()" (ngModelChange)="setFilter($event)">
        <option value="">all actions</option>
        @for (a of actions; track a) { <option [value]="a">{{ label(a) }}</option> }
      </select>
      <select aria-label="Filter by actor" [attr.aria-busy]="membersLoading()" name="actActor" [ngModel]="actorFilter()" (ngModelChange)="setActor($event)">
        <option value="">all actors</option>
        @for (m of members(); track m.id) { <option [value]="m.id">{{ m.displayName }}</option> }
      </select>
      <input aria-label="Filter by key" name="actKey" placeholder="key contains…" [ngModel]="keyFilter()" (ngModelChange)="onKeyInput($event)">
    </header>
    <main [attr.aria-busy]="loading()">
      @if (membersLoading()) { <p role="status" name="activityActorsLoading">Loading actor filter options. Activity loads independently.</p> }
      @if (membersError()) { <p class="error" role="alert" name="activityActorsError">Actor filter options unavailable. Activity remains available.</p><button type="button" name="retryActivityActors" (click)="void loadMembers()">Retry actor options</button> }
      @if (error(); as e) { <p class="error" role="alert">{{ e }}</p><button type="button" name="retryActivity" (click)="retry()">Retry activity</button> }
      @if (loading()) { <p role="status" name="activityLoading">Loading activity...</p> }
      @if (!error()) { <button type="button" name="refreshActivity" [disabled]="loading()" (click)="refresh()">Refresh activity</button> }
      <ul class="activity-list">
        @for (ev of items(); track ev.id) {
          <li class="activity-row">
            <span class="activity-actor">{{ ev.actor?.displayName ?? 'Former user' }}</span>
            <span class="activity-action">{{ label(ev.action) }}</span>
            @if (ev.keyName) { <code class="activity-key">{{ ev.keyName }}</code> }
            @if (ev.localeCode) { <span class="locale-badge">{{ ev.localeCode }}</span> }
            @if (detailText(ev)) { <span class="muted activity-detail">{{ detailText(ev) }}</span> }
            <time class="muted">{{ ev.createdAt | date:'short' }}</time>
          </li>
        } @empty {
          @if (!loading() && !error()) { <li class="muted" name="activityEmpty">{{ hasFilters() ? 'No activity matches these filters' : 'No activity yet' }}</li> }
        }
      </ul>
      @if (nextCursor() && !error()) {
        <button [disabled]="loading()" class="load-more" (click)="loadMore()">Load more</button>
      }
    </main>
  `,
})
export class ActivityComponent implements OnInit, OnDestroy {
  projectId = '';
  items = signal<ActivityEntry[]>([]);
  nextCursor = signal<string | null>(null);
  actionFilter = signal('');
  actorFilter = signal('');
  keyFilter = signal('');
  members = signal<MemberInfo[]>([]);
  membersLoading = signal(false);
  membersError = signal(false);
  private memberGeneration = 0;
  loading = signal(true);
  error = signal('');
  actions = Object.keys(ACTION_LABELS);
  private keyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  private subscription?:Subscription;
  private generation=0;
  private projectGeneration=0;
  private destroyed=false;
  private failedReset=true;
  ngOnInit() {
    this.subscription=this.route.paramMap.subscribe(params=>{void this.loadProject(params.get('id')??'');});
  }
  async loadProject(projectId:string) {
    if(this.destroyed)return;
    ++this.projectGeneration;this.projectId=projectId;
    if(this.keyTimer)clearTimeout(this.keyTimer);this.keyTimer=null;
    this.actionFilter.set('');this.actorFilter.set('');this.keyFilter.set('');this.members.set([]);
    await Promise.all([this.loadMembers(),this.fetch(true)]);
  }
  async loadMembers() {
    if(this.destroyed)return;
    const scope=this.projectGeneration,generation=++this.memberGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.memberGeneration;
    this.membersLoading.set(true);this.membersError.set(false);
    try {const members=await this.api.listMembers(projectId);if(current())this.members.set(members);}
    catch {if(current())this.membersError.set(true);}
    finally {if(current())this.membersLoading.set(false);}
  }
  ngOnDestroy() {this.destroyed=true;++this.generation;++this.projectGeneration;this.subscription?.unsubscribe();if(this.keyTimer)clearTimeout(this.keyTimer);}

  setActor(actorId: string) {
    this.actorFilter.set(actorId);
    void this.fetch(true);
  }

  // Debounced like the editor search: one request per pause, not per keystroke.
  onKeyInput(v: string) {
    if(this.destroyed)return;
    ++this.generation;this.items.set([]);this.nextCursor.set(null);this.error.set('');this.loading.set(true);
    this.keyFilter.set(v);
    if (this.keyTimer) clearTimeout(this.keyTimer);
    this.keyTimer = setTimeout(() => void this.fetch(true), 250);
  }

  hasFilters() { return !!(this.actionFilter()||this.actorFilter()||this.keyFilter().trim()); }

  label(action: string) { return ACTION_LABELS[action] ?? action; }

  detailText(ev: ActivityEntry): string {
    const d = ev.detail ?? {};
    switch (ev.action) {
      case 'task.created':
      case 'task.deleted':
        return typeof d['title']==='string' ? d['title'] : '';
      case 'glossary.created':
      case 'glossary.updated':
      case 'glossary.deleted':
        return typeof d['term']==='string' ? d['term'] : '';
      case 'translation.value':
        return d['previousValue'] ? `"${d['previousValue']}" → "${d['value']}"` : `"${d['value']}"`;
      case 'translation.status':
        return `${d['from']} → ${d['to']}`;
      case 'key.tags':
        return Array.isArray(d['tags']) && (d['tags'] as string[]).length ? (d['tags'] as string[]).join(', ') : '(tags cleared)';
      case 'project.renamed':
        return `"${d['from']}" → "${d['to']}"`;
      case 'project.import':
        return `${d['translationsUpserted']} updated, ${d['unchangedSkipped']} unchanged, ${d['keysCreated']} new keys`;
      case 'comment.deleted':
        return d['excerpt'] ? `"${d['excerpt']}"` : '';
      case 'member.added':
        return `${d['email']} (${String(d['role']).toLowerCase()}${Array.isArray(d['allowedLocales']) && (d['allowedLocales'] as string[]).length ? ': ' + (d['allowedLocales'] as string[]).join(', ') : ''})`;
      case 'member.updated': {
        const f = d['from'],t = d['to'];
        if(!roleSnapshot(f)||!roleSnapshot(t))return '';
        return `${d['email']}: ${f.role.toLowerCase()} → ${t.role.toLowerCase()}${JSON.stringify(f.allowedLocales) !== JSON.stringify(t.allowedLocales) ? `, locales ${f.allowedLocales.join(',') || 'all'} → ${t.allowedLocales.join(',') || 'all'}` : ''}`;
      }
      case 'member.removed':
        return `${d['email']} (was ${String(d['role']).toLowerCase()})`;
      case 'group.created':
        return `"${d['name']}" (${String(d['role']).toLowerCase()}${Array.isArray(d['allowedLocales']) && (d['allowedLocales'] as string[]).length ? ': ' + (d['allowedLocales'] as string[]).join(', ') : ''})`;
      case 'group.updated': {
        const f = d['from'],t = d['to'];
        if(!roleSnapshot(f)||!roleSnapshot(t))return '';
        const parts: string[] = [];
        if (f.role !== t.role) parts.push(`${f.role.toLowerCase()} → ${t.role.toLowerCase()}`);
        if (JSON.stringify(f.allowedLocales) !== JSON.stringify(t.allowedLocales)) parts.push(`locales ${f.allowedLocales.join(',') || 'all'} → ${t.allowedLocales.join(',') || 'all'}`);
        return `"${d['name']}"${parts.length ? ': ' + parts.join(', ') : ''}`;
      }
      case 'group.deleted': {
        const unassigned = typeof d['tasksUnassigned'] === 'number' ? d['tasksUnassigned'] as number : 0;
        return `"${d['name']}" (was ${String(d['role']).toLowerCase()}, ${d['members']} member(s)${unassigned ? `, ${unassigned} task(s) unassigned` : ''})`;
      }
      case 'task.updated': {
        const title = typeof d['title']==='string' ? d['title'] : '';
        const changes=d['changes'];
        if(!changes||typeof changes!=='object'||Array.isArray(changes))return title;
        const valid=(value:unknown)=>value===null||typeof value==='string'||typeof value==='boolean'||(Array.isArray(value)&&value.every(item=>typeof item==='string'));
        const fmt=(value:unknown):string=>value===null?'none':Array.isArray(value)?(value.length?value.join(', '):'none'):String(value);
        const parts:string[]=[];
        for(const [field,change] of Object.entries(changes)) {
          if(!change||typeof change!=='object'||Array.isArray(change))continue;
          const pair=change as Record<string,unknown>;
          if(valid(pair['from'])&&valid(pair['to']))parts.push(`${field}: ${fmt(pair['from'])} → ${fmt(pair['to'])}`);
        }
        return `${title}${parts.length ? (title ? ' - ' : '') + parts.join('; ') : ''}`;
      }
      case 'group.member.added':
      case 'group.member.removed':
        return `${d['member']} ${ev.action === 'group.member.added' ? '→' : '←'} ${d['group']}`;
      default:
        return '';
    }
  }

  setFilter(action: string) {
    this.actionFilter.set(action);
    void this.fetch(true);
  }

  refresh() { if(!this.loading())void this.fetch(true); }

  loadMore() { void this.fetch(false); }

  retry() {void this.fetch(this.failedReset);}
  async fetch(reset: boolean) {
    if(this.destroyed||(!reset&&(this.loading()||!this.nextCursor())))return;
    if(this.keyTimer)clearTimeout(this.keyTimer);this.keyTimer=null;
    const generation=++this.generation,scope=this.projectGeneration,projectId=this.projectId;
    const current=()=>!this.destroyed&&scope===this.projectGeneration&&generation===this.generation;
    const options={action:this.actionFilter()||undefined,actorId:this.actorFilter()||undefined,key:this.keyFilter().trim()||undefined,cursor:reset?undefined:this.nextCursor()??undefined};
    if(reset){this.items.set([]);this.nextCursor.set(null);}
    this.loading.set(true);this.error.set('');
    try {
      const res=await this.api.listActivity(projectId,options);
      if(current()){this.items.set(reset?res.items:[...this.items(),...res.items]);this.nextCursor.set(res.nextCursor);}
    } catch {
      if(current()){this.failedReset=reset;this.error.set('Activity unavailable. Retry this read or reload the page.');}
    } finally {if(current())this.loading.set(false);}
  }
}
