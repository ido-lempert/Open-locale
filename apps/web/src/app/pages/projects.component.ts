import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Project } from '../api.service';

@Component({
  selector: 'ol-projects',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="bar"><h1>Projects</h1>
      <a routerLink="/account/identities" class="identities-link">Linked identities</a>
      <a routerLink="/account/link-oidc" class="identity-link">Link OIDC identity</a>
      <a routerLink="/account/link-saml" class="saml-identity-link">Link SAML identity</a>
      <button (click)="logout()">Log out</button></header>
    <main>
      @if (createNotice(); as message) { <p role="status" name="projectCreateNotice">{{ message }}</p> }
      @if (hasProjectDraft()) { <p role="status" name="projectLocalDraft">{{ projectDraftLabel() }}</p> }
      <form class="create" [attr.aria-busy]="creating()" (ngSubmit)="create()">
        <input placeholder="Project name" aria-label="Project name" aria-describedby="newProjectRules" [attr.aria-invalid]="!!name() && !validNewName()" [ngModel]="name()" (ngModelChange)="formDraftEdited();name.set($event)" name="name" required />
        <input placeholder="slug" aria-label="Project slug" aria-describedby="newProjectRules" [attr.aria-invalid]="!!slug() && !validNewSlug()" [ngModel]="slug()" (ngModelChange)="formDraftEdited();slug.set($event)" name="slug" required />
        <input placeholder="Locales (e.g. en, he, ar)" aria-label="Locales" aria-describedby="newProjectRules" [attr.aria-invalid]="!!locales() && !validNewLocales()" [ngModel]="locales()" (ngModelChange)="formDraftEdited();locales.set($event)" name="locales" required />
        <button class="primary" type="submit" [disabled]="!validNewName() || !validNewSlug() || !validNewLocales() || busy() || createUnknown()">New project</button>
        @if (creating()) { <span role="status" name="projectCreating">Creating project...</span> }
      </form>
      <p class="muted" id="newProjectRules" name="newProjectRules">New project: a nonblank name up to 120 characters using the API count, a 2-61 character lowercase letter/digit/dash slug starting with a letter or digit, and at least one nonblank comma-separated locale entry. Name and slug are sent as entered, not trimmed or repaired. These checks do not verify locale syntax, uniqueness or availability.</p>
      @if((name() && !validNewName()) || (slug() && !validNewSlug()) || (locales() && !validNewLocales())){<p role="status" name="newProjectInvalid">Correct the name, slug or locale entries before creating. Your full form stays here and is not sent.</p>}
      <button type="button" name="downloadProjectDraft" [disabled]="!draftDownloadReady()" (click)="downloadDraft()">Download new-project form (.json)</button>
      <p class="muted" name="projectDraftDownloadScope">Backs up only the current local name, slug and raw locale text, not loaded projects or security settings. Not importable and does not create, retry or confirm a project. Unconfirmed creation stays unconfirmed; check projects before creating again. May contain private project text; downloading does not share it.</p>
      @if (draftDownloadNotice()) { <p role="status" name="projectDraftDownloadNotice">{{draftDownloadNotice()}}</p> }
      <button type="button" name="resetProjectDraft" [disabled]="!draftResetReady()" (click)="askDraftReset()">Discard local new-project form</button>
      @if (draftResetPending()) { <section role="group" aria-label="Discard local new-project form" name="projectDraftResetConfirm">
        <p>Discard the current local name, slug and locale text? Download or copy it first to keep it. This cannot be undone here. No project or security setting is changed. Unconfirmed creation stays unconfirmed.</p>
        <div class="toolbar"><button type="button" name="keepProjectDraft" (click)="cancelDraftReset()">Keep form</button>
        <button type="button" name="confirmProjectDraftReset" (click)="confirmDraftReset()">Discard local form</button></div>
      </section> }
      @if (draftResetNotice()) { <p role="status" name="projectDraftResetNotice">{{draftResetNotice()}}</p> }
      @if (createUnknown()) { <p class="error" role="alert" name="projectCreateUnknown">Project creation outcome unconfirmed. Your form is kept here. Check the project list, then refresh projects before creating again. Do not repeat the request without checking.</p> }
      @if (error() && (!createUnknown() || error() !== 'Project creation outcome unconfirmed. Your form is kept here. Check the project list before trying again.')) { <p class="error" role="alert">{{ error() }}</p> }
      @if (projectsLoading()) { <p class="muted" role="status" name="projectsLoading">Loading projects.</p> }
      @else if (projectsError()) { <p class="error" role="alert" name="projectsError">Projects unavailable. Check your access or connection, then retry.</p><button type="button" name="retryProjects" (click)="reload()">Retry projects</button> }
      @else if (projects().length === 0) {
        <p class="muted empty">No projects yet. Create your first one above.</p>
      }
      @if (!projectsError()) { <button type="button" name="refreshProjects" [disabled]="projectsLoading() || busy()" (click)="refreshProjects()">Refresh projects</button> }
      <section class="panel tfa">
        <h2>Two-factor authentication</h2>
        @if (tfaLoading()) { <p class="muted" role="status" name="tfaLoading">Loading two-factor status.</p> }
        @else if (tfaError()) { <p class="error" role="alert" name="tfaError">Two-factor status unavailable. No security setting was changed by this read.</p><button type="button" name="retryTfa" [disabled]="busy()" (click)="loadTfa()">Retry status</button> }
        @if (tfa(); as t) {
          @if (t.enabled) {
            <p class="muted">Enabled. {{ t.recoveryCodesRemaining }} recovery codes remain. Changing two-factor settings signs out all sessions, including this one.</p>
            <form class="inline" (ngSubmit)="disableTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaPassword" required autocomplete="current-password" />
              <input aria-label="Current 2FA code" placeholder="TOTP or recovery code" [ngModel]="tfaCode()" (ngModelChange)="tfaCode.set($event)" name="tfaCode" required />
              <button class="danger" type="submit" [disabled]="busy()">Disable</button>
            </form>
          } @else if (tfaSetup(); as su) {
            <p class="muted">Add this secret to your authenticator app, then enter its 6-digit code. Shown once.</p>
            <p><code class="tfa-secret">{{ su.secret }}</code></p>
            <p class="muted wrap"><code>{{ su.otpauthUrl }}</code></p>
            <form class="inline" (ngSubmit)="enableTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaPassword" required autocomplete="current-password" />
              <input aria-label="6-digit setup code" placeholder="6-digit code" [ngModel]="tfaCode()" (ngModelChange)="tfaCode.set($event)" name="tfaCode" required />
              <button class="primary" type="submit" [disabled]="busy()">Enable</button>
            </form>
          } @else {
            <p class="muted">Not enabled. A TOTP code is required at login after enabling. Setup requires your current password.</p>
            <form class="inline" (ngSubmit)="startTfa()">
              <input aria-label="Current password" type="password" placeholder="Current password" [ngModel]="tfaPassword()" (ngModelChange)="tfaPassword.set($event)" name="tfaSetupPassword" required autocomplete="current-password" />
              <button type="submit" [disabled]="busy()">Set up two-factor</button>
            </form>
          }
        }
        @if (tfaCodes().length) {
          <p class="muted"><strong>Recovery codes - store them now; they are shown once and each works once.</strong></p>
          <ul class="locale-list tfa-codes">
            @for (c of tfaCodes(); track c) { <li><code>{{ c }}</code></li> }
          </ul>
          <p class="muted">Your current session was signed out when you enabled two-factor.</p>
          <button class="primary" (click)="dismissTfaCodes()">I've stored these - sign in again</button>
        }
      </section>
      <label>Find in loaded project names, slugs or locale codes <input type="search" name="projectSearch" maxlength="200" [ngModel]="query()" (ngModelChange)="search($event)" /></label>
      <button type="button" name="clearProjectSearch" [disabled]="!query()" (click)="search('')">Clear search</button>
      @if (!projectsLoading() && !projectsError()) {
        <p class="muted" role="status" name="projectMatches">{{ visibleProjects().length }} of {{ projects().length }} projects match. Search is a literal, case-insensitive substring in loaded projects only. Refresh projects to read newer changes.</p>
        @if (query() && !visibleProjects().length) { <p class="muted" name="projectSearchEmpty">No loaded projects match this search. Clear search to show all loaded projects.</p> }
      }
      <ul class="cards">
        @for (p of visibleProjects(); track p.id) {
          <li>
            <a [routerLink]="['/projects', p.id]">
              <strong>{{ p.name }}</strong>
              <span class="muted">{{ p.slug }} · base {{ p.baseLocale }} ·
                {{ p.locales.length }} locales · {{ p._count?.keys ?? 0 }} keys</span>
            </a>
          </li>
        }
      </ul>
    </main>
  `,
})
export class ProjectsComponent implements OnInit, OnDestroy {
  projects = signal<Project[]>([]);
  query=signal('');
  visibleProjects=computed(()=>{const query=this.query().toLowerCase();return query?this.projects().filter(p=>[p.name,p.slug,...p.locales.map(l=>l.code)].some(value=>value.toLowerCase().includes(query))):this.projects();});
  search(query:string) {if(!this.destroyed)this.query.set(query.slice(0,200));}
  projectsLoading = signal(true); projectsError = signal(false);
  tfaLoading = signal(true); tfaError = signal(false);
  private projectsGeneration = 0; private tfaGeneration = 0; private destroyed = false;
  private draftDownloadResult=signal<{snapshot:string;message:string}|null>(null);
  draftDownloadNotice=computed(()=>{const result=this.draftDownloadResult();return result&&result.snapshot===this.draftJson()?result.message:'';});
  draftDownloadReady(){return !this.destroyed&&!this.creating();}
  private draftJson(){return JSON.stringify({schemaVersion:1,scope:'current-local-new-project-form',serverStateConfirmed:false,importable:false,canCreate:false,createOutcomeUnconfirmed:this.createUnknown(),draft:{name:this.name(),slug:this.slug(),localesText:this.locales()}},null,2);}
  downloadDraft(){
    if(!this.draftDownloadReady())return;
    let url:string|undefined;const snapshot=this.draftJson();
    try{
      url=URL.createObjectURL(new Blob([snapshot],{type:'application/json;charset=utf-8'}));
      const anchor=document.createElement('a');anchor.href=url;anchor.download='new-project-form.json';anchor.click();
      this.draftDownloadResult.set({snapshot,message:'Download requested for the current local new-project form. This does not confirm the file was saved, shared or a project was created.'});
    }catch{this.draftDownloadResult.set({snapshot,message:'Download could not be started. Copy your form text before leaving.'});}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  private draftResetSnapshot=signal<string|null>(null);
  private draftResetResult=signal<string|null>(null);
  draftResetReady(){return !this.destroyed&&!this.creating()&&this.hasProjectDraft();}
  draftResetPending=computed(()=>this.draftResetSnapshot()!==null&&this.draftResetSnapshot()===this.draftJson()&&!this.creating());
  draftResetNotice=computed(()=>this.draftResetResult()===this.draftJson()?'Local new-project form discarded. No project or security setting was changed. Unconfirmed creation stays unconfirmed.':'');
  askDraftReset(){if(this.draftResetReady()){this.draftResetResult.set(null);this.draftResetSnapshot.set(this.draftJson());}}
  formDraftEdited(){this.cancelDraftReset();this.draftResetResult.set(null);this.draftDownloadResult.set(null);}
  cancelDraftReset(){this.draftResetSnapshot.set(null);}
  confirmDraftReset(){
    if(!this.draftResetReady()||!this.draftResetPending()){this.cancelDraftReset();return;}
    this.name.set('');this.slug.set('');this.locales.set('');this.draftDownloadResult.set(null);this.cancelDraftReset();this.draftResetResult.set(this.draftJson());
  }
  hasProjectDraft=computed(()=>!!(this.name()||this.slug()||this.locales()));
  projectDraftLabel=computed(()=>this.creating()?'Project creation is pending. Current new-project fields are kept here; they may differ from the submitted project. Do not create again.':this.createUnknown()?'Current new-project form is kept here, but project creation is unconfirmed. Copy the form before leaving and check/refresh projects before creating again.':'New-project form has local text. It is not automatically saved or restored after leaving. Copy the form before leaving to keep it; a copy does not create a project.');
  name = signal(''); slug = signal(''); locales = signal('');
  busy = signal(false); error = signal('');
  creating = signal(false); createNotice = signal('');
  createUnknown = signal(false); private createEpoch = 0;
  tfa = signal<{ enabled: boolean; recoveryCodesRemaining: number } | null>(null);
  tfaSetup = signal<{ secret: string; otpauthUrl: string } | null>(null);
  tfaCode = signal(''); tfaPassword = signal(''); tfaCodes = signal<string[]>([]);
  constructor(private api: ApiService) {}
  async ngOnInit() { await Promise.all([this.reload(), this.loadTfa()]); }
  refreshProjects() { if(!this.destroyed&&!this.projectsLoading()&&!this.busy())void this.reload(); }
  async reload() {
    if (this.destroyed) return;
    const generation = ++this.projectsGeneration, epoch=this.createEpoch, pendingCreate=this.creating();
    const current = () => !this.destroyed && generation === this.projectsGeneration;
    this.projectsLoading.set(true); this.projectsError.set(false); this.projects.set([]);
    try { const projects = await this.api.listProjects(); if (current()) {this.projects.set(projects);if(!pendingCreate&&!this.creating()&&epoch===this.createEpoch){if(this.createUnknown()&&this.error()==='Project creation outcome unconfirmed. Your form is kept here. Check the project list before trying again.')this.error.set('');this.createUnknown.set(false);}} }
    catch { if (current()) this.projectsError.set(true); }
    finally { if (current()) this.projectsLoading.set(false); }
  }
  async loadTfa() {
    if (this.destroyed || this.busy()) return;
    const generation = ++this.tfaGeneration;
    const current = () => !this.destroyed && generation === this.tfaGeneration;
    this.tfaLoading.set(true); this.tfaError.set(false); this.tfa.set(null);
    try { const status = await this.api.get2faStatus(); if (current()) this.tfa.set(status); }
    catch { if (current()) this.tfaError.set(true); }
    finally { if (current()) this.tfaLoading.set(false); }
  }
  ngOnDestroy() { this.cancelDraftReset();this.draftResetResult.set(null);this.destroyed = true; ++this.projectsGeneration; ++this.tfaGeneration; }
  async startTfa() {
    this.busy.set(true); this.error.set('');
    try { this.tfaSetup.set(await this.api.setup2fa(this.tfaPassword())); this.tfaPassword.set(''); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  dismissTfaCodes() {
    this.tfaCodes.set([]);
    this.logout('Two-factor authentication is on - sign in again with your code.');
  }
  async enableTfa() {
    this.busy.set(true); this.error.set('');
    try {
      const res = await this.api.enable2fa(this.tfaPassword(), this.tfaCode().trim());
      this.tfaCodes.set(res.recoveryCodes);
      this.tfaSetup.set(null); this.tfaCode.set(''); this.tfaPassword.set('');
      // The pre-2FA session is immediately locked out of status reads
      // (step-up) - take the state from the enable response instead.
      this.tfa.set({ enabled: true, recoveryCodesRemaining: res.recoveryCodes.length });
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async disableTfa() {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.disable2fa(this.tfaPassword(), this.tfaCode().trim());
      this.tfaCode.set(''); this.tfaPassword.set(''); this.tfaCodes.set([]);
      // Disabling bumps the session epoch too - this token is already
      // revoked, so re-authenticate instead of refetching with it.
      this.logout('Two-factor authentication disabled - sign in again.');
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  private apiTextLength(value:string):number {
    // Match installed class-validator/validator isLength, not UTF-16 or grapheme length.
    return value.length-(value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)||[]).length-(value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)||[]).length;
  }
  validNewName():boolean {return !!this.name().trim() && this.apiTextLength(this.name())<=120;}
  validNewSlug():boolean {return /^[a-z0-9][a-z0-9-]{1,60}$/.test(this.slug());}
  validNewLocales():boolean {return this.locales().split(',').some(value=>!!value.trim());}
  async create() {
    if(this.destroyed || this.busy() || this.createUnknown())return;
    const submitted = { name: this.name(), slug: this.slug(), locales: this.locales() };
    if(!this.validNewName() || !this.validNewSlug() || !this.validNewLocales())return;
    this.cancelDraftReset();this.draftResetResult.set(null);this.draftDownloadResult.set(null);++this.createEpoch;this.busy.set(true);this.creating.set(true);this.error.set('');this.createNotice.set('');
    try {
      const codes = submitted.locales.split(',').map((s) => s.trim()).filter(Boolean);
      await this.api.createProject({ name: submitted.name, slug: submitted.slug, locales: codes });
      if(this.destroyed)return;
      if(this.name()===submitted.name && this.slug()===submitted.slug && this.locales()===submitted.locales){
        this.name.set('');this.slug.set('');this.locales.set('');
      }
      this.createNotice.set(`Project "${submitted.name.trim()}" was created. If the list is unavailable, retry the project list without creating again.`);
      await this.reload();
    } catch {
      if(!this.destroyed){++this.createEpoch;this.createUnknown.set(true);this.error.set('Project creation outcome unconfirmed. Your form is kept here. Check the project list before trying again.');}
    } finally {
      if(!this.destroyed){this.busy.set(false);this.creating.set(false);}
    }
  }
  logout(reason?: string) {
    this.api.token = null;
    location.href = reason ? `/login?reason=${encodeURIComponent(reason)}` : '/login';
  }
}
