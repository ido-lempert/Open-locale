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
          <button type="button" name="discardSettingsGeneral" (click)="discardGeneralDraft()" [disabled]="!canDiscardGeneralDraft()">Discard unsaved edits</button>
          <p class="muted">Discard only resets the local project name and description to last loaded or accepted values. It does not refresh the server or undo saved changes; other forms stay as they are.</p>
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
                  <span>Remove <strong>{{ l.code }}</strong>? This cannot be undone. All translations for this locale and their history are deleted across all branches, including empty rows. The loaded default-branch preview contains {{ localeTxCount() }} nonempty translation{{ localeTxCount() === 1 ? '' : 's' }}; it is not a total deletion count. Saved rules and local locale choices are not repaired. Review them before running work.</span>
                  <button class="danger" [attr.name]="'confirmRemoveLocale-'+l.code" (click)="removeLocale(l.code)" [disabled]="busy()">Yes, remove</button>
                  <button [attr.name]="'cancelRemoveLocale-'+l.code" (click)="cancelRemoveLocale()" [disabled]="busy()">Cancel</button>
                }
                @else if (isTeamAdmin()) { <button class="danger" [attr.name]="'startRemoveLocale-'+l.code" (click)="askRemoveLocale(l.code)" [disabled]="busy()">Remove</button> }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          @if(localeRemoveNotice()){<p role="status" name="settingsLocaleRemoveNotice">{{localeRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addLocale()">
            <input aria-label="Add locale" placeholder="Add locale (e.g. fr)" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required aria-describedby="settingsLocaleRules" [attr.aria-invalid]="newLocale()!=='' && !validNewLocaleCode()" />
            <button type="submit" name="addSettingsLocale" [disabled]="busy() || !validNewLocaleCode()">Add</button>
          </form>
          <button type="button" name="discardSettingsLocale" (click)="discardLocaleDraft()" [disabled]="!canDiscardLocaleDraft()">Discard locale draft</button>
          <p class="muted">Discard only clears the local add-locale field. It does not refresh Settings or remove any saved locale; other forms stay as they are.</p>
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
                  <span>Revoke <strong>{{ tok.name }}</strong>? Scripts using it stop immediately. This cannot be undone.</span>
                  <button class="danger" [attr.name]="'confirmRevokeToken-'+tok.id" (click)="revokeToken(tok.id)" [disabled]="busy()">Yes, revoke</button>
                  <button [attr.name]="'cancelRevokeToken-'+tok.id" (click)="cancelRevokeToken()" [disabled]="busy()">Cancel</button>
                } @else {
                  <button class="danger" [attr.name]="'startRevokeToken-'+tok.id" (click)="askRevokeToken(tok.id)" [disabled]="busy()">Revoke</button>
                }
              </li>
            }
          </ul>
          @if(tokenRevokeNotice()){<p role="status" name="settingsTokenRevokeNotice">{{tokenRevokeNotice()}}</p>}
          <form class="inline" (ngSubmit)="createToken()">
            <input aria-label="Token name" placeholder="Token name (e.g. ci)" [ngModel]="tokenName()" (ngModelChange)="tokenName.set($event)" name="tokenName" required />
            <select aria-label="Token access" [ngModel]="tokenScope()" (ngModelChange)="tokenScope.set($event)" name="tokenScope">
              <option value="read">read-only</option>
              <option value="read,write">read + write</option>
            </select>
            <button name="createSettingsToken" type="submit" [disabled]="busy()">Create</button>
          </form>
          <button type="button" name="discardSettingsTokenName" (click)="discardTokenNameDraft()" [disabled]="!canDiscardTokenNameDraft()">Discard name draft</button>
          <p class="muted">Discard only clears the local token name. Selected access stays. It does not refresh Settings, revoke saved tokens or hide the token revealed above; other forms stay as they are.</p>
          @if(tokenDraftNotice()){<p role="status" name="settingsTokenDraftNotice">{{ tokenDraftNotice() }}</p>}
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
                    <span>Delete this webhook and its delivery history? Deliveries stop immediately. This cannot be undone.</span>
                    <button class="danger" [attr.name]="'confirmDeleteHook-'+h.id" (click)="removeHook(h.id)" [disabled]="busy()">Yes, delete</button>
                    <button [attr.name]="'cancelDeleteHook-'+h.id" (click)="cancelDeleteHook()" [disabled]="busy()">Cancel</button>
                  } @else {
                    <a [routerLink]="['/projects',projectId,'webhooks',h.id,'deliveries']">Delivery journal</a>
                    <button [attr.name]="'toggleHook-'+h.id" (click)="toggleHook(h)" [disabled]="busy()">{{ h.active ? 'Disable' : 'Enable' }}</button>
                    <button class="danger" [attr.name]="'startDeleteHook-'+h.id" (click)="askDeleteHook(h.id)" [disabled]="busy()">Delete</button>
                  }
                }
              </li>
            }
            @if (!webhooks().length) { <li class="muted">No webhooks yet.</li> }
          </ul>
          @if(hookToggleNotice()){<p role="status" name="settingsHookToggleNotice">{{hookToggleNotice()}}</p>}
          @if(hookDeleteNotice()){<p role="status" name="settingsHookDeleteNotice">{{hookDeleteNotice()}}</p>}
          @if (isTeamAdmin()) {
          <form class="inline" (ngSubmit)="createWebhook()">
            <input type="url" aria-label="Webhook URL" placeholder="https://example.com/hook" [ngModel]="hookUrl()" (ngModelChange)="hookUrl.set($event)" name="hookUrl" required />
            <label><input type="checkbox" [ngModel]="hookTranslationUpdated()" (ngModelChange)="hookTranslationUpdated.set($event)" name="hookEvTx" /> translation.updated</label>
            <label><input type="checkbox" [ngModel]="hookProjectRestored()" (ngModelChange)="hookProjectRestored.set($event)" name="hookEvRestore" /> project.restored</label>
            <button name="createSettingsWebhook" type="submit" [disabled]="busy()">Create</button>
          </form>
          <button type="button" name="discardSettingsWebhookUrl" (click)="discardWebhookUrlDraft()" [disabled]="!canDiscardWebhookUrlDraft()">Discard URL draft</button>
          <p class="muted">Discard only clears the local webhook URL. Selected events stay. It does not refresh Settings, delete saved webhooks or hide the signing secret above; other forms stay as they are.</p>
          @if(hookDraftNotice()){<p role="status" name="settingsWebhookDraftNotice">{{ hookDraftNotice() }}</p>}
          }
        </section>
        <section class="panel">
          <h2>Review statuses</h2>
          <ul class="locale-list">
            <li><span class="badge">unverified</span><span class="badge">translated</span><span class="badge">reviewed</span> <span class="muted">base statuses, always available</span></li>
            @for (st of project()?.customStatuses ?? []; track st) {
              <li>
                <span class="badge">{{ st.toLowerCase() }}</span>
                @if (isTeamAdmin()) {
                  @if(confirmingStatus()===st){
                    <span>Remove this custom status? Translations already carrying it are not changed. The currently loaded custom-status list, minus this status, will replace the saved list.</span>
                    <button class="danger" [attr.name]="'confirmRemoveStatus-'+$index" (click)="removeStatus(st)" [disabled]="busy()">Yes, remove</button>
                    <button [attr.name]="'cancelRemoveStatus-'+$index" (click)="cancelRemoveStatus()" [disabled]="busy()">Cancel</button>
                  } @else {<button class="danger" [attr.name]="'startRemoveStatus-'+$index" (click)="askRemoveStatus(st)" [disabled]="busy()">Remove</button>}
                }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          @if(statusRemoveNotice()){<p role="status" name="settingsStatusRemoveNotice">{{statusRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addStatus()">
            <input aria-label="New custom status" placeholder="e.g. NEEDS_WORK (A-Z, 0-9, _)" [ngModel]="newStatus()" (ngModelChange)="newStatus.set($event)" name="newStatus" required aria-describedby="settingsStatusRules" [attr.aria-invalid]="newStatus()!=='' && !validNewStatus()" />
            <button type="submit" name="addSettingsStatus" [disabled]="busy() || !validNewStatus()">Add</button>
          </form>
          <button type="button" name="discardSettingsStatus" (click)="discardStatusDraft()" [disabled]="!canDiscardStatusDraft()">Discard status draft</button>
          <p class="muted">Discard only clears the local new-status field. It does not refresh Settings or remove any saved status; other forms stay as they are.</p>
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
                @if (isTeamAdmin()) {
                  @if(confirmingOrigin()===o){
                    <span>Remove this origin? It will no longer be allowlisted for this project's embed endpoint. This does not sign users out or promise to close frames already open. The currently loaded list, minus this origin, will replace the saved list.</span>
                    <button class="danger" [attr.name]="'confirmRemoveOrigin-'+$index" (click)="removeOrigin(o)" [disabled]="busy()">Yes, remove</button>
                    <button [attr.name]="'cancelRemoveOrigin-'+$index" (click)="cancelRemoveOrigin()" [disabled]="busy()">Cancel</button>
                  } @else {<button class="danger" [attr.name]="'startRemoveOrigin-'+$index" (click)="askRemoveOrigin(o)" [disabled]="busy()">Remove</button>}
                }
              </li>
            }
            @if (!(project()?.embedOrigins ?? []).length) { <li class="muted">No origins allowlisted - the embed endpoint answers nothing yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          @if(originRemoveNotice()){<p role="status" name="settingsOriginRemoveNotice">{{originRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addOrigin()">
            <input aria-label="New embed origin" placeholder="https://app.example.com" [ngModel]="newOrigin()" (ngModelChange)="newOrigin.set($event)" name="newOrigin" required aria-describedby="settingsOriginRules" [attr.aria-invalid]="newOrigin()!=='' && !validNewOrigin()" />
            <button type="submit" name="addSettingsOrigin" [disabled]="busy() || !validNewOrigin()">Add origin</button>
          </form>
          <button type="button" name="discardSettingsOrigin" (click)="discardOriginDraft()" [disabled]="!canDiscardOriginDraft()">Discard origin draft</button>
          <p class="muted">Discard only clears the local new-origin field. It does not refresh Settings or remove any saved origin; other forms stay as they are.</p>
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
                <button [attr.name]="'toggleMtProvider-'+p.id" (click)="toggleMtProvider(p)" [disabled]="busy()">{{ p.enabled ? 'Disable' : 'Enable' }}</button>
                @if (isTeamAdmin()) {
                  @if(confirmingMtProvider()===p.id){
                    <span>Remove <strong>{{p.name}}</strong>? This cannot be undone. Existing translations are not undone. Saved rules referencing it are not repaired and may fail; work already in progress may finish.</span>
                    <button class="danger" [attr.name]="'confirmRemoveMtProvider-'+p.id" (click)="removeMtProvider(p)" [disabled]="busy()">Yes, remove</button>
                    <button [attr.name]="'cancelRemoveMtProvider-'+p.id" (click)="cancelRemoveMtProvider()" [disabled]="busy()">Cancel</button>
                  } @else {<button class="danger" [attr.name]="'startRemoveMtProvider-'+p.id" (click)="askRemoveMtProvider(p.id)" [disabled]="busy()">Remove</button>}
                }
              </li>
            }
            @if (!mtProviders().length) { <li class="muted">No providers yet - add the pseudo provider to pre-translate empty cells.</li> }
          </ul>
          @if (isTeamAdmin()) {
          @if(mtToggleNotice()){<p role="status" name="settingsMtToggleNotice">{{mtToggleNotice()}}</p>}
          @if(mtRemoveNotice()){<p role="status" name="settingsMtRemoveNotice">{{mtRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addMtProvider()">
            <input aria-label="New provider name" placeholder="Provider name" [ngModel]="newMtName()" (ngModelChange)="newMtName.set($event)" name="newMtName" aria-describedby="settingsMtNameRules" [attr.aria-invalid]="!validNewMtName()" />
            <select aria-label="Provider type" [ngModel]="newMtType()" (ngModelChange)="newMtType.set($event)" name="newMtType">
              <option value="pseudo">pseudo (built-in, offline)</option>
            </select>
            <button type="submit" name="addSettingsMtProvider" [disabled]="busy() || !validNewMtName()">Add provider</button>
          </form>
          <button type="button" name="discardSettingsMtName" (click)="discardMtNameDraft()" [disabled]="!canDiscardMtNameDraft()">Discard provider name draft</button>
          <p class="muted">Discard only clears the local provider name. Provider type stays. It does not refresh Settings, remove saved providers or run pre-translation; other forms, pre-translation choices and results stay as they are.</p>
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
              <button name="runSettingsPretranslate" type="submit" [disabled]="busy()" title="Fill empty cells with pseudo test data">Fill empty</button>
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
                @if (isTeamAdmin()) { <button [attr.name]="'toggleRule-'+r.id" (click)="toggleRule(r)" [disabled]="busy()">{{ r.enabled ? 'Disable' : 'Enable' }}</button> }
                @if (isTeamAdmin()) {
                  @if(confirmingRule()===r.id){
                    <span>Remove <strong>{{r.name}}</strong>? This cannot be undone. Earlier effects are not undone, and a run already in progress may finish.</span>
                    <button class="danger" [attr.name]="'confirmRemoveRule-'+r.id" (click)="removeRule(r)" [disabled]="busy()">Yes, remove</button>
                    <button [attr.name]="'cancelRemoveRule-'+r.id" (click)="cancelRemoveRule()" [disabled]="busy()">Cancel</button>
                  } @else {<button class="danger" [attr.name]="'startRemoveRule-'+r.id" (click)="askRemoveRule(r.id)" [disabled]="busy()">Remove</button>}
                }
              </li>
            }
            @if (!autoRules().length) { <li class="muted">No rules yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          @if(ruleToggleNotice()){<p role="status" name="settingsRuleToggleNotice">{{ruleToggleNotice()}}</p>}
          @if(ruleRemoveNotice()){<p role="status" name="settingsRuleRemoveNotice">{{ruleRemoveNotice()}}</p>}
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
          <button type="button" name="discardSettingsRuleName" (click)="discardRuleNameDraft()" [disabled]="!canDiscardRuleNameDraft()">Discard rule name draft</button>
          <p class="muted">Discard only clears the local rule name. Trigger, action, provider, locales, title and message stay. It does not refresh Settings, change saved rules or run an action; other forms stay as they are.</p>
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
                  <select aria-label="Role" [ngModel]="memberRolePick()[m.id] ?? m.role" (ngModelChange)="pickMemberRole(m.id, $event)" [attr.name]="'role-'+m.id">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button type="button" name="role-save-{{m.id}}" (click)="setMemberRole(m)" [disabled]="!canSaveMemberRole(m)">{{ memberRolePending()[m.id] ? 'Saving role...' : 'Save role' }}</button>
                  <span class="muted">Selection alone does not change access. Save role applies the direct team role; group grants still combine.</span>
                  @if(memberRoleNotice()[m.id]){<p role="status" [attr.name]="'role-notice-'+m.id">{{ memberRoleNotice()[m.id] }}</p>}
                  @if(m.role === 'MEMBER') {
                    <label>Direct write locales <input [attr.name]="'member-locales-'+m.id" [ngModel]="memberLocalesPick()[m.id] ?? m.allowedLocales.join(', ')" (ngModelChange)="pickMemberLocales(m.id, $event)" [attr.aria-describedby]="'member-locales-help-'+m.id" [attr.aria-invalid]="!validMemberLocales(m)" /></label>
                    <button type="button" [attr.name]="'member-locales-save-'+m.id" (click)="saveMemberLocales(m)" [disabled]="!canSaveMemberLocales(m)">{{ memberLocalesPending()[m.id] ? 'Saving locales...' : 'Save locales' }}</button>
                    <span class="muted" [attr.id]="'member-locales-help-'+m.id">Comma-separated locale codes from this project. Blank grants all locales. This changes direct translation-write access across the team, not project visibility. Group grants can widen access. Typing does not save.</span>
                    @if(!validMemberLocales(m)){<p role="status">Use only locale codes from this project, separated by commas without empty entries. Leave the field completely blank only to grant all locales.</p>}
                    @if(memberLocalesNotice()[m.id]){<p role="status" [attr.name]="'member-locales-notice-'+m.id">{{ memberLocalesNotice()[m.id] }}</p>}
                  }
                  <button type="button" [attr.name]="'member-discard-'+m.id" (click)="discardMemberDrafts(m.id)" [disabled]="!canDiscardMemberDrafts(m.id)">Discard unsaved edits</button>
                  <span class="muted">Discard only clears this member's local role and locale drafts. It uses the last loaded or accepted values, does not refresh the server and does not undo saved changes.</span>
                  @if(confirmingMember()===m.id){
                    <span>Remove <strong>{{m.displayName}}</strong> ({{m.email}}) from the team? They lose access to every project in this team, not only this project. Their user account, saved group memberships, task assignments, tasks and translations remain. Re-adding them to this team can reactivate their saved group grants. Work already in progress may finish.</span>
                    <button class="danger" [attr.name]="'confirmRemoveMember-'+m.id" (click)="removeMember(m)" [disabled]="busy() || memberWorkPending(m.id)">Yes, remove from team</button>
                    <button [attr.name]="'cancelRemoveMember-'+m.id" (click)="cancelRemoveMember()" [disabled]="busy()">Cancel</button>
                  }@else{<button class="danger" [attr.name]="'startRemoveMember-'+m.id" (click)="askRemoveMember(m.id)" [disabled]="busy() || memberWorkPending(m.id) || !removableMember(m.id)">Remove</button>}
                }
              </li>
            }
          </ul>
          @if (isTeamAdmin()) {
          @if(memberRemoveNotice()){<p role="status" name="settingsMemberRemoveNotice">{{memberRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addMember()">
            <input aria-label="Member email" placeholder="User email" [ngModel]="memberEmail()" (ngModelChange)="memberEmail.set($event)" name="memberEmail" required />
            <select aria-label="New member role" [ngModel]="memberRole()" (ngModelChange)="memberRole.set($event)" name="memberRole">
              <option value="MEMBER">member</option>
              <option value="ADMIN">admin</option>
            </select>
            <input aria-label="Allowed locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="memberLocales()" (ngModelChange)="memberLocales.set($event)" name="memberLocales" />
            <button name="addSettingsMember" type="submit" [disabled]="busy()">Add</button>
          </form>
          <button type="button" name="discardSettingsMemberEmail" (click)="discardMemberEmailDraft()" [disabled]="!canDiscardMemberEmailDraft()">Discard member email draft</button>
          <p class="muted">Discard only clears the local add-member email. Selected role and locales stay. It does not refresh Settings, send an invitation or change anyone's saved membership or access; other forms stay as they are.</p>
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
                  <label>Group name <input [attr.name]="'group-name-'+g.id" [ngModel]="groupNamePick()[g.id] ?? g.name" (ngModelChange)="pickGroupName(g.id, $event)" [attr.aria-describedby]="'group-name-help-'+g.id" [attr.aria-invalid]="!validGroupName(g)" /></label>
                  <button type="button" [attr.name]="'group-name-save-'+g.id" (click)="saveGroupName(g)" [disabled]="!canSaveGroupName(g)">{{ groupNamePending()[g.id] ? 'Saving name...' : 'Save name' }}</button>
                  <span class="muted" [attr.id]="'group-name-help-'+g.id">Nonempty name, up to 100 characters after trimming. Save name renames this team-wide group without changing its members, grants or task assignments. Typing does not save.</span>
                  @if(!validGroupName(g)){<p role="status">Enter a nonempty group name of up to 100 characters. Your full text stays here and is not sent.</p>}
                  @if(groupNameNotice()[g.id]){<p role="status" [attr.name]="'group-name-notice-'+g.id">{{ groupNameNotice()[g.id] }}</p>}
                  <select aria-label="Group role" [ngModel]="groupRolePick()[g.id] ?? g.role" (ngModelChange)="pickGroupRole(g.id, $event)" [attr.name]="'grole-'+g.id">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button type="button" name="grole-save-{{g.id}}" (click)="setGroupRole(g)" [disabled]="!canSaveGroupRole(g)">{{ groupRolePending()[g.id] ? 'Saving role...' : 'Save role' }}</button>
                  <span class="muted">Selection alone does not change access. Save role applies this group's team-wide grant.</span>
                  @if(groupRoleNotice()[g.id]){<p role="status" [attr.name]="'grole-notice-'+g.id">{{ groupRoleNotice()[g.id] }}</p>}
                  @if(g.role === 'MEMBER') {
                    <label>Group write locales <input [attr.name]="'group-locales-'+g.id" [ngModel]="groupLocalesPick()[g.id] ?? g.allowedLocales.join(', ')" (ngModelChange)="pickGroupLocales(g.id, $event)" [attr.aria-describedby]="'group-locales-help-'+g.id" [attr.aria-invalid]="!validGroupLocales(g)" /></label>
                    <button type="button" [attr.name]="'group-locales-save-'+g.id" (click)="saveGroupLocales(g)" [disabled]="!canSaveGroupLocales(g)">{{ groupLocalesPending()[g.id] ? 'Saving locales...' : 'Save locales' }}</button>
                    <span class="muted" [attr.id]="'group-locales-help-'+g.id">Comma-separated locale codes from this project. Blank grants all locales. This changes this grant for every group member across every team project. Other grants still combine; this does not hide projects. Typing does not save.</span>
                    @if(!validGroupLocales(g)){<p role="status">Use only locale codes from this project, separated by commas without empty entries. Leave the field completely blank only to grant all locales.</p>}
                    @if(groupLocalesNotice()[g.id]){<p role="status" [attr.name]="'group-locales-notice-'+g.id">{{ groupLocalesNotice()[g.id] }}</p>}
                  }
                  <button type="button" [attr.name]="'group-discard-'+g.id" (click)="discardGroupDrafts(g.id)" [disabled]="!canDiscardGroupDrafts(g.id)">Discard unsaved edits</button>
                  <span class="muted">Discard only clears this group's local name, role, locale and add-member drafts. It uses the last loaded or accepted values, does not refresh the server and does not undo saved changes.</span>
                  @if(confirmingGroup()===g.id){
                    <span>Delete group <strong>{{g.name}}</strong>? This cannot be undone. This removes the group and its grant across the team, not only this project. Direct team membership and other group grants remain. Tasks assigned to this group become unassigned; tasks and translations are not deleted.</span>
                    <button class="danger" [attr.name]="'confirmRemoveGroup-'+g.id" (click)="removeGroup(g)" [disabled]="busy() || groupWorkPending(g.id)">Yes, delete group</button>
                    <button [attr.name]="'cancelRemoveGroup-'+g.id" (click)="cancelRemoveGroup()" [disabled]="busy()">Cancel</button>
                  }@else{<button class="danger" [attr.name]="'startRemoveGroup-'+g.id" (click)="askRemoveGroup(g.id)" [disabled]="busy() || groupWorkPending(g.id)">Delete</button>}
                }
              </li>
              <li class="muted group-members" style="padding-left: 1rem;">
                Members: {{ g.members.length ? '' : 'none' }}
                @for (gm of g.members; track gm.userId) {
                  <span>{{ gm.user.displayName }} @if (canManageGroup(g)) {
                    @if(confirmingGroupMember()?.groupId===g.id && confirmingGroupMember()?.userId===gm.userId){
                      <span>Remove <strong>{{gm.user.displayName}}</strong> from <strong>{{g.name}}</strong>? This removes this group's grant for them across the team, not only this project. Direct team membership and other group grants remain. Group task assignments, tasks and translations are not changed.</span>
                      <button class="danger" [attr.name]="'confirmRemoveGroupMember-'+g.id+'-'+gm.userId" (click)="removeGroupMember(g,gm.userId)" [disabled]="busy() || groupWorkPending(g.id)">Yes, remove from group</button>
                      <button [attr.name]="'cancelRemoveGroupMember-'+g.id+'-'+gm.userId" (click)="cancelRemoveGroupMember()" [disabled]="busy()">Cancel</button>
                    }@else{<button class="danger" aria-label="Remove from group" [attr.name]="'startRemoveGroupMember-'+g.id+'-'+gm.userId" [disabled]="busy() || groupWorkPending(g.id)" (click)="askRemoveGroupMember(g.id,gm.userId)">Remove from group</button>}
                  }</span>
                }
                @if (canManageGroup(g)) {
                  <select aria-label="Add member to group" [attr.name]="'gadd-'+g.id" [ngModel]="groupPick()[g.id] ?? ''" (ngModelChange)="pickGroupMember(g.id, $event)">
                    <option value="">add member…</option>
                    @for (m of members(); track m.id) {
                      @if (!g.members.some((gm) => gm.userId === m.id)) { <option [value]="m.id">{{ m.displayName }}</option> }
                    }
                  </select>
                  <button type="button" name="gadd-submit-{{g.id}}" (click)="addGroupMember(g)" [disabled]="deletingGroup()===g.id || !groupPick()[g.id] || groupMemberPending()[g.id]">{{ groupMemberPending()[g.id] ? 'Adding member...' : 'Add member' }}</button>
                  <span class="muted">Selection alone does not add access. Choose Add member to apply this group's grant.</span>
                  @if(groupMemberNotice()[g.id]){<p role="status" [attr.name]="'gadd-notice-'+g.id">{{ groupMemberNotice()[g.id] }}</p>}
                }
              </li>
            }
            @if (!groups().length) { <li class="muted">No groups yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          @if(groupMemberRemoveNotice()){<p role="status" name="settingsGroupMemberRemoveNotice">{{groupMemberRemoveNotice()}}</p>}
          @if(groupRemoveNotice()){<p role="status" name="settingsGroupRemoveNotice">{{groupRemoveNotice()}}</p>}
          <form class="inline" (ngSubmit)="addGroup()">
            <input aria-label="Group name" placeholder="Group name" [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" name="groupName" required aria-describedby="settingsGroupRules" [attr.aria-invalid]="groupName()!=='' && !validNewGroupName()" />
            <select aria-label="New group role" [ngModel]="groupRole()" (ngModelChange)="groupRole.set($event)" name="groupRole">
              <option value="MEMBER">member</option>
              @if (isTeamOwner()) { <option value="ADMIN">admin</option> }
            </select>
            <input aria-label="Group locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="groupLocales()" (ngModelChange)="groupLocales.set($event)" name="groupLocales" />
            <button type="submit" name="addSettingsGroup" [disabled]="busy() || !validNewGroupName()">Add group</button>
          </form>
          <button type="button" name="discardSettingsGroupName" (click)="discardGroupNameDraft()" [disabled]="!canDiscardGroupNameDraft()">Discard group name draft</button>
          <p class="muted">Discard only clears the local new-group name. Selected role and locales stay. It does not refresh Settings, change saved groups or change anyone's access; other forms stay as they are.</p>
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
          @if (projectDeletionAccepted()) {
            <p role="status" name="projectDeletedNotice">The project was deleted. <a routerLink="/projects">Return to projects</a>. Local fields on this page are no longer saved project state.</p>
          } @else if (!confirming()) {
            <button class="danger-outline" name="startDeleteProject" (click)="askDeleteProject()" [disabled]="busy()">Delete project…</button>
          } @else {
            <p>Delete <strong>{{ p.name }}</strong> and all its keys and translations? This cannot be undone.</p>
            <button class="danger-solid" name="confirmDeleteProject" (click)="remove()" [disabled]="busy()">Yes, delete permanently</button>
            <button name="cancelDeleteProject" (click)="cancelDeleteProject()" [disabled]="busy()">Cancel</button>
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
  canDiscardTokenNameDraft():boolean {return !this.busy() && this.tokenName()!=='';}
  discardTokenNameDraft() {
    if(!this.canDiscardTokenNameDraft())return;
    this.tokenName.set('');
    if(this.tokenDraftNotice())this.tokenDraftNotice.set('The submitted token was created. The local name draft was discarded without refreshing Settings or revoking any saved token. Selected access stays for your next explicit Create. The token revealed above belongs to the submitted token.');
  }
  tokenDraftNotice = signal('');
  async createToken() {
    if(this.busy())return;
    const submitted={name:this.tokenName(),scope:this.tokenScope()};
    this.busy.set(true); this.error.set(''); this.tokenDraftNotice.set('');
    try {
      const scopes = submitted.scope.split(',');
      const res = await this.api.createToken(submitted.name, scopes);
      this.createdToken.set({ id: res.id, name: res.name, token: res.token });
      if(this.tokenName()===submitted.name && this.tokenScope()===submitted.scope) {
        this.tokenName.set('');
      } else {
        this.tokenDraftNotice.set('The submitted token was created. Your newer name and access draft is kept here and has not been created. Review the name and access before creating again. The token revealed above belongs to the submitted token, not this newer draft.');
      }
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  async copyToken(value: string) {
    try { await navigator.clipboard.writeText(value); } catch { /* clipboard unavailable */ }
  }
  canDiscardWebhookUrlDraft():boolean {return !this.busy() && this.hookUrl()!=='';}
  discardWebhookUrlDraft() {
    if(!this.canDiscardWebhookUrlDraft())return;
    this.hookUrl.set('');
    if(this.hookDraftNotice())this.hookDraftNotice.set('The submitted webhook was created. The local URL draft was discarded without refreshing Settings or deleting any saved webhook. Selected events stay for your next explicit Create. The signing secret above belongs to the submitted webhook.');
  }
  hookDraftNotice = signal('');
  async createWebhook() {
    if(this.busy())return;
    const submitted={url:this.hookUrl(),translationUpdated:this.hookTranslationUpdated(),projectRestored:this.hookProjectRestored()};
    this.busy.set(true); this.error.set('');
    const events = [
      ...(submitted.translationUpdated ? ['translation.updated'] : []),
      ...(submitted.projectRestored ? ['project.restored'] : []),
    ];
    if (!events.length) { this.error.set('Pick at least one event'); this.busy.set(false); return; }
    this.hookDraftNotice.set('');
    try {
      const res = await this.api.createWebhook(this.projectId, { url: submitted.url.trim(), events });
      this.createdWebhook.set({ id: res.id, secret: res.secret });
      if(this.hookUrl()===submitted.url && this.hookTranslationUpdated()===submitted.translationUpdated && this.hookProjectRestored()===submitted.projectRestored) {
        this.hookUrl.set('');
      } else {
        this.hookDraftNotice.set('The submitted webhook was created. Your newer URL and event draft is kept here and has not been created. Review the URL and events before creating again. The signing secret above belongs to the submitted webhook, not this newer draft.');
      }
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  hookToggleNotice = signal('');
  async toggleHook(h: WebhookInfo) {
    const loaded=this.webhooks().find(row=>row.id===h.id);
    if(this.busy() || !loaded || loaded.active!==h.active)return;
    const active=!loaded.active;
    this.busy.set(true);this.error.set('');this.hookToggleNotice.set('');
    try {
      await this.api.updateWebhook(this.projectId,loaded.id,{active});
      this.webhooks.set(this.webhooks().map(row=>row.id===loaded.id?{...row,active}:row));
      this.hookToggleNotice.set(`The submitted webhook was ${active?'enabled':'disabled'}. Its URL, events, signing secret and delivery history were not changed by this request. Work already in progress may finish. Other webhooks and your unsaved forms are kept.`);
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.busy.set(false);}
  }
  hookDeleteNotice = signal('');
  askDeleteHook(id:string) {if(!this.busy() && this.webhooks().some(h=>h.id===id))this.confirmingHook.set(id);}
  cancelDeleteHook() {if(!this.busy())this.confirmingHook.set(null);}
  async removeHook(id: string) {
    if(this.busy() || this.confirmingHook()!==id || !this.webhooks().some(h=>h.id===id))return;
    this.busy.set(true); this.error.set(''); this.hookDeleteNotice.set('');
    try {
      await this.api.deleteWebhook(this.projectId, id);
      this.webhooks.set(this.webhooks().filter(h=>h.id!==id));
      this.hookDeleteNotice.set('The submitted webhook and its delivery history were deleted. Other webhooks were not deleted by this request.');
      this.confirmingHook.set(null);
      if (this.createdWebhook()?.id === id) this.createdWebhook.set(null);
      await this.reload();
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  tokenRevokeNotice = signal('');
  askRevokeToken(id:string) {if(!this.busy() && this.tokens().some(t=>t.id===id))this.confirmingToken.set(id);}
  cancelRevokeToken() {if(!this.busy())this.confirmingToken.set(null);}
  async revokeToken(id: string) {
    if(this.busy() || this.confirmingToken()!==id || !this.tokens().some(t=>t.id===id))return;
    this.busy.set(true); this.error.set(''); this.tokenRevokeNotice.set('');
    try {
      await this.api.revokeToken(id);
      this.tokens.set(this.tokens().filter(t=>t.id!==id));
      this.tokenRevokeNotice.set('The submitted API token was revoked. Other tokens were not revoked by this request.');
      this.confirmingToken.set(null);
      if (this.createdToken()?.id === id) this.createdToken.set(null);
      await this.reload();
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  localeRemoveNotice = signal('');
  private removableLocale(code:string):boolean {return !!this.project()?.locales.some(l=>l.code===code) && code!==this.project()?.baseLocale;}
  cancelRemoveLocale() {if(!this.busy())this.confirmingLocale.set(null);}
  async askRemoveLocale(code: string) {
    if(this.busy() || !this.removableLocale(code))return;
    this.busy.set(true); this.error.set('');
    try {
      const keys = await this.api.listKeys(this.projectId);
      this.localeTxCount.set(
        keys.reduce((n, k) => n + k.translations.filter((t) => t.localeCode === code && t.value !== '').length, 0),
      );
      if(this.removableLocale(code))this.confirmingLocale.set(code);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally {this.busy.set(false);}
  }
  private generalTextLength(value:string):number {
    // Match installed class-validator/validator isLength, not UTF-16 or grapheme length.
    return value.length-(value.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)||[]).length-(value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)||[]).length;
  }
  validGeneralName():boolean {return this.generalTextLength(this.name())<=120;}
  validGeneralDescription():boolean {return this.generalTextLength(this.description())<=2000;}
  canDiscardGeneralDraft():boolean {
    const p=this.project();
    return !!p && !this.busy() && (this.name()!==p.name || this.description()!==p.description);
  }
  discardGeneralDraft() {
    if(!this.canDiscardGeneralDraft())return;
    const p=this.project()!;this.name.set(p.name);this.description.set(p.description);
    if(this.generalDraftNotice())this.generalDraftNotice.set('The submitted project details were saved. Local name and description drafts were discarded without refreshing or undoing saved changes.');
  }
  generalDraftNotice = signal('');
  private readonly generalDraftMessage = 'The submitted project details were saved. Your newer name and description draft is kept here and has not been saved. Review both fields before saving again.';
  async rename() {
    if(this.busy() || !this.validGeneralName() || !this.validGeneralDescription())return;
    const submitted={name:this.name(),description:this.description()};
    this.busy.set(true); this.error.set(''); this.generalDraftNotice.set('');
    try {
      await this.api.updateProject(this.projectId, submitted);
      const accepted=this.project();if(accepted)this.project.set({...accepted,...submitted});
      if(this.name()!==submitted.name || this.description()!==submitted.description)this.generalDraftNotice.set(this.generalDraftMessage);
      await this.reload(submitted);
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  canDiscardLocaleDraft():boolean {return !this.busy() && this.newLocale()!=='';}
  discardLocaleDraft() {
    if(!this.canDiscardLocaleDraft())return;
    this.newLocale.set('');
    if(this.localeDraftNotice())this.localeDraftNotice.set('The submitted locale was added. The local add-locale draft was discarded without refreshing Settings or removing any saved locale.');
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
    if(this.busy() || this.confirmingLocale()!==code || !this.removableLocale(code))return;
    this.busy.set(true); this.error.set(''); this.localeRemoveNotice.set('');
    try {
      await this.api.removeLocale(this.projectId, code);
      this.project.update(project=>project?{...project,locales:project.locales.filter(l=>l.code!==code)}:project);
      this.confirmingLocale.set(null);
      this.localeRemoveNotice.set('The submitted locale was removed with its translations and their history across all branches. Other locales were not removed by this request. Saved rules and local locale choices are not repaired; review them before running work. Your add-locale draft and other forms are kept.');
      this.project.set(await this.api.getProject(this.projectId));
    }
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

  canDiscardOriginDraft():boolean {return !this.busy() && this.newOrigin()!=='';}
  discardOriginDraft() {
    if(!this.canDiscardOriginDraft())return;
    this.newOrigin.set('');
    if(this.originDraftNotice())this.originDraftNotice.set('The submitted embed origin was saved. The local new-origin draft was discarded without refreshing Settings or removing any saved origin.');
  }
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

  confirmingOrigin = signal<string|null>(null);
  originRemoveNotice = signal('');
  askRemoveOrigin(origin:string) {if(!this.busy() && this.project()?.embedOrigins?.includes(origin))this.confirmingOrigin.set(origin);}
  cancelRemoveOrigin() {if(!this.busy())this.confirmingOrigin.set(null);}
  async removeOrigin(origin: string) {
    if(this.busy() || this.confirmingOrigin()!==origin || !this.project()?.embedOrigins?.includes(origin))return;
    const embedOrigins=(this.project()?.embedOrigins ?? []).filter(x=>x!==origin);
    this.busy.set(true); this.error.set(''); this.originRemoveNotice.set('');
    try {
      await this.api.updateProject(this.projectId, { embedOrigins });
      this.project.update(project=>project?{...project,embedOrigins}:project);
      this.confirmingOrigin.set(null);
      this.originRemoveNotice.set('The submitted allowlist was saved without the selected origin. This replaced the saved list using the previously loaded origins; it did not sign users out or close frames already open. Your new-origin draft and other forms are kept.');
      this.project.set(await this.api.getProject(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }

  canDiscardMtNameDraft():boolean {return !this.busy() && this.newMtName()!=='';}
  discardMtNameDraft() {
    if(!this.canDiscardMtNameDraft())return;
    this.newMtName.set('');
    if(this.mtDraftNotice())this.mtDraftNotice.set('The submitted provider was added. The local provider name draft was discarded without refreshing Settings, removing saved providers or running pre-translation. Provider type stays for your next explicit Add provider.');
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

  mtToggleNotice = signal('');
  async toggleMtProvider(p: MtProviderInfo) {
    const loaded=this.mtProviders().find(row=>row.id===p.id);
    if(this.busy() || !loaded || loaded.enabled!==p.enabled)return;
    const enabled=!loaded.enabled;
    this.busy.set(true);this.error.set('');this.mtToggleNotice.set('');
    try {
      await this.api.updateMtProvider(this.projectId,loaded.id,{enabled});
      this.mtProviders.set(this.mtProviders().map(row=>row.id===loaded.id?{...row,enabled}:row));
      this.mtToggleNotice.set(`The submitted pseudo test-data provider was ${enabled?'enabled':'disabled'}. This did not run Fill empty or undo existing translations. Provider selection, saved rules and your unsaved forms are kept. Work already in progress may finish.`);
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:String(e));}
    finally{this.busy.set(false);}
  }

  confirmingMtProvider = signal<string|null>(null);
  mtRemoveNotice = signal('');
  askRemoveMtProvider(id:string) {if(!this.busy() && this.mtProviders().some(p=>p.id===id))this.confirmingMtProvider.set(id);}
  cancelRemoveMtProvider() {if(!this.busy())this.confirmingMtProvider.set(null);}
  async removeMtProvider(p: MtProviderInfo) {
    if(this.busy() || this.confirmingMtProvider()!==p.id || !this.mtProviders().some(provider=>provider.id===p.id))return;
    this.busy.set(true); this.error.set(''); this.mtRemoveNotice.set('');
    try {
      await this.api.deleteMtProvider(this.projectId, p.id);
      this.mtProviders.set(this.mtProviders().filter(provider=>provider.id!==p.id));
      if (this.mtProviderId() === p.id) this.mtProviderId.set(this.mtProviders()[0]?.id ?? '');
      this.confirmingMtProvider.set(null);
      this.mtRemoveNotice.set('The submitted provider was removed. Other providers and existing translations were not removed by this request. Saved rules referencing it are not repaired and may fail; work already in progress may finish. If it was selected for Fill empty, the first remaining provider is now selected, or none if no providers remain. Review that selection before running.');
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  async runPretranslate() {
    if(this.busy())return;
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

  canDiscardRuleNameDraft():boolean {return !this.busy() && this.newRuleName()!=='';}
  discardRuleNameDraft() {
    if(!this.canDiscardRuleNameDraft())return;
    this.newRuleName.set('');
    if(this.ruleDraftNotice())this.ruleDraftNotice.set('The submitted rule was saved. The local rule name draft was discarded without refreshing Settings, changing saved rules or running an action. Trigger, action, provider, locales, title and message stay for your next explicit Add rule.');
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

  ruleToggleNotice = signal('');
  async toggleRule(r: AutomationRuleInfo) {
    const loaded=this.autoRules().find(row=>row.id===r.id);
    if(this.busy() || !loaded || loaded.enabled!==r.enabled)return;
    const enabled=!loaded.enabled;
    this.busy.set(true);this.error.set('');this.ruleToggleNotice.set('');
    try {
      await this.api.updateAutomationRule(this.projectId,loaded.id,{enabled});
      this.autoRules.set(this.autoRules().map(row=>row.id===loaded.id?{...row,enabled}:row));
      this.ruleToggleNotice.set(`The submitted rule was ${enabled?'enabled':'disabled'}. This did not run the rule or undo its earlier effects. Its trigger, action, configuration and creator were not changed by this request. Other rules and unsaved forms are kept. A run already in progress may finish.`);
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:String(e));}
    finally{this.busy.set(false);}
  }

  confirmingRule = signal<string|null>(null);
  ruleRemoveNotice = signal('');
  askRemoveRule(id:string) {if(!this.busy() && this.autoRules().some(r=>r.id===id))this.confirmingRule.set(id);}
  cancelRemoveRule() {if(!this.busy())this.confirmingRule.set(null);}
  async removeRule(r: AutomationRuleInfo) {
    if(this.busy() || this.confirmingRule()!==r.id || !this.autoRules().some(rule=>rule.id===r.id))return;
    this.busy.set(true); this.error.set(''); this.ruleRemoveNotice.set('');
    try {
      await this.api.deleteAutomationRule(this.projectId, r.id);
      this.autoRules.set(this.autoRules().filter(rule=>rule.id!==r.id));
      this.confirmingRule.set(null);
      this.ruleRemoveNotice.set('The submitted automation rule was removed. Other rules were not removed by this request. Earlier effects are not undone, and a run already in progress may finish.');
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : String(e)); } finally { this.busy.set(false); }
  }

  canDiscardStatusDraft():boolean {return !this.busy() && this.newStatus()!=='';}
  discardStatusDraft() {
    if(!this.canDiscardStatusDraft())return;
    this.newStatus.set('');
    if(this.statusDraftNotice())this.statusDraftNotice.set('The submitted custom status was saved. The local new-status draft was discarded without refreshing Settings or removing any saved status.');
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
  confirmingStatus = signal<string|null>(null);
  statusRemoveNotice = signal('');
  askRemoveStatus(st:string) {if(!this.busy() && this.project()?.customStatuses?.includes(st))this.confirmingStatus.set(st);}
  cancelRemoveStatus() {if(!this.busy())this.confirmingStatus.set(null);}
  async removeStatus(st: string) {
    if(this.busy() || this.confirmingStatus()!==st || !this.project()?.customStatuses?.includes(st))return;
    const customStatuses=(this.project()?.customStatuses ?? []).filter(x=>x!==st);
    this.busy.set(true); this.error.set(''); this.statusRemoveNotice.set('');
    try {
      await this.api.updateProject(this.projectId, { customStatuses });
      this.project.update(project=>project?{...project,customStatuses}:project);
      this.confirmingStatus.set(null);
      this.statusRemoveNotice.set('The submitted custom-status list was saved without the selected status. This replaced the saved list using the previously loaded statuses. Existing translations were not changed by this request. Your new-status draft and other forms are kept.');
      this.project.set(await this.api.getProject(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  canDiscardMemberEmailDraft():boolean {return !this.busy() && this.memberEmail()!=='';}
  discardMemberEmailDraft() {
    if(!this.canDiscardMemberEmailDraft())return;
    this.memberEmail.set('');
    if(this.memberDraftNotice())this.memberDraftNotice.set('The submitted membership was saved. The local add-member email draft was discarded without refreshing Settings or changing saved membership or access. Selected role and locales stay for your next explicit Add.');
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
  canDiscardGroupNameDraft():boolean {return !this.busy() && this.groupName()!=='';}
  discardGroupNameDraft() {
    if(!this.canDiscardGroupNameDraft())return;
    this.groupName.set('');
    if(this.groupDraftNotice())this.groupDraftNotice.set('The submitted group was created. The local new-group name draft was discarded without refreshing Settings or changing saved groups or access. Selected role and locales stay for your next explicit Add group.');
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
  groupRolePick = signal<Record<string, string>>({});
  groupRolePending = signal<Record<string, boolean>>({});
  groupRoleNotice = signal<Record<string, string>>({});
  pickGroupRole(groupId: string, role: string) {
    this.groupRolePick.set({ ...this.groupRolePick(), [groupId]: role });
  }
  canSaveGroupRole(g: GroupInfo): boolean {
    const role=this.groupRolePick()[g.id];
    return this.deletingGroup()!==g.id && !this.groupNamePending()[g.id] && !this.groupRolePending()[g.id] && !this.groupLocalesPending()[g.id] && (role==='MEMBER' || role==='ADMIN') && role!==g.role;
  }
  async setGroupRole(g: GroupInfo) {
    if(!this.canSaveGroupRole(g))return;
    const role=this.groupRolePick()[g.id];
    this.groupRolePending.set({ ...this.groupRolePending(), [g.id]: true });
    this.groupRoleNotice.set({ ...this.groupRoleNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { role });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,role}:row));
      if(this.groupRolePick()[g.id]===role){const next={...this.groupRolePick()};delete next[g.id];this.groupRolePick.set(next);}
      this.groupRoleNotice.set({ ...this.groupRoleNotice(), [g.id]: 'The submitted group role was saved. Any newer role selection has not been saved by this request. Review the current group role before saving again.' });
      await this.reload();
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.groupRolePending.set({ ...this.groupRolePending(), [g.id]: false }); }
  }
  groupNamePick = signal<Record<string, string>>({});
  groupNamePending = signal<Record<string, boolean>>({});
  groupNameNotice = signal<Record<string, string>>({});
  pickGroupName(groupId: string, value: string) {
    this.groupNamePick.set({ ...this.groupNamePick(), [groupId]: value });
  }
  validGroupName(g: GroupInfo): boolean {
    const name=(this.groupNamePick()[g.id] ?? g.name).trim();
    return name.length>0 && this.generalTextLength(name)<=100;
  }
  canSaveGroupName(g: GroupInfo): boolean {
    const raw=this.groupNamePick()[g.id];
    return this.deletingGroup()!==g.id && raw!==undefined && !this.groupNamePending()[g.id] && !this.groupRolePending()[g.id] && !this.groupLocalesPending()[g.id] && this.validGroupName(g) && raw.trim()!==g.name;
  }
  async saveGroupName(g: GroupInfo) {
    if(!this.canSaveGroupName(g))return;
    const raw=this.groupNamePick()[g.id],name=raw.trim();
    this.groupNamePending.set({ ...this.groupNamePending(), [g.id]: true });
    this.groupNameNotice.set({ ...this.groupNameNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { name });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,name}:row));
      if(this.groupNamePick()[g.id]===raw){const next={...this.groupNamePick()};delete next[g.id];this.groupNamePick.set(next);}
      this.groupNameNotice.set({ ...this.groupNameNotice(), [g.id]: 'The submitted group name was saved. Any newer name text has not been saved by this request. Review the current group name before saving again.' });
      await this.reload();
    }
    catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.groupNamePending.set({ ...this.groupNamePending(), [g.id]: false });}
  }

  canDiscardGroupDrafts(groupId: string): boolean {
    if(this.deletingGroup()===groupId || this.groupNamePending()[groupId] || this.groupRolePending()[groupId] || this.groupLocalesPending()[groupId] || this.groupMemberPending()[groupId])return false;
    return this.groupNamePick()[groupId]!==undefined || this.groupRolePick()[groupId]!==undefined || this.groupLocalesPick()[groupId]!==undefined || !!this.groupPick()[groupId];
  }
  discardGroupDrafts(groupId: string) {
    if(!this.canDiscardGroupDrafts(groupId))return;
    for(const state of [this.groupNamePick,this.groupRolePick,this.groupLocalesPick,this.groupPick]) {
      const next={...state()};delete next[groupId];state.set(next);
    }
  }

  confirmingGroup = signal<string|null>(null);
  deletingGroup = signal<string|null>(null);
  groupRemoveNotice = signal('');
  groupWorkPending(id:string):boolean {return !!(this.groupNamePending()[id] || this.groupRolePending()[id] || this.groupLocalesPending()[id] || this.groupMemberPending()[id]);}
  askRemoveGroup(id:string) {if(!this.busy() && !this.groupWorkPending(id) && this.groups().some(g=>g.id===id))this.confirmingGroup.set(id);}
  cancelRemoveGroup() {if(!this.busy())this.confirmingGroup.set(null);}
  async removeGroup(g: GroupInfo) {
    if(this.busy() || this.groupWorkPending(g.id) || this.confirmingGroup()!==g.id || !this.groups().some(row=>row.id===g.id))return;
    this.busy.set(true);this.deletingGroup.set(g.id);this.error.set('');this.groupRemoveNotice.set('');
    try {
      await this.api.deleteGroup(this.projectId,g.id);
      this.groups.set(this.groups().filter(row=>row.id!==g.id));
      this.confirmingGroup.set(null);
      this.groupRemoveNotice.set('The submitted group and its grant were deleted across the team. Direct team membership and other group grants remain. Tasks assigned to it are now unassigned; tasks and translations were not deleted. Other group edits, your new-group draft and other forms are kept.');
      this.groups.set(await this.api.listGroups(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.deletingGroup.set(null);this.busy.set(false);}
  }
  groupMemberPending = signal<Record<string, boolean>>({});
  groupMemberNotice = signal<Record<string, string>>({});
  pickGroupMember(groupId: string, userId: string) {
    this.groupPick.set({ ...this.groupPick(), [groupId]: userId });
  }
  async addGroupMember(g: GroupInfo) {
    const userId=this.groupPick()[g.id];
    if (!userId || this.deletingGroup()===g.id || this.groupMemberPending()[g.id]) return;
    this.groupMemberPending.set({ ...this.groupMemberPending(), [g.id]: true });
    this.groupMemberNotice.set({ ...this.groupMemberNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.addGroupMember(this.projectId, g.id, userId);
      if(this.groupPick()[g.id]===userId)this.groupPick.set({ ...this.groupPick(), [g.id]: '' });
      this.groupMemberNotice.set({ ...this.groupMemberNotice(), [g.id]: 'The submitted member was added. Any selection shown here has not been added by this request. Choose Add member to apply it.' });
      await this.reload();
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.groupMemberPending.set({ ...this.groupMemberPending(), [g.id]: false }); }
  }
  confirmingGroupMember = signal<{groupId:string,userId:string}|null>(null);
  groupMemberRemoveNotice = signal('');
  private hasGroupMember(groupId:string,userId:string):boolean {return !!this.groups().find(g=>g.id===groupId)?.members.some(m=>m.userId===userId);}
  askRemoveGroupMember(groupId:string,userId:string) {if(!this.busy() && !this.groupWorkPending(groupId) && this.hasGroupMember(groupId,userId))this.confirmingGroupMember.set({groupId,userId});}
  cancelRemoveGroupMember() {if(!this.busy())this.confirmingGroupMember.set(null);}
  async removeGroupMember(g: GroupInfo, userId: string) {
    const target=this.confirmingGroupMember();
    if(this.busy() || this.deletingGroup()===g.id || this.groupWorkPending(g.id) || target?.groupId!==g.id || target?.userId!==userId || !this.hasGroupMember(g.id,userId))return;
    this.busy.set(true);this.deletingGroup.set(g.id);
    this.groupMemberPending.set({...this.groupMemberPending(),[g.id]:true});
    this.error.set('');this.groupMemberRemoveNotice.set('');
    try {
      await this.api.removeGroupMember(this.projectId,g.id,userId);
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,members:row.members.filter(m=>m.userId!==userId)}:row));
      this.confirmingGroupMember.set(null);
      this.groupMemberRemoveNotice.set('The submitted member was removed from this group. This group grant no longer applies to them across the team. Direct team membership and other group grants remain. Group task assignments, tasks and translations were not changed. Your group edits, new-group draft and other forms are kept.');
      this.groups.set(await this.api.listGroups(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.groupMemberPending.set({...this.groupMemberPending(),[g.id]:false});this.deletingGroup.set(null);this.busy.set(false);}
  }
  canDiscardMemberDrafts(memberId: string): boolean {
    if(this.removingMember()===memberId || this.memberRolePending()[memberId] || this.memberLocalesPending()[memberId])return false;
    return this.memberRolePick()[memberId]!==undefined || this.memberLocalesPick()[memberId]!==undefined;
  }
  discardMemberDrafts(memberId: string) {
    if(!this.canDiscardMemberDrafts(memberId))return;
    for(const state of [this.memberRolePick,this.memberLocalesPick]) {
      const next={...state()};delete next[memberId];state.set(next);
    }
  }

  memberRolePick = signal<Record<string, string>>({});
  memberRolePending = signal<Record<string, boolean>>({});
  memberRoleNotice = signal<Record<string, string>>({});
  pickMemberRole(memberId: string, role: string) {
    this.memberRolePick.set({ ...this.memberRolePick(), [memberId]: role });
  }
  canSaveMemberRole(m: MemberInfo): boolean {
    const role=this.memberRolePick()[m.id];
    return this.removingMember()!==m.id && !this.memberRolePending()[m.id] && !this.memberLocalesPending()[m.id] && (role==='MEMBER' || role==='ADMIN') && role!==m.role;
  }
  async setMemberRole(m: MemberInfo) {
    if(!this.canSaveMemberRole(m))return;
    const role=this.memberRolePick()[m.id];
    this.memberRolePending.set({ ...this.memberRolePending(), [m.id]: true });
    this.memberRoleNotice.set({ ...this.memberRoleNotice(), [m.id]: '' });
    this.error.set('');
    try {
      await this.api.updateMember(this.projectId, m.id, { role });
      this.members.set(this.members().map(row=>row.id===m.id?{...row,role}:row));
      if(this.memberRolePick()[m.id]===role){const next={...this.memberRolePick()};delete next[m.id];this.memberRolePick.set(next);}
      this.memberRoleNotice.set({ ...this.memberRoleNotice(), [m.id]: 'The submitted direct team role was saved. Any newer role selection has not been saved by this request. Review the current direct team role before saving again.' });
      await this.reload();
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.memberRolePending.set({ ...this.memberRolePending(), [m.id]: false }); }
  }

  memberLocalesPick = signal<Record<string, string>>({});
  memberLocalesPending = signal<Record<string, boolean>>({});
  memberLocalesNotice = signal<Record<string, string>>({});
  pickMemberLocales(memberId: string, value: string) {
    this.memberLocalesPick.set({ ...this.memberLocalesPick(), [memberId]: value });
  }
  private parsedMemberLocales(raw: string): string[] {
    return [...new Set(raw.split(',').map(code=>code.trim()).filter(Boolean))];
  }
  validMemberLocales(m: MemberInfo): boolean {
    const raw=this.memberLocalesPick()[m.id];
    if(raw===undefined)return true;
    const project=this.project();
    return !!project && (raw.trim()==='' || raw.split(',').every(part=>part.trim()!=='' && project.locales.some(locale=>locale.code===part.trim())));
  }
  canSaveMemberLocales(m: MemberInfo): boolean {
    const raw=this.memberLocalesPick()[m.id];
    if(this.removingMember()===m.id || m.role!=='MEMBER' || raw===undefined || this.memberLocalesPending()[m.id] || this.memberRolePending()[m.id] || !this.validMemberLocales(m))return false;
    const locales=this.parsedMemberLocales(raw);
    return locales.length!==m.allowedLocales.length || locales.some(code=>!m.allowedLocales.includes(code));
  }
  async saveMemberLocales(m: MemberInfo) {
    if(!this.canSaveMemberLocales(m))return;
    const raw=this.memberLocalesPick()[m.id],allowedLocales=this.parsedMemberLocales(raw);
    this.memberLocalesPending.set({ ...this.memberLocalesPending(), [m.id]: true });
    this.memberLocalesNotice.set({ ...this.memberLocalesNotice(), [m.id]: '' });
    this.error.set('');
    try {
      await this.api.updateMember(this.projectId, m.id, { allowedLocales });
      this.members.set(this.members().map(row=>row.id===m.id?{...row,allowedLocales}:row));
      if(this.memberLocalesPick()[m.id]===raw){const next={...this.memberLocalesPick()};delete next[m.id];this.memberLocalesPick.set(next);}
      this.memberLocalesNotice.set({ ...this.memberLocalesNotice(), [m.id]: 'The submitted direct locale scope was saved. Any newer locale text has not been saved by this request. Group grants still combine; review effective access before saving again.' });
      await this.reload();
    }
    catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.memberLocalesPending.set({ ...this.memberLocalesPending(), [m.id]: false });}
  }

  groupLocalesPick = signal<Record<string, string>>({});
  groupLocalesPending = signal<Record<string, boolean>>({});
  groupLocalesNotice = signal<Record<string, string>>({});
  pickGroupLocales(groupId: string, value: string) {
    this.groupLocalesPick.set({ ...this.groupLocalesPick(), [groupId]: value });
  }
  private parsedGroupLocales(raw: string): string[] {
    return [...new Set(raw.split(',').map(code=>code.trim()).filter(Boolean))];
  }
  validGroupLocales(g: GroupInfo): boolean {
    const raw=this.groupLocalesPick()[g.id];
    if(raw===undefined)return true;
    const project=this.project();
    return !!project && (raw.trim()==='' || raw.split(',').every(part=>part.trim()!=='' && project.locales.some(locale=>locale.code===part.trim())));
  }
  canSaveGroupLocales(g: GroupInfo): boolean {
    const raw=this.groupLocalesPick()[g.id];
    if(this.deletingGroup()===g.id || g.role!=='MEMBER' || raw===undefined || this.groupNamePending()[g.id] || this.groupLocalesPending()[g.id] || this.groupRolePending()[g.id] || !this.validGroupLocales(g))return false;
    const locales=this.parsedGroupLocales(raw);
    return locales.length!==g.allowedLocales.length || locales.some(code=>!g.allowedLocales.includes(code));
  }
  async saveGroupLocales(g: GroupInfo) {
    if(!this.canSaveGroupLocales(g))return;
    const raw=this.groupLocalesPick()[g.id],allowedLocales=this.parsedGroupLocales(raw);
    this.groupLocalesPending.set({ ...this.groupLocalesPending(), [g.id]: true });
    this.groupLocalesNotice.set({ ...this.groupLocalesNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { allowedLocales });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,allowedLocales}:row));
      if(this.groupLocalesPick()[g.id]===raw){const next={...this.groupLocalesPick()};delete next[g.id];this.groupLocalesPick.set(next);}
      this.groupLocalesNotice.set({ ...this.groupLocalesNotice(), [g.id]: 'The submitted group locale scope was saved. Any newer locale text has not been saved by this request. Other grants still combine; review effective access before saving again.' });
      await this.reload();
    }
    catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.groupLocalesPending.set({ ...this.groupLocalesPending(), [g.id]: false });}
  }

  confirmingMember = signal<string|null>(null);
  removingMember = signal<string|null>(null);
  memberRemoveNotice = signal('');
  removableMember(id:string):boolean {const m=this.members().find(row=>row.id===id);return !!m && m.role!=='OWNER' && m.email.toLowerCase()!==this.myEmail().toLowerCase();}
  memberWorkPending(id:string):boolean {return !!(this.memberRolePending()[id] || this.memberLocalesPending()[id]);}
  askRemoveMember(id:string) {if(!this.busy() && !this.memberWorkPending(id) && this.removableMember(id))this.confirmingMember.set(id);}
  cancelRemoveMember() {if(!this.busy())this.confirmingMember.set(null);}
  async removeMember(m: MemberInfo) {
    if(this.busy() || this.memberWorkPending(m.id) || this.confirmingMember()!==m.id || !this.removableMember(m.id))return;
    this.busy.set(true);this.removingMember.set(m.id);this.error.set('');this.memberRemoveNotice.set('');
    try {
      await this.api.removeMember(this.projectId,m.id);
      this.members.set(this.members().filter(row=>row.id!==m.id));
      this.confirmingMember.set(null);
      this.memberRemoveNotice.set('The submitted member was removed from this team and loses access to every project in it. Their user account, saved group memberships, task assignments, tasks and translations remain. Re-adding them can reactivate saved group grants. Work already in progress may finish. Your other member edits, add-member draft and other forms are kept.');
      this.members.set(await this.api.listMembers(this.projectId));
    }catch(e){this.error.set(e instanceof Error?e.message:'Failed');}
    finally{this.removingMember.set(null);this.busy.set(false);}
  }
  projectDeletionAccepted = signal(false);
  askDeleteProject() {if(!this.busy() && !this.projectDeletionAccepted())this.confirming.set(true);}
  cancelDeleteProject() {if(!this.busy())this.confirming.set(false);}
  async remove() {
    if(this.busy() || !this.confirming() || this.projectDeletionAccepted())return;
    this.busy.set(true); this.error.set('');
    try { await this.api.deleteProject(this.projectId); this.projectDeletionAccepted.set(true); this.confirming.set(false); await this.router.navigate(['/projects']); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); this.busy.set(false); }
  }
}
