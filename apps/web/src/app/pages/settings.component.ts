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
            <label>Name <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" aria-describedby="settingsGeneralRules" [attr.aria-invalid]="!validGeneralName()" /></label>
            <label>Description <input [ngModel]="description()" (ngModelChange)="description.set($event)" name="description" aria-describedby="settingsGeneralRules" [attr.aria-invalid]="!validGeneralDescription()" /></label>
            <button class="primary" type="submit" name="saveSettingsGeneral" [disabled]="busy() || !validGeneralName() || !validGeneralDescription()">Save</button>
          </form>
          <p class="muted" id="settingsGeneralRules" name="settingsGeneralRules">Project name: up to 120 characters; description: up to 2,000 characters using the API count. Empty text is allowed by the update API. Outer whitespace is kept; text is not truncated or automatically saved. These checks do not verify permission or newer server changes. A successful save refreshes Settings.</p>
          @if(generalDraftNotice()){<p role="status" name="settingsGeneralDraftNotice">{{ generalDraftNotice() }}</p>}
          @if(!validGeneralName() || !validGeneralDescription()){<p role="status" name="settingsGeneralInvalid">Correct the name or description before saving. Your full text stays here and is not sent.</p>}
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
            <input aria-label="Add locale" placeholder="Add locale (e.g. fr)" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required aria-describedby="settingsLocaleRules" [attr.aria-invalid]="newLocale()!=='' && !validNewLocaleCode()" />
            <button type="submit" name="addSettingsLocale" [disabled]="busy() || !validNewLocaleCode()">Add</button>
          </form>
          <p class="muted" id="settingsLocaleRules" name="settingsLocaleRules">Locale code: 2-3 lowercase letters, optionally followed by dash-separated groups of 2-8 letters or digits (for example en, pt-BR, zh-Hant-HK). Outer whitespace is trimmed when adding; text is not truncated or otherwise rewritten. This checks API syntax, not a language registry, availability or permission. A successful addition refreshes Settings.</p>
          @if(localeDraftNotice()){<p role="status" name="settingsLocaleDraftNotice">{{ localeDraftNotice() }}</p>}
          @if(newLocale()!=='' && !validNewLocaleCode()){<p role="status" name="settingsLocaleInvalid">Correct the locale code before adding. Your full code stays here and is not sent.</p>}
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
                    <a [routerLink]="['/projects',projectId,'webhooks',h.id,'deliveries']">Delivery journal</a>
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
            <input aria-label="New custom status" placeholder="e.g. NEEDS_WORK (A-Z, 0-9, _)" [ngModel]="newStatus()" (ngModelChange)="newStatus.set($event)" name="newStatus" required aria-describedby="settingsStatusRules" [attr.aria-invalid]="newStatus()!=='' && !validNewStatus()" />
            <button type="submit" name="addSettingsStatus" [disabled]="busy() || !validNewStatus()">Add</button>
          </form>
          <p class="muted" id="settingsStatusRules" name="settingsStatusRules">New custom status: 2-24 characters, starting with a letter, then letters, digits or underscores. Outer whitespace is trimmed and text is uppercased when adding, as before. UNVERIFIED, TRANSLATED and REVIEWED are base statuses, not custom names. Full input is kept without truncation. This checks the new name only, not newer server status choices or permission. A successful addition refreshes Settings.</p>
          @if(statusDraftNotice()){<p role="status" name="settingsStatusDraftNotice">{{ statusDraftNotice() }}</p>}
          @if(newStatus()!=='' && !validNewStatus()){<p role="status" name="settingsStatusInvalid">Correct the custom status before adding. Your full text stays here and is not sent.</p>}
          }
          <p class="muted">Custom statuses appear in the editor status dropdowns and the review queue. Removing one does not change translations already carrying it.</p>
        </section>
        <section class="panel">
          <h2>In-context embedding</h2>
          <p class="muted">Origins allowed to embed the in-context editor (served by the API at /embed/projects/{{ projectId }}) in an iframe and exchange messages with it. Bare origins only (https://app.example.com - no path or trailing slash). The embedded frame answers only these origins and never exposes your session to the host page. Serve /embed/host.js from the API on your page and call OpenLocaleEmbed.init with your iframe element to run the handshake and click-to-locate annotated elements (data-ol-key). Changes here require a signed-in session, not an API token.</p>
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
            <input aria-label="New embed origin" placeholder="https://app.example.com" [ngModel]="newOrigin()" (ngModelChange)="newOrigin.set($event)" name="newOrigin" required aria-describedby="settingsOriginRules" [attr.aria-invalid]="newOrigin()!=='' && !validNewOrigin()" />
            <button type="submit" name="addSettingsOrigin" [disabled]="busy() || !validNewOrigin()">Add origin</button>
          </form>
          <p class="muted" id="settingsOriginRules" name="settingsOriginRules">Use a canonical http:// or https:// bare origin, such as https://app.example.com or http://localhost:4200. No path, trailing slash, query, fragment or credentials. Outer whitespace is trimmed when adding; other text is not repaired or truncated. This checks the new origin's syntax only, not site ownership, trust, permission or newer server settings. Adding an origin allows it to embed this project's editor as described above; a successful addition refreshes Settings.</p>
          @if(originDraftNotice()){<p role="status" name="settingsOriginDraftNotice">{{ originDraftNotice() }}</p>}
          @if(newOrigin()!=='' && !validNewOrigin()){<p role="status" name="settingsOriginInvalid">Correct the origin before adding. Your full text stays here and is not sent.</p>}
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
            <input aria-label="New provider name" placeholder="Provider name" [ngModel]="newMtName()" (ngModelChange)="newMtName.set($event)" name="newMtName" aria-describedby="settingsMtNameRules" [attr.aria-invalid]="!validNewMtName()" />
            <select aria-label="Provider type" [ngModel]="newMtType()" (ngModelChange)="newMtType.set($event)" name="newMtType">
              <option value="pseudo">pseudo (built-in, offline)</option>
            </select>
            <button type="submit" name="addSettingsMtProvider" [disabled]="busy() || !validNewMtName()">Add provider</button>
          </form>
          <p class="muted" id="settingsMtNameRules" name="settingsMtNameRules">Provider name: up to 120 characters using the API count after trimming outer whitespace. Empty names are allowed by the API. Full text is kept without truncation. This checks the name only, not permission, duplicate names or provider availability. Adding this offline pseudo provider does not run pre-translation.</p>
          @if(mtDraftNotice()){<p role="status" name="settingsMtDraftNotice">{{ mtDraftNotice() }}</p>}
          @if(!validNewMtName()){<p role="status" name="settingsMtNameInvalid">Shorten the provider name before adding. Your full name and provider type stay here and are not sent.</p>}
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
          <p><a [routerLink]="['/projects',projectId,'activity']" name="automationActivityLink">Review recorded runs in Activity</a> <span class="muted">Choose "ran automation" in the action filter. This is not a complete run history or delivery receipt.</span></p>
          <p class="muted">Rules fire only on the whitelisted triggers - a new key, or a base-locale write on the main branch - and only do the whitelisted actions: fill empty cells with pseudo TEST DATA, create a task, or notify this project's registered webhooks (signed delivery to the URLs admins set up in the Webhooks panel - a rule itself cannot send anywhere else). Only project admins can create rules, and creating a rule delegates YOUR authority to it: any member's edit can trigger it, but the rule acts as you, with your CURRENT permissions re-checked on every run - not as the editor who triggered it. If you are demoted, lose a locale grant, or leave the project, the run narrows or fails visibly in the activity log and the triggering edit is unaffected. Runs are best-effort and in-process: no durable queue and no retry, and a write committed while the server restarts does not replay.</p>
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
            <input aria-label="Rule name" placeholder="Rule name" [ngModel]="newRuleName()" (ngModelChange)="newRuleName.set($event)" name="newRuleName" aria-describedby="settingsRuleNameRules" [attr.aria-invalid]="!validNewRuleName()" />
            <select aria-label="Trigger" [ngModel]="newRuleTrigger()" (ngModelChange)="newRuleTrigger.set($event)" name="newRuleTrigger">
              <option value="translation.value">base-locale write (main)</option>
              <option value="key.created">key created (main)</option>
            </select>
            <select aria-label="Action" [ngModel]="newRuleAction()" (ngModelChange)="newRuleAction.set($event)" name="newRuleAction">
              <option value="pretranslate">fill empty cells with test data</option>
              <option value="task.create">create a task</option>
              <option value="notify">notify project webhooks</option>
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
            } @else if (newRuleAction() === 'task.create') {
              <input aria-label="Task title" placeholder="Task title ({key} = key name)" [ngModel]="newRuleTitle()" (ngModelChange)="newRuleTitle.set($event)" name="newRuleTitle" aria-describedby="settingsRulePayloadRules" [attr.aria-invalid]="!validNewRulePayload()" />
            } @else {
              <input aria-label="Notification message" placeholder="Message ({key} = key name)" [ngModel]="newRuleMessage()" (ngModelChange)="newRuleMessage.set($event)" name="newRuleMessage" aria-describedby="settingsRulePayloadRules" [attr.aria-invalid]="!validNewRulePayload()" />
            }
            <button type="submit" name="addSettingsRule" [disabled]="busy() || !validNewRuleName() || !validNewRulePayload()">Add rule</button>
          </form>
          <p class="muted" id="settingsRuleNameRules" name="settingsRuleNameRules">Rule name: up to 120 characters using the API count after trimming outer whitespace. Empty names are allowed by the API. Full text is kept without truncation. This checks the name only, not permission, provider, locales or delivery; the active title or message also has limits below.</p>
          @if(ruleDraftNotice()){<p role="status" name="settingsRuleDraftNotice">{{ ruleDraftNotice() }}</p>}
          @if(!validNewRuleName()){<p role="status" name="settingsRuleNameInvalid">Shorten the rule name before adding. Your full name and rule choices stay here and are not sent.</p>}
          @if(newRuleAction()==='task.create' || newRuleAction()==='notify'){
            <p class="muted" id="settingsRulePayloadRules" name="settingsRulePayloadRules">Task title or notification message: nonblank and up to 200 UTF-16 units, as checked by the API. Some characters use two units. Outer whitespace counts and is kept; full text is not truncated. This checks the active text template only, not the rule name, permission, provider, locales or delivery. A valid rule can act on future edits as described above.</p>
            @if(!validNewRulePayload()){<p role="status" name="settingsRulePayloadInvalid">Correct the active title or message before adding the rule. Your full text and rule choices stay here and are not sent.</p>}
          }
          }
        </section>
        <section class="panel">
          <h2>Single sign-on (SAML)</h2>
          <p class="muted">Server-level sign-in configuration for this instance (set on the API server, read-only here). SAML lets team members sign in through your identity provider; accounts are created on first login, and members can also link an existing account from a signed-in session.</p>
          @if (samlInfo(); as saml) {
            @if (saml.configured) {
              <ul class="locale-list">
                <li>Status: <strong>configured</strong></li>
                <li>Service provider entity ID: <code>{{ saml.entityId }}</code></li>
                <li>Assertion consumer URL: <code>{{ saml.acsUrl }}</code></li>
                <li>Identity provider entry point: <code>{{ saml.idpEntryPoint }}</code></li>
                <li>SP metadata document: <code>{{ saml.metadataPath }}</code></li>
                <li>AuthnRequest signing: <strong>{{ saml.requestSigning ? 'on' : 'off' }}</strong></li>
              </ul>
            } @else {
              <p class="muted">Not configured. Set SAML_ENTRY_POINT and SAML_IDP_CERT on the API server to enable SAML sign-in; SAML_SP_PRIVATE_KEY and SAML_SP_SIGNING_CERT additionally enable signed requests.</p>
            }
          } @else {
            <p class="muted">Loading SAML configuration...</p>
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
            <button name="addSettingsMember" type="submit" [disabled]="busy()">Add</button>
          </form>
          @if(memberDraftNotice()){<p role="status" name="settingsMemberDraftNotice">{{ memberDraftNotice() }}</p>}
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
            <input aria-label="Group name" placeholder="Group name" [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" name="groupName" required aria-describedby="settingsGroupRules" [attr.aria-invalid]="groupName()!=='' && !validNewGroupName()" />
            <select aria-label="New group role" [ngModel]="groupRole()" (ngModelChange)="groupRole.set($event)" name="groupRole">
              <option value="MEMBER">member</option>
              @if (isTeamOwner()) { <option value="ADMIN">admin</option> }
            </select>
            <input aria-label="Group locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="groupLocales()" (ngModelChange)="groupLocales.set($event)" name="groupLocales" />
            <button type="submit" name="addSettingsGroup" [disabled]="busy() || !validNewGroupName()">Add group</button>
          </form>
          <p class="muted" id="settingsGroupRules" name="settingsGroupRules">Group name: 1-100 characters using the API count after trimming outer whitespace. Full input is kept without truncation. This checks the name only, not role, locale grants, permission or newer server changes. A successful addition refreshes Settings.</p>
          @if(groupDraftNotice()){<p role="status" name="settingsGroupDraftNotice">{{ groupDraftNotice() }}</p>}
          @if(groupName()!=='' && !validNewGroupName()){<p role="status" name="settingsGroupInvalid">Correct the group name before adding. Your full name, role and locales stay here and are not sent.</p>}
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
                @for (locale of o.locales; track locale) { <a [routerLink]="['/projects',projectId,'ota',o.version,locale]" [queryParams]="{branch:o.branch,publicationId:o.id}">Inspect {{locale}}</a> }
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
  samlInfo = signal<{ configured: boolean; entityId?: string; acsUrl?: string; metadataPath?: string; idpEntryPoint?: string; requestSigning?: boolean } | null>(null);
  projectId = '';

  constructor(private api: ApiService, route: ActivatedRoute, private router: Router) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() { await this.reload(); }
  async reload(generalSubmission?: {name:string;description:string}) {
    let loadedGeneral: {name:string;description:string}|undefined;
    try {
      const p = await this.api.getProject(this.projectId);
      this.project.set(p);
      loadedGeneral={name:p.name,description:p.description};
      if(!generalSubmission || (this.name()===generalSubmission.name && this.description()===generalSubmission.description)) {
        this.name.set(p.name); this.description.set(p.description);
      } else {
        this.generalDraftNotice.set(this.generalDraftMessage);
      }
      this.tokens.set(await this.api.listTokens());
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
      this.members.set(await this.api.listMembers(this.projectId));
      this.groups.set(await this.api.listGroups(this.projectId));
      this.otaPubs.set(await this.api.listOtaPublications(this.projectId));
      this.branches.set(await this.api.listBranches(this.projectId));
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
      this.samlInfo.set(await this.api.getSamlSpInfo());
      if (!this.mtProviderId() && this.mtProviders().length) this.mtProviderId.set(this.mtProviders()[0].id);
      if (!this.newRuleProvider() && this.mtProviders().length) this.newRuleProvider.set(this.mtProviders()[0].id);
      if (!this.mtLocale()) {
        const first = (this.project()?.locales ?? []).find((l) => l.code !== this.project()?.baseLocale);
        if (first) this.mtLocale.set(first.code);
      }
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed to load'); }
    finally {
      if(generalSubmission) {
        const saved=loadedGeneral??generalSubmission;
        this.generalDraftNotice.set(this.name()!==saved.name || this.description()!==saved.description ? this.generalDraftMessage : '');
      }
    }
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
  private generalTextLength(value:string):number {
    // Match installed class-validator/validator isLength, not UTF-16 or grapheme length.
    return value.length-(value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)||[]).length-(value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)||[]).length;
  }
  validGeneralName():boolean {return this.generalTextLength(this.name())<=120;}
  validGeneralDescription():boolean {return this.generalTextLength(this.description())<=2000;}
  generalDraftNotice = signal('');
  private readonly generalDraftMessage = 'The submitted project details were saved. Your newer name and description draft is kept here and has not been saved. Review both fields before saving again.';
  async rename() {
    if(this.busy() || !this.validGeneralName() || !this.validGeneralDescription())return;
    const submitted={name:this.name(),description:this.description()};
    this.busy.set(true); this.error.set(''); this.generalDraftNotice.set('');
    try {
      await this.api.updateProject(this.projectId, submitted);
      if(this.name()!==submitted.name || this.description()!==submitted.description)this.generalDraftNotice.set(this.generalDraftMessage);
      await this.reload(submitted);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  localeDraftNotice = signal('');
  validNewLocaleCode():boolean {return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(this.newLocale().trim());}
  async addLocale() {
    if(this.busy() || !this.validNewLocaleCode())return;
    const submitted=this.newLocale();
    this.busy.set(true); this.error.set(''); this.localeDraftNotice.set('');
    try {
      await this.api.addLocale(this.projectId, submitted.trim());
      if(this.newLocale()===submitted)this.newLocale.set('');
      else this.localeDraftNotice.set('The submitted locale was added. Your newer locale draft is kept here and has not been added. Review it before adding another locale.');
      await this.reload();
    }
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
  newRuleProvider = signal(''); newRuleLocales = signal<string[]>([]); newRuleTitle = signal(''); newRuleMessage = signal('');

  originDraftNotice = signal('');
  validNewOrigin():boolean {
    const origin=this.newOrigin().trim();
    try {const url=new URL(origin);return (url.protocol==='https:' || url.protocol==='http:') && url.origin===origin;}
    catch {return false;}
  }
  async addOrigin() {
    if(this.busy() || !this.validNewOrigin())return;
    const submitted=this.newOrigin();
    const origin = submitted.trim();
    this.busy.set(true); this.error.set(''); this.originDraftNotice.set('');
    try {
      const current = this.project()?.embedOrigins ?? [];
      await this.api.updateProject(this.projectId, { embedOrigins: [...current, origin] });
      if(this.newOrigin()===submitted)this.newOrigin.set('');
      else this.originDraftNotice.set('The submitted embed origin was saved. Your newer origin draft is kept here and has not been saved. Review it before adding another origin.');
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

  mtDraftNotice = signal('');
  validNewMtName():boolean {return this.generalTextLength(this.newMtName().trim())<=120;}
  async addMtProvider() {
    if(this.busy() || !this.validNewMtName())return;
    const submitted={name:this.newMtName(),type:this.newMtType()};
    this.busy.set(true); this.error.set(''); this.mtDraftNotice.set('');
    try {
      await this.api.createMtProvider(this.projectId, submitted.name.trim(), submitted.type);
      if(this.newMtName()===submitted.name && this.newMtType()===submitted.type) {
        this.newMtName.set('');
      } else {
        this.mtDraftNotice.set('The submitted provider was added. Your newer provider draft is kept here and has not been added. Review it before adding another provider.');
      }
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
      const pluralSkip = r.skippedPlural ? ` ${r.skippedPlural} plural keys skipped (scalar-only test provider; forms need real translation).` : '';
      this.mtResult.set(`Pseudo test data (${this.mtLocale()} on ${this.mtBranch()}): ${r.translated} filled, ${r.skippedExisting} already translated (untouched), ${r.skippedNoSource} without source text.${pluralSkip}${score} Filled rows are UNVERIFIED pseudo-localization TEST DATA, not real translations.`);
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  ruleSummary(r: AutomationRuleInfo): string {
    if (r.action === 'pretranslate') {
      const locales = Array.isArray(r.config['locales']) ? (r.config['locales'] as string[]).join(', ') : '';
      return `fill ${locales} with test data`;
    }
    if (r.action === 'notify') return `notify webhooks: ${String(r.config['message'] ?? '')}`;
    return `task: ${String(r.config['title'] ?? '')}`;
  }

  toggleRuleLocale(code: string) {
    this.newRuleLocales.set(this.newRuleLocales().includes(code)
      ? this.newRuleLocales().filter((l) => l !== code)
      : [...this.newRuleLocales(), code]);
  }

  ruleDraftNotice = signal('');
  private ruleDraft() {return {name:this.newRuleName(),trigger:this.newRuleTrigger(),action:this.newRuleAction(),provider:this.newRuleProvider(),locales:[...this.newRuleLocales()],title:this.newRuleTitle(),message:this.newRuleMessage()};}
  validNewRuleName():boolean {return this.generalTextLength(this.newRuleName().trim())<=120;}
  validNewRulePayload():boolean {
    const action=this.newRuleAction();
    if(action!=='task.create' && action!=='notify')return true;
    const text=action==='notify'?this.newRuleMessage():this.newRuleTitle();
    return text.trim().length>0 && text.length<=200;
  }
  async addRule() {
    if(this.busy() || !this.validNewRuleName() || !this.validNewRulePayload())return;
    const submitted=this.ruleDraft();
    this.busy.set(true); this.error.set(''); this.ruleDraftNotice.set('');
    try {
      const config = submitted.action === 'pretranslate'
        ? { providerId: submitted.provider, locales: submitted.locales }
        : submitted.action === 'notify'
          ? { message: submitted.message }
          : { title: submitted.title };
      await this.api.createAutomationRule(this.projectId, {
        name: submitted.name.trim(), trigger: submitted.trigger, action: submitted.action, config,
      });
      if(JSON.stringify(this.ruleDraft())===JSON.stringify(submitted)) {
        this.newRuleName.set(''); this.newRuleTitle.set(''); this.newRuleMessage.set(''); this.newRuleLocales.set([]);
      } else {
        this.ruleDraftNotice.set('The submitted rule was saved. Your newer rule draft is kept here and has not been saved. Review it before adding another rule.');
      }
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

  statusDraftNotice = signal('');
  validNewStatus():boolean {
    const value=this.newStatus().trim().toUpperCase();
    return /^[A-Z][A-Z0-9_]{1,23}$/.test(value) && !['UNVERIFIED','TRANSLATED','REVIEWED'].includes(value);
  }
  async addStatus() {
    if(this.busy() || !this.validNewStatus())return;
    const submitted=this.newStatus();
    this.busy.set(true); this.error.set(''); this.statusDraftNotice.set('');
    try {
      const current = this.project()?.customStatuses ?? [];
      await this.api.updateProject(this.projectId, { customStatuses: [...current, submitted.trim().toUpperCase()] });
      if(this.newStatus()===submitted)this.newStatus.set('');
      else this.statusDraftNotice.set('The submitted custom status was saved. Your newer custom status draft is kept here and has not been saved. Review it before adding another status.');
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
  memberDraftNotice = signal('');
  async addMember() {
    if(this.busy())return;
    const submitted={email:this.memberEmail(),role:this.memberRole(),locales:this.memberLocales()};
    this.busy.set(true); this.error.set(''); this.memberDraftNotice.set('');
    try {
      const locales = submitted.locales.split(',').map((l) => l.trim()).filter(Boolean);
      await this.api.addMember(this.projectId, submitted.email.trim(), submitted.role, locales);
      if(this.memberEmail()===submitted.email && this.memberRole()===submitted.role && this.memberLocales()===submitted.locales) {
        this.memberEmail.set(''); this.memberLocales.set('');
      } else {
        this.memberDraftNotice.set('The submitted membership was saved. Your newer member draft is kept here and has not been saved. Review the email, role and locales before adding again.');
      }
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
  groupDraftNotice = signal('');
  validNewGroupName():boolean {const name=this.groupName().trim();return name.length>0 && this.generalTextLength(name)<=100;}
  async addGroup() {
    if(this.busy() || !this.validNewGroupName())return;
    const submitted={name:this.groupName(),role:this.groupRole(),locales:this.groupLocales()};
    this.busy.set(true); this.error.set(''); this.groupDraftNotice.set('');
    try {
      const locales = submitted.locales.split(',').map((l) => l.trim()).filter(Boolean);
      await this.api.createGroup(this.projectId, submitted.name.trim(), submitted.role, locales);
      if(this.groupName()===submitted.name && this.groupRole()===submitted.role && this.groupLocales()===submitted.locales) {
        this.groupName.set(''); this.groupLocales.set('');
      } else {
        this.groupDraftNotice.set('The submitted group was created. Your newer group draft is kept here and has not been created. Review its role and locales before adding another group.');
      }
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
