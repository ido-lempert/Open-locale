import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, BranchInfo, OtaPublicationInfo, ApiTokenInfo, MemberInfo, Project } from '../api.service';

@Component({
  selector: 'ol-settings',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a [routerLink]="['/projects', projectId]" class="back">&larr; Editor</a>
      <h1>Project settings</h1>
    </header>
    <main>
      @if (project(); as p) {
        <section class="panel">
          <h2>General</h2>
          <form (ngSubmit)="rename()">
            <label>Name <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" required /></label>
            <label>Description <input [ngModel]="description()" (ngModelChange)="description.set($event)" name="description" /></label>
            <button class="primary" type="submit" [disabled]="busy()">Save</button>
          </form>
          <p class="muted">Slug: <code>{{ p.slug }}</code> · Base locale: <code>{{ p.baseLocale }}</code></p>
        </section>
        <section class="panel">
          <h2>Locales</h2>
          <ul class="locale-list">
            @for (l of p.locales; track l.code) {
              <li>
                <code>{{ l.code }}</code>
                @if (l.code === p.baseLocale) { <span class="muted">base</span> }
                @else if (confirmingLocale() === l.code) {
                  <span>Remove <strong>{{ l.code }}</strong>? This permanently deletes
                    {{ localeTxCount() }} translation{{ localeTxCount() === 1 ? '' : 's' }}.</span>
                  <button class="danger" (click)="removeLocale(l.code)">Yes, remove</button>
                  <button (click)="confirmingLocale.set(null)">Cancel</button>
                }
                @else { <button class="danger" (click)="askRemoveLocale(l.code)">Remove</button> }
              </li>
            }
          </ul>
          <form class="inline" (ngSubmit)="addLocale()">
            <input aria-label="Add locale" placeholder="Add locale (e.g. fr)" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
        </section>
        <section class="panel">
          <h2>API tokens</h2>
          <p class="muted">Tokens authenticate scripts and CI against the API (X-Api-Key header).</p>
          @if (createdToken(); as t) {
            <p class="notice">Token created. Copy it now - it will not be shown again.</p>
            <p class="token-reveal"><code>{{ t.token }}</code>
              <button type="button" (click)="copyToken(t.token)">Copy</button></p>
          }
          <ul class="locale-list">
            @for (tok of tokens(); track tok.id) {
              <li>
                <span>{{ tok.name }}</span>
                <span class="muted">{{ tok.scopes.join('+') }} · created {{ tok.createdAt | date:'mediumDate' }}{{ tok.lastUsedAt ? ' · used ' + (tok.lastUsedAt | date:'short') : ' · never used' }}</span>
                @if (confirmingToken() === tok.id) {
                  <span>Revoke <strong>{{ tok.name }}</strong>? Scripts using it stop immediately.</span>
                  <button class="danger" (click)="revokeToken(tok.id)">Yes, revoke</button>
                  <button (click)="confirmingToken.set(null)">Cancel</button>
                } @else {
                  <button class="danger" (click)="confirmingToken.set(tok.id)">Revoke</button>
                }
              </li>
            }
          </ul>
          <form class="inline" (ngSubmit)="createToken()">
            <input aria-label="Token name" placeholder="Token name (e.g. ci)" [ngModel]="tokenName()" (ngModelChange)="tokenName.set($event)" name="tokenName" required />
            <select aria-label="Token access" [ngModel]="tokenScope()" (ngModelChange)="tokenScope.set($event)" name="tokenScope">
              <option value="read">read-only</option>
              <option value="read,write">read + write</option>
            </select>
            <button type="submit" [disabled]="busy()">Create</button>
          </form>
        </section>
        <section class="panel">
          <h2>Review statuses</h2>
          <ul class="locale-list">
            <li><span class="badge">unverified</span><span class="badge">translated</span><span class="badge">reviewed</span> <span class="muted">base statuses, always available</span></li>
            @for (st of project()?.customStatuses ?? []; track st) {
              <li>
                <span class="badge">{{ st.toLowerCase() }}</span>
                <button class="danger" (click)="removeStatus(st)">Remove</button>
              </li>
            }
          </ul>
          <form class="inline" (ngSubmit)="addStatus()">
            <input aria-label="New custom status" placeholder="e.g. NEEDS_WORK (A-Z, 0-9, _)" [ngModel]="newStatus()" (ngModelChange)="newStatus.set($event)" name="newStatus" required maxlength="24" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
          <p class="muted">Custom statuses appear in the editor status dropdowns and the review queue. Removing one does not change translations already carrying it.</p>
        </section>
        <section class="panel">
          <h2>Members</h2>
          <ul class="locale-list">
            @for (m of members(); track m.id) {
              <li>
                <span>{{ m.displayName }} <span class="muted">{{ m.email }}</span></span>
                <span class="role-badge">{{ m.role.toLowerCase() }}</span>
                <span class="muted">{{ m.role === 'MEMBER' && m.allowedLocales.length ? 'locales: ' + m.allowedLocales.join(', ') : 'all locales' }}</span>
                @if (m.role !== 'OWNER') {
                  <select aria-label="Role" [ngModel]="m.role" (ngModelChange)="setRole(m, $event)" name="role-{{m.id}}">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button class="danger" (click)="removeMember(m)">Remove</button>
                }
              </li>
            }
          </ul>
          <form class="inline" (ngSubmit)="addMember()">
            <input aria-label="Member email" placeholder="User email" [ngModel]="memberEmail()" (ngModelChange)="memberEmail.set($event)" name="memberEmail" required />
            <select aria-label="New member role" [ngModel]="memberRole()" (ngModelChange)="memberRole.set($event)" name="memberRole">
              <option value="MEMBER">member</option>
              <option value="ADMIN">admin</option>
            </select>
            <input aria-label="Allowed locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="memberLocales()" (ngModelChange)="memberLocales.set($event)" name="memberLocales" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
          <p class="muted">Members join this team and can access every project in it. A locale list limits their translation writes across all of the team's projects. Project administration (settings, locales, webhooks, restores, members) requires admin.</p>
        </section>
        <section class="panel">
          <h2>OTA publications</h2>
          <p class="muted">Immutable per-branch translation bundles for OTA pull. Pull requires a session or a read API token - bundles are never public.</p>
          <ul class="locale-list">
            @for (o of otaPubs(); track o.id) {
              <li>
                <span>{{ o.branch }} <span class="muted">v{{ o.version }}</span></span>
                <span class="muted">{{ o.locales.join(', ') }} - {{ o.translations }} translations - {{ o.createdAt | date:'medium' }}</span>
              </li>
            }
            @if (!otaPubs().length) { <li class="muted">No publications yet.</li> }
          </ul>
          <form class="inline" (ngSubmit)="publishOta()">
            <select aria-label="OTA branch" [ngModel]="otaBranch()" (ngModelChange)="otaBranch.set($event)" name="otaBranch">
              @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
            </select>
            <button type="submit" [disabled]="busy()">Publish bundle</button>
          </form>
          @if (otaNotice()) { <p class="notice">{{ otaNotice() }}</p> }
        </section>
        <section class="panel danger-zone">
          <h2>Danger zone</h2>
          @if (!confirming()) {
            <button class="danger-outline" (click)="confirming.set(true)">Delete project…</button>
          } @else {
            <p>Delete <strong>{{ p.name }}</strong> and all its keys and translations? This cannot be undone.</p>
            <button class="danger-solid" (click)="remove()" [disabled]="busy()">Yes, delete permanently</button>
            <button (click)="confirming.set(false)">Cancel</button>
          }
        </section>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      } @else {
        <p class="muted">Loading…</p>
      }
    </main>
  `,
})
export class SettingsComponent implements OnInit {
  project = signal<Project | null>(null);
  name = signal(''); description = signal(''); newLocale = signal('');
  busy = signal(false); error = signal(''); confirming = signal(false);
  tokens = signal<ApiTokenInfo[]>([]);
  createdToken = signal<{ id: string; name: string; token: string } | null>(null);
  tokenName = signal(''); tokenScope = signal('read,write');
  confirmingToken = signal<string | null>(null);
  confirmingLocale = signal<string | null>(null);
  members = signal<MemberInfo[]>([]);
  otaPubs = signal<OtaPublicationInfo[]>([]); otaBranch = signal('main'); branches = signal<BranchInfo[]>([]); otaNotice = signal('');
  memberEmail = signal(''); memberRole = signal('MEMBER'); memberLocales = signal(''); newStatus = signal('');
  localeTxCount = signal(0);
  projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute, private router: Router) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() { await this.reload(); }
  async reload() {
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p);
      this.name.set(p.name); this.description.set(p.description);
      this.tokens.set(await this.api.listTokens());
      this.members.set(await this.api.listMembers(this.projectId));
      this.otaPubs.set(await this.api.listOtaPublications(this.projectId));
      this.branches.set(await this.api.listBranches(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
  }
  async publishOta() {
    this.busy.set(true); this.error.set(''); this.otaNotice.set('');
    try {
      const pub = await this.api.publishOta(this.projectId, this.otaBranch());
      this.otaNotice.set(`Published ${pub.branch} v${pub.version}: ${pub.locales.length} locales, ${pub.translations} translations.`);
      this.otaPubs.set(await this.api.listOtaPublications(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Publish failed'); }
    finally { this.busy.set(false); }
  }
  async createToken() {
    this.busy.set(true); this.error.set('');
    const submitted = this.tokenName();
    try {
      const scopes = this.tokenScope().split(',');
      const res = await this.api.createToken(submitted, scopes);
      this.createdToken.set({ id: res.id, name: res.name, token: res.token });
      if (this.tokenName() === submitted) this.tokenName.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async copyToken(value: string) {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard unavailable */ }
  }
  async revokeToken(id: string) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.revokeToken(id);
      this.confirmingToken.set(null);
      if (this.createdToken()?.id === id) this.createdToken.set(null);
      await this.reload();
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async askRemoveLocale(code: string) {
    this.error.set('');
    try {
      const keys = await this.api.listKeys(this.projectId);
      this.localeTxCount.set(
        keys.reduce((n, k) => n + k.translations.filter((t) => t.localeCode === code && t.value !== '').length, 0),
      );
      this.confirmingLocale.set(code);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async rename() {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.updateProject(this.projectId, { name: this.name(), description: this.description() });
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async addLocale() {
    this.busy.set(true); this.error.set('');
    try { await this.api.addLocale(this.projectId, this.newLocale().trim()); this.newLocale.set(''); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async removeLocale(code: string) {
    this.busy.set(true); this.error.set('');
    try { await this.api.removeLocale(this.projectId, code); this.confirmingLocale.set(null); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async addStatus() {
    this.busy.set(true); this.error.set('');
    try {
      const current = this.project()?.customStatuses ?? [];
      await this.api.updateProject(this.projectId, { customStatuses: [...current, this.newStatus().trim().toUpperCase()] });
      this.newStatus.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async removeStatus(st: string) {
    this.busy.set(true); this.error.set('');
    try {
      const current = this.project()?.customStatuses ?? [];
      await this.api.updateProject(this.projectId, { customStatuses: current.filter((x) => x !== st) });
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async addMember() {
    this.busy.set(true); this.error.set('');
    try {
      const locales = this.memberLocales().split(',').map((l) => l.trim()).filter(Boolean);
      await this.api.addMember(this.projectId, this.memberEmail().trim(), this.memberRole(), locales);
      this.memberEmail.set(''); this.memberLocales.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async setRole(m: MemberInfo, role: string) {
    this.error.set('');
    try { await this.api.updateMember(this.projectId, m.id, { role }); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async removeMember(m: MemberInfo) {
    if (!confirm(`Remove ${m.displayName} from the team? They lose access to this project immediately.`)) return;
    this.error.set('');
    try { await this.api.removeMember(this.projectId, m.id); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async remove() {
    this.busy.set(true);
    try { await this.api.deleteProject(this.projectId); await this.router.navigate(['/projects']); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); this.busy.set(false); }
  }
}
