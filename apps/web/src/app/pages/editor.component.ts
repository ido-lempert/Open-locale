import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, Optional, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { hintsForTarget, GlossaryHint } from '../glossary-match';
import { detectImportFormat, IoFormat } from '../import-format';
import { mergeFormsForSave, pluralCategories } from '../plural-forms';
import { ApiService, BranchInfo, ScreenshotMeta, TmSuggestion, GlossaryTermItem, CommentEntry, HistoryEntry, Key, Project, TranslationStatus } from '../api.service';

interface ImportScope { generation: number; keysGeneration: number; branch: string; locale: string; format: IoFormat; }

interface CellState {
  value: string; saved: string;
  // Per-CLDR-category text for plural keys; {} for plain keys.
  forms: Record<string, string>; savedForms: Record<string, string>;
  version?: number; rowId?: string; needsReload?: boolean; reviewing?: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  errorMsg: string;
  review: TranslationStatus;
  // MT provenance of the saved value; null after any human save.
  mtScore: number | null; mtProvider: string | null;
}

@Component({
  selector: 'ol-editor',
  styles: [`.grid td.key { white-space: normal; max-width: 22rem; }
  @media (max-width: 760px) {
    .grid td.key { max-width: none; }
    .tags { display: flex; margin: .35rem 0; max-width: 100%; }
    .tag-edit { width: 100%; min-width: 0; flex: 1 1 100%; }
  }`],
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="bar">
      <a routerLink="/projects" class="back">&larr; Projects</a>
      <h1>{{ project()?.name ?? (projectError() ? 'Project unavailable' : 'Loading…') }}</h1>
      <a [routerLink]="['/projects', projectId, 'qa']" class="qa-link">QA</a>
      <a [routerLink]="['/projects', projectId, 'reports']" class="reports-link">Progress</a>
      <a [routerLink]="['/projects', projectId, 'glossary']" class="glossary-link">Glossary</a>
      <a [routerLink]="['/projects', projectId, 'tasks']" class="tasks-link">Tasks</a>
      <a [routerLink]="['/projects', projectId, 'activity']" class="activity-link">Activity</a>
      <a [routerLink]="['/projects', projectId, 'snapshots']" class="snapshots-link">Snapshots</a>
      <a [routerLink]="['/projects', projectId, 'sync']" class="sync-link">File sync preview</a>
      <a [routerLink]="['/projects', projectId, 'settings']" class="settings-link">Settings</a>
      <span class="muted">{{ keys().length }} keys</span>
    </header>
    <main>
      @if (projectLoading()) { <p class="muted" role="status" name="projectLoading">Loading project and branches.</p> }
      @else if (projectError()) { <p class="error" role="alert" name="projectError">Project unavailable. Check your access or connection, then retry.</p><button type="button" name="retryProject" (click)="loadProject()">Retry project</button> }
      @if (project(); as p) {
        <section class="toolbar">
          <select #branchPicker aria-label="Branch" [disabled]="!canSwitchBranch()" [attr.aria-describedby]="!canSwitchBranch()?'branchSwitchScope':null" [ngModel]="branch()" (ngModelChange)="pickBranch($event,branchPicker)" name="branch">
            @for (b of branches(); track b.id) { <option [value]="b.name">{{ b.name }}</option> }
          </select>
          @if(!canSwitchBranch()){<p class="muted" name="branchSwitchBlocked" id="branchSwitchScope">Branch switching unavailable. Save local translation drafts and wait for pending saves or reviews. For unconfirmed results, copy retained values before reloading. Other navigation and filters are not protected by this control.</p>}
          <form class="branch-form" (ngSubmit)="addBranch()">
            <input placeholder="new-empty-branch" aria-label="New branch name" [ngModel]="newBranch()" (ngModelChange)="newBranch.set($event)" name="newBranch" maxlength="40" />
            <button type="submit" name="addBranch" [disabled]="branchCreating() || branchCreateUnknown()">{{ branchCreating() ? 'Creating branch...' : 'Add empty branch' }}</button>
          </form>
          @if (branchCreateUnknown()) { <p class="error" role="alert" name="branchCreateUnknown">Branch creation could not be confirmed. Creation is paused. Check current branches before another create; this read does not retry creation, switch branches or reload translations.</p><button type="button" name="checkCurrentBranches" (mousedown)="$event.preventDefault()" [disabled]="branchListLoading() || branchCreating()" (click)="checkCurrentBranches()">Check current branches</button> }
          @if (branchListError()) { <span class="error" role="alert" name="branchListError">Branch list unavailable. A confirmed new branch may not appear yet.</span>@if (!branchCreateUnknown()) { <button type="button" name="retryEditorBranches" (mousedown)="$event.preventDefault()" [disabled]="!branchRetryReady()" (click)="retryBranches()">Retry branch list</button> } }
          @if (branch() !== 'main') {
            <button name="previewMerge" [disabled]="mergePreviewLoading() || mergePending()" (click)="mergeIntoMain()">{{ mergePreviewLoading() ? 'Loading merge preview...' : 'Merge ' + branch() + ' into main' }}</button>
          }
          <button type="button" name="findSavedText" (mousedown)="$event.preventDefault()" [disabled]="!canOpenSavedSearch()" (click)="openSavedSearch()" [attr.aria-describedby]="!canOpenSavedSearch()?'savedSearchDepartureScope':null">Find saved text</button>
          @if(!canOpenSavedSearch()){<span class="muted" name="savedSearchDepartureBlocked" id="savedSearchDepartureScope">Find saved text unavailable. Save local translation drafts and wait for pending work. If a result is unconfirmed, copy retained values before reloading. Other navigation is not protected by this action.</span>}
          <input #keyNameFilter class="search" placeholder="Search keys" aria-label="Search keys" [disabled]="!canChangeKeyFilters()" [attr.aria-describedby]="!canChangeKeyFilters()?'keyFiltersScope':null" [ngModel]="search()" (ngModelChange)="pickKeyFilter('search',$event,keyNameFilter)" />
          <input #keyTagFilter class="tag-filter" placeholder="tag" aria-label="Filter by tag" [disabled]="!canChangeKeyFilters()" [attr.aria-describedby]="!canChangeKeyFilters()?'keyFiltersScope':null" [ngModel]="filterTag()" (ngModelChange)="pickKeyFilter('filterTag',$event,keyTagFilter)" />
          <select #keyStatusFilter aria-label="Filter by review status" [disabled]="!canChangeKeyFilters()" [attr.aria-describedby]="!canChangeKeyFilters()?'keyFiltersScope':null" [ngModel]="filterStatus()" (ngModelChange)="pickKeyFilter('filterStatus',$event,keyStatusFilter)">
            <option value="">all statuses</option>
            @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
          </select>
          @if(!canChangeKeyFilters()){<p class="muted" name="keyFiltersBlocked" id="keyFiltersScope">Key filters are paused. Save local translation drafts and wait for pending saves or reviews. For unconfirmed results, copy retained values before reloading. Other navigation and explicit reload are not protected by these filters.</p>}
          @if (filterStatus()) {
            <span class="review-queue">
              queue: {{ ioLocale() }}
              <select aria-label="Bulk set status" [ngModel]="bulkStatus()" (ngModelChange)="bulkStatus.set($event)" name="bulkStatus">
                @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
              </select>
              <button name="bulkMark" [disabled]="!canBulkReview() || bulkReviewPending()" (click)="bulkMark()">{{ bulkReviewPending() ? 'Reviewing...' : 'Mark all' }}</button>
              @if (!canBulkReview()) { <span name="bulkReviewBlocked" class="muted">Bulk review unavailable. Save local drafts and wait for pending work, or copy retained values before reloading an unconfirmed result.</span> }
            </span>
          }
          <form class="inline" (ngSubmit)="addKey()">
            <input placeholder="new.key.name" aria-label="New key name" [ngModel]="newKey()" (ngModelChange)="newKey.set($event)" name="newKey" required />
            <button type="submit" name="addKey" [disabled]="keyCreating() || keyCreateError()">{{ keyCreating() ? 'Creating key...' : 'Add key' }}</button>
          </form>
          @if (keyCreateError()) { <span class="error" name="keyCreateError" role="alert">Key creation could not be confirmed on branch "{{ keyCreateBranch() }}". Creation is paused. Copy retained translation values, then read that branch without key filters before another create. A read does not retry creation or prove that a missing key was never created.</span><button type="button" name="reloadAfterKeyCreate" (mousedown)="$event.preventDefault()" [disabled]="!keyCreateRecoveryReady()" (click)="prepareKeyCreateReload()">Review retained values before reload</button> }
          <form class="inline" (ngSubmit)="addLocale()">
            <input placeholder="locale (e.g. fr)" aria-label="New locale code" [ngModel]="newLocale()" (ngModelChange)="newLocale.set($event)" name="newLocale" required maxlength="10" />
            <button type="submit" name="addLocale" [disabled]="localeCreating() || localeCreateError()">{{ localeCreating() ? 'Adding locale...' : 'Add locale' }}</button>
          </form>
          @if (localeCreateError()) { <span class="error" role="alert" name="localeCreateError">Locale addition could not be confirmed. Additions are paused. Check current locale codes before another addition; this read does not retry addition, reload translations or replace editor columns.</span><button type="button" name="checkCurrentLocales" (mousedown)="$event.preventDefault()" [disabled]="!localeRecoveryReady()" (click)="checkCurrentLocales()">Check current locale codes</button> }
          @if (localeRecoveryLoading()) { <p class="muted" role="status" name="localeRecoveryLoading">Reading current locale codes...</p> }
          @if (localeRecoveryError()) { <p class="error" role="alert" name="localeRecoveryError">Current locale codes unavailable. Additions remain paused; retry this read.</p> }
          @if (localeRecoveryCodes(); as codes) { <p class="muted" name="localeRecoveryCodes">Locale codes from the last check: {{ codes.join(', ') || '(none returned)' }}. Editor columns and local values were kept and may differ. This is not automatic refresh or confirmation of which request added a locale.</p> }
          <select [ngModel]="ioFormat()" (ngModelChange)="onFormatPick($event)" name="ioFormat" aria-label="Import/export format">
            <option value="json">JSON</option>
            <option value="csv">CSV (spreadsheet-safe)</option>
            <option value="android">Android XML</option>
            <option value="po">PO (gettext)</option>
            <option value="pot">POT (gettext template)</option>
            <option value="xliff">XLIFF 1.2</option>
            <option value="resx">RESX (.NET)</option>
            <option value="properties">Java properties</option>
            <option value="arb">ARB (Flutter)</option>
            <option value="yaml">YAML</option>
            <option value="ios">iOS strings</option>
            <option value="stringsdict">iOS .stringsdict (plurals)</option>
          </select>
          <button name="exportFile" (mousedown)="$event.preventDefault()" [disabled]="exportPending()" (click)="exportFile()">Export {{ formatLabel() }}</button>
          <button name="exportBundle" (mousedown)="$event.preventDefault()" [disabled]="exportPending()" (click)="exportBundleFile()" title="Download every locale as one zip in the selected format">Export all (.zip)</button>
          <button name="exportTmx" (mousedown)="$event.preventDefault()" [disabled]="exportPending()" (click)="exportTmxFile()" title="Download the translation memory for the selected locale as TMX 1.4 (export-only)">Export TM (TMX)</button>
          <label class="import">Import {{ formatLabel() }} <input type="file" name="importFile" [disabled]="importPending()" accept=".json,.csv,.xml,.strings,.stringsdict,.po,.pot,.xlf,.xliff,.properties,.arb,.yaml,.yml,.resx" (change)="importFile($event)" hidden /></label>
          <label class="import">Preview import <input type="file" name="previewFile" [disabled]="importPending()" accept=".json,.csv,.xml,.strings,.stringsdict,.po,.pot,.xlf,.xliff,.properties,.arb,.yaml,.yml,.resx" (change)="previewFile($event)" hidden /></label>
          <label class="import" title="Upload a store-only zip from Export all (.zip); compressed zips from other tools are rejected. Each locale imports independently: skipped entries and failed locales are reported, not rolled back.">Import bundle (.zip) <input type="file" name="bundleFile" [disabled]="importPending()" accept=".zip" (change)="bundleFile($event)" hidden /></label>
          <div class="muted csv-note">.zip bundles: store-only archives from Export all (.zip) only - compressed zips are rejected. Each locale imports independently; skipped entries and failed locales are reported, not rolled back.</div>
          @if (ioFormat() === 'csv') {
            <div class="muted csv-note">CSV exports are spreadsheet-safe: values starting with formula characters get a protective prefix, so re-importing a safe export keeps those prefixes and changes stored values. For a lossless roundtrip use the API with <code>mode=raw</code>.</div>
          }
          <div class="muted csv-note">Exports contain saved server values only, not unsaved local drafts. TMX exports project translation memory for the selected locale, not just this branch.</div>
          @if (exportPending()) { <span role="status" name="exportPending">Export request pending. Changing branch, locale or format discards its download, not the request already sent.</span> }
          @if (exportError()) { <span class="error" role="alert" name="exportError">Export unavailable. Check your access or connection, then try again.</span> }
          @if (exportNotice()) { <span role="status" name="exportNotice">{{ exportNotice() }}</span> }
          @if (importPending()) { <span role="status" name="importPending">Import request pending. Changing scope does not cancel a request already sent.</span> }
          @if (importConflict(); as c) {
            <div class="import-conflict" role="alert">
              <span>{{ c.filename }} has a .{{ c.ext }} extension, which usually means {{ labelFor(c.detected) }}, but the format is set to {{ labelFor(c.current) }}. Nothing was imported yet.</span>
              <button type="button" (click)="resolveImportConflict(true)">{{ c.dryRun ? 'Preview as' : 'Import as' }} {{ labelFor(c.detected) }}</button>
              <button type="button" (click)="resolveImportConflict(false)">{{ c.dryRun ? 'Preview as' : 'Keep' }} {{ labelFor(c.current) }}</button>
              <button type="button" (click)="cancelImportPick()">Cancel</button>
            </div>
          }
          <select [ngModel]="ioLocale()" (ngModelChange)="onIoLocalePick($event)" name="ioLocale" aria-label="Import/export locale">
            @for (l of p.locales; track l.code) { <option [value]="l.code">{{ l.code }}</option> }
          </select>
        </section>
        @if (notice()) { <p class="notice">{{ notice() }}</p> }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (keysLoading()) { <p class="muted" role="status" name="keysLoading">Loading keys. The previous grid may remain below, read-only until the current read succeeds.</p> }
        @else if (keysError()) { <p class="error" role="alert" name="keysError">Keys unavailable. The previous grid may remain below, read-only. Retry replaces it with the current server result; keep any unsaved work first.</p><button type="button" name="retryKeys" (click)="reload()">Retry keys</button>
        }
          @if (retainedDownloadReady()) { <details><summary name="localGridBackupToggle" (mousedown)="$event.preventDefault()">Copy or download local grid values before leaving or reloading</summary><p class="muted">Local displayed values only, not confirmed saved data or an import file. Includes plural forms. Select and copy this text before leaving or reloading. Pending work may still finish; this copy does not wait for it.</p><textarea name="retainedKeyDrafts" aria-label="Retained grid values" readonly rows="8" style="width:100%;box-sizing:border-box" [value]="retainedGridValues()"></textarea><button type="button" name="downloadRetainedGrid" (mousedown)="$event.preventDefault()" [disabled]="!retainedDownloadReady()" (click)="downloadRetainedGrid()">Download retained values (.json)</button><p class="muted" name="retainedDownloadScope">Local backup of this retained grid only, including plural forms. Not confirmed saved data, not all project keys and not an import file. May contain private translation text; it is not uploaded or shared.</p>@if (retainedDownloadNotice()) { <p role="status" name="retainedDownloadNotice">{{ retainedDownloadNotice() }}</p> }</details> }
        @if (!keysLoading() && !keysError() && keys().length === 0) {
          @if (hasKeyFilters()) {
            <p class="muted empty" name="filteredKeysEmpty">No keys match the current filters on branch {{ branch() }}. Other keys may still exist.</p>
            <button type="button" name="clearKeyFilters" [disabled]="!canChangeKeyFilters()" (click)="clearKeyFilters()">Clear key filters</button>
          } @else {
            <p class="muted empty" name="branchKeysEmpty">No keys on branch {{ branch() }}. Add one above - for example <code>home.title</code>.</p>
          }
        }
        @for (k of keys(); track k.id) {
          @if (keyDeleteErrorFor().includes(k.id)) { <p class="error" role="alert" name="keyDeleteError">Deletion of key "{{ k.name }}" could not be confirmed. Deletion stays paused. Copy retained translation values before reading current keys; this does not retry deletion.</p><button type="button" name="reloadAfterKeyDelete" (mousedown)="$event.preventDefault()" [disabled]="!keyDeleteRecoveryReady(k)" (click)="prepareKeyDeleteReload(k)">Review retained values before reload</button> }
        }
        <table class="grid" [attr.inert]="keysLoading() || keysError() ? '' : null" [attr.aria-busy]="keysLoading()">
          <thead><tr><th>Key</th>@for (l of p.locales; track l.code) { <th>{{ l.code }}</th> }<th></th></tr></thead>
          <tbody>
            @for (k of keys(); track k.id) {
              <tr [attr.inert]="keyDeleting().includes(k.id) ? '' : null">
                <td class="key"><code>{{ k.name }}</code>
                  <span class="tags">
                    @for (t of k.tags; track t) { <span class="tag-chip">{{ t }}</span> }
                    @if (tagEditFor() === k.id) {
                      <input class="tag-edit" aria-label="Edit tags (comma separated)" title="Enter or leave this field to save; Escape cancels without saving" [disabled]="tagsSaving().includes(k.id) || tagsErrorFor().includes(k.id)"
                        [ngModel]="tagDraft()" (ngModelChange)="tagDraft.set($event)"
                        (blur)="saveTags(k)" (keydown.enter)="saveTags(k)" (keydown.escape)="$event.preventDefault(); cancelTagEdit(k)" />
                      <button type="button" name="cancelTagEdit" title="Discard this local tag edit without saving" (mousedown)="$event.preventDefault()" [disabled]="!tagCancelReady(k)" (click)="cancelTagEdit(k)">Cancel tags (Esc)</button>
                    } @else {
                      <button class="tags-toggle" (mousedown)="$event.preventDefault()" [disabled]="!tagOpenReady(k)" (click)="openTagEdit(k)">tags</button>
                    }
                    @if (tagsSaving().includes(k.id)) { <span class="muted" role="status" name="tagsSaving">Saving tags...</span> }

                  </span>
                  <button class="history-toggle" [attr.aria-expanded]="historyFor() === k.id" (mousedown)="$event.preventDefault()" [disabled]="!historyToggleReady(k)"
                    (click)="toggleHistory(k)">history</button>
                  <button class="comments-toggle" [attr.aria-expanded]="commentsFor() === k.id" (mousedown)="$event.preventDefault()" [disabled]="!commentsToggleReady(k)"
                    (click)="toggleComments(k)">comments{{ k._count?.comments ? ' (' + k._count.comments + ')' : '' }}</button>
                  <button class="shots-toggle" [attr.aria-expanded]="shotsFor() === k.id" (mousedown)="$event.preventDefault()" [disabled]="!shotsToggleReady(k)"
                    (click)="toggleShots(k)">shots{{ k._count?.screenshots ? ' (' + k._count.screenshots + ')' : '' }}</button>@if (tagsErrorFor().includes(k.id)) { <p class="cell-error-reason" role="alert" name="tagsError" style="white-space:normal;max-width:18rem">Tag result unconfirmed. Editing is paused. Copy retained translation values before reloading current server tags.</p><button type="button" name="reloadAfterTags" [disabled]="tagsSaving().length > 0" (mousedown)="$event.preventDefault()" (click)="prepareTagsReload(k)">Review retained values before reload</button> }</td>
                @for (l of p.locales; track l.code) {
                  <td [attr.data-locale]="l.code">
                    <textarea rows="1" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                      [ngModel]="cell(k.id, l.code)().value"
                      (ngModelChange)="edit(k, l.code, $event)"
                      (focus)="onCellFocus(k, l.code)"
                      (blur)="save(k, l.code)"
                      [attr.aria-label]="k.name + ' in ' + l.code"></textarea>
                    @if (k.isPlural) {
                      <div class="plural-forms">
                        @for (cat of pluralCategories(l.code); track cat) {
                          <label class="plural-field"><span class="plural-cat">{{ cat }}</span>
                            <input type="text" [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'"
                              [ngModel]="cell(k.id, l.code)().forms[cat] ?? ''"
                              (ngModelChange)="editForm(k, l.code, cat, $event)"
                              (blur)="save(k, l.code)"
                              [attr.aria-label]="k.name + ' ' + cat + ' form in ' + l.code" />
                          </label>
                        }
                      </div>
                    }
                    @if (suggestFor() === k.id + ':' + l.code && !tmError()) {
                      <button type="button" name="refreshTm" (mousedown)="$event.preventDefault()" [disabled]="!tmRefreshReady(k,l.code)" (click)="refreshTm(k,l.code)">Refresh memory</button>
                      <p class="muted" name="tmRefreshScope" style="white-space:normal">Refresh looks up memory for this locale and the current local source text only, returning at most three suggestions. It does not reload translations, apply a suggestion or save anything.</p>
                      @if (!tmLoading() && suggestions().length === 0) { <p class="muted" name="tmEmpty">No memory suggestions returned for this source and locale.</p> }
                    }
                    @if (suggestFor() === k.id + ':' + l.code && tmLoading()) { <p class="muted" role="status" name="tmLoading">Looking in translation memory...</p> }
                    @if (suggestFor() === k.id + ':' + l.code && tmError()) { <p class="error" role="alert" name="tmError">Translation memory unavailable.</p><button type="button" name="retryTm" (mousedown)="$event.preventDefault()" [disabled]="!tmRecoveryReady(k,l.code)" (click)="recoverTm(k,l.code)">Retry memory</button> }
                    @if (suggestFor() === k.id + ':' + l.code && suggestions().length > 0) {
                      @if (!canApplySuggestion(k, l.code)) { <p class="muted" name="tmApplyBlocked">Memory apply unavailable. Save local target drafts and wait for pending work, or copy retained values before reloading an unconfirmed result.</p> }
                      <div class="tm-suggest">
                        @for (sg of suggestions(); track sg.targetText) {
                          <button type="button" class="tm-pick" [disabled]="!canApplySuggestion(k, l.code)"
                            (mousedown)="$event.preventDefault()" (click)="applySuggestion(k, l.code, sg.targetText)">
                            <span [attr.dir]="isRtl(l.code) ? 'rtl' : 'ltr'">{{ sg.targetText }}</span>
                            <span class="muted">memory {{ Math.round(sg.score * 100) }}%</span>
                          </button>
                        }
                      </div>
                    }
                    <div class="cell-foot">
                      <select class="review" [class]="'review review-' + cell(k.id, l.code)().review.toLowerCase()"
                        [disabled]="!canReview(k, l.code)" [ngModel]="cell(k.id, l.code)().review"
                        (ngModelChange)="setReview(k, l.code, $event)"
                        [attr.aria-label]="'Review status for ' + k.name + ' in ' + l.code">
                        @for (st of statuses; track st) { <option [value]="st">{{ st.toLowerCase() }}</option> }
                        @if (!statuses.includes(cell(k.id, l.code)().review)) {
                          <option [value]="cell(k.id, l.code)().review">{{ cell(k.id, l.code)().review.toLowerCase() }} (removed)</option>
                        }
                      </select>
                      @if (cell(k.id, l.code)().reviewing) { <span class="muted" role="status" name="reviewPending">Updating review. New text stays local until you save it.</span> }
                      @if (cellDirty(k, l.code)) {
                        <span class="muted" name="localDraft">Local draft differs from last confirmed save.</span>
                        <button type="button" name="saveCellDraft" [disabled]="!canSaveDraft(k, l.code)" (click)="save(k, l.code)">Save draft</button>
                      }
                      @if (cell(k.id, l.code)().status === 'error') {
                        <span class="cell-status">Save not confirmed. Local draft retained.</span><button type="button" name="reloadAfterSave" (mousedown)="$event.preventDefault()" [disabled]="!cellSaveRecoveryReady(k,l.code)" (click)="prepareCellSaveReload(k,l.code)">Review retained values before reload</button>
                        @if (cell(k.id, l.code)().errorMsg) {
                          <span class="cell-error-reason">{{ cell(k.id, l.code)().errorMsg }}</span>
                        }
                      } @else {
                        <span class="cell-status">{{ statusText(k.id, l.code) }}</span>
                      }
                      @if (cell(k.id, l.code)().mtScore !== null) {
                        <span class="mt-badge" [attr.aria-label]="'Machine test-data fill by ' + (cell(k.id, l.code)().mtProvider ?? 'provider') + ' - structural preservation score only, not a measure of translation quality'" [title]="'MT fill by ' + (cell(k.id, l.code)().mtProvider ?? 'provider') + ' - structural preservation score, not a quality review'">MT {{ cell(k.id, l.code)().mtScore }} (structure)</span>
                      }
                    </div>
                    @if (l.code !== p.baseLocale && glossaryHints(k, l.code).length) {
                      <div class="glossary-hints">
                        @for (h of glossaryHints(k, l.code); track h.term + '-' + h.locale) {
                          <div class="glossary-hint" [title]="h.notes">glossary &middot; {{ h.locale }}: <code>{{ h.term }}</code> &rarr; <strong [attr.dir]="isRtl(h.locale) ? 'rtl' : 'ltr'">{{ h.value }}</strong></div>
                        }
                      </div>
                    }
                  </td>
                }
                <td><button class="danger" [attr.aria-label]="'Delete key ' + k.name" title="Delete key (save local drafts and wait for pending work first)" [disabled]="!canRemoveKey(k)" (click)="removeKey(k)">&times;</button></td>
              </tr>
              @if (keyDeleting().includes(k.id)) { <tr><td [attr.colspan]="2 + p.locales.length"><span role="status" name="keyDeleting">Deleting key "{{ k.name }}"...</span></td></tr> }
              @if (shotsFor() === k.id) {
                <tr class="history-row shots-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (shotsMutating().includes(k.id)) { <p class="muted" role="status" name="shotsMutating">Screenshot change pending. Closing this pane does not cancel it.</p> }
                  @if (shotsMutationError().includes(k.id)) { <p class="error" role="alert" name="shotsMutationError">Screenshot change could not be confirmed. Check current screenshots before another change.</p><button type="button" name="checkCurrentShots" (mousedown)="$event.preventDefault()" [disabled]="!shotsRecoveryReady(k)" (click)="recoverShots(k)">Check current screenshots</button> }
                  @if (!shotsError() && !shotsMutationError().includes(k.id)) { <button type="button" name="refreshShots" (mousedown)="$event.preventDefault()" [disabled]="!shotsRefreshReady(k)" (click)="refreshShots(k)">Refresh screenshots</button> }
                  <p class="muted" name="shotsRefreshScope" style="white-space:normal;max-width:40rem">Refresh reads this key's current screenshot list and image bytes only. It does not reload translations, discard local values or change screenshots. These separate reads are not one database snapshot.</p>
                  @if (shotsLoading()) { <p class="muted" role="status" name="shotsLoading">Loading screenshots...</p> }
                  @else if (shotsError()) { <p class="error" role="alert" name="shotsError">Screenshots unavailable. No images are shown.</p><button type="button" name="retryShots" (mousedown)="$event.preventDefault()" [disabled]="!shotsRecoveryReady(k)" (click)="recoverShots(k)">Retry screenshots</button> }
                  @else {
                    @if (shots().length === 0) { <p class="muted" name="shotsEmpty">No screenshots yet. Add one to give translators visual context.</p> }
                    <ul class="shots-list">
                      @for (sh of shots(); track sh.id) {
                        <li>
                          <img [src]="shotUrls()[sh.id]" [alt]="'Screenshot ' + sh.filename" width="160" />
                          <span class="muted">{{ sh.filename }} · {{ sh.uploader?.displayName ?? 'unknown' }}</span>
                          <button class="danger" [attr.aria-label]="'Delete screenshot ' + sh.filename" [disabled]="shotsMutating().includes(k.id) || shotsMutationError().includes(k.id)" (click)="deleteShot(k, sh.id)">&times;</button>
                        </li>
                      }
                    </ul>
                    <label class="shot-upload">Add screenshot (PNG, JPEG, GIF or WebP, max 2 MB)
                      <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label="Upload screenshot" [disabled]="shotsMutating().includes(k.id) || shotsMutationError().includes(k.id)"
                        (change)="uploadShot(k, $event)" />
                    </label>
                  }
                </td></tr>
              }
              @if (commentsFor() === k.id) {
                <tr class="history-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (commentsSaving()) { <p class="muted" role="status" name="commentsPending">Comment change pending. Closing this thread does not cancel it.</p> }
                  @if (commentsMutationError().includes(k.id)) { <p class="error" role="alert" name="commentsMutationError">Comment change could not be confirmed. Keep your draft and check current comments before another change.</p><button type="button" name="checkCurrentComments" (mousedown)="$event.preventDefault()" [disabled]="!commentsRecoveryReady(k)" (click)="recoverComments(k)">Check current comments</button> }
                  @if (!commentsError() && !commentsMutationError().includes(k.id)) { <button type="button" name="refreshComments" (mousedown)="$event.preventDefault()" [disabled]="!commentsRefreshReady(k)" (click)="refreshComments(k)">Refresh comments</button> }
                  <p class="muted" name="commentsRefreshScope" style="white-space:normal;max-width:40rem">Refresh reads this key's current thread only, not translations. Your comment text and locale stay here; a reply target missing from the new thread is cleared. It does not post, delete or retry a comment.</p>
                  @if (commentsLoading()) { <p class="muted" role="status" name="commentsLoading">Loading comments...</p> }
                  @else if (commentsError()) { <p class="error" role="alert" name="commentsError">Comments unavailable. No thread is shown.</p><button type="button" name="retryComments" (mousedown)="$event.preventDefault()" [disabled]="!commentsRecoveryReady(k)" (click)="recoverComments(k)">Retry comments</button> }
                  @else {
                    @if (comments().length === 0) { <p class="muted" name="commentsEmpty">No comments yet.</p> }
                    <ul class="history-list">
                      @for (cm of rootComments(); track cm.id) {
                        <li>
                          <code>{{ cm.localeCode ?? 'all' }}</code>
                          <span>@for (seg of bodySegments(cm.body); track $index) {<!--
                            -->@if (seg.mention) { <span class="mention">{{ seg.text }}</span> } @else { <span>{{ seg.text }}</span> }<!--
                          --> }</span>
                          <span class="muted">{{ cm.author?.displayName ?? 'unknown' }} · {{ cm.createdAt | date:'short' }}</span>
                          <button [attr.aria-label]="'Reply to comment'" (mousedown)="$event.preventDefault()" [disabled]="!commentReplyReady(k,cm.id)" (click)="selectCommentReply(k,cm.id)">reply</button>
                          <button class="danger" [attr.aria-label]="'Delete comment'" [disabled]="commentsSaving() || commentsMutationError().includes(k.id)" (click)="deleteComment(k, cm.id)">&times;</button>
                          @if (repliesOf(cm.id).length > 0) {
                            <ul class="history-list replies">
                              @for (rp of repliesOf(cm.id); track rp.id) {
                                <li>
                                  <code>{{ rp.localeCode ?? 'all' }}</code>
                                  <span>@for (seg of bodySegments(rp.body); track $index) {<!--
                                    -->@if (seg.mention) { <span class="mention">{{ seg.text }}</span> } @else { <span>{{ seg.text }}</span> }<!--
                                  --> }</span>
                                  <span class="muted">{{ rp.author?.displayName ?? 'unknown' }} · {{ rp.createdAt | date:'short' }}</span>
                                  <button class="danger" [attr.aria-label]="'Delete comment'" [disabled]="commentsSaving() || commentsMutationError().includes(k.id)" (click)="deleteComment(k, rp.id)">&times;</button>
                                </li>
                              }
                            </ul>
                          }
                        </li>
                      }
                    </ul>
                    @if (replyTo(); as rt) {
                      <p class="muted">Replying to {{ commentAuthor(rt) }} <button name="cancelCommentReply" (mousedown)="$event.preventDefault()" [disabled]="!commentReplyCancelReady(k)" (click)="cancelCommentReply(k)">cancel</button></p>
                    }
                    <form class="comment-form" (ngSubmit)="addComment(k)">
                      <input aria-label="New comment" placeholder="Add a comment… (@email mentions a member)" maxlength="2000"
                        [ngModel]="commentDraft()" (ngModelChange)="commentDraft.set($event)" name="commentDraft" required />
                      <select aria-label="Comment scope" [ngModel]="commentLocale()" (ngModelChange)="commentLocale.set($event)" name="commentLocale">
                        <option value="">all languages</option>
                        @for (l of p.locales; track l.code) { <option [value]="l.code">{{ l.code }}</option> }
                      </select>
                      <button type="submit" [disabled]="commentsSaving() || commentsMutationError().includes(k.id)">{{ commentsSaving() ? 'Posting or deleting...' : 'Post' }}</button>
                    </form>
                  }
                </td></tr>
              }
              @if (historyFor() === k.id) {
                <tr class="history-row"><td [attr.colspan]="2 + p.locales.length">
                  @if (!historyError()) { <button type="button" name="refreshHistory" (mousedown)="$event.preventDefault()" [disabled]="!historyRefreshReady(k)" (click)="refreshHistory(k)">Refresh history</button> }
                  <p class="muted" name="historyRefreshScope" style="white-space:normal;max-width:40rem">Refresh reads this key's saved translation history across loaded project locales and shows at most 50 newest returned changes. Separate locale reads are not one database snapshot or complete history. It does not reload translations, discard local values or restore a change.</p>
                  @if (historyLoading()) { <p class="muted" role="status" name="historyLoading">Loading history...</p> }
                  @else if (historyError()) { <p class="error" role="alert" name="historyError">History unavailable. No changes are shown. Retry this read.</p><button type="button" name="retryHistory" (mousedown)="$event.preventDefault()" [disabled]="!historyRecoveryReady(k)" (click)="recoverHistory(k)">Retry history</button> }
                  @else if (historyEntries().length === 0) { <p class="muted" name="historyEmpty">No changes recorded yet.</p> }
                  @else {
                    <ul class="history-list">
                      @for (h of historyEntries(); track h.id) {
                        <li>
                          <code>{{ h.locale }}</code>
                          <span class="review review-{{ h.status.toLowerCase() }}">{{ h.status.toLowerCase() }}</span>
                          <span class="h-value" [attr.dir]="isRtl(h.locale) ? 'rtl' : 'ltr'">{{ h.value || '(empty)' }}</span>
                          <span class="muted">{{ h.changedBy?.displayName ?? 'unknown' }} · {{ h.createdAt | date:'short' }}</span>
                        </li>
                      }
                    </ul>
                  }
                </td></tr>
              }
            }
          </tbody>
        </table>
      }
    </main>
    @if (mergePreview(); as mp) {
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-label="Merge preview">
          <h3>Merge {{ mp.from }} into main</h3>
          <p class="muted">Copy-forward: {{ mp.from }} itself stays as it is. Only saved server values are merged; local unsaved drafts are not included.</p>
          <ul class="merge-diff">
            @for (line of mp.lines; track line) {
              <li [class.warn]="line.startsWith('WARNING')">{{ line }}</li>
            }
          </ul>
          <p class="muted">An automatic snapshot of the current state is taken first, and every overwritten translation keeps its previous value in history. Anything changed on main after this preview is skipped, not overwritten.</p>
          <div class="modal-actions">
            <button class="primary" name="confirmMerge" [disabled]="mergePending()" (click)="confirmMerge()">{{ mergePending() ? 'Merging...' : 'Merge now' }}</button>
            <button name="cancelMerge" [disabled]="mergePending()" (click)="cancelMerge()">Cancel</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EditorComponent implements OnInit, OnDestroy {
  project = signal<Project | null>(null);
  keys = signal<Key[]>([]);
  keysLoading = signal(false);
  keysError = signal(false);
  private keysGeneration = 0;
  cells = new Map<string, WritableSignal<CellState>>();
  search = signal(''); newKey = signal(''); newLocale = signal(''); ioLocale = signal('en'); bulkStatus = signal('REVIEWED');
  bulkReviewPending = signal(false);
  keyDeleting = signal<string[]>([]); keyDeleteErrorFor = signal<string[]>([]);
  localeCreating = signal(false); localeCreateError = signal(false);
  localeRecoveryLoading=signal(false); localeRecoveryError=signal(false); localeRecoveryCodes=signal<string[]|null>(null); private localeRecoveryGeneration=0;
  keyCreating = signal(false); keyCreateError = signal(false); keyCreateBranch = signal(''); private keyCreateEpoch=0;
  branchCreateUnknown = signal(false); private branchCreateEpoch=0;
  branchCreating = signal(false); branchListLoading = signal(false); branchListError = signal(false);
  private branchListGeneration = 0;
  branch = signal('main'); branches = signal<BranchInfo[]>([]); newBranch = signal('');
  mergePreviewLoading = signal(false); mergePending = signal(false);
  private mergeGeneration = 0; private mergePreviewKeysGeneration = -1;
  mergePreview = signal<{ branchId: string; from: string; lines: string[]; previewAt: string } | null>(null); ioFormat = signal<'json' | 'csv' | 'android' | 'ios' | 'stringsdict' | 'po' | 'pot' | 'xliff' | 'properties' | 'arb' | 'yaml' | 'resx'>('json');
  ioFormatTouched = signal(false);
  exportPending = signal(false); exportError = signal(false); exportNotice = signal('');
  private exportGeneration = 0;
  importWritePending = signal(false);
  importPending = signal(false); private importGeneration = 0;
  importConflict = signal<{ scope: ImportScope; filename: string; ext: string; detected: IoFormat; current: IoFormat; text: string; dryRun: boolean } | null>(null);
  glossary = signal<GlossaryTermItem[]>([]);
  filterTag = signal(''); filterStatus = signal<'' | TranslationStatus>('');
  tagEditFor = signal<string | null>(null);
  tagDraft = signal('');
  tagsSaving = signal<string[]>([]);
  tagsErrorFor = signal<string[]>([]);
  historyFor = signal<string | null>(null);
  suggestFor = signal<string | null>(null);
  suggestions = signal<TmSuggestion[]>([]);
  tmLoading = signal(false);
  tmError = signal(false);
  private tmGeneration = 0;
  private tmSource = '';
  Math = Math;
  shotsFor = signal<string | null>(null);
  shots = signal<ScreenshotMeta[]>([]);
  shotUrls = signal<Record<string, string>>({});
  private shotsMutationEpoch = new Map<string, number>();
  shotsMutating = signal<string[]>([]); shotsMutationError = signal<string[]>([]);
  shotsLoading = signal(false);
  shotsError = signal(false);
  private shotsGeneration = 0;
  commentsFor = signal<string | null>(null);
  comments = signal<CommentEntry[]>([]);
  commentDraft = signal('');
  commentLocale = signal('');
  replyTo = signal<string | null>(null);
  commentsLoading = signal(false);
  commentsError = signal(false);
  commentsSaving = signal(false); commentsMutationError = signal<string[]>([]);
  private commentsMutationEpoch = new Map<string, number>();
  private commentsGeneration = 0;
  historyEntries = signal<(HistoryEntry & { locale: string })[]>([]);
  historyLoading = signal(false);
  historyError = signal(false);
  private historyGeneration = 0;
  private destroyed = false;
  readonly baseStatuses = ['UNVERIFIED', 'TRANSLATED', 'REVIEWED'];
  get statuses(): string[] { return [...this.baseStatuses, ...(this.project()?.customStatuses ?? [])]; }
  notice = signal(''); error = signal('');
  projectId = '';
  projectLoading = signal(true);
  projectError = signal(false);
  private projectGeneration = 0;

  constructor(private api: ApiService, route: ActivatedRoute, @Optional() private router: Router|null=null) {
    this.projectId = route.snapshot.paramMap.get('id') ?? '';
  }
  async ngOnInit() { await this.loadProject(); }
  async loadProject() {
    if (this.destroyed) return;
    ++this.localeRecoveryGeneration;this.localeRecoveryLoading.set(false);this.localeRecoveryError.set(false);this.localeRecoveryCodes.set(null);
    const generation = ++this.projectGeneration, projectId = this.projectId;
    const current = () => !this.destroyed && generation === this.projectGeneration;
    this.projectLoading.set(true); this.projectError.set(false);
    this.project.set(null); this.branches.set([]); this.glossary.set([]);
    try {
      // Publish required metadata together, never a partially usable editor.
      const [project, branches] = await Promise.all([
        this.api.getProject(projectId), this.api.listBranches(projectId),
      ]);
      if (!current()) return;
      this.project.set(project); this.ioLocale.set(project.baseLocale); this.branches.set(branches);
      this.api.listGlossary(projectId).then(g => { if (current()) this.glossary.set(g); })
        .catch(() => { if (current()) this.glossary.set([]); });
      await this.reload();
    } catch { if (current()) this.projectError.set(true); }
    finally { if (current()) this.projectLoading.set(false); }
  }
  canOpenSavedSearch() {
    return !!this.project() && !this.projectLoading() && !this.projectError()
      && this.branches().some(b=>b.name===this.branch()) && this.canBulkReview()
      && !this.bulkReviewPending() && !this.importWritePending();
  }
  openSavedSearch() {
    if(!this.canOpenSavedSearch())return;
    void this.router?.navigate(['/projects',this.projectId,'find'],{queryParams:{branch:this.branch()}});
  }
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  canChangeKeyFilters(){return this.canSwitchBranch();}
  pickKeyFilter(field:'search'|'filterTag'|'filterStatus',value:string,input:HTMLInputElement|HTMLSelectElement){
    if(!this.canChangeKeyFilters()){input.value=this[field]();return;}
    this[field].set(value);this.onSearch();
  }
  onSearch() {
    if (!this.canChangeKeyFilters()) return;
    ++this.keysGeneration; this.keysLoading.set(true); this.keysError.set(false);
    this.clearHistory(); this.clearShots(); this.clearComments(); this.clearTm();
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer=null;
      if(!this.canChangeKeyFilters()){this.keysLoading.set(false);return;}
      void this.reload();
    }, 250);
  }
  async reload() {
    if (this.destroyed) return;
    if (this.searchTimer) { clearTimeout(this.searchTimer); this.searchTimer = null; }
    this.cancelMerge(); this.cancelImportPick();
    const generation = ++this.keysGeneration, projectId = this.projectId, createEpoch=this.keyCreateEpoch, readBranch=this.branch(), unfiltered=!this.hasKeyFilters();
    const current = () => !this.destroyed && generation === this.keysGeneration;
    this.keysLoading.set(true); this.keysError.set(false); this.retainedDownloadNotice.set('');
    this.tagEditFor.set(null); this.tagsErrorFor.set([]); this.keyDeleteErrorFor.set([]);
    this.clearHistory(); this.clearShots(); this.clearComments(); this.clearTm();
    try {
      const keys = await this.api.listKeys(projectId, {
        search: this.search() || undefined,
        tag: this.filterTag() || undefined,
        status: this.filterStatus() || undefined,
        locale: this.filterStatus() ? this.ioLocale() : undefined,
        branch: this.branch(),
      });
      if (!current()) return;
      this.keys.set(keys);
      if(createEpoch===this.keyCreateEpoch && !this.keyCreating() && this.keyCreateError() && readBranch===this.keyCreateBranch() && unfiltered)this.keyCreateError.set(false);
      this.cells.clear();
      for (const k of keys) for (const t of k.translations) {
        this.cells.set(`${k.id}:${t.localeCode}`,
          signal({ version: t.version, rowId: t.rowId, value: t.value, saved: t.value, status: 'idle', errorMsg: '', review: t.status ?? 'UNVERIFIED',
            forms: { ...(t.pluralForms ?? {}) }, savedForms: { ...(t.pluralForms ?? {}) },
            mtScore: t.mtScore ?? null, mtProvider: t.mtProvider ?? null }));
      }
    } catch { if (current()) this.keysError.set(true); }
    finally { if (current()) this.keysLoading.set(false); }
  }
  hasKeyFilters() { return !!(this.search() || this.filterTag() || this.filterStatus()); }
  async clearKeyFilters() {
    if (!this.canChangeKeyFilters() || this.keysLoading() || this.keysError() || !this.hasKeyFilters()) return;
    this.search.set(''); this.filterTag.set(''); this.filterStatus.set('');
    await this.reload();
  }
  retainedDownloadNotice = signal('');
  retainedDownloadReady() { return !this.destroyed && !!this.project() && !this.keysLoading() && this.keys().length > 0 && (this.keysError() || !this.canSwitchBranch()); }
  downloadRetainedGrid() {
    if (!this.retainedDownloadReady()) return;
    this.retainedDownloadNotice.set('');
    try {
      const content = JSON.stringify({schemaVersion: 1, kind: 'unverified-retained-grid-values', scope: 'currently-retained-grid-only', projectId: this.projectId, confirmedSaved: false, importFile: false, values: JSON.parse(this.retainedGridValues())}, null, 2);
      const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
      try { const a = document.createElement('a'); a.href = url; a.download = 'open-locale-retained-values.json'; a.click(); }
      finally { URL.revokeObjectURL(url); }
      this.retainedDownloadNotice.set('Local backup download requested. Check the file before reloading; this does not confirm that your browser saved it.');
    } catch { this.retainedDownloadNotice.set('Local backup could not be started. Keep this page open and copy the retained values above.'); }
  }
  retainedGridValues() {
    return JSON.stringify(this.keys().map(key => ({ key: key.name, values: (this.project()?.locales ?? []).map(locale => {
      const cell = this.cells.get(`${key.id}:${locale.code}`)?.();
      return { locale: locale.code, value: cell?.value ?? '', pluralForms: cell?.forms ?? {} };
    }) })), null, 2);
  }
  cell(keyId: string, locale: string): WritableSignal<CellState> {
    let s = this.cells.get(`${keyId}:${locale}`);
    if (!s) {
      s = signal<CellState>({ version: 0, value: '', saved: '', status: 'idle', errorMsg: '', review: 'UNVERIFIED', forms: {}, savedForms: {}, mtScore: null, mtProvider: null });
      this.cells.set(`${keyId}:${locale}`, s);
    }
    return s;
  }
  edit(k: Key, locale: string, value: string) {
    this.clearTm();
    this.cell(k.id, locale).update((c) => ({ ...c, value }));
  }
  editForm(k: Key, locale: string, category: string, value: string) {
    this.clearTm();
    this.cell(k.id, locale).update((c) => ({ ...c, forms: { ...c.forms, [category]: value } }));
  }
  pluralCategories(locale: string): string[] { return pluralCategories(locale); }
  private sameForms(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
  }
  cellDirty(k: Key, locale: string) {
    const c = this.cell(k.id, locale)();
    return c.value !== c.saved || !this.sameForms(c.forms, c.savedForms);
  }
  canSaveDraft(k: Key, locale: string) {
    const c = this.cell(k.id, locale)();
    return !this.destroyed && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && !this.bulkReviewPending() && !this.importWritePending() && !this.keysLoading() && !this.keysError() && this.cellDirty(k, locale)
      && c.status !== 'saving' && !c.reviewing && !c.needsReload;
  }
  async save(k: Key, locale: string, force = false) {
    // Inert is a UI affordance, not a write boundary. Reject retained-grid events.
    if (this.destroyed || this.keysLoading() || this.keysError() || this.bulkReviewPending() || this.importWritePending() || this.keyDeleting().includes(k.id) || this.keyDeleteErrorFor().includes(k.id)) return;
    const sig = this.cell(k.id, locale);
    const c = sig();
    if (!force && c.value === c.saved && this.sameForms(c.forms, c.savedForms)) return;
    if (this.destroyed || c.status === 'saving' || c.reviewing || c.needsReload) return;
    if (c.version === undefined || (c.version > 0 && !c.rowId)) {
      sig.update(cur => ({ ...cur, status: 'error', needsReload: true, errorMsg: 'Loaded row identity is unavailable. Copy local values and reload before saving.' })); return;
    }
    // Plural keys send the merge of the server's last-known forms with this
    // browser's category edits: categories a different ICU build stored but
    // this browser does not know survive the save (see plural-forms.ts).
    const formsAtSend = k.isPlural
      ? mergeFormsForSave(c.savedForms, c.forms, this.pluralCategories(locale))
      : undefined;
    sig.set({ ...c, status: 'saving' });
    try {
      const res = await this.api.upsertTranslation(this.projectId, k.id, locale, c.value, formsAtSend, c.version, c.rowId);
      const latest = sig();
      sig.set({ version: res.version, rowId: res.rowId, value: latest.value, saved: c.value, errorMsg: '',
        forms: latest.forms, savedForms: formsAtSend ?? latest.savedForms,
        status: latest.value === c.value && this.sameForms(latest.forms, c.forms) ? 'saved' : 'idle',
        // The server clears MT provenance on a human write; mirror that here.
        mtScore: null, mtProvider: null,
        review: res.status ?? 'UNVERIFIED' });
    } catch (e) {
      // A failed response may follow a committed write. Never blindly replay.
      sig.update(cur => ({ ...cur, status: 'error', needsReload: true,
        errorMsg: 'The row may have changed or the result may be unknown. Copy retained values and reload before another save.' }));
    }
  }
  cellSaveRecoveryReady(k:Key,locale:string) { return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.keyDeleting().length && !this.tagsSaving().length && this.keys().some(key=>key.id===k.id) && !!this.project()?.locales.some(l=>l.code===locale) && this.cell(k.id,locale)().status==='error'; }
  prepareCellSaveReload(k:Key,locale:string) { if(this.cellSaveRecoveryReady(k,locale))this.prepareSaveReload(); }
  prepareSaveReload() {
    ++this.keysGeneration; this.keysLoading.set(false); this.keysError.set(true);
    this.clearHistory(); this.clearShots(); this.clearComments(); this.clearTm();
  }
  statusText(keyId: string, locale: string): string {
    const s = this.cell(keyId, locale)().status;
    return s === 'saving' ? 'saving…' : s === 'saved' ? 'saved' : s === 'error' ? 'save failed' : '';
  }
  isRtl(code: string) { return ['he', 'ar', 'fa', 'ur'].some((r) => code.startsWith(r)); }
  glossaryHints(k: Key, targetLocale: string): GlossaryHint[] {
    const p = this.project();
    if (!p || targetLocale === p.baseLocale || !this.glossary().length) return [];
    const source = this.cell(k.id, p.baseLocale)().value;
    return hintsForTarget(source, targetLocale, this.glossary());
  }

  canReview(k: Key, locale: string) {
    const c = this.cell(k.id, locale)();
    return !this.destroyed && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && !this.bulkReviewPending() && !this.importWritePending() && !this.keysLoading() && !this.keysError() && !c.needsReload
      && !c.reviewing && c.status !== 'saving' && c.value === c.saved
      && this.sameForms(c.forms, c.savedForms) && c.version !== undefined && c.version > 0 && !!c.rowId;
  }
  async setReview(k: Key, locale: string, status: TranslationStatus) {
    if (!this.canReview(k, locale)) return;
    const sig = this.cell(k.id, locale), c = sig();
    sig.update(cur => ({ ...cur, reviewing: true }));
    try {
      const res = await this.api.setStatus(this.projectId, k.id, locale, status, c.version, c.rowId);
      sig.update(cur => ({ ...cur, review: res.status, version: res.version, rowId: res.rowId }));
    } catch {
      sig.update(cur => ({ ...cur, status: 'error', needsReload: true,
        errorMsg: 'Review result could not be confirmed. Copy retained values and reload before another change.' }));
    } finally { sig.update(cur => ({ ...cur, reviewing: false })); }
  }
  tagOpenReady(k: Key) {
    return !this.destroyed && !this.keysLoading() && !this.keysError()
      && !this.tagsSaving().includes(k.id) && !this.tagsErrorFor().includes(k.id)
      && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id)
      && this.tagEditFor() === null && this.keys().some(key => key.id === k.id);
  }
  openTagEdit(k: Key) {
    if (!this.tagOpenReady(k)) return;
    const current = this.keys().find(key => key.id === k.id)!;
    this.tagEditFor.set(k.id);
    this.tagDraft.set(current.tags.join(', '));
  }
  tagCancelReady(k: Key) {
    return !this.destroyed && !this.keysLoading() && !this.keysError()
      && !this.tagsSaving().includes(k.id) && !this.tagsErrorFor().includes(k.id)
      && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id)
      && this.tagEditFor() === k.id && this.keys().some(key => key.id === k.id);
  }
  cancelTagEdit(k: Key) {
    if (!this.tagCancelReady(k)) return;
    this.tagEditFor.set(null); this.tagDraft.set('');
  }
  prepareTagsReload(k:Key) {
    if(this.destroyed || this.keysLoading() || this.keysError() || !this.tagsErrorFor().includes(k.id) || this.tagsSaving().length || !this.keys().some(key=>key.id===k.id))return;
    this.prepareSaveReload();
  }
  async saveTags(k: Key) {
    if (this.destroyed || this.keysLoading() || this.keysError() || this.tagsSaving().includes(k.id) || this.tagsErrorFor().includes(k.id) || this.tagEditFor() !== k.id || this.keyDeleting().includes(k.id) || this.keyDeleteErrorFor().includes(k.id)) return;
    const tags = this.tagDraft().split(',').map((t) => t.trim()).filter(Boolean);
    const generation = this.keysGeneration, projectId = this.projectId;
    const current = () => !this.destroyed && generation === this.keysGeneration;
    this.tagEditFor.set(null);
    this.tagsSaving.update(ids => [...ids, k.id]);
    this.tagsErrorFor.update(ids => ids.filter(id => id !== k.id));
    try {
      const updated = await this.api.setTags(projectId, k.id, tags);
      if (!current()) return;
      this.keys.update(keys => keys.map(key => key.id === k.id ? { ...key, tags: [...updated.tags] } : key));
      if (this.filterTag()) this.notice.set('Tags saved. The current grid is retained to keep local drafts. Run the filter again to refresh matching rows.');
      // Do not replace cells or silently remove a row from an active tag filter.
    } catch { if (current()) this.tagsErrorFor.update(ids => [...ids, k.id]); }
    finally { if (!this.destroyed) this.tagsSaving.update(ids => ids.filter(id => id !== k.id)); }
  }
  private clearComments() {
    ++this.commentsGeneration; this.commentsFor.set(null); this.comments.set([]);
    this.commentsLoading.set(false); this.commentsError.set(false); this.replyTo.set(null);
  }
  commentsToggleReady(k:Key) { return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  async toggleComments(k: Key) {
    if(!this.commentsToggleReady(k))return;
    if (this.destroyed) return;
    if (this.commentsFor() === k.id) { this.clearComments(); return; }
    this.commentsFor.set(k.id);
    this.commentDraft.set(''); this.commentLocale.set(''); this.replyTo.set(null);
    await this.readComments(k);
  }
  commentsRefreshReady(k:Key) { return this.canChangeComments(k) && this.keys().some(key=>key.id===k.id); }
  refreshComments(k:Key) { if(this.commentsRefreshReady(k))return this.readComments(k);return Promise.resolve(); }
  commentsRecoveryReady(k:Key) { return !this.destroyed && this.commentsFor()===k.id && !this.commentsLoading() && !this.commentsSaving() && (this.commentsError() || this.commentsMutationError().includes(k.id)) && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  recoverComments(k:Key) { if(this.commentsRecoveryReady(k))return this.readComments(k);return Promise.resolve(); }
  async readComments(k: Key) {
    if (this.destroyed || this.commentsFor() !== k.id) return;
    const generation = ++this.commentsGeneration, projectId = this.projectId, keyId = k.id;
    const current = () => !this.destroyed && generation === this.commentsGeneration && this.commentsFor() === keyId;
    const mutationEpoch = this.commentsMutationEpoch.get(keyId) ?? 0;
    this.commentsLoading.set(true); this.commentsError.set(false); this.comments.set([]);
    try {
      const list = await this.api.listComments(projectId, keyId);
      if (current()) {
        this.comments.set(list);
        if (!this.commentsSaving() && mutationEpoch === (this.commentsMutationEpoch.get(keyId) ?? 0)) this.commentsMutationError.update(ids => ids.filter(id => id !== keyId));
        this.keys.update(keys => keys.map(key => key.id === keyId && key._count
          ? { ...key, _count: { ...key._count, comments: list.length } } : key));
        if (this.replyTo() && !list.some(c => c.id === this.replyTo())) this.replyTo.set(null);
      }
    } catch { if (current()) this.commentsError.set(true); }
    finally { if (current()) this.commentsLoading.set(false); }
  }
  // One-level threads: roots render flat; replies nest under their parent.
  rootComments() { return this.comments().filter((c) => !c.parentId); }
  repliesOf(id: string) { return this.comments().filter((c) => c.parentId === id); }
  commentAuthor(id: string) {
    return this.comments().find((c) => c.id === id)?.author?.displayName ?? 'comment';
  }
  // Splits a body into plain and @email mention segments; every segment is
  // rendered by interpolation, never innerHTML, so escaping is preserved.
  bodySegments(body: string): { text: string; mention: boolean }[] {
    const re = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    const segs: { text: string; mention: boolean }[] = [];
    let last = 0;
    for (const m of body.matchAll(re)) {
      const i = m.index ?? 0;
      if (i > last) segs.push({ text: body.slice(last, i), mention: false });
      segs.push({ text: m[0], mention: true });
      last = i + m[0].length;
    }
    if (last < body.length) segs.push({ text: body.slice(last), mention: false });
    return segs.length ? segs : [{ text: body, mention: false }];
  }
  private canChangeComments(k: Key) {
    return !this.destroyed && !this.commentsSaving() && this.commentsFor() === k.id
      && !this.commentsLoading() && !this.commentsError() && !this.commentsMutationError().includes(k.id)
      && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id);
  }
  commentReplyReady(k:Key,id:string) { return this.canChangeComments(k) && this.keys().some(key=>key.id===k.id) && this.comments().some(c=>c.id===id && !c.parentId); }
  selectCommentReply(k:Key,id:string) { if(this.commentReplyReady(k,id))this.replyTo.set(id); }
  commentReplyCancelReady(k:Key) { return this.canChangeComments(k) && this.keys().some(key=>key.id===k.id) && !!this.replyTo(); }
  cancelCommentReply(k:Key) { if(this.commentReplyCancelReady(k))this.replyTo.set(null); }
  async addComment(k: Key) {
    const draft = this.commentDraft(), body = draft.trim(), locale = this.commentLocale(), reply = this.replyTo();
    if (!body || !this.canChangeComments(k) || (reply && !this.comments().some(c => c.id === reply && !c.parentId))) return;
    await this.changeComments(k, () => this.api.addComment(this.projectId, k.id, body, locale || undefined, reply ?? undefined), () => {
      if (this.commentDraft() === draft && this.commentLocale() === locale && this.replyTo() === reply) { this.commentDraft.set(''); this.replyTo.set(null); }
    });
  }
  private async changeComments(k: Key, write: () => Promise<unknown>, onConfirmed?: () => void) {
    const generation = this.commentsGeneration;
    this.commentsMutationEpoch.set(k.id, (this.commentsMutationEpoch.get(k.id) ?? 0) + 1);
    this.commentsSaving.set(true);
    let confirmed = false;
    try { await write(); confirmed = true; }
    catch { if (!this.destroyed) this.commentsMutationError.update(ids => ids.includes(k.id) ? ids : [...ids,k.id]); }
    finally { if (!this.destroyed) { this.commentsMutationEpoch.set(k.id, (this.commentsMutationEpoch.get(k.id) ?? 0) + 1); this.commentsSaving.set(false); } }
    if (confirmed && !this.destroyed && generation === this.commentsGeneration && this.commentsFor() === k.id) {
      onConfirmed?.(); await this.readComments(k);
    }
  }
  // Translation memory: only for empty cells with a base-locale source.
  // Applying is an explicit click and saves through the normal path - the
  // cell stays unverified until a human reviews it.
  private clearTm() {
    ++this.tmGeneration; this.suggestFor.set(null); this.suggestions.set([]);
    this.tmLoading.set(false); this.tmError.set(false); this.tmSource = '';
  }
  async onCellFocus(k: Key, locale: string) {
    this.clearTm();
    if (this.destroyed || this.keysLoading() || this.keysError()) return;
    const base = this.project()?.baseLocale;
    if (!base || locale === base || this.cell(k.id, locale)().value.trim()) return;
    const source = this.cell(k.id, base)().value.trim();
    if (!source) return;
    const id = `${k.id}:${locale}`, generation = this.tmGeneration;
    const current = () => !this.destroyed && generation === this.tmGeneration && this.suggestFor() === id
      && this.cell(k.id, base)().value.trim() === source && !this.cell(k.id, locale)().value.trim();
    this.suggestFor.set(id); this.tmSource = source; this.tmLoading.set(true);
    try {
      const res = await this.api.suggestTm(this.projectId, locale, source);
      if (current()) this.suggestions.set(res.suggestions.slice(0, 3));
    } catch { if (current()) this.tmError.set(true); }
    finally { if (current()) this.tmLoading.set(false); }
  }
  tmRefreshReady(k:Key,locale:string) { return this.keys().some(key=>key.id===k.id) && this.canApplySuggestion(k,locale); }
  refreshTm(k:Key,locale:string) { if(this.tmRefreshReady(k,locale))return this.onCellFocus(k,locale);return Promise.resolve(); }
  tmRecoveryReady(k:Key,locale:string) { return this.keys().some(key=>key.id===k.id) && this.tmError() && this.tmTargetReady(k,locale,true); }
  recoverTm(k:Key,locale:string) { if(this.tmRecoveryReady(k,locale))return this.onCellFocus(k,locale);return Promise.resolve(); }
  canApplySuggestion(k: Key, locale: string) { return this.tmTargetReady(k,locale); }
  private tmTargetReady(k: Key, locale: string, allowReadError=false) {
    if (this.destroyed || this.keysLoading() || this.keysError() || this.bulkReviewPending() || this.importWritePending()
      || this.keyDeleting().includes(k.id) || this.keyDeleteErrorFor().includes(k.id)) return false;
    const base = this.project()?.baseLocale;
    if (!base || locale === base || this.suggestFor() !== `${k.id}:${locale}` || this.tmLoading() || (!allowReadError && this.tmError())
      || this.cell(k.id, base)().value.trim() !== this.tmSource) return false;
    const c = this.cell(k.id, locale)();
    return !c.value.trim() && c.value === c.saved && this.sameForms(c.forms, c.savedForms)
      && c.status !== 'saving' && !c.reviewing && !c.needsReload
      && c.version !== undefined && (c.version === 0 || !!c.rowId);
  }
  async applySuggestion(k: Key, locale: string, text: string) {
    if (!this.canApplySuggestion(k, locale) || !this.suggestions().some(s => s.targetText === text)) return;
    this.cell(k.id, locale).update(c => ({ ...c, value: text }));
    this.clearTm();
    await this.save(k, locale, true);
  }
  private revokeShots(urls: Record<string, string>) {
    for (const url of Object.values(urls)) URL.revokeObjectURL(url);
  }
  private clearShots() {
    ++this.shotsGeneration; this.shotsFor.set(null); this.shotsLoading.set(false); this.shotsError.set(false);
    this.revokeShots(this.shotUrls()); this.shotUrls.set({}); this.shots.set([]);
  }
  shotsToggleReady(k:Key) { return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  async toggleShots(k: Key) {
    if(!this.shotsToggleReady(k))return;
    if (this.destroyed) return;
    if (this.shotsFor() === k.id) { this.clearShots(); return; }
    this.shotsFor.set(k.id);
    await this.readShots(k);
  }
  shotsRefreshReady(k:Key) {
    return this.canChangeShots(k) && this.keys().some(key=>key.id===k.id);
  }
  refreshShots(k:Key) { if(this.shotsRefreshReady(k))return this.readShots(k);return Promise.resolve(); }
  shotsRecoveryReady(k:Key) { return !this.destroyed && this.shotsFor()===k.id && !this.shotsLoading() && !this.shotsMutating().includes(k.id) && (this.shotsError() || this.shotsMutationError().includes(k.id)) && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  recoverShots(k:Key) { if(this.shotsRecoveryReady(k))return this.readShots(k);return Promise.resolve(); }
  async readShots(k: Key) {
    if (this.destroyed || this.shotsFor() !== k.id) return;
    const generation = ++this.shotsGeneration, projectId = this.projectId, keyId = k.id;
    const current = () => !this.destroyed && generation === this.shotsGeneration && this.shotsFor() === keyId;
    this.revokeShots(this.shotUrls()); this.shotUrls.set({}); this.shots.set([]);
    this.shotsLoading.set(true); this.shotsError.set(false);
    const mutationEpoch = this.shotsMutationEpoch.get(keyId) ?? 0;
    const urls: Record<string, string> = {};
    let published = false;
    try {
      const list = await this.api.listScreenshots(projectId, keyId);
      if (!current()) return;
      for (const sh of list) {
        urls[sh.id] = await this.api.screenshotUrl(projectId, keyId, sh.id);
        if (!current()) return;
      }
      this.shots.set(list); this.shotUrls.set(urls); published = true;
      if (!this.shotsMutating().includes(keyId) && mutationEpoch === (this.shotsMutationEpoch.get(keyId) ?? 0)) {
        this.shotsMutationError.update(ids => ids.filter(id => id !== keyId));
        this.keys.update(keys => keys.map(key => key.id === keyId && key._count ? { ...key, _count: { ...key._count, screenshots: list.length } } : key));
      }
    } catch { if (current()) this.shotsError.set(true); }
    finally {
      if (!published) this.revokeShots(urls);
      if (current()) this.shotsLoading.set(false);
    }
  }
  private updateShotCount(keyId: string, delta: number) {
    this.keys.update(keys => keys.map(key => key.id === keyId && key._count
      ? { ...key, _count: { ...key._count, screenshots: Math.max(0, (key._count.screenshots ?? 0) + delta) } } : key));
  }
  private canChangeShots(k: Key) {
    return !this.destroyed && this.shotsFor() === k.id && !this.shotsLoading() && !this.shotsError()
      && !this.shotsMutating().includes(k.id) && !this.shotsMutationError().includes(k.id)
      && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id)
      && !this.keyDeleteErrorFor().includes(k.id);
  }
  async uploadShot(k: Key, ev: Event) {
    const input = ev.target as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (!file || !this.canChangeShots(k)) return;
    await this.changeShots(k, () => this.api.uploadScreenshot(this.projectId, k.id, file), 1);
  }
  async deleteShot(k: Key, shotId: string) {
    if (!this.canChangeShots(k) || !this.shots().some(sh => sh.id === shotId)) return;
    await this.changeShots(k, () => this.api.deleteScreenshot(this.projectId, k.id, shotId), -1);
  }
  private async changeShots(k: Key, write: () => Promise<unknown>, delta: number) {
    const generation = this.shotsGeneration, keysGeneration = this.keysGeneration;
    this.shotsMutationEpoch.set(k.id, (this.shotsMutationEpoch.get(k.id) ?? 0) + 1);
    this.shotsMutating.update(ids => [...ids,k.id]);
    let confirmed = false;
    try {
      await write(); confirmed = true;
      if (!this.destroyed && keysGeneration === this.keysGeneration) this.updateShotCount(k.id, delta);
    } catch { if (!this.destroyed) this.shotsMutationError.update(ids => ids.includes(k.id) ? ids : [...ids,k.id]); }
    finally { if (!this.destroyed) { this.shotsMutationEpoch.set(k.id, (this.shotsMutationEpoch.get(k.id) ?? 0) + 1); this.shotsMutating.update(ids => ids.filter(id => id !== k.id)); } }
    // Refresh is an independent read, never relabel a confirmed mutation as failed.
    if (confirmed && !this.destroyed && generation === this.shotsGeneration && this.shotsFor() === k.id) await this.readShots(k);
  }
  async deleteComment(k: Key, commentId: string) {
    if (!this.canChangeComments(k) || !this.comments().some(c => c.id === commentId)) return;
    await this.changeComments(k, () => this.api.deleteComment(this.projectId, k.id, commentId));
  }
  private clearHistory() {
    ++this.historyGeneration; this.historyFor.set(null); this.historyEntries.set([]);
    this.historyError.set(false); this.historyLoading.set(false);
  }
  historyToggleReady(k:Key) { return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  async toggleHistory(k: Key) {
    if(!this.historyToggleReady(k))return;
    if(this.destroyed)return;
    if (this.historyFor() === k.id) {
      this.clearHistory(); return;
    }
    this.historyFor.set(k.id);
    await this.readHistory(k);
  }
  historyRefreshReady(k:Key) { return !this.destroyed && this.historyFor()===k.id && !this.historyLoading() && !this.historyError() && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  refreshHistory(k:Key) { if(this.historyRefreshReady(k))return this.readHistory(k);return Promise.resolve(); }
  historyRecoveryReady(k:Key) { return !this.destroyed && this.historyFor()===k.id && this.historyError() && !this.historyLoading() && !this.keysLoading() && !this.keysError() && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id) && this.keys().some(key=>key.id===k.id); }
  recoverHistory(k:Key) { if(this.historyRecoveryReady(k))return this.readHistory(k);return Promise.resolve(); }
  async readHistory(k: Key) {
    if(this.destroyed||this.historyFor()!==k.id)return;
    const generation=++this.historyGeneration,projectId=this.projectId,keyId=k.id;
    const current=()=>!this.destroyed&&generation===this.historyGeneration&&this.historyFor()===keyId;
    this.historyLoading.set(true); this.historyEntries.set([]); this.historyError.set(false);
    try {
      const locales = this.project()?.locales ?? [];
      const all = await Promise.all(locales.map(async l =>
        (await this.api.getHistory(projectId, keyId, l.code)).map(h => ({ ...h, locale:l.code }))));
      if(current())this.historyEntries.set(all.flat().sort((x,y)=>new Date(y.createdAt).getTime()-new Date(x.createdAt).getTime()).slice(0,50));
    } catch { if(current())this.historyError.set(true); }
    finally { if(current())this.historyLoading.set(false); }
  }
  ngOnDestroy() {
    this.invalidateExport();
    this.destroyed=true; ++this.importGeneration; ++this.mergeGeneration; ++this.branchListGeneration; ++this.projectGeneration; ++this.keysGeneration; ++this.historyGeneration; this.clearShots(); this.clearComments(); this.clearTm();
    if(this.searchTimer)clearTimeout(this.searchTimer);
  }
  keyCreateRecoveryReady() { return !this.destroyed && this.keyCreateError() && !this.keyCreating() && !this.keysLoading() && !this.keysError() && this.branch()===this.keyCreateBranch() && !this.hasKeyFilters() && !this.tagsSaving().length; }
  prepareKeyCreateReload() { if(this.keyCreateRecoveryReady())this.prepareSaveReload(); }
  async addKey() {
    const submitted = this.newKey();
    if (!submitted.trim() || this.destroyed || this.keyCreating() || this.keyCreateError()) return;
    const branch = this.branch(), generation = this.keysGeneration;
    ++this.keyCreateEpoch; this.keyCreating.set(true); this.keyCreateError.set(false); this.keyCreateBranch.set(branch); this.notice.set('');
    try {
      const key = await this.api.createKey(this.projectId, { name: submitted, branch });
      if (this.destroyed) return;
      if (this.newKey() === submitted) this.newKey.set('');
      const insert = generation === this.keysGeneration && branch === this.branch()
        && !this.keysLoading() && !this.keysError() && !this.hasKeyFilters();
      if (insert) this.keys.update(keys => keys.some(k => k.id === key.id) ? keys : [...keys, key].sort((a,b) => a.name.localeCompare(b.name)));
      this.notice.set(`Key "${key.name}" was created on branch "${branch}".${insert ? ' Existing local translation values were kept.' : ' The current grid was kept. Copy any local drafts before clearing key filters or reloading that branch to find it.'}`);
    } catch { if (!this.destroyed) { ++this.keyCreateEpoch; this.keyCreateError.set(true); } }
    finally { if (!this.destroyed) this.keyCreating.set(false); }
  }
  keyDeleteRecoveryReady(k:Key) { return !this.destroyed && !this.keysLoading() && !this.keysError() && this.keyDeleteErrorFor().includes(k.id) && !this.keyDeleting().length && !this.tagsSaving().length && this.keys().some(key=>key.id===k.id); }
  prepareKeyDeleteReload(k:Key) { if(this.keyDeleteRecoveryReady(k))this.prepareSaveReload(); }
  canRemoveKey(k: Key) {
    return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.bulkReviewPending()
      && !this.keyDeleting().includes(k.id) && !this.keyDeleteErrorFor().includes(k.id)
      && !this.commentsSaving() && !this.commentsMutationError().includes(k.id) && !this.tagsSaving().includes(k.id) && !this.shotsMutating().includes(k.id) && !this.shotsMutationError().includes(k.id) && this.keys().some(key => key.id === k.id)
      && ![...this.cells.entries()].some(([id,sig]) => { const c = sig(); return id.startsWith(`${k.id}:`)
        && (c.needsReload || c.reviewing || c.status === 'saving' || c.value !== c.saved || !this.sameForms(c.forms,c.savedForms)); });
  }
  async removeKey(k: Key) {
    if (!this.canRemoveKey(k)) return;
    const generation = this.keysGeneration;
    const current = () => !this.destroyed && generation === this.keysGeneration;
    this.keyDeleting.update(ids => [...ids,k.id]);
    try {
      await this.api.deleteKey(this.projectId, k.id);
      if (!current()) return;
      this.keys.update(keys => keys.filter(key => key.id !== k.id));
      for (const id of this.cells.keys()) if (id.startsWith(`${k.id}:`)) this.cells.delete(id);
      if (this.historyFor() === k.id) this.clearHistory();
      if (this.shotsFor() === k.id) this.clearShots();
      if (this.commentsFor() === k.id) this.clearComments();
      if (this.tagEditFor() === k.id) this.tagEditFor.set(null);
      this.clearTm();
      this.notice.set(`Key "${k.name}" was deleted. Other local translation values were kept.`);
    } catch { if (current()) this.keyDeleteErrorFor.update(ids => [...ids,k.id]); }
    finally { if (!this.destroyed) this.keyDeleting.update(ids => ids.filter(id => id !== k.id)); }
  }
  localeRecoveryReady() { return !this.destroyed && this.localeCreateError() && !this.localeCreating() && !this.localeRecoveryLoading() && !this.projectLoading() && !this.projectError() && !!this.project(); }
  async checkCurrentLocales() {
    if(!this.localeRecoveryReady())return;
    const generation=++this.localeRecoveryGeneration,projectId=this.projectId,projectGeneration=this.projectGeneration;
    const current=()=>!this.destroyed && generation===this.localeRecoveryGeneration && projectGeneration===this.projectGeneration && projectId===this.projectId;
    this.localeRecoveryLoading.set(true);this.localeRecoveryError.set(false);this.localeRecoveryCodes.set(null);
    try { const project=await this.api.getProject(projectId);if(current()){this.localeRecoveryCodes.set(project.locales.map(l=>l.code));this.localeCreateError.set(false);} }
    catch { if(current())this.localeRecoveryError.set(true); }
    finally { if(generation===this.localeRecoveryGeneration&&!this.destroyed)this.localeRecoveryLoading.set(false); }
  }
  async addLocale() {
    const submitted = this.newLocale(), code = submitted.trim();
    if (!code || this.destroyed || this.localeCreating() || this.localeCreateError()) return;
    const generation = this.projectGeneration;
    ++this.localeRecoveryGeneration;this.localeRecoveryCodes.set(null);this.localeRecoveryError.set(false);this.localeCreating.set(true); this.localeCreateError.set(false); this.notice.set('');
    try {
      const locale = await this.api.addLocale(this.projectId, code);
      if (this.destroyed) return;
      if (this.newLocale() === submitted) this.newLocale.set('');
      const current = generation === this.projectGeneration && !!this.project()
        && !this.projectLoading() && !this.projectError();
      if (current) this.project.update(project => project && !project.locales.some(l => l.code === locale.code)
        ? { ...project, locales: [...project.locales, locale] } : project);
      this.notice.set(`Locale "${locale.code}" is available on this project.${current ? ' Existing local translation values were kept.' : ' The current editor was kept. Reopen project settings to see current locales.'}`);
    } catch { if (!this.destroyed) this.localeCreateError.set(true); }
    finally { if (!this.destroyed) this.localeCreating.set(false); }
  }
  async exportJson() { await this.downloadExport('file', 'json'); }
  private invalidateExport() { ++this.exportGeneration; this.exportError.set(false); this.exportNotice.set(''); }
  canSwitchBranch() {
    return !this.destroyed && ![...this.cells.values()].some(sig=>{
      const c=sig();return c.needsReload || c.reviewing || c.status==='saving'
        || c.value!==c.saved || !this.sameForms(c.forms,c.savedForms);
    });
  }
  pickBranch(name:string,picker:HTMLSelectElement) {
    if(!this.canSwitchBranch()){picker.value=this.branch();return;}
    void this.switchBranch(name);
  }
  async switchBranch(name: string) {
    if(!this.canSwitchBranch())return;
    this.invalidateExport();
    this.branch.set(name);
    this.notice.set('');
    this.error.set('');
    await this.reload();
  }
  async loadBranches() {
    if (this.destroyed) return;
    const generation = ++this.branchListGeneration, projectId = this.projectId, createEpoch=this.branchCreateEpoch;
    const current = () => !this.destroyed && generation === this.branchListGeneration;
    this.branchListLoading.set(true); this.branchListError.set(false);
    try { const branches = await this.api.listBranches(projectId); if (current()) { this.branches.set(branches); if(createEpoch===this.branchCreateEpoch && !this.branchCreating())this.branchCreateUnknown.set(false); } }
    catch { if (current()) this.branchListError.set(true); }
    finally { if (current()) this.branchListLoading.set(false); }
  }
  branchRetryReady() { return !this.destroyed && this.branchListError() && !this.branchListLoading() && !this.branchCreating() && !this.branchCreateUnknown(); }
  retryBranches() { if(!this.branchRetryReady())return Promise.resolve(); return this.loadBranches(); }
  checkCurrentBranches() {
    if(this.destroyed || !this.branchCreateUnknown() || this.branchListLoading() || this.branchCreating())return Promise.resolve();
    return this.loadBranches();
  }
  async addBranch() {
    const submitted = this.newBranch(), name = submitted.trim();
    if (!name || this.destroyed || this.branchCreating() || this.branchCreateUnknown()) return;
    ++this.branchCreateEpoch; this.branchCreating.set(true); this.error.set('');
    try {
      await this.api.createBranch(this.projectId, name);
      if (this.destroyed) return;
      if (this.newBranch() === submitted) this.newBranch.set('');
      this.notice.set(`Empty branch "${name}" was created. Branches start with no keys - they do not copy another branch. Pick it from the branch list to work there.`);
      await this.loadBranches();
    } catch { if (!this.destroyed) { ++this.branchCreateEpoch; this.branchCreateUnknown.set(true); } }
    finally { if (!this.destroyed) this.branchCreating.set(false); }
  }
  cancelMerge() {
    ++this.mergeGeneration; this.mergePreview.set(null); this.mergePreviewLoading.set(false);
  }
  async mergeIntoMain() {
    if (this.destroyed || this.mergePreviewLoading() || this.mergePending() || this.keysLoading() || this.keysError()) return;
    const from = this.branch();
    const b = this.branches().find(x => x.name === from);
    if (!b || from === 'main') return;
    const generation = ++this.mergeGeneration, keysGeneration = this.keysGeneration;
    const current = () => !this.destroyed && generation === this.mergeGeneration && keysGeneration === this.keysGeneration && from === this.branch();
    this.mergePreview.set(null); this.mergePreviewLoading.set(true); this.error.set('');
    try {
      const p = await this.api.previewMergeBranch(this.projectId, b.id, 'main');
      if (!current()) return;
      const lines = [
        `${p.keysCreated} new key(s) added to main`,
        `${p.keysExisting} key(s) exist on both; main gets ${from}'s description, plural and tag settings`,
        `${p.translationsAdded} translation(s) added`,
        `${p.translationsIdentical} identical, skipped`,
      ];
      if (p.translationsOverwritten > 0) lines.push(`WARNING: ${p.translationsOverwritten} existing main translation(s) will be OVERWRITTEN by ${from}'s version`);
      else lines.push('No existing main translation is overwritten.');
      lines.push(`${p.targetOnlyKeys} key(s) only on main are kept untouched`);
      this.mergePreviewKeysGeneration = keysGeneration;
      this.mergePreview.set({ branchId: b.id, from, lines, previewAt: p.previewAt });
    } catch { if (current()) this.error.set('Merge preview unavailable. Check your access or connection, then try again.'); }
    finally { if (current()) this.mergePreviewLoading.set(false); }
  }
  async confirmMerge() {
    const mp = this.mergePreview();
    if (!mp || this.destroyed || this.mergePending() || mp.from !== this.branch() || this.mergePreviewKeysGeneration !== this.keysGeneration || this.keysLoading() || this.keysError()) return;
    const generation = this.mergeGeneration;
    const current = () => !this.destroyed && generation === this.mergeGeneration;
    this.mergePending.set(true); this.error.set('');
    try {
      const res = await this.api.mergeBranch(this.projectId, mp.branchId, 'main', mp.previewAt);
      if (!current()) return;
      this.mergePreview.set(null);
      const skipped = res.translationsSkipped > 0 || res.keysSkipped > 0
        ? ` ${res.keysSkipped} key(s) and ${res.translationsSkipped} translation(s) changed on main after the preview were skipped - preview again to re-check them.` : '';
      this.notice.set(`Merged ${res.merged}: ${res.keysMerged} keys, ${res.translationsMerged} translations copied to main.${skipped} Current local values were kept. Copy local drafts before opening main to see its current server values.`);
    } catch { if (current()) { this.mergePreview.set(null); this.error.set('Merge result could not be confirmed. Check main before preparing another merge.'); } }
    finally { if (!this.destroyed) this.mergePending.set(false); }
  }
  // Review queue: set one status for the translations the CURRENT filter
  // selects in the selected locale. Previews the exact affected count first;
  // the server re-checks status/value at write time, so rows edited between
  // preview and confirm are excluded. Empty translations are never marked.
  canBulkReview() {
    return !this.destroyed && !this.keysLoading() && !this.keysError() && !this.keyDeleting().length && !this.keyDeleteErrorFor().length
      && ![...this.cells.values()].some(sig => {
        const c = sig();
        return c.needsReload || c.reviewing || c.status === 'saving'
          || c.value !== c.saved || !this.sameForms(c.forms, c.savedForms);
      });
  }
  async bulkMark() {
    if (!this.canBulkReview() || this.bulkReviewPending() || this.importWritePending()) return;
    this.bulkReviewPending.set(true); this.error.set('');
    const scope = { locale: this.ioLocale(), status: this.bulkStatus(), from: this.filterStatus() || undefined, search: this.search() || undefined, tag: this.filterTag() || undefined, branch: this.branch() };
    const generation = this.keysGeneration;
    const current = () => this.canBulkReview() && generation === this.keysGeneration
      && scope.locale === this.ioLocale() && scope.status === this.bulkStatus()
      && scope.from === (this.filterStatus() || undefined) && scope.search === (this.search() || undefined)
      && scope.tag === (this.filterTag() || undefined) && scope.branch === this.branch();
    try {
      const preview = await this.api.bulkSetStatus(this.projectId, { ...scope, dryRun: true });
      if (!current()) return;
      const bits = [];
      if (scope.from) bits.push(`currently ${scope.from.toLowerCase()}`);
      if (scope.search) bits.push(`keys matching "${scope.search}"`);
      if (scope.tag) bits.push(`tagged ${scope.tag}`);
      const scopeText = bits.length ? ` (${bits.join(', ')})` : '';
      if (!confirm(`Mark up to ${preview.matched} translations in ${scope.locale} on branch ${scope.branch}${scopeText} as ${scope.status.toLowerCase()}?\nOnly branch ${scope.branch} is touched. Empty translations are skipped, and anything saved after this preview is excluded.`) || !current()) return;
      const res = await this.api.bulkSetStatus(this.projectId, { ...scope, notChangedSince: preview.previewAt ?? undefined });
      // A new draft or scope while the write was pending must not be reloaded away.
      if (!current()) {
        if (!this.destroyed) {
          for (const sig of this.cells.values()) sig.update(c => ({ ...c, status: 'error', needsReload: true, errorMsg: 'Copy local values and reload after the bulk review result.' }));
          this.notice.set('Bulk review returned after local work or scope changed. Local values were kept. Copy them and reload current server values before more changes.');
        }
        return;
      }
      this.notice.set(`Marked ${res.updated} translations in ${scope.locale} as ${scope.status.toLowerCase()}.`);
      await this.reload();
    } catch { if (!this.destroyed) {
      for (const sig of this.cells.values()) sig.update(c => ({ ...c, status: 'error', needsReload: true, errorMsg: 'Copy local values and reload after the bulk review result.' }));
      this.prepareSaveReload();
      this.error.set('Bulk review could not be confirmed. Copy retained values and reload before trying again.');
    } }
    finally { if (!this.destroyed) this.bulkReviewPending.set(false); }
  }
  async bundleFile(event: Event) {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (!file || this.destroyed || this.importPending()) return;
    this.cancelImportPick(); this.notice.set(''); this.error.set('');
    if (!this.canBulkReview() || this.bulkReviewPending()) {
      this.error.set('Bundle import unavailable while local translation work is unsaved, pending or unconfirmed. Save drafts or copy retained values before reloading.'); return;
    }
    const scope: ImportScope = { generation: this.importGeneration, keysGeneration: this.keysGeneration, branch: this.branch(), locale: this.ioLocale(), format: this.ioFormat() };
    this.importPending.set(true); this.importWritePending.set(true);
    try {
      const res = await this.api.importBundle(this.projectId, scope.format, file, scope.branch);
      if (!this.importScopeCurrent(scope)) return;
      const parts = res.imported.map(r => `${r.locale}: ${r.keysCreated} created, ${r.translationsUpserted} updated, ${r.unchangedSkipped} unchanged${r.failed ? `, ${r.failed} failed` : ''}`);
      const skips = res.skipped.map(x => `skipped ${x.name} (${x.reason})`);
      const fails = res.failedLocales.map(x => `${x.locale} failed (${x.error})`);
      const summary = [...parts, ...skips, ...fails].join('; ');
      this.notice.set(`Bundle import (${this.labelFor(scope.format)}, ${res.branch}): ${summary || 'no entries'}. Each locale imported independently - skipped/failed entries above were not rolled back.`);
      if (!this.canBulkReview() || this.bulkReviewPending()) {
        this.prepareSaveReload();
        this.notice.update(message => `${message} Local values were kept. Copy retained values and reload current server values before more changes.`);
      } else await this.reload();
    } catch { if (this.importScopeCurrent(scope)) {
      this.prepareSaveReload();
      this.error.set('Bundle import result could not be confirmed. Some locales may have changed. Copy retained values and check current server values before trying again.');
    } }
    finally { if (!this.destroyed) { this.importPending.set(false); this.importWritePending.set(false); } }
  }
  async exportBundleFile() { await this.downloadExport('bundle'); }
  async exportTmxFile() { await this.downloadExport('tmx'); }
  async exportFile() { await this.downloadExport('file'); }
  private async downloadExport(kind: 'file' | 'bundle' | 'tmx', fmt = this.ioFormat()) {
    if (this.destroyed || this.exportPending()) return;
    const scope = { generation: this.exportGeneration, projectGeneration: this.projectGeneration,
      branch: this.branch(), locale: this.ioLocale(), format: this.ioFormat(), slug: this.project()?.slug ?? 'export' };
    const current = () => !this.destroyed && scope.generation === this.exportGeneration
      && scope.projectGeneration === this.projectGeneration && scope.branch === this.branch()
      && scope.locale === this.ioLocale() && scope.format === this.ioFormat();
    this.exportPending.set(true); this.exportError.set(false); this.exportNotice.set('');
    try {
      let blob: Blob, filename: string, message: string;
      if (kind === 'bundle') {
        blob = await this.api.exportBundle(this.projectId, fmt, scope.branch);
        filename = `${scope.slug}-${fmt}.zip`;
        message = `All locales exported as one zip (${this.labelFor(fmt)}${fmt === 'csv' ? ', spreadsheet-safe' : ''}, branch ${scope.branch}).`;
      } else if (kind === 'tmx') {
        const content = await this.api.exportTmx(this.projectId, scope.locale);
        blob = new Blob([content], { type: 'application/x-tmx+xml' });
        filename = `${scope.slug}-${scope.locale}.tmx`;
        message = `Translation memory for ${scope.locale} exported as TMX 1.4 (project-wide, export-only; there is no TMX import).`;
      } else {
        let content: string, type: string, ext: string;
        if (fmt === 'json') {
          content = JSON.stringify(await this.api.exportJson(this.projectId, scope.locale, scope.branch), null, 2);
          type = 'application/json'; ext = 'json';
        } else if (fmt === 'csv') {
          content = await this.api.exportCsv(this.projectId, scope.locale, undefined, scope.branch);
          type = 'text/csv'; ext = 'csv';
        } else {
          content = await this.api.exportText(this.projectId, scope.locale, fmt, scope.branch);
          type = fmt === 'android' || fmt === 'xliff' || fmt === 'resx' || fmt === 'stringsdict' ? 'text/xml' : fmt === 'arb' ? 'application/json' : fmt === 'yaml' ? 'text/yaml' : 'text/plain';
          ext = fmt === 'android' ? 'xml' : fmt === 'po' ? 'po' : fmt === 'pot' ? 'pot' : fmt === 'xliff' ? 'xlf' : fmt === 'properties' ? 'properties' : fmt === 'arb' ? 'arb' : fmt === 'yaml' ? 'yaml' : fmt === 'resx' ? 'resx' : fmt === 'stringsdict' ? 'stringsdict' : 'strings';
        }
        blob = new Blob([content], { type }); filename = `${scope.slug}.${scope.locale}.${ext}`;
        message = `${this.labelFor(fmt)} exported for ${scope.locale} on branch ${scope.branch}.${fmt === 'csv' ? ' Spreadsheet-safe. For a lossless roundtrip export use the API with mode=raw.' : ''}`;
      }
      if (!current()) return;
      const url = URL.createObjectURL(blob);
      try { const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); }
      finally { URL.revokeObjectURL(url); }
      this.exportNotice.set(message);
    } catch { if (current()) this.exportError.set(true); }
    finally { if (!this.destroyed) this.exportPending.set(false); }
  }
  labelFor(fmt: IoFormat): string {
    return fmt === 'json' ? 'JSON' : fmt === 'csv' ? 'CSV' : fmt === 'android' ? 'Android XML' : fmt === 'po' ? 'PO (gettext)' : fmt === 'pot' ? 'POT (gettext template)' : fmt === 'xliff' ? 'XLIFF 1.2' : fmt === 'properties' ? 'Java properties' : fmt === 'arb' ? 'ARB (Flutter)' : fmt === 'yaml' ? 'YAML' : fmt === 'resx' ? 'RESX (.NET)' : fmt === 'stringsdict' ? 'iOS .stringsdict' : 'iOS strings';
  }
  formatLabel(): string {
    return this.labelFor(this.ioFormat());
  }
  onFormatPick(fmt: IoFormat) {
    this.invalidateExport();
    this.cancelImportPick(); this.ioFormat.set(fmt);
    this.ioFormatTouched.set(true);
  }
  async importFile(event: Event) {
    return this.handleFile(event, false);
  }
  async previewFile(event: Event) {
    return this.handleFile(event, true);
  }
  cancelImportPick() { ++this.importGeneration; this.importConflict.set(null); }
  onIoLocalePick(locale: string) { this.invalidateExport(); this.cancelImportPick(); this.ioLocale.set(locale); }
  private importScopeCurrent(scope: ImportScope) {
    return !this.destroyed && scope.generation === this.importGeneration && scope.keysGeneration === this.keysGeneration
      && scope.branch === this.branch() && scope.locale === this.ioLocale() && scope.format === this.ioFormat();
  }
  private async handleFile(event: Event, dryRun: boolean) {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    input.value = '';
    if (!file || this.destroyed || this.importPending()) return;
    this.cancelImportPick(); this.notice.set(''); this.error.set('');
    const scope: ImportScope = { generation: this.importGeneration, keysGeneration: this.keysGeneration, branch: this.branch(), locale: this.ioLocale(), format: this.ioFormat() };
    let text: string;
    try { text = await file.text(); }
    catch { if (this.importScopeCurrent(scope)) this.error.set('File could not be read. Pick it again to try again.'); return; }
    if (!this.importScopeCurrent(scope)) return;
    const detected = detectImportFormat(file.name);
    if (detected && detected !== scope.format) {
      if (this.ioFormatTouched()) {
        this.importConflict.set({ scope, filename: file.name, ext: file.name.split('.').pop() ?? '', detected, current: scope.format, text, dryRun });
        return;
      }
      this.invalidateExport(); this.ioFormat.set(detected); scope.format = detected;
    }
    await this.runImport(text, dryRun, scope);
  }
  async resolveImportConflict(useDetected: boolean) {
    const c = this.importConflict();
    if (!c || this.importPending() || !this.importScopeCurrent(c.scope)) { this.importConflict.set(null); return; }
    this.importConflict.set(null); this.notice.set(''); this.error.set('');
    const scope = { ...c.scope };
    if (useDetected) { this.invalidateExport(); this.ioFormat.set(c.detected); scope.format = c.detected; this.ioFormatTouched.set(true); }
    await this.runImport(c.text, c.dryRun, scope);
  }
  private async runImport(text: string, dryRun: boolean, scope: ImportScope) {
    if (this.importPending() || !this.importScopeCurrent(scope)) return;
    const fmt = scope.format;
    if (!dryRun && (!this.canBulkReview() || this.bulkReviewPending())) { this.error.set('Import unavailable while local translation work is unsaved, pending or unconfirmed. Save drafts or copy retained values before reloading.'); return; }
    this.importPending.set(true); this.importWritePending.set(!dryRun);
    let submitted = false;
    try {
      const payload = fmt === 'json' ? { entries: JSON.parse(text) }
        : fmt === 'csv' ? { csv: text }
        : fmt === 'android' ? { xml: text } : fmt === 'po' ? { po: text } : fmt === 'pot' ? { pot: text } : fmt === 'xliff' ? { xliff: text } : fmt === 'properties' ? { properties: text } : fmt === 'arb' ? { arb: text } : fmt === 'yaml' ? { yaml: text } : fmt === 'resx' ? { resx: text } : fmt === 'stringsdict' ? { stringsdict: text } : { strings: text };
      submitted = true;
      const res = await this.api.importPayload(this.projectId, scope.locale, payload, scope.branch, dryRun);
      if (!this.importScopeCurrent(scope)) return;
      this.error.set('');
      this.notice.set(dryRun
        ? `Preview only - nothing imported: would create ${res.keysCreated} keys, update ${res.translationsUpserted} translations, ${res.unchangedSkipped} unchanged${res.failed ? `, ${res.failed} would fail: ${(res.failures ?? []).join('; ')}` : ''} (${this.labelFor(fmt)}, ${scope.locale}, branch ${scope.branch}).`
        : `Imported ${res.keysCreated} keys, ${res.translationsUpserted} translations (${this.labelFor(fmt)}, ${scope.locale}, branch ${scope.branch}).`);
      if (!dryRun) {
        if (!this.canBulkReview() || this.bulkReviewPending()) {
          this.prepareSaveReload();
          this.notice.set(`Import confirmed on branch "${scope.branch}" in ${scope.locale}. Local values were kept. Copy retained values and reload current server values before more changes.`);
        } else await this.reload();
      }
    } catch { if (this.importScopeCurrent(scope)) { if (!dryRun && submitted) this.prepareSaveReload(); this.notice.set(''); this.error.set(!submitted ? 'File could not be parsed in the selected format. Nothing was sent.' : dryRun ? 'Import preview unavailable. Check the file and connection before trying again.' : 'Import result could not be confirmed. Check current server values before trying again.'); } }
    finally { if (!this.destroyed) { this.importPending.set(false); this.importWritePending.set(false); } }
  }
}
