import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, AutomationRuleInfo, BranchInfo, MtProviderInfo, OtaPublicationInfo, ApiTokenInfo, GroupInfo, MemberInfo, Project, WebhookInfo } from '../api.service';

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
          @if (isTeamAdmin()) {
          <form (ngSubmit)="rename()">
            <label>Name <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" required /></label>
            <label>Description <input [ngModel]="description()" (ngModelChange)="description.set($event)" name="description" /></label>
            <button class="primary" type="submit" [disabled]="busy()">Save</button>
          </form>
          }
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
                @else if (isTeamAdmin()) { <button class="danger" (click)="askRemoveLocale(l.code)">Remove</button> }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addLocale()">
            <input aria-label="Add locale" placeholder="Add locale (e.g. fr)" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
          }
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
          <h2>Webhooks</h2>
          <p class="muted">Signed POSTs to a public http(s) URL when project events happen. Each delivery carries X-OpenLocale-Event and X-OpenLocale-Signature (HMAC-SHA256 of the raw body with the signing secret). Private and internal addresses are refused.</p>
          @if (createdWebhook(); as w) {
            <p class="notice">Webhook created. Copy the signing secret now - it will not be shown again.</p>
            <p class="token-reveal"><code>{{ w.secret }}</code>
              <button type="button" (click)="copyToken(w.secret)">Copy</button></p>
          }
          <ul class="locale-list">
            @for (h of webhooks(); track h.id) {
              <li>
                <span class="hook-url">{{ h.url }}</span>
                <span class="muted">{{ h.events.join(' + ') }} · created {{ h.createdAt | date:'mediumDate' }}</span>
                @if (!h.active) { <span class="badge">disabled</span> }
                @if (isTeamAdmin()) {
                  @if (confirmingHook() === h.id) {
                    <span>Delete this webhook? Deliveries stop immediately.</span>
                    <button class="danger" (click)="removeHook(h.id)">Yes, delete</button>
                    <button (click)="confirmingHook.set(null)">Cancel</button>
                  } @else {
                    <button (click)="toggleHook(h)">{{ h.active ? 'Disable' : 'Enable' }}</button>
                    <button class="danger" (click)="confirmingHook.set(h.id)">Delete</button>
                  }
                }
              </li>
            }
            @if (!webhooks().length) { <li class="muted">No webhooks yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="createWebhook()">
            <input type="url" aria-label="Webhook URL" placeholder="https://example.com/hook" [ngModel]="hookUrl()" (ngModelChange)="hookUrl.set($event)" name="hookUrl" required />
            <label><input type="checkbox" [ngModel]="hookTranslationUpdated()" (ngModelChange)="hookTranslationUpdated.set($event)" name="hookEvTx" /> translation.updated</label>
            <label><input type="checkbox" [ngModel]="hookProjectRestored()" (ngModelChange)="hookProjectRestored.set($event)" name="hookEvRestore" /> project.restored</label>
            <button type="submit" [disabled]="busy()">Create</button>
          </form>
          }
        </section>
        <section class="panel">
          <h2>Review statuses</h2>
          <ul class="locale-list">
            <li><span class="badge">unverified</span><span class="badge">translated</span><span class="badge">reviewed</span> <span class="muted">base statuses, always available</span></li>
            @for (st of project()?.customStatuses ?? []; track st) {
              <li>
                <span class="badge">{{ st.toLowerCase() }}</span>
                @if (isTeamAdmin()) { <button class="danger" (click)="removeStatus(st)">Remove</button> }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addStatus()">
            <input aria-label="New custom status" placeholder="e.g. NEEDS_WORK (A-Z, 0-9, _)" [ngModel]="newStatus()" (ngModelChange)="newStatus.set($event)" name="newStatus" required maxlength="24" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
          }
          <p class="muted">Custom statuses appear in the editor status dropdowns and the review queue. Removing one does not change translations already carrying it.</p>
        </section>
        <section class="panel">
          <h2>In-context embedding</h2>
          <p class="muted">Origins allowed to embed the in-context editor (served by the API at /embed/projects/{{ projectId }}) in an iframe and exchange messages with it. Bare origins only (https://app.example.com - no path or trailing slash). The embedded frame answers only these origins and never exposes your session to the host page. Changes here require a signed-in session, not an API token.</p>
          <ul class="locale-list">
            @for (o of project()?.embedOrigins ?? []; track o) {
              <li>
                <code>{{ o }}</code>
                @if (isTeamAdmin()) { <button class="danger" (click)="removeOrigin(o)">Remove</button> }
              </li>
            }
            @if (!(project()?.embedOrigins ?? []).length) { <li class="muted">No origins allowlisted - the embed endpoint answers nothing yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addOrigin()">
            <input aria-label="New embed origin" placeholder="https://app.example.com" [ngModel]="newOrigin()" (ngModelChange)="newOrigin.set($event)" name="newOrigin" required />
            <button type="submit" [disabled]="busy()">Add origin</button>
          </form>
          }
        </section>
        <section class="panel">
          <h2>Machine translation (pseudo test data)</h2>
          <p class="muted"><strong>This slice ships pseudo-localization TEST DATA only - not real language translation.</strong> The pseudo provider wraps source text in brackets with accented characters so you can spot hard-coded strings and layout breakage. External MT/AI engines are NOT available in this slice; no provider configuration enables them yet. Runs fill EMPTY target cells only - existing human or reviewed values are never touched - and every filled row starts UNVERIFIED and is attributed to you in the activity log.</p>
          <ul class="locale-list">
            @for (p of mtProviders(); track p.id) {
              <li>
                <span>{{ p.name }} <span class="muted">{{ p.type }}</span></span>
                <button (click)="toggleMtProvider(p)">{{ p.enabled ? 'Disable' : 'Enable' }}</button>
                @if (isTeamAdmin()) { <button class="danger" (click)="removeMtProvider(p)">Remove</button> }
              </li>
            }
            @if (!mtProviders().length) { <li class="muted">No providers yet - add the pseudo provider to pre-translate empty cells.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addMtProvider()">
            <input aria-label="New provider name" placeholder="Provider name" [ngModel]="newMtName()" (ngModelChange)="newMtName.set($event)" name="newMtName" required />
            <select aria-label="Provider type" [ngModel]="newMtType()" (ngModelChange)="newMtType.set($event)" name="newMtType">
              <option value="pseudo">pseudo (built-in, offline)</option>
            </select>
            <button type="submit" [disabled]="busy()">Add provider</button>
          </form>
          }
          @if (mtProviders().length) {
            @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="runPretranslate()">
              <select aria-label="Pre-translate provider" [ngModel]="mtProviderId()" (ngModelChange)="mtProviderId.set($event)" name="mtProviderId">
                @for (p of mtProviders(); track p.id) { <option [value]="p.id" [disabled]="!p.enabled">{{ p.name }}</option> }
              </select>
              <select aria-label="Target locale" [ngModel]="mtLocale()" (ngModelChange)="mtLocale.set($event)" name="mtLocale">
                @for (l of project()?.locales ?? []; track l.code) {
                  @if (l.code !== project()?.baseLocale) { <option [value]="l.code">{{ l.code }}</option> }
                }
              </select>
              <select aria-label="Branch" [ngModel]="mtBranch()" (ngModelChange)="mtBranch.set($event)" name="mtBranch">
                @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
              </select>
              <button type="submit" [disabled]="busy()" title="Fill empty cells with pseudo test data">Fill empty</button>
            </form>
          }
            @if (mtResult()) { <p class="muted" role="status">{{ mtResult() }}</p> }
          }
        </section>
        <section class="panel">
          <h2>Automations</h2>
          <p class="muted">Rules fire only on the whitelisted triggers - a new key, or a base-locale write on the main branch - and only do the whitelisted internal actions: fill empty cells with pseudo TEST DATA or create a task. They never call external services. Only project admins can create rules, and creating a rule delegates YOUR authority to it: any member's edit can trigger it, but the rule acts as you, with your CURRENT permissions re-checked on every run - not as the editor who triggered it. If you are demoted, lose a locale grant, or leave the project, the run narrows or fails visibly in the activity log and the triggering edit is unaffected. Runs are best-effort and in-process: no durable queue and no retry, and a write committed while the server restarts does not replay.</p>
          <ul class="locale-list">
            @for (r of autoRules(); track r.id) {
              <li>
                <span>{{ r.name }} <span class="muted">{{ r.trigger }} &rarr; {{ ruleSummary(r) }}</span></span>
                @if (isTeamAdmin()) { <button (click)="toggleRule(r)">{{ r.enabled ? 'Disable' : 'Enable' }}</button> }
                @if (isTeamAdmin()) { <button class="danger" (click)="removeRule(r)">Remove</button> }
              </li>
            }
            @if (!autoRules().length) { <li class="muted">No rules yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addRule()">
            <input aria-label="Rule name" placeholder="Rule name" [ngModel]="newRuleName()" (ngModelChange)="newRuleName.set($event)" name="newRuleName" required />
            <select aria-label="Trigger" [ngModel]="newRuleTrigger()" (ngModelChange)="newRuleTrigger.set($event)" name="newRuleTrigger">
              <option value="translation.value">base-locale write (main)</option>
              <option value="key.created">key created (main)</option>
            </select>
            <select aria-label="Action" [ngModel]="newRuleAction()" (ngModelChange)="newRuleAction.set($event)" name="newRuleAction">
              <option value="pretranslate">fill empty cells with test data</option>
              <option value="task.create">create a task</option>
            </select>
            @if (newRuleAction() === 'pretranslate') {
              <select aria-label="Rule provider" [ngModel]="newRuleProvider()" (ngModelChange)="newRuleProvider.set($event)" name="newRuleProvider">
                @for (p of mtProviders(); track p.id) { <option [value]="p.id">{{ p.name }}</option> }
              </select>
              @for (l of project()?.locales ?? []; track l.code) {
                @if (l.code !== project()?.baseLocale) {
                  <label><input type="checkbox" [checked]="newRuleLocales().includes(l.code)" (change)="toggleRuleLocale(l.code)" name="ruleLoc-{{ l.code }}" /> {{ l.code }}</label>
                }
              }
            } @else {
              <input aria-label="Task title" placeholder="Task title ({key} = key name)" [ngModel]="newRuleTitle()" (ngModelChange)="newRuleTitle.set($event)" name="newRuleTitle" />
            }
            <button type="submit" [disabled]="busy()">Add rule</button>
          </form>
          }
        </section>
        <section class="panel">
          <h2>Members</h2>
          <ul class="locale-list">
            @for (m of members(); track m.id) {
              <li>
                <span>{{ m.displayName }} <span class="muted">{{ m.email }}</span></span>
                <span class="role-badge">{{ m.role.toLowerCase() }}</span>
                <span class="muted">{{ m.role === 'MEMBER' && m.allowedLocales.length ? 'locales: ' + m.allowedLocales.join(', ') : 'all locales' }}</span>
                @if (effectiveNote(m); as note) { <span class="muted" aria-label="Effective grant">{{ note }}</span> }
                @if (m.role !== 'OWNER' && isTeamAdmin()) {
                  <select aria-label="Role" [ngModel]="m.role" (ngModelChange)="setRole(m, $event)" name="role-{{m.id}}">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button class="danger" (click)="removeMember(m)">Remove</button>
                }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addMember()">
            <input aria-label="Member email" placeholder="User email" [ngModel]="memberEmail()" (ngModelChange)="memberEmail.set($event)" name="memberEmail" required />
            <select aria-label="New member role" [ngModel]="memberRole()" (ngModelChange)="memberRole.set($event)" name="memberRole">
              <option value="MEMBER">member</option>
              <option value="ADMIN">admin</option>
            </select>
            <input aria-label="Allowed locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="memberLocales()" (ngModelChange)="memberLocales.set($event)" name="memberLocales" />
            <button type="submit" [disabled]="busy()">Add</button>
          </form>
          }
          <p class="muted">Members join this team and can access every project in it. A locale list limits their translation writes across all of the team's projects. Project administration (settings, locales, webhooks, restores, members) requires admin.</p>
        </section>
        <section class="panel">
          <h2>Groups</h2>
          <p class="muted">Groups are team-wide grant templates: every member sees all groups and their members (there is no per-project hiding), and a group grant applies to every project in the team. A member's effective access is the UNION of their direct membership and every group they belong to: the strongest role wins, locale lists combine, and a restrictive group never reduces an unrestricted direct grant. Changes apply immediately - promoting or demoting a group changes its members' effective access on their next action.</p>
          <ul class="locale-list">
            @for (g of groups(); track g.id) {
              <li class="group-row">
                <span><strong>{{ g.name }}</strong></span>
                <span class="role-badge">{{ g.role.toLowerCase() }}</span>
                <span class="muted">{{ g.role === 'MEMBER' && g.allowedLocales.length ? 'locales: ' + g.allowedLocales.join(', ') : 'all locales' }}</span>
                @if (canManageGroup(g)) {
                  <select aria-label="Group role" [ngModel]="g.role" (ngModelChange)="setGroupRole(g, $event)" name="grole-{{g.id}}">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button class="danger" (click)="removeGroup(g)">Delete</button>
                }
              </li>
              <li class="muted group-members" style="padding-left: 1rem;">
                Members: {{ g.members.length ? '' : 'none' }}
                @for (gm of g.members; track gm.userId) {
                  <span>{{ gm.user.displayName }} @if (canManageGroup(g)) { <button class="danger" aria-label="Remove from group" (click)="removeGroupMember(g, gm.userId)">x</button> }</span>
                }
                @if (canManageGroup(g)) {
                  <select aria-label="Add member to group" name="gadd-{{g.id}}" [ngModel]="groupPick()[g.id] ?? ''" (ngModelChange)="addGroupMember(g, $event)">
                    <option value="">add member…</option>
                    @for (m of members(); track m.id) {
                      @if (!g.members.some((gm) => gm.userId === m.id)) { <option [value]="m.id">{{ m.displayName }}</option> }
                    }
                  </select>
                }
              </li>
            }
            @if (!groups().length) { <li class="muted">No groups yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="addGroup()">
            <input aria-label="Group name" placeholder="Group name" [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" name="groupName" required />
            <select aria-label="New group role" [ngModel]="groupRole()" (ngModelChange)="groupRole.set($event)" name="groupRole">
              <option value="MEMBER">member</option>
              @if (isTeamOwner()) { <option value="ADMIN">admin</option> }
            </select>
            <input aria-label="Group locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="groupLocales()" (ngModelChange)="groupLocales.set($event)" name="groupLocales" />
            <button type="submit" [disabled]="busy()">Add group</button>
          </form>
          }
        </section>
        <section class="panel">
          <h2>OTA publications</h2>
          <p class="muted">Immutable per-branch translation bundles for OTA pull. Pull requires a session or a read API token - bundles are never public. A bundle includes EVERY translation on the branch: empty values and all review statuses, not only reviewed ones.</p>
          <ul class="locale-list">
            @for (o of otaPubs(); track o.id) {
              <li>
                <span>{{ o.branch }} <span class="muted">v{{ o.version }}</span></span>
                <span class="muted">{{ o.locales.join(', ') }} - {{ o.translations }} translations - {{ o.createdAt | date:'medium' }}</span>
              </li>
            }
            @if (!otaPubs().length) { <li class="muted">No publications yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="publishOta()">
            <select aria-label="OTA branch" [ngModel]="otaBranch()" (ngModelChange)="otaBranch.set($event)" name="otaBranch">
              @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
            </select>
            <button type="submit" [disabled]="busy()">Publish bundle</button>
          </form>
          }
          @if (otaNotice()) { <p class="notice">{{ otaNotice() }}</p> }
        </section>
        @if (isTeamAdmin()) {
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
        }
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
  webhooks = signal<WebhookInfo[]>([]);
  createdWebhook = signal<{ id: string; secret: string } | null>(null);
  hookUrl = signal(''); hookTranslationUpdated = signal(true); hookProjectRestored = signal(false);
  confirmingHook = signal<string | null>(null);
  confirmingLocale = signal<string | null>(null);
  members = signal<MemberInfo[]>([]);
  groups = signal<GroupInfo[]>([]);
  groupName = signal(''); groupRole = signal('MEMBER'); groupLocales = signal('');
  groupPick = signal<Record<string, string>>({});
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
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
      this.members.set(await this.api.listMembers(this.projectId));
      this.groups.set(await this.api.listGroups(this.projectId));
      this.otaPubs.set(await this.api.listOtaPublications(this.projectId));
      this.branches.set(await this.api.listBranches(this.projectId));
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
      if (!this.mtProviderId() && this.mtProviders().length) this.mtProviderId.set(this.mtProviders()[0].id);
      if (!this.newRuleProvider() && this.mtProviders().length) this.newRuleProvider.set(this.mtProviders()[0].id);
      if (!this.mtLocale()) {
        const first = (this.project()?.locales ?? []).find((l) => l.code !== this.project()?.baseLocale);
        if (first) this.mtLocale.set(first.code);
      }
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
  async createWebhook() {
    this.busy.set(true); this.error.set('');
    const events = [
      ...(this.hookTranslationUpdated() ? ['translation.updated'] : []),
      ...(this.hookProjectRestored() ? ['project.restored'] : []),
    ];
    if (!events.length) { this.error.set('Pick at least one event'); this.busy.set(false); return; }
    try {
      const res = await this.api.createWebhook(this.projectId, { url: this.hookUrl().trim(), events });
      this.createdWebhook.set({ id: res.id, secret: res.secret });
      this.hookUrl.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async toggleHook(h: WebhookInfo) {
    this.busy.set(true); this.error.set('');
    try { await this.api.updateWebhook(this.projectId, h.id, { active: !h.active }); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async removeHook(id: string) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.deleteWebhook(this.projectId, id);
      this.confirmingHook.set(null);
      if (this.createdWebhook()?.id === id) this.createdWebhook.set(null);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
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
  readonly newOrigin = signal('');
  mtProviders = signal<MtProviderInfo[]>([]);
  newMtName = signal(''); newMtType = signal('pseudo');
  mtProviderId = signal(''); mtLocale = signal(''); mtBranch = signal('main'); mtResult = signal('');
  autoRules = signal<AutomationRuleInfo[]>([]);
  newRuleName = signal(''); newRuleTrigger = signal('translation.value'); newRuleAction = signal('pretranslate');
  newRuleProvider = signal(''); newRuleLocales = signal<string[]>([]); newRuleTitle = signal('');

  async addOrigin() {
    const origin = this.newOrigin().trim();
    if (!origin) return;
    this.busy.set(true); this.error.set('');
    try {
      const current = this.project()?.embedOrigins ?? [];
      await this.api.updateProject(this.projectId, { embedOrigins: [...current, origin] });
      this.newOrigin.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }

  async removeOrigin(origin: string) {
    this.busy.set(true); this.error.set('');
    try {
      const current = this.project()?.embedOrigins ?? [];
      await this.api.updateProject(this.projectId, { embedOrigins: current.filter((x) => x !== origin) });
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }

  async addMtProvider() {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.createMtProvider(this.projectId, this.newMtName().trim(), this.newMtType());
      this.newMtName.set('');
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
      if (!this.mtProviderId() && this.mtProviders().length) this.mtProviderId.set(this.mtProviders()[0].id);
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async toggleMtProvider(p: MtProviderInfo) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.updateMtProvider(this.projectId, p.id, { enabled: !p.enabled });
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async removeMtProvider(p: MtProviderInfo) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.deleteMtProvider(this.projectId, p.id);
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
      if (this.mtProviderId() === p.id) this.mtProviderId.set(this.mtProviders()[0]?.id ?? '');
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async runPretranslate() {
    this.busy.set(true); this.error.set(''); this.mtResult.set('');
    try {
      const r = await this.api.pretranslate(this.projectId, this.mtProviderId(), this.mtLocale(), this.mtBranch());
      const score = r.scoreAvg === null || r.scoreAvg === undefined ? '' : ` Provider score: avg ${r.scoreAvg}, min ${r.scoreMin}, max ${r.scoreMax} (structural preservation only, not linguistic quality).`;
      this.mtResult.set(`Pseudo test data (${this.mtLocale()} on ${this.mtBranch()}): ${r.translated} filled, ${r.skippedExisting} already translated (untouched), ${r.skippedNoSource} without source text.${score} Filled rows are UNVERIFIED pseudo-localization TEST DATA, not real translations.`);
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  ruleSummary(r: AutomationRuleInfo): string {
    if (r.action === 'pretranslate') {
      const locales = Array.isArray(r.config['locales']) ? (r.config['locales'] as string[]).join(', ') : '';
      return `fill ${locales} with test data`;
    }
    return `task: ${String(r.config['title'] ?? '')}`;
  }

  toggleRuleLocale(code: string) {
    this.newRuleLocales.set(this.newRuleLocales().includes(code)
      ? this.newRuleLocales().filter((l) => l !== code)
      : [...this.newRuleLocales(), code]);
  }

  async addRule() {
    this.busy.set(true); this.error.set('');
    try {
      const config = this.newRuleAction() === 'pretranslate'
        ? { providerId: this.newRuleProvider(), locales: this.newRuleLocales() }
        : { title: this.newRuleTitle() };
      await this.api.createAutomationRule(this.projectId, {
        name: this.newRuleName().trim(), trigger: this.newRuleTrigger(), action: this.newRuleAction(), config,
      });
      this.newRuleName.set(''); this.newRuleTitle.set(''); this.newRuleLocales.set([]);
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async toggleRule(r: AutomationRuleInfo) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.updateAutomationRule(this.projectId, r.id, { enabled: !r.enabled });
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async removeRule(r: AutomationRuleInfo) {
    this.busy.set(true); this.error.set('');
    try {
      await this.api.deleteAutomationRule(this.projectId, r.id);
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
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

  // Mirrors the server's union rule so inherited grants are visible:
  // strongest role wins across direct + group grants; a MEMBER-level
  // effective role unions the locale lists (empty list from any grant =
  // unrestricted). A restrictive group never shrinks a wider direct grant.
  myEmail(): string {
    try { return JSON.parse(atob((this.api.token ?? '').split('.')[1])).email ?? ''; } catch { return ''; }
  }
  private static readonly RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
  private grantsFor(m: MemberInfo) {
    return [{ role: m.role, allowedLocales: m.allowedLocales },
      ...this.groups().filter((g) => g.members.some((gm) => gm.userId === m.id)).map((g) => ({ role: g.role, allowedLocales: g.allowedLocales }))];
  }
  // Effective role = strongest across direct + group grants, mirroring the
  // server. A group-promoted admin therefore sees the controls they are
  // actually permitted to use.
  effectiveRoleOf(m: MemberInfo): string {
    return this.grantsFor(m).reduce((a, b) => (SettingsComponent.RANK[b.role] > SettingsComponent.RANK[a.role] ? b : a)).role;
  }
  private meRank(): number {
    const me = this.members().find((m) => m.email.toLowerCase() === this.myEmail().toLowerCase());
    return me ? SettingsComponent.RANK[this.effectiveRoleOf(me)] : 0;
  }
  isTeamAdmin(): boolean { return this.meRank() >= 2; }
  isTeamOwner(): boolean { return this.meRank() >= 3; }
  // Managing a group needs a role strictly above the group's role (same
  // rule the server enforces), so a direct admin gets no controls on an
  // ADMIN group.
  canManageGroup(g: GroupInfo): boolean { return this.meRank() > SettingsComponent.RANK[g.role]; }

  effectiveNote(m: MemberInfo): string | null {
    const rank: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };
    const grants = [{ role: m.role, allowedLocales: m.allowedLocales },
      ...this.groups().filter((g) => g.members.some((gm) => gm.userId === m.id)).map((g) => ({ role: g.role, allowedLocales: g.allowedLocales }))];
    if (grants.length === 1) return null;
    const role = grants.reduce((a, b) => (rank[b.role] > rank[a.role] ? b : a)).role;
    if (role !== 'MEMBER') return role === m.role ? null : `effective: ${role.toLowerCase()} via group`;
    if (grants.some((g) => g.allowedLocales.length === 0)) return m.allowedLocales.length === 0 ? null : 'effective: all locales via group';
    const union = [...new Set(grants.flatMap((g) => g.allowedLocales))].sort();
    if (union.length === m.allowedLocales.length && union.every((l) => m.allowedLocales.includes(l))) return null;
    return `effective locales: ${union.join(', ')}`;
  }
  async addGroup() {
    this.busy.set(true); this.error.set('');
    try {
      const locales = this.groupLocales().split(',').map((l) => l.trim()).filter(Boolean);
      await this.api.createGroup(this.projectId, this.groupName().trim(), this.groupRole(), locales);
      this.groupName.set(''); this.groupLocales.set('');
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async setGroupRole(g: GroupInfo, role: string) {
    this.error.set('');
    try { await this.api.updateGroup(this.projectId, g.id, { role }); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async removeGroup(g: GroupInfo) {
    if (!confirm(`Delete group ${g.name}? Its members keep their direct team access but lose this grant immediately.`)) return;
    this.error.set('');
    try { await this.api.deleteGroup(this.projectId, g.id); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async addGroupMember(g: GroupInfo, userId: string) {
    if (!userId) return;
    this.error.set('');
    try { await this.api.addGroupMember(this.projectId, g.id, userId); this.groupPick.set({ ...this.groupPick(), [g.id]: '' }); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
  }
  async removeGroupMember(g: GroupInfo, userId: string) {
    this.error.set('');
    try { await this.api.removeGroupMember(this.projectId, g.id, userId); await this.reload(); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
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
