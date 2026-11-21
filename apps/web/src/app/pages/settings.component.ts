import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
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
          <button type="button" name="refreshSettingsGeneralMetadata" [disabled]="!canRefreshGeneralMetadata()" aria-describedby="settingsGeneralMetadataRefreshScope" (click)="refreshGeneralMetadata()">Refresh loaded details</button>
          <p class="muted" id="settingsGeneralMetadataRefreshScope">Reads project metadata and updates the loaded name and description only. Your current inputs, other drafts, choices, earlier results and other loaded settings stay. Discard unsaved edits will use these newly loaded values. This does not save or replace your inputs, merge changes or check current permission. Save remains explicit and can replace newer server details.</p>
          @if(generalMetadataRefreshing()){<p role="status" name="settingsGeneralMetadataRefreshing">Refreshing loaded name and description. Your current inputs stay.</p>}
          @if(generalMetadataRefreshNotice()){<p role="status" name="settingsGeneralMetadataRefreshNotice">{{generalMetadataRefreshNotice()}}</p>}

          <div class="loaded-general" aria-labelledby="settingsLoadedGeneralHeading">
            <h3 id="settingsLoadedGeneralHeading">Loaded details</h3>
            <p class="muted">Last loaded or accepted values, not a live server check. Editable inputs, when available, may differ. Refresh loaded details updates this display without replacing editable inputs.</p>
            <dl>
              <dt>Loaded name</dt>
              <dd name="settingsLoadedGeneralName">@if(p.name === ''){<span class="muted">Empty name</span>}@else{@if(p.name.trim() === ''){<span class="muted">Whitespace-only name</span>}<span class="loaded-general-value">{{p.name}}</span>}</dd>
              <dt>Loaded description</dt>
              <dd name="settingsLoadedGeneralDescription">@if(p.description === ''){<span class="muted">Empty description</span>}@else{@if(p.description.trim() === ''){<span class="muted">Whitespace-only description</span>}<span class="loaded-general-value">{{p.description}}</span>}</dd>
            </dl>
          </div>
          @if (isTeamAdmin()) {
          <p role="status" name="settingsGeneralInputComparison">{{generalInputComparison()}}</p>
          <form (ngSubmit)="rename()">
            <label>Name <input [ngModel]="name()" (ngModelChange)="name.set($event)" name="name" aria-describedby="settingsGeneralRules" [attr.aria-invalid]="!validGeneralName()" /></label>
            <label>Description <input [ngModel]="description()" (ngModelChange)="description.set($event)" name="description" aria-describedby="settingsGeneralRules" [attr.aria-invalid]="!validGeneralDescription()" /></label>
            <button class="primary" type="submit" name="saveSettingsGeneral" [disabled]="busy() || !validGeneralName() || !validGeneralDescription()">Save</button>
          </form>
          <button type="button" name="discardSettingsGeneral" (click)="discardGeneralDraft()" [disabled]="!canDiscardGeneralDraft()">Discard unsaved edits</button>
          <p class="muted">Discard only resets the local project name and description to last loaded or accepted values. It does not refresh the server or undo saved changes; other forms stay as they are.</p>
          <p class="muted" id="settingsGeneralRules" name="settingsGeneralRules">Project name: up to 120 characters; description: up to 2,000 characters using the API count. Empty text is allowed by the update API. Outer whitespace is kept; text is not truncated or automatically saved. These checks do not verify permission or newer server changes. A successful save refreshes project data only and keeps other unsaved forms.</p>
          @if(generalDraftNotice()){<p role="status" name="settingsGeneralDraftNotice">{{ generalDraftNotice() }}</p>}
          @if(!validGeneralName() || !validGeneralDescription()){<p role="status" name="settingsGeneralInvalid">Correct the name or description before saving. Your full text stays here and is not sent.</p>}
          }
          <p class="muted">Slug: <code>{{ p.slug }}</code> · Base locale: <code>{{ p.baseLocale }}</code></p>
        </section>
        <section class="panel">
          <h2>Locales</h2>
          <button type="button" name="refreshSettingsLocales" [disabled]="!canRefreshLocaleList()" aria-describedby="settingsLocaleListRefreshScope" (click)="refreshLocaleList()">Refresh locale list</button>
          <p class="muted" id="settingsLocaleListRefreshScope">Reads project metadata and updates this locale list only. Drafts, Fill empty and new-rule choices, earlier results and other loaded settings stay. This does not add or remove locales, save fields or rules, run work or check current availability or permission. Missing selected targets are kept, not replaced.</p>
          @if(localeListRefreshing()){<p role="status" name="settingsLocaleListRefreshing">Refreshing locale metadata. The previous list stays until this read succeeds.</p>}
          @if(localeListRefreshNotice()){<p role="status" name="settingsLocaleListRefreshNotice">{{localeListRefreshNotice()}}</p>}
          <ul class="locale-list">
            @for (l of p.locales; track l.code) {
              <li>
                <code>{{ l.code }}</code>
                @if (l.code === p.baseLocale) { <span class="muted">base</span> }
                @else if (confirmingLocale() === l.code) {
                  <span>Remove <strong>{{ l.code }}</strong>? This cannot be undone. All translations for this locale and their history are deleted across all branches, including empty rows. The loaded default-branch preview contains {{ localeTxCount() }} nonempty translation{{ localeTxCount() === 1 ? '' : 's' }}; it is not a total deletion count. Saved rules and local locale choices are not repaired. Review them before running work.</span>
                  <section class="locale-remove-dependencies" name="settingsLocaleRemoveDependencies" aria-label="Loaded locale references">
                    <h3>Review loaded locale references</h3>
                    <p class="muted">Local review only, using rules and choices loaded on this screen. This is not a complete dependency scan, a read of newer server values, a total deletion count or a permission check. Nothing is saved, repaired or run by this review. Removing the locale does not repair these references.</p>
                    <p name="settingsLocaleRemoveFillReference">Current Fill empty target: {{mtLocale()===l.code ? 'references this locale' : 'does not reference this locale'}}.</p>
                    <p name="settingsLocaleRemoveDraftReference">Retained new-rule target choices: {{newRuleLocales().includes(l.code) ? 'include this locale' : 'do not include this locale'}}. Choices can be inactive for the selected action; they are not saved rules.</p>
                    <p>Loaded pretranslation rules with this exact target:</p>
                    @if(localeRemovalRules(l.code).length){
                      <ol name="settingsLocaleRemoveRuleReferences">@for(rule of localeRemovalRules(l.code); track $index){<li><span class="locale-reference-name">{{rule.name || '(empty name)'}}</span> <span class="locale-reference-state">{{rule.enabled ? 'enabled' : 'disabled'}}</span></li>}</ol>
                    } @else {<p name="settingsLocaleRemoveNoRuleReferences">No matching loaded pretranslation rules. This does not prove there are no other references.</p>}
                  </section>
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
          <p class="muted" id="settingsLocaleRules" name="settingsLocaleRules">Locale code: 2-3 lowercase letters, optionally followed by dash-separated groups of 2-8 letters or digits (for example en, pt-BR, zh-Hant-HK). Outer whitespace is trimmed when adding; text is not truncated or otherwise rewritten. This checks API syntax, not a language registry, availability or permission. A successful addition refreshes project data only and keeps other unsaved forms.</p>
          @if(localeDraftNotice()){<p role="status" name="settingsLocaleDraftNotice">{{ localeDraftNotice() }}</p>}
          @if(newLocale()!=='' && !validNewLocaleCode()){<p role="status" name="settingsLocaleInvalid">Correct the locale code before adding. Your full code stays here and is not sent.</p>}
          }
        </section>
        <section class="panel">
          <h2>API tokens</h2>
          <p class="muted">Tokens authenticate scripts and CI against the API (X-Api-Key header).</p>
          <button type="button" name="refreshSettingsTokens" [disabled]="busy() || tokenListRefreshing()" aria-describedby="settingsTokenListRefreshScope" (click)="refreshTokenList()">Refresh token list</button>
          <p class="muted" id="settingsTokenListRefreshScope">Reads token metadata only. Your drafts and one-time reveals stay. This does not create or revoke tokens, copy credentials or check whether a token works. A kept reveal can belong to a token no longer in the list.</p>
          @if(tokenListRefreshing()){<p role="status" name="settingsTokenListRefreshing">Refreshing token metadata. The previous list stays until this read succeeds.</p>}
          @if(tokenListRefreshNotice()){<p role="status" name="settingsTokenListRefreshNotice">{{tokenListRefreshNotice()}}</p>}

          @if (createdToken(); as t) {
            <p class="notice">Token created. Copy it now - it will not be shown again.</p>
            <p class="token-reveal"><code style="overflow-wrap:anywhere">{{ t.token }}</code>
              <button type="button" name="copyCreatedToken" [disabled]="tokenCopyPending() || hookCopyPending()" aria-describedby="settingsTokenCopyScope" (click)="copyCreatedToken()">Copy</button>
              <button type="button" name="hideCreatedToken" aria-describedby="settingsTokenRevealScope" (click)="hideCreatedToken()">Hide token</button></p>
            <p class="muted" id="settingsTokenRevealScope" name="settingsTokenRevealScope">Copy before hiding. Hide removes this one-time reveal from this screen. It does not revoke the token or clear clipboard, browser history or earlier copies. It cannot be shown here again.</p>
          }
          @if(createdToken()){
            <p class="muted" id="settingsTokenCopyScope">Copy reports whether the browser accepted the clipboard write, not whether it was pasted or kept. Hiding cannot cancel an in-progress clipboard write.</p>
            @if(tokenCopyPending()){<p role="status" name="settingsTokenCopyPending">A token clipboard write is still pending. Another secret Copy on this screen is unavailable until it settles, even if the reveal changes.</p>}
            @if(tokenCopyNotice()){<p role="status" name="settingsTokenCopyNotice">{{tokenCopyNotice()}}</p>}
          }
          @if(tokenRevealNotice()){<p role="status" name="settingsTokenRevealNotice">{{tokenRevealNotice()}}</p>}
          <ul class="locale-list">
            @for (tok of tokens(); track tok.id) {
              <li>
                <span class="loaded-token-text">{{ tok.name }}</span>
                <span class="muted loaded-token-text">{{ tok.scopes.join('+') }} · created {{ tok.createdAt | date:'mediumDate' }}{{ tok.lastUsedAt ? ' · used ' + (tok.lastUsedAt | date:'short') : ' · never used' }}</span>
                @if (confirmingToken() === tok.id) {
                  <span>Revoke <strong>{{ tok.name }}</strong>? Scripts using it stop immediately. This cannot be undone.</span>
                  <section class="locale-remove-dependencies" style="overflow-wrap:anywhere;word-break:break-word" name="settingsTokenRevokeDetails" aria-label="Loaded token selected for revocation">
                    <h3>Review loaded token</h3>
                    <p class="muted">Local review of this loaded token metadata only, not a read of newer server values, current validity or permission, complete usage history or dependent scripts. This does not reveal or copy a token, check expiry against the current time, change scopes or make a request with it. Confirming revokes this ID only, not other tokens with the same name. Earlier copies are not erased.</p>
                    <dl>
                      <dt>Token ID</dt><dd name="settingsTokenRevokeId">{{tok.id}}</dd>
                      <dt>Created (raw loaded value)</dt><dd name="settingsTokenRevokeCreated">{{tok.createdAt || '(empty loaded value)'}}</dd>
                      <dt>Last used (raw loaded value)</dt><dd name="settingsTokenRevokeLastUsed">{{tok.lastUsedAt === null ? 'No last-use timestamp in loaded metadata' : tok.lastUsedAt || '(empty loaded value)'}}</dd>
                      <dt>Expires (raw loaded value)</dt><dd name="settingsTokenRevokeExpiry">{{tok.expiresAt === null ? 'No expiry timestamp in loaded metadata' : tok.expiresAt || '(empty loaded value)'}}</dd>
                    </dl>
                    <p>Full loaded scope names in loaded order, not a current access check:</p>
                    @if(tokenRevocationScopes(tok).length){<ol name="settingsTokenRevokeScopes">@for(scope of tokenRevocationScopes(tok); track $index){<li>{{scope || '(empty scope name)'}}</li>}</ol>}
                    @else{<p name="settingsTokenRevokeNoScopes">No scope names in this loaded metadata.</p>}
                  </section>
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
          <button type="button" name="refreshSettingsWebhooks" [disabled]="busy() || hookListRefreshing()" aria-describedby="settingsWebhookListRefreshScope" (click)="refreshWebhookList()">Refresh webhook list</button>
          <p class="muted" id="settingsWebhookListRefreshScope">Reads webhook metadata only. Your drafts and one-time reveals stay. This does not create, delete or enable webhooks, copy secrets, contact endpoints or verify delivery. A kept reveal can belong to a webhook no longer in the list.</p>
          @if(hookListRefreshing()){<p role="status" name="settingsWebhookListRefreshing">Refreshing webhook metadata. The previous list stays until this read succeeds.</p>}
          @if(hookListRefreshNotice()){<p role="status" name="settingsWebhookListRefreshNotice">{{hookListRefreshNotice()}}</p>}
          @if (createdWebhook(); as w) {
            <p class="notice">Webhook created. Copy the signing secret now - it will not be shown again.</p>
            <p class="token-reveal"><code style="overflow-wrap:anywhere">{{ w.secret }}</code>
              <button type="button" name="copyCreatedWebhook" [disabled]="hookCopyPending() || tokenCopyPending()" aria-describedby="settingsWebhookCopyScope" (click)="copyCreatedWebhook()">Copy</button>
              <button type="button" name="hideCreatedWebhook" aria-describedby="settingsWebhookRevealScope" (click)="hideCreatedWebhook()">Hide signing secret</button></p>
            <p class="muted" id="settingsWebhookRevealScope" name="settingsWebhookRevealScope">Copy before hiding. Hide removes this one-time signing-secret reveal from this screen. It does not delete or disable the webhook, rotate its secret, or clear clipboard, browser history or earlier copies. It cannot be shown here again.</p>
          }
          @if(createdWebhook()){
            <p class="muted" id="settingsWebhookCopyScope">Copy reports whether the browser accepted the clipboard write, not whether it was pasted or kept. Hiding cannot cancel an in-progress clipboard write.</p>
            @if(hookCopyPending()){<p role="status" name="settingsWebhookCopyPending">A signing-secret clipboard write is still pending. Another secret Copy on this screen is unavailable until it settles, even if the reveal changes.</p>}
            @if(hookCopyNotice()){<p role="status" name="settingsWebhookCopyNotice">{{hookCopyNotice()}}</p>}
          }
          @if(hookRevealNotice()){<p role="status" name="settingsWebhookRevealNotice">{{hookRevealNotice()}}</p>}
          <ul class="locale-list">
            @for (h of webhooks(); track h.id) {
              <li>
                <span class="hook-url">{{ h.url }}</span>
                <span class="muted loaded-hook-events">{{ h.events.join(' + ') }} · created {{ h.createdAt | date:'mediumDate' }}</span>
                @if (!h.active) { <span class="badge">disabled</span> }
                @if (isTeamAdmin()) {
                  @if (confirmingHook() === h.id) {
                    <span>Delete this webhook and its delivery history? Deliveries stop immediately. This cannot be undone.</span>
                    <section class="locale-remove-dependencies" style="overflow-wrap:anywhere;word-break:break-word" name="settingsWebhookDeleteDetails" aria-label="Loaded webhook selected for deletion">
                      <h3>Review loaded webhook</h3>
                      <p class="muted">Local review of this loaded registration only, not a read of newer server values, current permission or delivery history. This does not contact the endpoint, verify ownership or delivery, copy a signing secret, enable or send anything. Confirming deletes this webhook ID and its delivery history only, not other registrations at the same URL. Earlier copies of its secret or delivered payloads are not erased.</p>
                      <dl>
                        <dt>Webhook ID</dt><dd name="settingsWebhookDeleteId">{{h.id}}</dd>
                        <dt>Endpoint (text only)</dt><dd name="settingsWebhookDeleteUrl">{{h.url}}</dd>
                        <dt>Loaded state</dt><dd name="settingsWebhookDeleteState">{{h.active ? 'enabled' : 'disabled'}}</dd>
                      </dl>
                      <p>Full loaded event names in loaded order, not a delivery receipt:</p>
                      @if(webhookDeletionEvents(h).length){<ol name="settingsWebhookDeleteEvents">@for(event of webhookDeletionEvents(h); track $index){<li>{{event || '(empty event name)'}}</li>}</ol>}
                      @else{<p name="settingsWebhookDeleteNoEvents">No event names in this loaded registration.</p>}
                    </section>
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
          <button type="button" name="refreshSettingsStatuses" [disabled]="!canRefreshStatusList()" aria-describedby="settingsStatusListRefreshScope" (click)="refreshStatusList()">Refresh status list</button>
          <p class="muted" id="settingsStatusListRefreshScope">Reads project metadata and updates custom review statuses only. New-status text, other drafts, choices, earlier results and other loaded settings stay. This does not save statuses, change existing translations or refresh editor choices already open elsewhere. Later Add or Remove replaces the saved list using the statuses loaded here, not a conflict-checked merge. This is not a current availability or permission check.</p>
          @if(statusListRefreshing()){<p role="status" name="settingsStatusListRefreshing">Refreshing custom-status metadata. The previous list stays until this read succeeds.</p>}
          @if(statusListRefreshNotice()){<p role="status" name="settingsStatusListRefreshNotice">{{statusListRefreshNotice()}}</p>}

          <ul class="locale-list status-choice-list">
            <li><span class="badge">unverified</span><span class="badge">translated</span><span class="badge">reviewed</span> <span class="muted">base statuses, always available</span></li>
            @for (st of project()?.customStatuses ?? []; track $index) {
              <li>
                <span class="badge">{{ st.toLowerCase() }}</span>
                @if (isTeamAdmin()) {
                  @if(confirmingStatus()===st){
                    <span>Remove this custom status? Translations already carrying it are not changed. The currently loaded custom-status list, minus this status, will replace the saved list.</span>
                    <section class="status-remove-preview" name="settingsStatusRemovePreview" aria-label="Unsaved custom-status Remove preview">
                      <h3>Unsaved Remove preview</h3>
                      <p class="muted">Local preview only. Confirming removes all exact matches of <code name="settingsStatusRemoveSelected">{{st}}</code> from the loaded custom-status list and submits the remaining entries in this order, replacing the saved list. The server validates and deduplicates entries. This is not a conflict-checked merge or a read of newer server values. Nothing is saved by this preview. Translations already carrying this status are not changed.</p>
                      @if(statusRemovePreview(st).length){
                        <ol name="settingsStatusRemovePreviewEntries">@for(entry of statusRemovePreview(st); track $index){<li><code>{{entry || '(empty)'}}</code></li>}</ol>
                      } @else {<p name="settingsStatusRemovePreviewEmpty">The outgoing custom-status list is empty. Base statuses stay available.</p>}
                    </section>
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
            <label>New custom status <input aria-label="New custom status" placeholder="e.g. NEEDS_WORK (A-Z, 0-9, _)" [ngModel]="newStatus()" (ngModelChange)="newStatus.set($event)" name="newStatus" required aria-describedby="settingsStatusRules settingsStatusPreviewScope" [attr.aria-invalid]="newStatus()!=='' && !validNewStatus()" /></label>
            <button type="submit" name="addSettingsStatus" [disabled]="busy() || !validNewStatus()">Add</button>
          </form>
          <section class="status-add-preview" name="settingsStatusPreview" aria-label="Unsaved custom-status Add preview">
            <h3>Unsaved Add preview</h3>
            <p class="muted" id="settingsStatusPreviewScope">Local preview only. Add submits the loaded custom-status list followed by the trimmed, uppercased draft below, replacing the saved list. Duplicate entries are shown as sent; the server validates and deduplicates them. This is not a conflict-checked merge or a read of newer server values. Nothing is saved by this preview, and no translation status changes here.</p>
            <p>Normalized draft: <code name="settingsStatusNormalized">{{newStatus().trim().toUpperCase() || '(empty)'}}</code></p>
            @if(!validNewStatus()){<p name="settingsStatusPreviewInvalid">This draft cannot be added. Correct the name above; the full raw draft stays.</p>}
            @if(project()){
              <p>Outgoing custom-status entries, in order:</p>
              <ol name="settingsStatusPreviewEntries">@for(entry of statusAddPreview(); track $index){<li><code>{{entry || '(empty)'}}</code></li>}</ol>
            } @else {<p name="settingsStatusPreviewUnavailable">Loaded project metadata is unavailable. This preview cannot show the replacement list.</p>}
          </section>
          <button type="button" name="discardSettingsStatus" (click)="discardStatusDraft()" [disabled]="!canDiscardStatusDraft()">Discard status draft</button>
          <p class="muted">Discard only clears the local new-status field. It does not refresh Settings or remove any saved status; other forms stay as they are.</p>
          <p class="muted" id="settingsStatusRules" name="settingsStatusRules">New custom status: 2-24 characters, starting with a letter, then letters, digits or underscores. Outer whitespace is trimmed and text is uppercased when adding, as before. UNVERIFIED, TRANSLATED and REVIEWED are base statuses, not custom names. Full input is kept without truncation. This checks the new name only, not newer server status choices or permission. A successful addition refreshes project data only and keeps other unsaved forms.</p>
          @if(statusDraftNotice()){<p role="status" name="settingsStatusDraftNotice">{{ statusDraftNotice() }}</p>}
          @if(newStatus()!=='' && !validNewStatus()){<p role="status" name="settingsStatusInvalid">Correct the custom status before adding. Your full text stays here and is not sent.</p>}
          }
          <p class="muted">Custom statuses appear in the editor status dropdowns and the review queue. Removing one does not change translations already carrying it.</p>
        </section>
        <section class="panel">
          <h2>In-context embedding</h2>
          <button type="button" name="refreshSettingsOrigins" [disabled]="!canRefreshOriginList()" aria-describedby="settingsOriginListRefreshScope" (click)="refreshOriginList()">Refresh origin list</button>
          <p class="muted" id="settingsOriginListRefreshScope">Reads project metadata and updates the loaded embed-origin allowlist only. New-origin text, other drafts, choices, earlier results and other loaded settings stay. This does not add or remove origins, contact listed sites, verify site ownership or trust, close open frames or check current permission. Later Add or Remove replaces the saved list using the origins loaded here, not a conflict-checked merge.</p>
          @if(originListRefreshing()){<p role="status" name="settingsOriginListRefreshing">Refreshing origin metadata. The previous list stays until this read succeeds.</p>}
          @if(originListRefreshNotice()){<p role="status" name="settingsOriginListRefreshNotice">{{originListRefreshNotice()}}</p>}

          <p class="muted">Origins allowed to embed the in-context editor (served by the API at /embed/projects/{{ projectId }}) in an iframe and exchange messages with it. Bare origins only (https://app.example.com - no path or trailing slash). The embedded frame answers only these origins and never exposes your session to the host page. Serve /embed/host.js from the API on your page and call OpenLocaleEmbed.init with your iframe element to run the handshake and click-to-locate annotated elements (data-ol-key). Changes here require a signed-in session, not an API token.</p>
          <ul class="locale-list origin-choice-list">
            @for (o of project()?.embedOrigins ?? []; track $index) {
              <li>
                <code>{{ o }}</code>
                @if (isTeamAdmin()) {
                  @if(confirmingOrigin()===o){
                    <span>Remove this origin? It will no longer be allowlisted for this project's embed endpoint. This does not sign users out or promise to close frames already open. The currently loaded list, minus this origin, will replace the saved list.</span>
                    <section class="origin-remove-preview" name="settingsOriginRemovePreview" aria-label="Unsaved embed-origin Remove preview">
                      <h3>Unsaved origin Remove preview</h3>
                      <p class="muted">Local preview only. Confirming removes all exact matches of <code name="settingsOriginRemoveSelected">{{o}}</code> from the loaded allowlist and submits the remaining entries in this order, replacing the saved list. The server validates and deduplicates entries. This is not a conflict-checked merge or a read of newer server values. Nothing is saved or contacted by this preview. It does not verify site ownership, trust or permission, sign users out or promise to close frames already open.</p>
                      @if(originRemovePreview(o).length){
                        <ol name="settingsOriginRemovePreviewEntries">@for(entry of originRemovePreview(o); track $index){<li><code>{{entry || '(empty)'}}</code></li>}</ol>
                      } @else {<p name="settingsOriginRemovePreviewEmpty">The outgoing embed-origin allowlist is empty. No origins will be allowlisted for new embed requests.</p>}
                    </section>
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
            <label>New embed origin <input aria-label="New embed origin" placeholder="https://app.example.com" [ngModel]="newOrigin()" (ngModelChange)="newOrigin.set($event)" name="newOrigin" required aria-describedby="settingsOriginRules settingsOriginPreviewScope" [attr.aria-invalid]="newOrigin()!=='' && !validNewOrigin()" /></label>
            <button type="submit" name="addSettingsOrigin" [disabled]="busy() || !validNewOrigin()">Add origin</button>
          </form>
          <section class="origin-add-preview" name="settingsOriginPreview" aria-label="Unsaved embed-origin Add preview">
            <h3>Unsaved origin Add preview</h3>
            <p class="muted" id="settingsOriginPreviewScope">Local preview only. Add origin submits the loaded allowlist followed by the trimmed draft below, replacing the saved list. Duplicate entries are shown as sent; the server validates and deduplicates them. This is not a conflict-checked merge or a read of newer server values. Nothing is saved or contacted by this preview. It does not verify site ownership, trust or permission. Explicit Add allows that origin to embed this project's editor.</p>
            <p>Trimmed draft, without URL repair: <code name="settingsOriginTrimmed">{{newOrigin().trim() || '(empty)'}}</code></p>
            @if(!validNewOrigin()){<p name="settingsOriginPreviewInvalid">This draft cannot be added. Correct the origin above; the full raw draft stays.</p>}
            @if(project()){
              <p>Outgoing embed-origin entries, in order:</p>
              <ol name="settingsOriginPreviewEntries">@for(entry of originAddPreview(); track $index){<li><code>{{entry || '(empty)'}}</code></li>}</ol>
            } @else {<p name="settingsOriginPreviewUnavailable">Loaded project metadata is unavailable. This preview cannot show the replacement allowlist.</p>}
          </section>
          <button type="button" name="discardSettingsOrigin" (click)="discardOriginDraft()" [disabled]="!canDiscardOriginDraft()">Discard origin draft</button>
          <p class="muted">Discard only clears the local new-origin field. It does not refresh Settings or remove any saved origin; other forms stay as they are.</p>
          <p class="muted" id="settingsOriginRules" name="settingsOriginRules">Use a canonical http:// or https:// bare origin, such as https://app.example.com or http://localhost:4200. No path, trailing slash, query, fragment or credentials. Outer whitespace is trimmed when adding; other text is not repaired or truncated. This checks the new origin's syntax only, not site ownership, trust, permission or newer server settings. Adding an origin allows it to embed this project's editor as described above; a successful addition refreshes project data only and keeps other unsaved forms.</p>
          @if(originDraftNotice()){<p role="status" name="settingsOriginDraftNotice">{{ originDraftNotice() }}</p>}
          @if(newOrigin()!=='' && !validNewOrigin()){<p role="status" name="settingsOriginInvalid">Correct the origin before adding. Your full text stays here and is not sent.</p>}
          }
        </section>
        <section class="panel">
          <h2>Machine translation (pseudo test data)</h2>
          <button type="button" name="refreshSettingsMtProviders" [disabled]="!canRefreshMtProviderList()" aria-describedby="settingsMtProviderListRefreshScope" (click)="refreshMtProviderList()">Refresh provider list</button>
          <p class="muted" id="settingsMtProviderListRefreshScope">Reads saved provider metadata only. Provider drafts, Fill empty choices and results, and automation provider choice stay. Kept choices may refer to a provider no longer listed; review them before any explicit run or save. This does not add, remove, enable or test providers, run Fill empty, repair saved rules or enable real translation.</p>
          @if(mtProviderListRefreshing()){<p role="status" name="settingsMtProviderListRefreshing">Refreshing provider metadata. The previous list stays until this read succeeds.</p>}
          @if(mtProviderListRefreshNotice()){<p role="status" name="settingsMtProviderListRefreshNotice">{{mtProviderListRefreshNotice()}}</p>}
          <p class="muted"><strong>This slice ships pseudo-localization TEST DATA only - not real language translation.</strong> The pseudo provider wraps source text in brackets with accented characters so you can spot hard-coded strings and layout breakage. External MT/AI engines are NOT available in this slice; no provider configuration enables them yet. Runs fill EMPTY target cells only - existing human or reviewed values are never touched - and every filled row starts UNVERIFIED and is attributed to you in the activity log.</p>
          <ul class="locale-list">
            @for (p of mtProviders(); track p.id) {
              <li>
                <span>{{ p.name }} <span class="muted">{{ p.type }}</span></span>
                <button [attr.name]="'toggleMtProvider-'+p.id" (click)="toggleMtProvider(p)" [disabled]="busy()">{{ p.enabled ? 'Disable' : 'Enable' }}</button>
                @if (isTeamAdmin()) {
                  @if(confirmingMtProvider()===p.id){
                    <span>Remove <strong>{{p.name}}</strong>? This cannot be undone. Existing translations are not undone. Saved rules referencing it are not repaired and may fail; work already in progress may finish.</span>
                    <section class="locale-remove-dependencies" name="settingsProviderRemoveDependencies" aria-label="Loaded provider references">
                      <h3>Review loaded provider references</h3>
                      <p class="muted">Local review only, using rules and choices loaded on this screen. This is not a complete dependency scan, a read of newer server values or a permission or provider-readiness check. Nothing is saved, repaired, enabled or run by this review. Saved rules and the retained new-rule provider choice are not repaired by removal.</p>
                      <p name="settingsProviderRemoveFillReference">Current Fill empty provider: {{mtProviderId()===p.id ? 'references this provider' : 'does not reference this provider'}}. If selected when removal is accepted, the first remaining loaded provider is selected, or none. Review that selection before running; this does not enable or run it.</p>
                      <p name="settingsProviderRemoveDraftReference">Retained new-rule provider choice: {{newRuleProvider()===p.id ? 'references this provider' : 'does not reference this provider'}}. This choice can be inactive for the selected action; it is not a saved rule.</p>
                      <p>Loaded pretranslation rules with this exact provider:</p>
                      @if(providerRemovalRules(p.id).length){
                        <ol name="settingsProviderRemoveRuleReferences">@for(rule of providerRemovalRules(p.id); track $index){<li><span class="locale-reference-name">{{rule.name || '(empty name)'}}</span><span class="locale-reference-state">{{rule.enabled ? 'enabled' : 'disabled'}}</span></li>}</ol>
                      } @else {<p name="settingsProviderRemoveNoRuleReferences">No matching loaded pretranslation rules. This does not prove there are no other references.</p>}
                    </section>
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
          @if(isTeamAdmin() && mtLocaleMissing()){<p role="status" name="settingsMtLocaleMissing">Selected Fill empty target locale <code>{{mtLocale()}}</code> is not in the loaded non-base locale choices. The exact choice and earlier result are kept, not replaced. Fill empty is blocked until you explicitly choose a loaded non-base target. Refresh locale list to read choices again if needed. This does not add locales, repair saved rules or check current availability or permission.</p>}
          @if(isTeamAdmin() && missingMtProvider(mtProviderId())){<p role="status" name="settingsMtProviderMissing">Selected Fill empty provider <code>{{mtProviderId()}}</code> is not in the loaded provider list. The exact choice and earlier result are kept, not replaced. Fill empty is blocked until you explicitly choose a loaded enabled provider. Refresh provider list to read choices again if needed. This is not a current availability or permission check.</p>}
          @if (mtProviders().length) {
            @if (isTeamAdmin()) {
          <button type="button" name="refreshSettingsMtBranches" [disabled]="!canRefreshMtBranches()" aria-describedby="settingsMtBranchRefreshScope" (click)="refreshMtBranches()">Refresh pre-translation branches</button>
          <p class="muted" id="settingsMtBranchRefreshScope">Reads branch choices only. Your selected provider, locale and branch, earlier pseudo result and other drafts stay. This does not run pre-translation, create, merge or delete branches, reload provider or OTA choices, or validate current branch availability or permission. A missing selected branch is kept, not replaced.</p>
          @if(mtBranchesRefreshing()){<p role="status" name="settingsMtBranchesRefreshing">Refreshing pre-translation branches. The previous choices stay until this read succeeds.</p>}
          @if(mtBranchesRefreshNotice()){<p role="status" name="settingsMtBranchesRefreshNotice">{{mtBranchesRefreshNotice()}}</p>}
          @if(mtBranchMissing()){<p role="status" name="settingsMtBranchMissing">Selected branch <code>{{mtBranch()}}</code> is not in the loaded choices. It is still selected. Fill empty is blocked until you explicitly choose a loaded branch. Your earlier result and other drafts stay. Refresh pre-translation branches to read choices again if needed. This is not a current availability or permission check.</p>}
          <form class="inline" (ngSubmit)="runPretranslate()">
              <label>Fill empty provider <select aria-label="Pre-translate provider" [ngModel]="mtProviderId()" (ngModelChange)="mtProviderId.set($event)" name="mtProviderId" aria-describedby="settingsMtProviderRules" [attr.aria-invalid]="!validMtProvider()">
                @if(mtProviderId()===''){<option value="">No provider selected (choose an enabled provider)</option>}
                @if(missingMtProvider(mtProviderId())){<option [value]="mtProviderId()">{{mtProviderId()}} (not in loaded providers)</option>}
                @for (p of mtProviders(); track p.id) { <option [value]="p.id" [disabled]="!p.enabled">{{ p.name }}{{p.enabled ? '' : ' (disabled in loaded list)'}}</option> }
              </select></label>
              <label>Fill empty target <select aria-label="Target locale" [ngModel]="mtLocale()" (ngModelChange)="mtLocale.set($event)" name="mtLocale" aria-describedby="settingsMtLocaleRules" [attr.aria-invalid]="!validMtTarget()">
                @if(!validMtTarget() && !mtLocaleMissing()){<option [value]="mtLocale()">{{mtLocale() || 'No target selected'}} (not a loaded target)</option>}
                @if(mtLocaleMissing()){<option [value]="mtLocale()">{{mtLocale()}} (not in loaded target locales)</option>}
                @for (l of project()?.locales ?? []; track l.code) {
                  @if (l.code !== project()?.baseLocale) { <option [value]="l.code">{{ l.code }}</option> }
                }
              </select></label>
              <label>Fill empty branch <select aria-label="Branch" [ngModel]="mtBranch()" (ngModelChange)="mtBranch.set($event)" name="mtBranch" aria-describedby="settingsMtBranchRules" [attr.aria-invalid]="mtBranchMissing()">
                @if(mtBranchMissing()){<option [value]="mtBranch()">{{mtBranch()}} (not in loaded choices)</option>}
                @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
              </select></label>
              <button name="runSettingsPretranslate" type="submit" [disabled]="busy() || mtBranchMissing() || !validMtTarget() || !validMtProvider()" title="Fill empty cells with pseudo test data">Fill empty</button>
            </form>
            <p class="muted" id="settingsMtProviderRules">Fill empty requires an exact enabled provider in the loaded list. Empty, missing and disabled choices are blocked without replacing your choice or clearing the earlier result. Choose an enabled provider or Refresh provider list. This does not enable providers or check current readiness, availability or permission.</p>
            <p class="muted" id="settingsMtLocaleRules">Fill empty requires an exact loaded non-base target locale. Empty, base and missing targets are blocked without replacing your choice or clearing the earlier result. Choose a loaded target or Refresh locale list. This does not add locales or check current availability, grants or permission.</p>
            <p class="muted" id="settingsMtBranchRules">Fill empty requires an exact branch in the loaded pre-translation choices. No fallback is selected. This does not check current branch availability, provider readiness, locale grants or permission; the server still checks each request. This offline provider writes unverified pseudo test data, not real translations.</p>
          }
            @if (mtResult()) { <p class="muted" role="status" name="settingsMtResult">{{ mtResult() }}</p> }
          }
        </section>
        <section class="panel">
          <h2>Automations</h2>
          <button type="button" name="refreshSettingsRules" [disabled]="!canRefreshRuleList()" aria-describedby="settingsRuleListRefreshScope" (click)="refreshRuleList()">Refresh rule list</button>
          <p class="muted" id="settingsRuleListRefreshScope">Reads saved rule metadata only. All new-rule fields, choices and earlier receipts stay. This does not create, remove, enable or run rules, reload providers or webhooks, validate current creator authority or repair configuration. This list is not a complete run history or delivery verification.</p>
          @if(ruleListRefreshing()){<p role="status" name="settingsRuleListRefreshing">Refreshing rule metadata. The previous list stays until this read succeeds.</p>}
          @if(ruleListRefreshNotice()){<p role="status" name="settingsRuleListRefreshNotice">{{ruleListRefreshNotice()}}</p>}
          <p><a [routerLink]="['/projects',projectId,'activity']" name="automationActivityLink">Review recorded runs in Activity</a>&nbsp;<span class="muted">Choose "ran automation" in the action filter. This is not a complete run history or delivery receipt.</span></p>
          <p class="muted">Rules fire only on the whitelisted triggers - a new key, or a base-locale write on the main branch - and only do the whitelisted actions: fill empty cells with pseudo TEST DATA, create a task, or notify this project's registered webhooks (signed delivery to the URLs admins set up in the Webhooks panel - a rule itself cannot send anywhere else). Only project admins can create rules, and creating a rule delegates YOUR authority to it: any member's edit can trigger it, but the rule acts as you, with your CURRENT permissions re-checked on every run - not as the editor who triggered it. If you are demoted, lose a locale grant, or leave the project, the run narrows or fails visibly in the activity log and the triggering edit is unaffected. Runs are best-effort and in-process: no durable queue and no retry, and a write committed while the server restarts does not replay.</p>
          <ul class="locale-list">
            @for (r of autoRules(); track r.id) {
              <li>
                <span class="loaded-rule-label">{{ r.name }} <span class="muted">{{ r.trigger }} &rarr; {{ ruleSummary(r) }}</span></span>
                @if (isTeamAdmin()) { <button [attr.name]="'toggleRule-'+r.id" (click)="toggleRule(r)" [disabled]="busy()">{{ r.enabled ? 'Disable' : 'Enable' }}</button> }
                @if (isTeamAdmin()) {
                  @if(confirmingRule()===r.id){
                    <span>Remove <strong>{{r.name}}</strong>? This cannot be undone. Earlier effects are not undone, and a run already in progress may finish.</span>
                    <section class="locale-remove-dependencies" name="settingsRuleRemoveDetails" aria-label="Loaded rule selected for removal">
                      <h3>Review loaded rule</h3>
                      <p class="muted">Local review of the selected loaded rule only, not a read of newer server values, current permission or creator authority, configuration readiness or run history. Nothing is saved, enabled, repaired or run by this review. Confirming removes this rule ID only; earlier effects are not undone and work already in progress may finish.</p>
                      <dl>
                        <dt>Rule ID</dt><dd name="settingsRuleRemoveId">{{r.id}}</dd>
                        <dt>Loaded state</dt><dd name="settingsRuleRemoveState">{{r.enabled ? 'enabled' : 'disabled'}}</dd>
                        <dt>Trigger</dt><dd name="settingsRuleRemoveTrigger">{{r.trigger}}</dd>
                        <dt>Action</dt><dd name="settingsRuleRemoveAction">{{r.action}}</dd>
                      </dl>
                      <p>Full loaded configuration (JSON, not a validation or execution preview):</p>
                      <pre name="settingsRuleRemoveConfig" style="white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%">{{ruleRemovalConfig(r)}}</pre>
                    </section>
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
              @if(missingMtProvider(newRuleProvider())){<p role="status" name="settingsRuleProviderMissing">Selected new-rule provider <code>{{newRuleProvider()}}</code> is not in the loaded provider list. The exact choice and rule draft are kept, not replaced. Add rule is blocked until you explicitly choose a loaded provider. Refresh provider list to read choices again if needed. This does not repair saved rules or check current availability or permission.</p>}
              <label>New-rule provider <select aria-label="Rule provider" [ngModel]="newRuleProvider()" (ngModelChange)="newRuleProvider.set($event)" name="newRuleProvider" aria-describedby="settingsRuleProviderRules" [attr.aria-invalid]="!validNewRuleProvider()">
                @if(newRuleProvider()===''){<option value="">No provider selected (choose a loaded provider)</option>}
                @if(missingMtProvider(newRuleProvider())){<option [value]="newRuleProvider()">{{newRuleProvider()}} (not in loaded providers)</option>}
                @for (p of mtProviders(); track p.id) { <option [value]="p.id">{{ p.name }}{{p.enabled ? '' : ' (disabled in loaded list)'}}</option> }
              </select></label>
              <p class="muted" id="settingsRuleProviderRules">Choose an exact provider in the loaded list before adding this test-data rule. Empty or missing choices block Add without replacing your choice or clearing earlier receipts. Refresh provider list to read choices again. A listed disabled provider can be saved as a rule reference, but this does not enable it or promise a later run will work. This does not repair saved rules, run the rule or check current readiness, grants or permission.</p>
              @if(missingRuleLocales().length){<p role="status" name="settingsRuleLocalesMissing">These checked new-rule target locales are not in the loaded non-base locale choices. Exact codes and the rule draft are kept, not replaced. Add rule is blocked until every selected target is loaded and non-base. Uncheck a retained target to remove it from this draft only. This does not add locales, repair saved rules or check current availability or permission.</p>}
              <p class="muted" id="settingsRuleLocaleRules" name="settingsRuleLocaleRules">Choose 1 to 5 exact loaded non-base target locales before adding this test-data rule. Selected: {{newRuleLocales().length}}. Empty, missing and base targets are blocked without replacing your choices or clearing earlier receipts. Uncheck retained targets or Refresh locale list to read choices again. This does not add locales, repair saved rules or check current grants, provider readiness or permission. Saving delegates future actions as described above; it does not run the rule now.</p>
              @for (code of missingRuleLocales(); track code) {
                <label class="missing-rule-locale"><input type="checkbox" [checked]="true" (change)="toggleRuleLocale(code)" name="missingRuleLoc-{{code}}" aria-describedby="settingsRuleLocaleRules" [attr.aria-invalid]="!validNewRuleLocales()" /> {{code}} (not in loaded target locales)</label>
              }
              @for (l of project()?.locales ?? []; track l.code) {
                @if (l.code !== project()?.baseLocale) {
                  <label class="missing-rule-locale"><input type="checkbox" [checked]="newRuleLocales().includes(l.code)" (change)="toggleRuleLocale(l.code)" name="ruleLoc-{{ l.code }}" aria-describedby="settingsRuleLocaleRules" [attr.aria-invalid]="!validNewRuleLocales()" /> {{ l.code }}</label>
                }
              }
            } @else if (newRuleAction() === 'task.create') {
              <input aria-label="Task title" placeholder="Task title ({key} = key name)" [ngModel]="newRuleTitle()" (ngModelChange)="newRuleTitle.set($event)" name="newRuleTitle" aria-describedby="settingsRulePayloadRules" [attr.aria-invalid]="!validNewRulePayload()" />
            } @else {
              <input aria-label="Notification message" placeholder="Message ({key} = key name)" [ngModel]="newRuleMessage()" (ngModelChange)="newRuleMessage.set($event)" name="newRuleMessage" aria-describedby="settingsRulePayloadRules" [attr.aria-invalid]="!validNewRulePayload()" />
            }
            <button type="submit" name="addSettingsRule" [disabled]="busy() || !validNewRuleName() || !validNewRulePayload() || !validNewRuleLocales() || !validNewRuleProvider()">Add rule</button>
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
        <section class="panel saml-display">
          <h2>Single sign-on (SAML)</h2>
          <button type="button" name="refreshSettingsSaml" [disabled]="!canRefreshSamlInfo()" aria-describedby="settingsSamlRefreshScope" (click)="refreshSamlInfo()">Refresh SAML configuration</button>
          <p class="muted" id="settingsSamlRefreshScope">Reads this instance's display-only SAML metadata. The previous display, inputs, choices and earlier results stay until this read succeeds. This does not save configuration, contact the identity provider, start sign-in or verify trust, current access or working authentication. Other settings are not refreshed.</p>
          @if(samlInfoRefreshing()){<p role="status" name="settingsSamlInfoRefreshing">Refreshing SAML display metadata.</p>}
          @if(samlInfoRefreshNotice()){<p role="status" name="settingsSamlInfoRefreshNotice">{{samlInfoRefreshNotice()}}</p>}
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
            <p class="muted" name="settingsSamlInfoUnloaded">No SAML display metadata is loaded yet. Refresh SAML configuration to try again. This does not mean SAML is unconfigured.</p>
          }
        </section>
        <section class="panel">
          <h2>Members</h2>
          <button type="button" name="refreshSettingsMembers" [disabled]="!canRefreshMemberList()" aria-describedby="settingsMemberListRefreshScope" (click)="refreshMemberList()">Refresh member list</button>
          <p class="muted" id="settingsMemberListRefreshScope">Reads direct team membership metadata only. Add-member fields and row drafts stay. This does not add or remove members, save roles or locales, reload groups or check effective access. Drafts for members no longer listed stay local and are not saved by Refresh.</p>
          @if(memberListRefreshing()){<p role="status" name="settingsMemberListRefreshing">Refreshing membership metadata. The previous list stays until this read succeeds.</p>}
          @if(memberListRefreshNotice()){<p role="status" name="settingsMemberListRefreshNotice">{{memberListRefreshNotice()}}</p>}
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
                  <span class="muted">Selection alone does not change access. Save role applies the direct team role; group grants still combine. A successful role save refreshes members only and keeps other unsaved forms.</span>
                  @if(memberRoleNotice()[m.id]){<p role="status" [attr.name]="'role-notice-'+m.id">{{ memberRoleNotice()[m.id] }}</p>}
                  @if(m.role === 'MEMBER') {
                    <label>Direct write locales <input [attr.name]="'member-locales-'+m.id" [ngModel]="memberLocalesPick()[m.id] ?? m.allowedLocales.join(', ')" (ngModelChange)="pickMemberLocales(m.id, $event)" [attr.aria-describedby]="'member-locales-help-'+m.id" [attr.aria-invalid]="!validMemberLocales(m)" /></label>
                    <button type="button" [attr.name]="'member-locales-save-'+m.id" (click)="saveMemberLocales(m)" [disabled]="!canSaveMemberLocales(m)">{{ memberLocalesPending()[m.id] ? 'Saving locales...' : 'Save locales' }}</button>
                    <span class="muted" [attr.id]="'member-locales-help-'+m.id">Comma-separated locale codes from this project. Blank grants all locales. This changes direct translation-write access across the team, not project visibility. Group grants can widen access. Typing does not save. A successful scope save refreshes members only and keeps other unsaved forms.</span>
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
          <h3 id="settingsNewMemberHeading">Add or update direct member</h3>
          <form class="inline new-member-form" (ngSubmit)="addMember()">
            <label>Email <input aria-label="Member email" placeholder="User email" [ngModel]="memberEmail()" (ngModelChange)="memberEmail.set($event)" name="memberEmail" required /></label>
            <label>Direct role <select aria-label="New member role" [ngModel]="memberRole()" (ngModelChange)="memberRole.set($event)" name="memberRole">
              <option value="MEMBER">member</option>
              <option value="ADMIN">admin</option>
            </select></label>
            <label>Direct write locales <input aria-label="Allowed locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="memberLocales()" (ngModelChange)="memberLocales.set($event)" name="memberLocales" aria-describedby="settingsNewMemberLocalesRules" [attr.aria-invalid]="!validNewMemberLocales()" /></label>
            <button name="addSettingsMember" type="submit" [disabled]="busy() || !validNewMemberLocales()">Add</button>
          </form>
          <p class="muted" id="settingsNewMemberLocalesRules" name="settingsNewMemberLocalesRules">Direct write locales: comma-separated exact codes from this project's loaded locale list. Blank or whitespace-only text grants all locales. A comma is not blank: empty entries and unknown codes block Add, without changing your text. Outer spaces around codes are trimmed on submission. This checks loaded choices only, not newer server state or permission. Add can update an existing member's team-wide direct role and scope; group grants can widen access. Admin roles are not restricted by a locale list.</p>
          @if(!validNewMemberLocales()){<p role="status" name="settingsNewMemberLocalesInvalid">Correct the direct write locales before adding. Use loaded project codes separated by commas with no empty entries, or leave the field blank only if all locales is intended. Your full email, role and locale draft stays here and has not been sent.</p>}
          <button type="button" name="discardSettingsMemberEmail" (click)="discardMemberEmailDraft()" [disabled]="!canDiscardMemberEmailDraft()">Discard member email draft</button>
          <p class="muted">Discard only clears the local add-member email. Selected role and locales stay. It does not refresh Settings, send an invitation or change anyone's saved membership or access; other forms stay as they are.</p>
          @if(memberDraftNotice()){<p role="status" name="settingsMemberDraftNotice">{{ memberDraftNotice() }}</p>}
          }
          <p class="muted">Members join this team and can access every project in it. A locale list limits their translation writes across all of the team's projects. Project administration (settings, locales, webhooks, restores, members) requires admin.</p>
        </section>
        <section class="panel">
          <h2>Groups</h2>
          <button type="button" name="refreshSettingsGroups" [disabled]="!canRefreshGroupList()" aria-describedby="settingsGroupListRefreshScope" (click)="refreshGroupList()">Refresh group list</button>
          <p class="muted" id="settingsGroupListRefreshScope">Reads team-wide group metadata and saved group memberships only. New-group fields and row drafts stay, including drafts for groups no longer listed. This does not create or delete groups, save grants or members, reload direct team members or verify effective access. Kept drafts are local and are not saved by Refresh.</p>
          @if(groupListRefreshing()){<p role="status" name="settingsGroupListRefreshing">Refreshing group metadata. The previous list stays until this read succeeds.</p>}
          @if(groupListRefreshNotice()){<p role="status" name="settingsGroupListRefreshNotice">{{groupListRefreshNotice()}}</p>}
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
                  <span class="muted" [attr.id]="'group-name-help-'+g.id">Nonempty name, up to 100 characters after trimming. Save name renames this team-wide group without changing its members, grants or task assignments. Typing does not save. A successful rename refreshes groups only and keeps other unsaved forms.</span>
                  @if(!validGroupName(g)){<p role="status">Enter a nonempty group name of up to 100 characters. Your full text stays here and is not sent.</p>}
                  @if(groupNameNotice()[g.id]){<p role="status" [attr.name]="'group-name-notice-'+g.id">{{ groupNameNotice()[g.id] }}</p>}
                  <select aria-label="Group role" [ngModel]="groupRolePick()[g.id] ?? g.role" (ngModelChange)="pickGroupRole(g.id, $event)" [attr.name]="'grole-'+g.id">
                    <option value="MEMBER">member</option>
                    <option value="ADMIN">admin</option>
                  </select>
                  <button type="button" name="grole-save-{{g.id}}" (click)="setGroupRole(g)" [disabled]="!canSaveGroupRole(g)">{{ groupRolePending()[g.id] ? 'Saving role...' : 'Save role' }}</button>
                  <span class="muted">Selection alone does not change access. Save role applies this group's team-wide grant. A successful role save refreshes groups only and keeps other unsaved forms.</span>
                  @if(groupRoleNotice()[g.id]){<p role="status" [attr.name]="'grole-notice-'+g.id">{{ groupRoleNotice()[g.id] }}</p>}
                  @if(g.role === 'MEMBER') {
                    <label>Group write locales <input [attr.name]="'group-locales-'+g.id" [ngModel]="groupLocalesPick()[g.id] ?? g.allowedLocales.join(', ')" (ngModelChange)="pickGroupLocales(g.id, $event)" [attr.aria-describedby]="'group-locales-help-'+g.id" [attr.aria-invalid]="!validGroupLocales(g)" /></label>
                    <button type="button" [attr.name]="'group-locales-save-'+g.id" (click)="saveGroupLocales(g)" [disabled]="!canSaveGroupLocales(g)">{{ groupLocalesPending()[g.id] ? 'Saving locales...' : 'Save locales' }}</button>
                    <span class="muted" [attr.id]="'group-locales-help-'+g.id">Comma-separated locale codes from this project. Blank grants all locales. This changes this grant for every group member across every team project. Other grants still combine; this does not hide projects. Typing does not save. A successful scope save refreshes groups only and keeps other unsaved forms.</span>
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
                  <span class="muted">Selection alone does not add access. Choose Add member to apply this group's grant. A successful add refreshes groups only and keeps other unsaved forms.</span>
                  @if(groupMemberNotice()[g.id]){<p role="status" [attr.name]="'gadd-notice-'+g.id">{{ groupMemberNotice()[g.id] }}</p>}
                }
              </li>
            }
            @if (!groups().length) { <li class="muted">No groups yet.</li> }
          </ul>
          @if (isTeamAdmin()) {
          @if(groupMemberRemoveNotice()){<p role="status" name="settingsGroupMemberRemoveNotice">{{groupMemberRemoveNotice()}}</p>}
          @if(groupRemoveNotice()){<p role="status" name="settingsGroupRemoveNotice">{{groupRemoveNotice()}}</p>}
          <h3 id="settingsNewGroupHeading">Create group</h3>
          <form class="inline new-group-form" (ngSubmit)="addGroup()">
            <label>Group name <input aria-label="Group name" placeholder="Group name" [ngModel]="groupName()" (ngModelChange)="groupName.set($event)" name="groupName" required aria-describedby="settingsGroupRules" [attr.aria-invalid]="groupName()!=='' && !validNewGroupName()" /></label>
            <label>Group role <select aria-label="New group role" [ngModel]="groupRole()" (ngModelChange)="groupRole.set($event)" name="groupRole">
              <option value="MEMBER">member</option>
              @if (isTeamOwner()) { <option value="ADMIN">admin</option> }
            </select></label>
            <label>Group write locales <input aria-label="Group locales" placeholder="Locales (e.g. he,fr) - blank = all" [ngModel]="groupLocales()" (ngModelChange)="groupLocales.set($event)" name="groupLocales" aria-describedby="settingsNewGroupLocalesRules" [attr.aria-invalid]="!validNewGroupLocales()" /></label>
            <button type="submit" name="addSettingsGroup" [disabled]="busy() || !validNewGroupName() || !validNewGroupLocales()">Add group</button>
          </form>
          <p class="muted" id="settingsNewGroupLocalesRules" name="settingsNewGroupLocalesRules">Group write locales: comma-separated exact codes from this project's loaded locale list. Blank or whitespace-only text grants all locales. A comma is not blank: empty entries and unknown codes block Add group, without changing your text. Outer spaces around codes are trimmed on submission. This checks loaded choices only, not newer server state or permission. Groups are team-wide; members can have wider access from direct or other group grants. Admin roles are not restricted by a locale list. Creating a group does not add members.</p>
          @if(!validNewGroupLocales()){<p role="status" name="settingsNewGroupLocalesInvalid">Correct the group write locales before adding. Use loaded project codes separated by commas with no empty entries, or leave the field blank only if all locales is intended. Your full name, role and locale draft stays here and has not been sent.</p>}
          <button type="button" name="discardSettingsGroupName" (click)="discardGroupNameDraft()" [disabled]="!canDiscardGroupNameDraft()">Discard group name draft</button>
          <p class="muted">Discard only clears the local new-group name. Selected role and locales stay. It does not refresh Settings, change saved groups or change anyone's access; other forms stay as they are.</p>
          <p class="muted" id="settingsGroupRules" name="settingsGroupRules">Group name: 1-100 characters using the API count after trimming outer whitespace. Full input is kept without truncation. This checks the name only, not role, locale grants, permission or newer server changes. A successful addition refreshes groups only; other unsaved forms stay.</p>
          @if(groupDraftNotice()){<p role="status" name="settingsGroupDraftNotice">{{ groupDraftNotice() }}</p>}
          @if(groupName()!=='' && !validNewGroupName()){<p role="status" name="settingsGroupInvalid">Correct the group name before adding. Your full name, role and locales stay here and are not sent.</p>}
          }
        </section>
        <section class="panel">
          <h2>OTA publications</h2>
          <button type="button" name="refreshSettingsOta" [disabled]="!canRefreshOtaList()" aria-describedby="settingsOtaListRefreshScope" (click)="refreshOtaList()">Refresh publication list</button>
          <p class="muted" id="settingsOtaListRefreshScope">Reads retained publication metadata only. Your selected publish branch, earlier receipt and other drafts stay. This does not publish, download or verify bundles, reload branch choices or deploy to a CDN or device. A kept receipt can refer to a publication no longer retained. This is not a complete release history or current bundle-availability check.</p>
          @if(otaListRefreshing()){<p role="status" name="settingsOtaListRefreshing">Refreshing publication metadata. The previous list stays until this read succeeds.</p>}
          @if(otaListRefreshNotice()){<p role="status" name="settingsOtaListRefreshNotice">{{otaListRefreshNotice()}}</p>}
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
          <button type="button" name="refreshSettingsOtaBranches" [disabled]="!canRefreshOtaBranches()" aria-describedby="settingsOtaBranchRefreshScope" (click)="refreshOtaBranches()">Refresh publish branches</button>
          <p class="muted" id="settingsOtaBranchRefreshScope">Reads branch choices only. Your selected branch, earlier publication receipt, publication list and other drafts stay. This does not create, merge or delete branches, publish or download bundles, reload publication metadata or validate current publish permission or branch availability. A missing selected branch is kept, not replaced.</p>
          @if(otaBranchesRefreshing()){<p role="status" name="settingsOtaBranchesRefreshing">Refreshing publish branches. The previous choices stay until this read succeeds.</p>}
          @if(otaBranchesRefreshNotice()){<p role="status" name="settingsOtaBranchesRefreshNotice">{{otaBranchesRefreshNotice()}}</p>}
          @if(otaBranchMissing()){<p role="status" name="settingsOtaBranchMissing">Selected branch <code>{{otaBranch()}}</code> is not in the loaded choices. It is still selected. Publish is blocked until you explicitly choose a loaded branch. Your earlier receipt and other drafts stay. Refresh publish branches to read choices again if needed. This is not a current availability or permission check.</p>}
          <form class="inline" (ngSubmit)="publishOta()">
            <label>Publish branch <select aria-label="OTA branch" [ngModel]="otaBranch()" (ngModelChange)="otaBranch.set($event)" name="otaBranch" aria-describedby="settingsOtaPublishRules" [attr.aria-invalid]="otaBranchMissing()">
              @if(otaBranchMissing()){<option [value]="otaBranch()">{{otaBranch()}} (not in loaded choices)</option>}
              @for (b of otaPublishBranches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
            </select></label>
            <button type="submit" name="publishSettingsOta" [disabled]="busy() || otaBranchMissing()">Publish bundle</button>
          </form>
          }
          <p class="muted" id="settingsOtaPublishRules">Publish uses the exact selected branch from the loaded publish choices. Missing choices are kept, never replaced with main. This checks loaded choices only; the server still checks current branch state and permission. Publishing creates a saved bundle snapshot of all translations on that branch, not a CDN or device deployment.</p>
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
  styles: [`.loaded-token-text {min-width:0;overflow-wrap:anywhere;word-break:break-word} .loaded-hook-events {min-width:0;overflow-wrap:anywhere;word-break:break-word} .locale-remove-dependencies {width:100%;box-sizing:border-box;margin:.75rem 0;padding:.75rem;border:1px solid #cbd5e1;border-radius:.5rem;min-width:0} .locale-remove-dependencies h3 {margin-top:0} .locale-remove-dependencies li {display:list-item;padding:0;list-style:decimal} .locale-reference-state {display:block;margin-top:.25rem} .loaded-rule-label {min-width:0;overflow-wrap:anywhere;word-break:break-word} .locale-reference-name {white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word} .origin-choice-list code {overflow-wrap:anywhere;word-break:break-word;min-width:0;max-width:100%} .status-choice-list .badge {overflow-wrap:anywhere;word-break:break-word;min-width:0;max-width:100%} .status-remove-preview,.origin-remove-preview {width:100%;box-sizing:border-box} .status-remove-preview li,.origin-remove-preview li {display:list-item;padding:0;list-style:decimal} .status-add-preview,.origin-add-preview,.status-remove-preview,.origin-remove-preview {margin:.75rem 0;padding:.75rem;border:1px solid #cbd5e1;border-radius:.5rem;min-width:0} .status-add-preview h3,.origin-add-preview h3,.status-remove-preview h3,.origin-remove-preview h3 {margin-top:0} .status-add-preview code,.origin-add-preview code,.status-remove-preview code,.origin-remove-preview code {white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word} .status-add-preview li,.origin-add-preview li,.status-remove-preview li,.origin-remove-preview li {min-width:0} .new-member-form label,.new-group-form label {display:flex;flex-direction:column;gap:.25rem;min-width:0;max-width:100%} .saml-display code {overflow-wrap:anywhere;word-break:break-word;min-width:0;max-width:100%} .loaded-general {margin:1rem 0;padding:.75rem;border:1px solid #cbd5e1;border-radius:.5rem;min-width:0} .loaded-general h3 {margin-top:0} .loaded-general dt {font-weight:600} .loaded-general dd {margin:.25rem 0 .75rem;min-width:0} .loaded-general-value {white-space:pre-wrap;overflow-wrap:anywhere} .missing-rule-locale {display:inline-flex;align-items:center;gap:.4rem;overflow-wrap:anywhere;max-width:100%} .missing-rule-locale input {width:auto;flex:none}`],
})
export class SettingsComponent implements OnInit, OnDestroy {
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
  private tokenCopyDeparted = false;
  ngOnDestroy() {this.invalidateSamlInfoRefresh();this.invalidateGeneralMetadataRefresh();this.invalidateOriginListRefresh();this.invalidateStatusListRefresh();this.invalidateLocaleListRefresh();this.invalidateMtBranchRefresh();this.invalidateOtaBranchRefresh();this.invalidateOtaListRefresh();this.invalidateRuleListRefresh();this.invalidateMtProviderListRefresh();this.invalidateGroupListRefresh();this.invalidateMemberListRefresh();this.invalidateWebhookListRefresh();this.invalidateTokenListRefresh();this.tokenCopyDeparted=true;this.tokenCopyNotice.set('');this.hookCopyNotice.set('');}
  async ngOnInit() { await this.reload(); }
  async reload(generalSubmission?: {name:string;description:string}, projectOnly = false) {
    this.invalidateSamlInfoRefresh();
    this.invalidateGeneralMetadataRefresh();
    this.invalidateOriginListRefresh();
    this.invalidateStatusListRefresh();
    this.invalidateLocaleListRefresh();
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
      if(projectOnly)return;
      this.invalidateTokenListRefresh();
      this.tokens.set(await this.api.listTokens());
      this.invalidateWebhookListRefresh();
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
      this.invalidateMemberListRefresh();
      this.members.set(await this.api.listMembers(this.projectId));
      this.invalidateGroupListRefresh();
      this.groups.set(await this.api.listGroups(this.projectId));
      this.invalidateOtaListRefresh();
      this.otaPubs.set(await this.api.listOtaPublications(this.projectId));
      this.invalidateOtaBranchRefresh();
      this.invalidateMtBranchRefresh();
      this.branches.set(await this.api.listBranches(this.projectId));
      this.otaPublishBranches.set(this.branches());
      this.invalidateMtProviderListRefresh();
      this.mtProviders.set(await this.api.listMtProviders(this.projectId));
      this.invalidateRuleListRefresh();
      this.autoRules.set(await this.api.listAutomationRules(this.projectId));
      this.invalidateSamlInfoRefresh();
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
    if(this.busy() || this.tokenCopyDeparted || this.otaBranchMissing())return;
    this.invalidateOtaListRefresh();
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
    if(this.tokenDraftNotice())this.tokenDraftNotice.set('The submitted token was created. The local name draft was discarded without refreshing Settings or revoking any saved token. Selected access stays for your next explicit Create. '+(this.createdToken()?'The token revealed above belongs to the submitted token.':'The one-time reveal is no longer shown here.'));
  }
  tokenRevealNotice = signal('');
  hideCreatedToken() {
    if(!this.createdToken())return;
    this.createdToken.set(null);
    this.tokenCopyNotice.set('');
    this.tokenRevealNotice.set('The one-time token reveal was hidden from this screen. The token was not revoked. Clipboard, browser history and earlier copies were not cleared.'+(this.tokenCopyPending()?' An in-progress clipboard write may still finish.':''));
    if(this.tokenDraftNotice())this.tokenDraftNotice.set(this.tokenDraftNotice().replace('The token revealed above belongs to the submitted token', 'The hidden reveal belonged to the submitted token'));
  }
  tokenDraftNotice = signal('');
  async createToken() {
    if(this.busy())return;
    this.invalidateTokenListRefresh();
    const submitted={name:this.tokenName(),scope:this.tokenScope()};
    this.busy.set(true); this.error.set(''); this.tokenDraftNotice.set('');
    try {
      const scopes = submitted.scope.split(',');
      const res = await this.api.createToken(submitted.name, scopes);
      this.tokenRevealNotice.set('');
      this.tokenCopyNotice.set('');
      this.createdToken.set({ id: res.id, name: res.name, token: res.token });
      if(this.tokenName()===submitted.name && this.tokenScope()===submitted.scope) {
        this.tokenName.set('');
      } else {
        this.tokenDraftNotice.set('The submitted token was created. Your newer name and access draft is kept here and has not been created. Review the name and access before creating again. The token revealed above belongs to the submitted token, not this newer draft.');
      }
      this.tokens.set(await this.api.listTokens());
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  tokenListRefreshing = signal(false);
  tokenListRefreshNotice = signal('');
  private tokenListRefreshEpoch = 0;
  private invalidateTokenListRefresh() {
    this.tokenListRefreshEpoch++;this.tokenListRefreshing.set(false);this.tokenListRefreshNotice.set('');
  }
  async refreshTokenList() {
    if(this.tokenCopyDeparted || this.busy() || this.tokenListRefreshing())return;
    const epoch=++this.tokenListRefreshEpoch,projectId=this.projectId;
    this.tokenListRefreshing.set(true);this.tokenListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.tokenListRefreshEpoch && projectId===this.projectId;
    try {
      const tokens=await this.api.listTokens();
      if(!current())return;
      this.tokens.set(tokens);
      this.tokenListRefreshNotice.set('Token metadata was refreshed. Drafts and one-time reveals were kept. This is a list snapshot, not a token authentication check.');
    } catch {
      if(current())this.tokenListRefreshNotice.set('Token metadata could not be refreshed. The previous list, drafts and one-time reveals were kept. Try Refresh token list again.');
    } finally {if(current())this.tokenListRefreshing.set(false);}
  }
  hookListRefreshing = signal(false);
  hookListRefreshNotice = signal('');
  private hookListRefreshEpoch = 0;
  private invalidateWebhookListRefresh() {
    this.hookListRefreshEpoch++;this.hookListRefreshing.set(false);this.hookListRefreshNotice.set('');
  }
  async refreshWebhookList() {
    if(this.tokenCopyDeparted || this.busy() || this.hookListRefreshing())return;
    const epoch=++this.hookListRefreshEpoch,projectId=this.projectId;
    this.hookListRefreshing.set(true);this.hookListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.hookListRefreshEpoch && projectId===this.projectId;
    try {
      const webhooks=await this.api.listWebhooks(projectId);
      if(!current())return;
      this.webhooks.set(webhooks);
      this.hookListRefreshNotice.set('Webhook metadata was refreshed. Drafts and one-time reveals were kept. This is a list snapshot, not an endpoint health or delivery check.');
    } catch {
      if(current())this.hookListRefreshNotice.set('Webhook metadata could not be refreshed. The previous list, drafts and one-time reveals were kept. Try Refresh webhook list again.');
    } finally {if(current())this.hookListRefreshing.set(false);}
  }
  memberListRefreshing = signal(false);
  memberListRefreshNotice = signal('');
  private memberListRefreshEpoch = 0;
  private invalidateMemberListRefresh() {
    this.memberListRefreshEpoch++;this.memberListRefreshing.set(false);this.memberListRefreshNotice.set('');
  }
  canRefreshMemberList():boolean {
    return !this.tokenCopyDeparted && !this.busy() && !this.memberListRefreshing() && !this.removingMember() && !Object.values(this.memberRolePending()).some(Boolean) && !Object.values(this.memberLocalesPending()).some(Boolean);
  }
  async refreshMemberList() {
    if(!this.canRefreshMemberList())return;
    const epoch=++this.memberListRefreshEpoch,projectId=this.projectId;
    this.memberListRefreshing.set(true);this.memberListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.memberListRefreshEpoch && projectId===this.projectId;
    try {
      const members=await this.api.listMembers(projectId);
      if(!current())return;
      this.members.set(members);
      this.memberListRefreshNotice.set('Membership metadata was refreshed. Add-member fields and row drafts were kept. This is a list snapshot, not an effective-access check.');
    } catch {
      if(current())this.memberListRefreshNotice.set('Membership metadata could not be refreshed. The previous list, add-member fields and row drafts were kept. Try Refresh member list again.');
    } finally {if(current())this.memberListRefreshing.set(false);}
  }
  groupListRefreshing = signal(false);
  groupListRefreshNotice = signal('');
  private groupListRefreshEpoch = 0;
  private invalidateGroupListRefresh() {
    this.groupListRefreshEpoch++;this.groupListRefreshing.set(false);this.groupListRefreshNotice.set('');
  }
  canRefreshGroupList():boolean {
    return !this.tokenCopyDeparted && !this.busy() && !this.groupListRefreshing() && !this.deletingGroup() && ![this.groupNamePending(),this.groupRolePending(),this.groupLocalesPending(),this.groupMemberPending()].some(map=>Object.values(map).some(Boolean));
  }
  async refreshGroupList() {
    if(!this.canRefreshGroupList())return;
    const epoch=++this.groupListRefreshEpoch,projectId=this.projectId;
    this.groupListRefreshing.set(true);this.groupListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.groupListRefreshEpoch && projectId===this.projectId;
    try {
      const groups=await this.api.listGroups(projectId);
      if(!current())return;
      this.groups.set(groups);
      this.groupListRefreshNotice.set('Group metadata was refreshed. New-group fields and row drafts were kept. Direct team members were not reloaded; this is not an effective-access check.');
    } catch {
      if(current())this.groupListRefreshNotice.set('Group metadata could not be refreshed. The previous list, new-group fields and row drafts were kept. Try Refresh group list again.');
    } finally {if(current())this.groupListRefreshing.set(false);}
  }
  mtProviderListRefreshing = signal(false);
  mtProviderListRefreshNotice = signal('');
  private mtProviderListRefreshEpoch = 0;
  private invalidateMtProviderListRefresh() {
    this.mtProviderListRefreshEpoch++;this.mtProviderListRefreshing.set(false);this.mtProviderListRefreshNotice.set('');
  }
  canRefreshMtProviderList():boolean {
    return !this.tokenCopyDeparted && !this.busy() && !this.mtProviderListRefreshing();
  }
  async refreshMtProviderList() {
    if(!this.canRefreshMtProviderList())return;
    const epoch=++this.mtProviderListRefreshEpoch,projectId=this.projectId;
    this.mtProviderListRefreshing.set(true);this.mtProviderListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.mtProviderListRefreshEpoch && projectId===this.projectId;
    try {
      const providers=await this.api.listMtProviders(projectId);
      if(!current())return;
      this.mtProviders.set(providers);
      this.mtProviderListRefreshNotice.set('Provider metadata was refreshed. Drafts, Fill empty choices and results, and automation provider choice were kept. This is not a provider availability or health check.');
    } catch {
      if(current())this.mtProviderListRefreshNotice.set('Provider metadata could not be refreshed. The previous list, drafts, choices and results were kept. Try Refresh provider list again.');
    } finally {if(current())this.mtProviderListRefreshing.set(false);}
  }
  samlInfoRefreshing = signal(false);
  samlInfoRefreshNotice = signal('');
  private samlInfoRefreshEpoch = 0;
  private invalidateSamlInfoRefresh() {this.samlInfoRefreshEpoch++;this.samlInfoRefreshing.set(false);this.samlInfoRefreshNotice.set('');}
  canRefreshSamlInfo():boolean {return !this.tokenCopyDeparted && !this.busy() && !this.samlInfoRefreshing();}
  async refreshSamlInfo() {
    if(!this.canRefreshSamlInfo())return;
    const epoch=++this.samlInfoRefreshEpoch,projectId=this.projectId,previous=this.samlInfo();
    this.samlInfoRefreshing.set(true);this.samlInfoRefreshNotice.set('');
    const active=()=>!this.tokenCopyDeparted && epoch===this.samlInfoRefreshEpoch && projectId===this.projectId;
    const current=()=>active() && this.samlInfo()===previous && !this.busy();
    try {
      const info=await this.api.getSamlSpInfo();
      if(!current())return;
      this.samlInfo.set(info);
      this.samlInfoRefreshNotice.set('SAML display metadata was refreshed. Other settings, drafts, choices and earlier results were kept. This is a configuration snapshot, not a sign-in, trust or effective-access check.');
    } catch {
      if(current())this.samlInfoRefreshNotice.set('SAML display metadata could not be refreshed. Previous display, drafts, choices and earlier results were kept. Try Refresh SAML configuration again.');
    } finally {if(active())this.samlInfoRefreshing.set(false);}
  }
  generalMetadataRefreshing = signal(false);
  generalMetadataRefreshNotice = signal('');
  private generalMetadataRefreshEpoch = 0;
  private invalidateGeneralMetadataRefresh() {this.generalMetadataRefreshEpoch++;this.generalMetadataRefreshing.set(false);this.generalMetadataRefreshNotice.set('');}
  canRefreshGeneralMetadata():boolean {return !this.tokenCopyDeparted && !this.busy() && !!this.project() && !this.generalMetadataRefreshing();}
  async refreshGeneralMetadata() {
    if(!this.canRefreshGeneralMetadata())return;
    const epoch=++this.generalMetadataRefreshEpoch,projectId=this.projectId,previous=this.project();
    this.generalMetadataRefreshing.set(true);this.generalMetadataRefreshNotice.set('');
    const active=()=>!this.tokenCopyDeparted && epoch===this.generalMetadataRefreshEpoch && projectId===this.projectId;
    const current=()=>active() && this.project()===previous && !this.busy();
    try {
      const fresh=await this.api.getProject(projectId);
      if(!current())return;
      this.project.set({...previous!,name:fresh.name,description:fresh.description});
      this.generalMetadataRefreshNotice.set('Loaded name and description were refreshed. Your inputs and other settings were kept. Discard unsaved edits now uses these loaded values. Nothing was saved; Save remains explicit and is not a conflict-checked merge.');
    } catch {
      if(current())this.generalMetadataRefreshNotice.set('General details could not be refreshed. Previous loaded values, your inputs and other settings were kept. Try Refresh loaded details again.');
    } finally {if(active())this.generalMetadataRefreshing.set(false);}
  }
  originListRefreshing = signal(false);
  originListRefreshNotice = signal('');
  private originListRefreshEpoch = 0;
  private invalidateOriginListRefresh() {this.originListRefreshEpoch++;this.originListRefreshing.set(false);this.originListRefreshNotice.set('');}
  canRefreshOriginList():boolean {return !this.tokenCopyDeparted && !this.busy() && !!this.project() && !this.originListRefreshing() && this.confirmingOrigin()===null;}
  async refreshOriginList() {
    if(!this.canRefreshOriginList())return;
    const epoch=++this.originListRefreshEpoch,projectId=this.projectId,previous=this.project();
    this.originListRefreshing.set(true);this.originListRefreshNotice.set('');
    const active=()=>!this.tokenCopyDeparted && epoch===this.originListRefreshEpoch && projectId===this.projectId;
    const current=()=>active() && this.project()===previous && !this.busy() && this.confirmingOrigin()===null;
    try {
      const fresh=await this.api.getProject(projectId);
      if(!current())return;
      this.project.set({...previous!,embedOrigins:fresh.embedOrigins});
      this.originListRefreshNotice.set('Origin metadata was refreshed. Drafts, new-origin text and earlier results were kept. Other loaded settings were not refreshed; this is not a current availability or permission check.');
    } catch {
      if(current())this.originListRefreshNotice.set('Origin metadata could not be refreshed. The previous list, drafts, choices and results were kept. Try Refresh origin list again.');
    } finally {if(active())this.originListRefreshing.set(false);}
  }
  statusListRefreshing = signal(false);
  statusListRefreshNotice = signal('');
  private statusListRefreshEpoch = 0;
  private invalidateStatusListRefresh() {this.statusListRefreshEpoch++;this.statusListRefreshing.set(false);this.statusListRefreshNotice.set('');}
  canRefreshStatusList():boolean {return !this.tokenCopyDeparted && !this.busy() && !!this.project() && !this.statusListRefreshing() && this.confirmingStatus()===null;}
  async refreshStatusList() {
    if(!this.canRefreshStatusList())return;
    const epoch=++this.statusListRefreshEpoch,projectId=this.projectId,previous=this.project();
    this.statusListRefreshing.set(true);this.statusListRefreshNotice.set('');
    const active=()=>!this.tokenCopyDeparted && epoch===this.statusListRefreshEpoch && projectId===this.projectId;
    const current=()=>active() && this.project()===previous && !this.busy() && this.confirmingStatus()===null;
    try {
      const fresh=await this.api.getProject(projectId);
      if(!current())return;
      this.project.set({...previous!,customStatuses:fresh.customStatuses});
      this.statusListRefreshNotice.set('Custom-status metadata was refreshed. Drafts, new-status text and earlier results were kept. Other loaded settings were not refreshed; this is not a current availability or permission check.');
    } catch {
      if(current())this.statusListRefreshNotice.set('Custom-status metadata could not be refreshed. The previous list, drafts, choices and results were kept. Try Refresh status list again.');
    } finally {if(active())this.statusListRefreshing.set(false);}
  }
  localeListRefreshing = signal(false);
  localeListRefreshNotice = signal('');
  private localeListRefreshEpoch = 0;
  private invalidateLocaleListRefresh() {this.localeListRefreshEpoch++;this.localeListRefreshing.set(false);this.localeListRefreshNotice.set('');}
  canRefreshLocaleList():boolean {return !this.tokenCopyDeparted && !this.busy() && !!this.project() && !this.localeListRefreshing() && this.confirmingLocale()===null;}
  async refreshLocaleList() {
    if(!this.canRefreshLocaleList())return;
    const epoch=++this.localeListRefreshEpoch,projectId=this.projectId,previous=this.project();
    this.localeListRefreshing.set(true);this.localeListRefreshNotice.set('');
    const active=()=>!this.tokenCopyDeparted && epoch===this.localeListRefreshEpoch && projectId===this.projectId;
    const current=()=>active() && this.project()===previous && !this.busy() && this.confirmingLocale()===null;
    try {
      const fresh=await this.api.getProject(projectId);
      if(!current())return;
      this.project.set({...previous!,locales:fresh.locales});
      this.localeListRefreshNotice.set('Locale metadata was refreshed. Drafts, target choices and earlier results were kept. Other loaded settings were not refreshed; this is not a current availability or permission check.');
    } catch {
      if(current())this.localeListRefreshNotice.set('Locale metadata could not be refreshed. The previous list, drafts, choices and results were kept. Try Refresh locale list again.');
    } finally {if(active())this.localeListRefreshing.set(false);}
  }
  missingRuleLocales():string[] {const project=this.project();return project?[...new Set(this.newRuleLocales())].filter(code=>!project.locales.some(locale=>locale.code===code && locale.code!==project.baseLocale)):[];}
  mtLocaleMissing():boolean {const project=this.project();return !!project && this.mtLocale()!=='' && !project.locales.some(locale=>locale.code===this.mtLocale() && locale.code!==project.baseLocale);}
  validMtTarget():boolean {const project=this.project();return !!project && project.locales.some(locale=>locale.code===this.mtLocale() && locale.code!==project.baseLocale);}
  validMtProvider():boolean {return this.mtProviders().some(provider=>provider.id===this.mtProviderId() && provider.enabled);}
  missingMtProvider(id:string):boolean {return id!=='' && !this.mtProviders().some(provider=>provider.id===id);}
  mtBranchesRefreshing = signal(false);
  mtBranchesRefreshNotice = signal('');
  private mtBranchRefreshEpoch = 0;
  private invalidateMtBranchRefresh() {
    this.mtBranchRefreshEpoch++;this.mtBranchesRefreshing.set(false);this.mtBranchesRefreshNotice.set('');
  }
  mtBranchMissing():boolean {return !this.branches().some(branch=>branch.name===this.mtBranch());}
  canRefreshMtBranches():boolean {return !this.tokenCopyDeparted && !this.busy() && !this.mtBranchesRefreshing();}
  async refreshMtBranches() {
    if(!this.canRefreshMtBranches())return;
    const epoch=++this.mtBranchRefreshEpoch,projectId=this.projectId;
    this.mtBranchesRefreshing.set(true);this.mtBranchesRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.mtBranchRefreshEpoch && projectId===this.projectId;
    try {
      const branches=await this.api.listBranches(projectId);
      if(!current())return;
      this.branches.set(branches);
      this.mtBranchesRefreshNotice.set('Pre-translation branch choices were refreshed. Your selected provider, locale and branch, earlier pseudo result and other drafts were kept. This is not a current availability or permission check.');
    } catch {
      if(current())this.mtBranchesRefreshNotice.set('Pre-translation branch choices could not be refreshed. The previous choices, selected provider, locale and branch, earlier pseudo result and other drafts were kept. Try Refresh pre-translation branches again.');
    } finally {if(current())this.mtBranchesRefreshing.set(false);}
  }
  otaPublishBranches = signal<BranchInfo[]>([]);
  otaBranchesRefreshing = signal(false);
  otaBranchesRefreshNotice = signal('');
  private otaBranchRefreshEpoch = 0;
  private invalidateOtaBranchRefresh() {
    this.otaBranchRefreshEpoch++;this.otaBranchesRefreshing.set(false);this.otaBranchesRefreshNotice.set('');
  }
  otaBranchMissing():boolean {return !this.otaPublishBranches().some(branch=>branch.name===this.otaBranch());}
  canRefreshOtaBranches():boolean {return !this.tokenCopyDeparted && !this.busy() && !this.otaBranchesRefreshing();}
  async refreshOtaBranches() {
    if(!this.canRefreshOtaBranches())return;
    const epoch=++this.otaBranchRefreshEpoch,projectId=this.projectId;
    this.otaBranchesRefreshing.set(true);this.otaBranchesRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.otaBranchRefreshEpoch && projectId===this.projectId;
    try {
      const branches=await this.api.listBranches(projectId);
      if(!current())return;
      this.otaPublishBranches.set(branches);
      this.otaBranchesRefreshNotice.set('Publish branch choices were refreshed. Your selected branch, earlier receipt, publication list and other drafts were kept. This is not a current availability or publish-permission check.');
    } catch {
      if(current())this.otaBranchesRefreshNotice.set('Publish branch choices could not be refreshed. The previous choices, selected branch, earlier receipt, publication list and other drafts were kept. Try Refresh publish branches again.');
    } finally {if(current())this.otaBranchesRefreshing.set(false);}
  }
  otaListRefreshing = signal(false);
  otaListRefreshNotice = signal('');
  private otaListRefreshEpoch = 0;
  private invalidateOtaListRefresh() {
    this.otaListRefreshEpoch++;this.otaListRefreshing.set(false);this.otaListRefreshNotice.set('');
  }
  canRefreshOtaList():boolean {
    return !this.tokenCopyDeparted && !this.busy() && !this.otaListRefreshing();
  }
  async refreshOtaList() {
    if(!this.canRefreshOtaList())return;
    const epoch=++this.otaListRefreshEpoch,projectId=this.projectId;
    this.otaListRefreshing.set(true);this.otaListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.otaListRefreshEpoch && projectId===this.projectId;
    try {
      const publications=await this.api.listOtaPublications(projectId);
      if(!current())return;
      this.otaPubs.set(publications);
      this.otaListRefreshNotice.set('Publication metadata was refreshed. Your selected branch, earlier receipt and other drafts were kept. This does not verify bundles, deployment or current availability.');
    } catch {
      if(current())this.otaListRefreshNotice.set('Publication metadata could not be refreshed. The previous list, selected branch, earlier receipt and other drafts were kept. Try Refresh publication list again.');
    } finally {if(current())this.otaListRefreshing.set(false);}
  }
  ruleListRefreshing = signal(false);
  ruleListRefreshNotice = signal('');
  private ruleListRefreshEpoch = 0;
  private invalidateRuleListRefresh() {
    this.ruleListRefreshEpoch++;this.ruleListRefreshing.set(false);this.ruleListRefreshNotice.set('');
  }
  canRefreshRuleList():boolean {
    return !this.tokenCopyDeparted && !this.busy() && !this.ruleListRefreshing();
  }
  async refreshRuleList() {
    if(!this.canRefreshRuleList())return;
    const epoch=++this.ruleListRefreshEpoch,projectId=this.projectId;
    this.ruleListRefreshing.set(true);this.ruleListRefreshNotice.set('');
    const current=()=>!this.tokenCopyDeparted && epoch===this.ruleListRefreshEpoch && projectId===this.projectId;
    try {
      const rules=await this.api.listAutomationRules(projectId);
      if(!current())return;
      this.autoRules.set(rules);
      this.ruleListRefreshNotice.set('Rule metadata was refreshed. All new-rule fields, choices and earlier receipts were kept. This is not a run history, delivery verification or current-authority check.');
    } catch {
      if(current())this.ruleListRefreshNotice.set('Rule metadata could not be refreshed. The previous list, new-rule fields, choices and earlier receipts were kept. Try Refresh rule list again.');
    } finally {if(current())this.ruleListRefreshing.set(false);}
  }
  tokenCopyPending = signal(false);
  tokenCopyNotice = signal('');
  async copyCreatedToken() {
    const reveal=this.createdToken(),projectId=this.projectId;
    if(this.tokenCopyDeparted || !reveal || this.tokenCopyPending() || this.hookCopyPending())return;
    this.tokenCopyPending.set(true);this.tokenCopyNotice.set('');
    let accepted=false;
    try {await navigator.clipboard.writeText(reveal.token);accepted=true;} catch { /* Show only bounded feedback, never raw clipboard errors. */ }
    finally {
      this.tokenCopyPending.set(false);
      if(!this.tokenCopyDeparted && this.projectId===projectId && this.createdToken()===reveal) {
        this.tokenCopyNotice.set(accepted?'The browser accepted the token clipboard write. This does not confirm pasting or how long the clipboard keeps it.':'The browser did not confirm copying the token. Keep the reveal open and try Copy again, or select the token and copy it manually.');
      }
    }
  }
  hookCopyPending = signal(false);
  hookCopyNotice = signal('');
  async copyCreatedWebhook() {
    const reveal=this.createdWebhook(),projectId=this.projectId;
    if(this.tokenCopyDeparted || !reveal || this.hookCopyPending() || this.tokenCopyPending())return;
    this.hookCopyPending.set(true);this.hookCopyNotice.set('');
    let accepted=false;
    try {await navigator.clipboard.writeText(reveal.secret);accepted=true;} catch { /* Never display raw clipboard errors. */ }
    finally {
      this.hookCopyPending.set(false);
      if(!this.tokenCopyDeparted && this.projectId===projectId && this.createdWebhook()===reveal) {
        this.hookCopyNotice.set(accepted?'The browser accepted the signing-secret clipboard write. This does not confirm pasting or how long the clipboard keeps it.':'The browser did not confirm copying the signing secret. Keep the reveal open and try Copy again, or select the signing secret and copy it manually.');
      }
    }
  }
  canDiscardWebhookUrlDraft():boolean {return !this.busy() && this.hookUrl()!=='';}
  discardWebhookUrlDraft() {
    if(!this.canDiscardWebhookUrlDraft())return;
    this.hookUrl.set('');
    if(this.hookDraftNotice())this.hookDraftNotice.set('The submitted webhook was created. The local URL draft was discarded without refreshing Settings or deleting any saved webhook. Selected events stay for your next explicit Create. '+(this.createdWebhook()?'The signing secret above belongs to the submitted webhook.':'The one-time signing-secret reveal is no longer shown here.'));
  }
  hookRevealNotice = signal('');
  hideCreatedWebhook() {
    if(!this.createdWebhook())return;
    this.createdWebhook.set(null);
    this.hookCopyNotice.set('');
    this.hookRevealNotice.set('The one-time signing-secret reveal was hidden from this screen. The webhook was not deleted or disabled and its secret was not rotated. Clipboard, browser history and earlier copies were not cleared.'+(this.hookCopyPending()?' An in-progress clipboard write may still finish.':''));
    if(this.hookDraftNotice())this.hookDraftNotice.set(this.hookDraftNotice().replace('The signing secret above belongs to the submitted webhook', 'The hidden signing-secret reveal belonged to the submitted webhook'));
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
    this.invalidateWebhookListRefresh();
    this.hookDraftNotice.set('');
    try {
      const res = await this.api.createWebhook(this.projectId, { url: submitted.url.trim(), events });
      this.hookRevealNotice.set('');
      this.hookCopyNotice.set('');
      this.createdWebhook.set({ id: res.id, secret: res.secret });
      if(this.hookUrl()===submitted.url && this.hookTranslationUpdated()===submitted.translationUpdated && this.hookProjectRestored()===submitted.projectRestored) {
        this.hookUrl.set('');
      } else {
        this.hookDraftNotice.set('The submitted webhook was created. Your newer URL and event draft is kept here and has not been created. Review the URL and events before creating again. The signing secret above belongs to the submitted webhook, not this newer draft.');
      }
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  hookToggleNotice = signal('');
  async toggleHook(h: WebhookInfo) {
    const loaded=this.webhooks().find(row=>row.id===h.id);
    if(this.busy() || !loaded || loaded.active!==h.active)return;
    this.invalidateWebhookListRefresh();
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
  webhookDeletionEvents(hook:WebhookInfo):string[] {return [...hook.events];}
  askDeleteHook(id:string) {if(!this.busy() && this.webhooks().some(h=>h.id===id))this.confirmingHook.set(id);}
  cancelDeleteHook() {if(!this.busy())this.confirmingHook.set(null);}
  async removeHook(id: string) {
    if(this.busy() || this.confirmingHook()!==id || !this.webhooks().some(h=>h.id===id))return;
    this.invalidateWebhookListRefresh();
    this.busy.set(true); this.error.set(''); this.hookDeleteNotice.set('');
    try {
      await this.api.deleteWebhook(this.projectId, id);
      this.webhooks.set(this.webhooks().filter(h=>h.id!==id));
      this.hookDeleteNotice.set('The submitted webhook and its delivery history were deleted. Other webhooks were not deleted by this request.');
      this.confirmingHook.set(null);
      if (this.createdWebhook()?.id === id) {this.createdWebhook.set(null);this.hookCopyNotice.set('');}
      this.webhooks.set(await this.api.listWebhooks(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  tokenRevokeNotice = signal('');
  tokenRevocationScopes(token:ApiTokenInfo):string[] {return [...token.scopes];}
  askRevokeToken(id:string) {if(!this.busy() && this.tokens().some(t=>t.id===id))this.confirmingToken.set(id);}
  cancelRevokeToken() {if(!this.busy())this.confirmingToken.set(null);}
  async revokeToken(id: string) {
    if(this.busy() || this.confirmingToken()!==id || !this.tokens().some(t=>t.id===id))return;
    this.invalidateTokenListRefresh();
    this.busy.set(true); this.error.set(''); this.tokenRevokeNotice.set('');
    try {
      await this.api.revokeToken(id);
      this.tokens.set(this.tokens().filter(t=>t.id!==id));
      this.tokenRevokeNotice.set('The submitted API token was revoked. Other tokens were not revoked by this request.');
      this.confirmingToken.set(null);
      if (this.createdToken()?.id === id) {this.createdToken.set(null);this.tokenCopyNotice.set('');}
      this.tokens.set(await this.api.listTokens());
    }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  localeRemoveNotice = signal('');
  localeRemovalRules(code:string):AutomationRuleInfo[] {return this.autoRules().filter(rule=>rule.action==='pretranslate' && Array.isArray(rule.config['locales']) && rule.config['locales'].includes(code));}
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
  generalInputComparison():string {
    const p=this.project();if(!p)return '';
    const name=this.name()!==p.name,description=this.description()!==p.description;
    if(!name && !description)return 'Your name and description inputs match the loaded details. This does not check newer server changes.';
    const fields=name && description?'Name and description inputs differ':name?'Name input differs':'Description input differs';
    return fields+' from the loaded details. These differences are local, not a server conflict check. Save remains explicit; Discard unsaved edits replaces both inputs with the loaded values.';
  }
  canDiscardGeneralDraft():boolean {
    const p=this.project();
    return !!p && !this.busy() && (this.name()!==p.name || this.description()!==p.description);
  }
  discardGeneralDraft() {
    if(!this.canDiscardGeneralDraft())return;
    this.invalidateGeneralMetadataRefresh();
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
      await this.reload(submitted, true);
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
      this.project.set(await this.api.getProject(this.projectId));
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
  originAddPreview():string[] {return [...(this.project()?.embedOrigins ?? []),this.newOrigin().trim()];}
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
      this.project.set(await this.api.getProject(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }

  originRemovePreview(origin:string):string[] {return (this.project()?.embedOrigins ?? []).filter(entry=>entry!==origin);}
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
    this.invalidateMtProviderListRefresh();
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
    this.invalidateMtProviderListRefresh();
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

  providerRemovalRules(id:string):AutomationRuleInfo[] {return this.autoRules().filter(rule=>rule.action==='pretranslate' && rule.config['providerId']===id);}
  confirmingMtProvider = signal<string|null>(null);
  mtRemoveNotice = signal('');
  askRemoveMtProvider(id:string) {if(!this.busy() && this.mtProviders().some(p=>p.id===id))this.confirmingMtProvider.set(id);}
  cancelRemoveMtProvider() {if(!this.busy())this.confirmingMtProvider.set(null);}
  async removeMtProvider(p: MtProviderInfo) {
    if(this.busy() || this.confirmingMtProvider()!==p.id || !this.mtProviders().some(provider=>provider.id===p.id))return;
    this.invalidateMtProviderListRefresh();
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
    if(this.busy() || this.tokenCopyDeparted || this.mtBranchMissing() || !this.validMtTarget() || !this.validMtProvider())return;
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
  validNewRuleLocales():boolean {
    if(this.newRuleAction()!=='pretranslate')return true;
    const project=this.project(),locales=this.newRuleLocales();
    return !!project && locales.length>=1 && locales.length<=5 && locales.every(code=>project.locales.some(locale=>locale.code===code && locale.code!==project.baseLocale));
  }
  validNewRuleProvider():boolean {return this.newRuleAction()!=='pretranslate' || this.mtProviders().some(provider=>provider.id===this.newRuleProvider());}
  async addRule() {
    if(this.busy() || !this.validNewRuleName() || !this.validNewRulePayload() || !this.validNewRuleLocales() || !this.validNewRuleProvider())return;
    this.invalidateRuleListRefresh();
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
    this.invalidateRuleListRefresh();
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

  ruleRemovalConfig(rule:AutomationRuleInfo):string {return JSON.stringify(rule.config,null,2);}
  confirmingRule = signal<string|null>(null);
  ruleRemoveNotice = signal('');
  askRemoveRule(id:string) {if(!this.busy() && this.autoRules().some(r=>r.id===id))this.confirmingRule.set(id);}
  cancelRemoveRule() {if(!this.busy())this.confirmingRule.set(null);}
  async removeRule(r: AutomationRuleInfo) {
    if(this.busy() || this.confirmingRule()!==r.id || !this.autoRules().some(rule=>rule.id===r.id))return;
    this.invalidateRuleListRefresh();
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
  statusAddPreview():string[] {return [...(this.project()?.customStatuses ?? []),this.newStatus().trim().toUpperCase()];}
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
      this.project.set(await this.api.getProject(this.projectId));
    } catch (e) { this.error.set(e instanceof Error ? e.message : 'Failed'); }
    finally { this.busy.set(false); }
  }
  statusRemovePreview(st:string):string[] {return (this.project()?.customStatuses ?? []).filter(entry=>entry!==st);}
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
  validNewMemberLocales():boolean {
    const raw=this.memberLocales(),project=this.project();
    return !!project && (raw.trim()==='' || raw.split(',').every(part=>part.trim()!=='' && project.locales.some(locale=>locale.code===part.trim())));
  }
  async addMember() {
    if(this.busy() || !this.validNewMemberLocales())return;
    this.invalidateMemberListRefresh();
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
      this.members.set(await this.api.listMembers(this.projectId));
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
  validNewGroupLocales():boolean {
    const raw=this.groupLocales(),project=this.project();
    return !!project && (raw.trim()==='' || raw.split(',').every(part=>part.trim()!=='' && project.locales.some(locale=>locale.code===part.trim())));
  }
  async addGroup() {
    if(this.busy() || !this.validNewGroupName() || !this.validNewGroupLocales())return;
    this.invalidateGroupListRefresh();
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
      this.groups.set(await this.api.listGroups(this.projectId));
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
    this.invalidateGroupListRefresh();
    const role=this.groupRolePick()[g.id];
    this.groupRolePending.set({ ...this.groupRolePending(), [g.id]: true });
    this.groupRoleNotice.set({ ...this.groupRoleNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { role });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,role}:row));
      if(this.groupRolePick()[g.id]===role){const next={...this.groupRolePick()};delete next[g.id];this.groupRolePick.set(next);}
      this.groupRoleNotice.set({ ...this.groupRoleNotice(), [g.id]: 'The submitted group role was saved. Any newer role selection has not been saved by this request. Review the current group role before saving again.' });
      this.groups.set(await this.api.listGroups(this.projectId));
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
    this.invalidateGroupListRefresh();
    const raw=this.groupNamePick()[g.id],name=raw.trim();
    this.groupNamePending.set({ ...this.groupNamePending(), [g.id]: true });
    this.groupNameNotice.set({ ...this.groupNameNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { name });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,name}:row));
      if(this.groupNamePick()[g.id]===raw){const next={...this.groupNamePick()};delete next[g.id];this.groupNamePick.set(next);}
      this.groupNameNotice.set({ ...this.groupNameNotice(), [g.id]: 'The submitted group name was saved. Any newer name text has not been saved by this request. Review the current group name before saving again.' });
      this.groups.set(await this.api.listGroups(this.projectId));
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
    this.invalidateGroupListRefresh();
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
    this.invalidateGroupListRefresh();
    this.groupMemberPending.set({ ...this.groupMemberPending(), [g.id]: true });
    this.groupMemberNotice.set({ ...this.groupMemberNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.addGroupMember(this.projectId, g.id, userId);
      if(this.groupPick()[g.id]===userId)this.groupPick.set({ ...this.groupPick(), [g.id]: '' });
      this.groupMemberNotice.set({ ...this.groupMemberNotice(), [g.id]: 'The submitted member was added. Any selection shown here has not been added by this request. Choose Add member to apply it.' });
      this.groups.set(await this.api.listGroups(this.projectId));
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
    this.invalidateGroupListRefresh();
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
    this.invalidateMemberListRefresh();
    const role=this.memberRolePick()[m.id];
    this.memberRolePending.set({ ...this.memberRolePending(), [m.id]: true });
    this.memberRoleNotice.set({ ...this.memberRoleNotice(), [m.id]: '' });
    this.error.set('');
    try {
      await this.api.updateMember(this.projectId, m.id, { role });
      this.members.set(this.members().map(row=>row.id===m.id?{...row,role}:row));
      if(this.memberRolePick()[m.id]===role){const next={...this.memberRolePick()};delete next[m.id];this.memberRolePick.set(next);}
      this.memberRoleNotice.set({ ...this.memberRoleNotice(), [m.id]: 'The submitted direct team role was saved. Any newer role selection has not been saved by this request. Review the current direct team role before saving again.' });
      this.members.set(await this.api.listMembers(this.projectId));
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
    this.invalidateMemberListRefresh();
    const raw=this.memberLocalesPick()[m.id],allowedLocales=this.parsedMemberLocales(raw);
    this.memberLocalesPending.set({ ...this.memberLocalesPending(), [m.id]: true });
    this.memberLocalesNotice.set({ ...this.memberLocalesNotice(), [m.id]: '' });
    this.error.set('');
    try {
      await this.api.updateMember(this.projectId, m.id, { allowedLocales });
      this.members.set(this.members().map(row=>row.id===m.id?{...row,allowedLocales}:row));
      if(this.memberLocalesPick()[m.id]===raw){const next={...this.memberLocalesPick()};delete next[m.id];this.memberLocalesPick.set(next);}
      this.memberLocalesNotice.set({ ...this.memberLocalesNotice(), [m.id]: 'The submitted direct locale scope was saved. Any newer locale text has not been saved by this request. Group grants still combine; review effective access before saving again.' });
      this.members.set(await this.api.listMembers(this.projectId));
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
    this.invalidateGroupListRefresh();
    const raw=this.groupLocalesPick()[g.id],allowedLocales=this.parsedGroupLocales(raw);
    this.groupLocalesPending.set({ ...this.groupLocalesPending(), [g.id]: true });
    this.groupLocalesNotice.set({ ...this.groupLocalesNotice(), [g.id]: '' });
    this.error.set('');
    try {
      await this.api.updateGroup(this.projectId, g.id, { allowedLocales });
      this.groups.set(this.groups().map(row=>row.id===g.id?{...row,allowedLocales}:row));
      if(this.groupLocalesPick()[g.id]===raw){const next={...this.groupLocalesPick()};delete next[g.id];this.groupLocalesPick.set(next);}
      this.groupLocalesNotice.set({ ...this.groupLocalesNotice(), [g.id]: 'The submitted group locale scope was saved. Any newer locale text has not been saved by this request. Other grants still combine; review effective access before saving again.' });
      this.groups.set(await this.api.listGroups(this.projectId));
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
    this.invalidateMemberListRefresh();
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
