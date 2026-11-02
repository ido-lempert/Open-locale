import { reviewedRecoveryInput } from './recovery-input';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  ApiService,
  RepositoryTargetInput,
  RepositoryEffectSummary,
  DeletionAuditPage,
  DeletionRecoveryPreview,
  DeletionRecoveryValueReview,
  LocalRecoveryInput,
  RepositoryTargetConfig,
  RepositoryFileSnapshot,
  RepositoryBaselineView,
  RepositorySyncPreview,
  RepositoryResolutionDraft,
  SyncResolutionChoice,
  BranchInfo,
} from '../api.service';
const empty = (): RepositoryTargetInput => ({
  localBranch: 'main',
  locale: '',
  owner: '',
  repo: '',
  path: '',
  remoteBranch: 'main',
});
@Component({
  selector: 'ol-repository-targets',
  imports: [FormsModule, RouterLink],
  styles: [
    `
      section[aria-label="Deletion audit metadata"], .audit-heading { scroll-margin-top: 72px; }
      .audit-heading:focus { outline: 2px solid #285fbd; outline-offset: 4px; }
      .audit-list { padding: 0; list-style: none; }
      .audit-list li { border: 1px solid #dce2eb; border-radius: 8px; padding: 16px; margin: 12px 0; overflow-wrap: anywhere; }
      .recovery-value:focus, .recovery-confirmation:focus, .recovery-outcome:focus { outline: 2px solid #285fbd; outline-offset: 4px; }
      .recovery-value { scroll-margin-top: 72px; }
      .recovery-value pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 240px; overflow: auto; padding: 12px; background: #fff; border: 1px solid #dce2eb; }
      .audit-list dl { margin: 0; }
      .audit-list dd { margin: 0 0 8px; }
      .effect-summary dl { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 8px 16px; }
      .effect-summary dd { margin: 0; overflow-wrap: anywhere; }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        min-width: 1050px;
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 10px;
        border-bottom: 1px solid #dce2eb;
        vertical-align: top;
        min-width: 100px;
        max-width: 240px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .manual {
        background: #fff4e8;
      }
      fieldset {
        min-width: 0;
        border: 1px solid #dce2eb;
        border-radius: 8px;
      }
      .digest {
        overflow-wrap: anywhere;
      }
      textarea {
        width: 100%;
        min-height: 180px;
        box-sizing: border-box;
        font-family: monospace;
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px;
      }
      .notice {
        color: #654b12;
        background: #fff8e7;
        border: 1px solid #e7cb85;
        border-radius: 8px;
        padding: 16px;
        line-height: 1.5;
      }
      .fields {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin: 12px 0;
        min-width: 0;
      }
      input,
      select {
        width: 100%;
        box-sizing: border-box;
      }
      article {
        background: white;
        border: 1px solid #dce2eb;
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .success {
        color: #25603c;
      }
      h2 {
        font-size: 1.2rem;
      }
      code {
        overflow-wrap: anywhere;
      }
      button {
        min-height: 36px;
      }
      @media (max-width: 600px) {
        main {
          padding: 16px;
        }
        .fields {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  template: ` <header class="bar">
      <a class="back" [routerLink]="['/projects', projectId, 'sync']"
        >&larr; File preview</a
      >
      <h1>Repository targets</h1>
    </header>
    <main>
      <p class="notice">
        Configuration only. These coordinates do not connect to GitHub, grant
        credentials, accept a baseline or run sync. Reading a file requires
        separately configured deployment read access. No repository files or
        translations change unless you explicitly confirm a reviewed local apply or recovery below. Session admins only. Do not paste tokens or
        passwords here.
      </p>
      @if (recoverySending()) {
        <p #outcome tabindex="-1" role="status" class="notice recovery-outcome">Local recovery request sent. Waiting for its result. Leaving this page does not cancel the request. Do not send another recovery until you check the current value.</p>
      }
      @if (error()) {
        <p #outcome tabindex="-1" role="alert" class="error recovery-outcome">{{ error() }}</p>
      }
      @if (message()) {
        <p #outcome tabindex="-1" role="status" class="success recovery-outcome">{{ message() }}</p>
      }
      @if (ready()) {
        <button
          type="button"
          name="targetRefresh"
          (click)="refresh()"
          [disabled]="busy()"
        >
          Refresh configurations
        </button>
        <section #auditRegion aria-label="Deletion audit metadata" [attr.aria-busy]="auditLoading()">
          <h2 #auditHeading class="audit-heading" tabindex="-1">Deletion audit metadata</h2>
          <p>Project-wide metadata only. No archived values or history until explicit review.</p>
          <button name="auditLoad" type="button" (click)="loadAudits()" [disabled]="busy()">Load newest audit page</button>
          <label>Archived value review scope
            <select name="auditReviewTarget" [disabled]="busy() && !valueReviewLoading()" [ngModel]="reviewTargetId()" (ngModelChange)="changeReviewTarget($event)">
              <option value="">Value only (no repository target)</option>
              @for (t of targets(); track t.id) { <option [value]="t.id">{{ t.localBranch }} / {{ t.locale }} / {{ t.owner }}/{{ t.repo }} / {{ t.path }}</option> }
            </select>
          </label>
          <p>Choosing a target checks its current baseline and scope. Direct team admins only. Recovery requires a separate confirmation after review.</p>
          @if (auditLoading()) { <p role="status">Loading audit metadata...</p> }
          @if (auditPage(); as page) {
            <p>Up to 50 rows per page, newest first. Not live or a frozen snapshot.</p>
            @if (!page.audits.length) { <p>No deletion audits on this page.</p> }
            <ul class="audit-list">
              @for (a of page.audits; track a.id) {
                <li><strong>{{ a.keyName }}</strong><dl>
                  <dt>Locale</dt><dd>{{ a.localeCode }}</dd>
                  <dt>Deleted at (UTC)</dt><dd>{{ a.createdAt }}</dd>
                  <dt>Actor ID</dt><dd>{{ a.actorId ?? 'Unavailable' }}</dd>
                  <dt>Key ID</dt><dd>{{ a.keyId }}</dd>
                  <dt>Audit ID</dt><dd>{{ a.id }}</dd>
                </dl>
                <button name="auditValueReview" [attr.data-value-audit-id]="a.id" type="button" (click)="reviewRecoveryValue(a.id)" [disabled]="busy()">Review archived value</button>
                @if (valueReviewLoading() === a.id) {
                  <div class="value-review-loading" aria-busy="true">
                    <p role="status">Loading archived value for review...</p>
                    <button name="auditValueCancel" type="button" (click)="cancelValueReview()">Cancel value review</button>
                  </div>
                }
                @if (recoveryValue()?.auditId === a.id) {
                  <div class="recovery-value" tabindex="-1" [attr.data-value-result-id]="a.id" role="region" aria-label="Archived value review">
                    <p class="notice" role="status">{{ valueReviewReason(recoveryValue()!.result) }}
                      @if (recoveryValue()!.targetLabel) { Target at review: {{ recoveryValue()!.targetLabel }}. }
                      Snapshot: {{ recoveryValue()!.result.asOf }} (UTC). Not live. No reservation is held. This review does not restore a value.</p>
                    @if (recoveryValue()!.result.reviewAvailable) { <pre>{{ recoveryValue()!.result.value === '' ? '(Empty value)' : recoveryValue()!.result.value }}</pre> }
                    @if (recoveryBindingsUnavailable()) {
                      <p class="notice" role="status" name="auditRecoveryBindingsUnavailable">This value is read-only. Complete matching recovery checks were not returned for the selected configuration. Refresh configuration and review again before preparing local recovery. No recovery request was sent.</p>
                    }
                    @if (recoveryValue()!.recoveryInput) {
                      @if (recoveryValue()!.confirming) {
                        <div class="notice recovery-confirmation" tabindex="-1" role="region" aria-label="Confirm local recovery">
                          <p>Recover this archived value locally? A fresh unverified locale value, new history and one queued effect will be created. Archived history is not replayed. Repository files and accepted baseline stay unchanged. Sync is not completed. Queued effects may run if a worker is enabled.</p>
                          <button name="auditRecoverConfirm" type="button" (click)="recoverLocalValue()" [disabled]="busy()">Confirm local recovery</button>
                          <button name="auditRecoverCancel" type="button" (click)="cancelLocalRecovery()" [disabled]="busy()">Cancel recovery</button>
                        </div>
                      } @else {
                        <button name="auditRecoverPrepare" type="button" (click)="prepareLocalRecovery()" [disabled]="busy()">Prepare local recovery</button>
                      }
                    }
                    <button name="auditValueHide" type="button" (click)="hideValueReview()">Hide archived value</button>
                  </div>
                }
                <button name="auditCheck" [attr.data-audit-id]="a.id" type="button" (click)="checkRecovery(a.id)" [disabled]="busy()">Check recovery eligibility</button>
                @if (recoveryPreview()?.auditId === a.id) {
                  <p class="notice" role="status">{{ recoveryReason(recoveryPreview()!.result) }}
                    Snapshot: {{ recoveryPreview()!.result.asOf }} (UTC). Not live. Check again to refresh. No reservation is held. This eligibility check cannot restore a value. Use archived value review with a repository target for separate recovery confirmation.</p>
                }
                </li>
              }
            </ul>
            @if (page.nextCursor) {
              <button name="auditOlder" type="button" (click)="loadAudits(page.nextCursor)" [disabled]="busy()">Load older audit page</button>
            } @else { <p>End of audit pages.</p> }
          }
        </section>
        <h2>
          {{
            editing() ? 'Edit target configuration' : 'Add target configuration'
          }}
        </h2>
        <form (ngSubmit)="save()">
          <fieldset [disabled]="busy()">
            <div class="fields">
              <label
                >Local branch<select
                  name="targetLocalBranch"
                  [(ngModel)]="form.localBranch"
                  required
                >
                  @for (b of branches(); track b.id) {
                    <option [value]="b.name">{{ b.name }}</option>
                  }
                </select></label
              >
              <label
                >Locale<select
                  name="targetLocale"
                  [(ngModel)]="form.locale"
                  required
                >
                  @for (l of locales(); track l) {
                    <option [value]="l">{{ l }}</option>
                  }
                </select></label
              >
              <label
                >Repository owner<input
                  name="targetOwner"
                  [(ngModel)]="form.owner"
                  maxlength="39"
                  required
                  autocomplete="off"
                  placeholder="owner"
              /></label>
              <label
                >Repository name<input
                  name="targetRepo"
                  [(ngModel)]="form.repo"
                  maxlength="100"
                  required
                  autocomplete="off"
                  placeholder="repository"
              /></label>
              <label
                >File path (relative to repository)<input
                  name="targetPath"
                  [(ngModel)]="form.path"
                  maxlength="1024"
                  required
                  autocomplete="off"
                  placeholder="locales/en.json"
              /></label>
              <label
                >Remote branch<input
                  name="targetRemoteBranch"
                  [(ngModel)]="form.remoteBranch"
                  maxlength="255"
                  required
                  autocomplete="off"
              /></label>
            </div>
            <p>
              One target per local branch and locale; up to 100 per project. No
              credentials are stored.
            </p>
            <div class="actions">
              <button name="targetSave" type="submit">
                {{
                  busy()
                    ? 'Saving...'
                    : editing()
                      ? 'Save configuration'
                      : 'Add configuration'
                }}
              </button>
              @if (editing()) {
                <button name="targetCancel" type="button" (click)="cancel()">
                  Cancel edit
                </button>
              }
            </div>
          </fieldset>
        </form>
        <h2>Saved configurations ({{ targets().length }})</h2>
        @for (t of targets(); track t.id) {
          <article [attr.data-target-id]="t.id">
            <h2>{{ t.localBranch }} / {{ t.locale }}</h2>
            <p>{{ t.owner }} / {{ t.repo }}</p>
            <p>
              File: <code>{{ t.path }}</code>
            </p>
            <p>
              Remote branch: {{ t.remoteBranch }}. Revision {{ t.revision }}.
            </p>
            <p>
              No sync connection. Sync cannot run. A comparison baseline is
              separate from synchronization.
            </p>
            <div class="actions">
            <button
              name="targetLoadBaseline"
              type="button"
              (click)="loadBaseline(t)"
              [disabled]="busy()"
            >
              View accepted baseline
            </button>
            <button
              name="targetRead"
              type="button"
              (click)="read(t)"
              [disabled]="busy()"
            >
              Read repository file
            </button>
            <button
              name="targetPreview"
              type="button"
              (click)="preview(t)"
              [disabled]="busy()"
            >
              Compare repository with local translations
            </button>
            <button name="targetEffects" type="button" (click)="loadEffects(t)" [disabled]="busy()">
              Load effect summary
            </button>
            </div>
            @if (effectSummary()?.targetId === t.id) {
              <section aria-label="Effect bookkeeping summary" class="effect-summary">
                <h3>Effect bookkeeping</h3>
                <p>Snapshot: {{ effectSummary()!.asOf }} (UTC). Not live. Load again to refresh.</p>
                <dl>
                  <dt>Pending</dt><dd>{{ effectSummary()!.counts.pending }}</dd>
                  <dt>Leased</dt><dd>{{ effectSummary()!.counts.leased }}</dd>
                  <dt>Completed handlers</dt><dd>{{ effectSummary()!.counts.completed }}</dd>
                  <dt>Dead</dt><dd>{{ effectSummary()!.counts.dead }}</dd>
                  <dt>Webhook checkpoints</dt><dd>{{ effectSummary()!.channelCheckpoints.webhook }}</dd>
                  <dt>Automation checkpoints</dt><dd>{{ effectSummary()!.channelCheckpoints.automation }}</dd>
                  <dt>Both checkpoints</dt><dd>{{ effectSummary()!.channelCheckpoints.both }}</dd>
                  <dt>Expired leases</dt><dd>{{ effectSummary()!.expiredLeases }}</dd>
                  <dt>Oldest pending (UTC)</dt><dd>{{ effectSummary()!.oldestPendingAt ?? 'None' }}</dd>
                </dl>
                <p class="notice">These are handler counts and channel checkpoints, not delivery receipts or completed sync.
                  Includes earlier target revisions. Terminal counts may be removed after seven days.
                  Worker enablement is unknown. Loading this summary does not run or retry effects.</p>
              </section>
            }
            @if (previewResult()?.targetId === t.id) {
              <section aria-label="Repository comparison">
                <h3>Repository comparison - not applied</h3>
                <p class="notice">
                  Accepted baseline version
                  {{ previewResult()!.baselineVersion }}, current local
                  {{ previewResult()!.branch }} / {{ previewResult()!.locale }},
                  and fresh verified repository bytes. Conflicts and missing
                  values need manual review. Nothing is imported, pushed or
                  saved.
                </p>
                <p>
                  {{ previewResult()!.decisions.length }} keys compared.
                  {{
                    previewResult()!.requiresManual
                      ? 'Manual review needed.'
                      : 'No conflicts or deletions requiring manual review.'
                  }}
                </p>
                <p class="digest">
                  Remote blob SHA: {{ previewResult()!.remoteSha }}
                </p>
                <p>Scroll the table horizontally on smaller screens.</p>
                <div
                  class="table-wrap"
                  tabindex="0"
                  role="region"
                  aria-label="Repository comparison table"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Accepted baseline</th>
                        <th>Local</th>
                        <th>Repository</th>
                        <th>Difference</th>
                        <th>Draft selection</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (d of previewRows(); track d.key) {
                        <tr [class.manual]="d.suggested === 'manual'">
                          <td>{{ d.key }}</td>
                          <td>{{ display(d.base) }}</td>
                          <td>{{ display(d.local) }}</td>
                          <td>{{ display(d.remote) }}</td>
                          <td>
                            {{ d.kind
                            }}{{
                              d.suggested === 'manual' ? ' - manual review' : ''
                            }}
                          </td>
                          <td>
                            @if (
                              d.kind !== 'unchanged' && d.kind !== 'converged'
                            ) {
                              <select
                                [attr.aria-label]="'Draft value for ' + d.key"
                                [attr.data-repo-choice]="d.key"
                                [ngModel]="choices().get(d.key) ?? ''"
                                (ngModelChange)="choose(d.key, $event)"
                                [disabled]="busy()"
                              >
                                <option value="">Choose...</option>
                                <option value="base">Accepted baseline</option>
                                <option value="local">Local</option>
                                <option value="remote">Repository</option>
                              </select>
                            } @else {
                              Same value retained
                            }
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6">No translated keys to compare.</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (previewPages() > 1) {
                  <nav aria-label="Repository comparison pages">
                    <button
                      name="targetPreviewPrevious"
                      type="button"
                      (click)="previewPage.set(previewPage() - 1)"
                      [disabled]="previewPage() === 0"
                    >
                      Previous</button
                    ><span
                      >Page {{ previewPage() + 1 }} of
                      {{ previewPages() }}</span
                    ><button
                      name="targetPreviewNext"
                      type="button"
                      (click)="previewPage.set(previewPage() + 1)"
                      [disabled]="previewPage() + 1 >= previewPages()"
                    >
                      Next
                    </button>
                  </nav>
                }
                <section aria-label="Prepare repository draft">
                  <h3>Prepare draft JSON</h3>
                  <p>
                    Select a value for every differing key, including one-sided
                    changes. Selecting a missing value omits that key from the
                    draft only. This does not import translations, write
                    repository files or run sync.
                  </p>
                  <p>
                    {{ choices().size }} of {{ requiredChoices() }} differing
                    keys selected.
                  </p>
                  <button
                    name="targetResolve"
                    type="button"
                    (click)="resolve(t)"
                    [disabled]="busy() || choices().size !== requiredChoices()"
                  >
                    {{ busy() ? 'Preparing draft...' : 'Prepare draft JSON' }}
                  </button>
                  @if (draft(); as d) {
                    <p class="notice">
                      Draft only - not applied. {{ d.outputKeys }} output keys;
                      {{ d.absentKeys }} absent keys omitted. No translations or
                      repository files have changed. The repository may change
                      after this read.
                    </p>
                    <section aria-label="Local draft changes">
                      <h4>Local value changes - not applied</h4>
                      <p>
                        Compared with current stored
                        {{ previewResult()!.branch }} /
                        {{ previewResult()!.locale }} values:
                        {{ d.localChangePlan.setValues }} values to set,
                        {{ d.localChangePlan.removeLocaleValues }} locale values
                        to remove,
                        {{ d.localChangePlan.unchangedValues }} values
                        unchanged.
                      </p>
                      <p class="notice">
                        A removal affects this locale value only, never the
                        project key or another locale. These are review data,
                        not permission to apply. No local values, repository
                        files or accepted baseline have changed.
                      </p>
                      <div
                        class="table-wrap"
                        role="region"
                        aria-label="Local draft changes table"
                        tabindex="0"
                      >
                        <table>
                          <thead>
                            <tr>
                              <th>Key</th>
                              <th>Draft operation</th>
                              <th>Current local value</th>
                              <th>Draft local value</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (c of changeRows(); track c.key) {
                              <tr
                                [class.manual]="
                                  c.action === 'remove-locale-value'
                                "
                              >
                                <td>{{ c.key }}</td>
                                <td>
                                  {{
                                    c.action === 'set-value'
                                      ? 'Set locale value'
                                      : 'Remove locale value only'
                                  }}
                                </td>
                                <td>{{ display(c.expectedValue) }}</td>
                                <td>{{ display(c.nextValue) }}</td>
                              </tr>
                            } @empty {
                              <tr>
                                <td colspan="4">
                                  No local value changes in this draft.
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      @if (changePages() > 1) {
                        <nav aria-label="Local draft change pages">
                          <button
                            type="button"
                            name="targetChangePrevious"
                            (click)="changePage.set(changePage() - 1)"
                            [disabled]="changePage() === 0"
                          >
                            Previous</button
                          ><span
                            >Page {{ changePage() + 1 }} of
                            {{ changePages() }}</span
                          ><button
                            type="button"
                            name="targetChangeNext"
                            (click)="changePage.set(changePage() + 1)"
                            [disabled]="changePage() + 1 >= changePages()"
                          >
                            Next
                          </button>
                        </nav>
                      }
                    </section>
                    <label
                      >Draft JSON<textarea
                        name="targetDraft"
                        readonly
                        [value]="d.json"
                        spellcheck="false"
                      ></textarea>
                    </label>
                    <p class="digest">SHA256: {{ d.contentDigest }}</p>
                    @if (d.localChangePlan.changes.length) {
                      @if (confirmApply()) {
                        <section class="notice" aria-label="Confirm local apply">
                          <h4>Apply reviewed local values?</h4>
                          <p>Project {{ projectId }}, branch {{ t.localBranch }}, locale {{ t.locale }}:
                          set {{ d.localChangePlan.setValues }} values and remove {{ d.localChangePlan.removeLocaleValues }} locale values.
                          A removal never deletes a project key or another locale.</p>
                          <p>Repository files and accepted baseline stay unchanged. This does not complete sync.
                          Configured webhooks and automations may run later if the deployment effect worker is enabled.</p>
                          <p class="digest">Reviewed SHA256: {{ d.contentDigest }}</p>
                          <div class="actions"><button name="targetConfirmApply" type="button" (click)="apply(t)" [disabled]="busy()">{{ busy() ? 'Applying local values...' : 'Apply local values' }}</button>
                          <button name="targetCancelApply" type="button" (click)="confirmApply.set(false)" [disabled]="busy()">Keep local values</button></div>
                        </section>
                      } @else {
                        <button name="targetPrepareApply" type="button" (click)="confirmApply.set(true)" [disabled]="busy()">Review local apply...</button>
                      }
                    }
                    <button
                      name="targetDownloadDraft"
                      type="button"
                      (click)="downloadDraft()"
                    >
                      Download draft JSON
                    </button>
                  }
                </section>
              </section>
            }
            @if (snapshot()?.targetId === t.id) {
              <section aria-label="Repository file snapshot">
                <h3>Verified file snapshot. Not an accepted baseline.</h3>
                <p>
                  Read at {{ readAt() }}. Target revision
                  {{ snapshot()!.targetRevision }}. No import or sync was run.
                  The repository may change after this read.
                </p>
                <p class="digest">Blob SHA: {{ snapshot()!.remoteSha }}</p>
                <p class="digest">SHA256: {{ snapshot()!.contentDigest }}</p>
                <label
                  >Repository JSON<textarea
                    name="targetSnapshot"
                    readonly
                    [value]="snapshot()!.json"
                    spellcheck="false"
                  ></textarea>
                </label>
              </section>
            }
            @if (baselineView()?.targetId === t.id) {
              <section aria-label="Accepted comparison baseline">
                @if (baselineView()!.baseline; as b) {
                  <h3>
                    Accepted comparison baseline - version {{ b.version }}
                  </h3>
                  <p>
                    Accepted at {{ b.acceptedAt }} by account {{ b.actorId }}.
                    This does not mean local translations match the repository
                    or that sync completed.
                  </p>
                  <p class="digest">Accepted blob SHA: {{ b.remoteSha }}</p>
                  <label
                    >Accepted baseline JSON<textarea
                      name="targetBaseline"
                      readonly
                      [value]="b.text"
                      spellcheck="false"
                    ></textarea>
                  </label>
                } @else {
                  <p>No accepted comparison baseline.</p>
                }
                @if (snapshot()?.targetId === t.id) {
                  @if (confirmBaseline()) {
                    <p class="notice">
                      Use the displayed verified file snapshot as the comparison
                      baseline? This replaces the current baseline only. It does
                      not import translations, change repository files or grant
                      permission to apply a future plan.
                    </p>
                    <button
                      name="targetConfirmBaseline"
                      type="button"
                      (click)="acceptBaseline(t)"
                      [disabled]="busy()"
                    >
                      Accept comparison baseline
                    </button>
                    <button
                      name="targetCancelBaseline"
                      type="button"
                      (click)="confirmBaseline.set(false)"
                      [disabled]="busy()"
                    >
                      Keep current baseline
                    </button>
                  } @else {
                    <button
                      name="targetPrepareBaseline"
                      type="button"
                      (click)="confirmBaseline.set(true)"
                      [disabled]="busy()"
                    >
                      Use snapshot as comparison baseline...
                    </button>
                  }
                }
              </section>
            }
            @if (removing()?.id === t.id) {
              <p class="notice">
                Remove this configuration only? Repository files and
                translations will not be deleted.
              </p>
              <div class="actions">
                <button
                  name="targetConfirmRemove"
                  type="button"
                  (click)="remove(t)"
                  [disabled]="busy()"
                >
                  Remove configuration</button
                ><button
                  name="targetCancelRemove"
                  type="button"
                  (click)="removing.set(null)"
                  [disabled]="busy()"
                >
                  Keep configuration
                </button>
              </div>
            } @else {
              <div class="actions">
                <button
                  name="targetEdit"
                  type="button"
                  (click)="edit(t)"
                  [disabled]="busy()"
                >
                  Edit configuration</button
                ><button
                  name="targetRemove"
                  type="button"
                  (click)="removing.set(t)"
                  [disabled]="busy()"
                >
                  Remove...
                </button>
              </div>
            }
          </article>
        } @empty {
          <p>No repository target configurations.</p>
        }
      } @else if (!error()) {
        <p role="status">Loading configurations...</p>
      }
    </main>`,
})
export class RepositoryTargetsComponent implements OnInit, OnDestroy {
  projectId = '';
  form = empty();
  targets = signal<RepositoryTargetConfig[]>([]);
  branches = signal<BranchInfo[]>([]);
  locales = signal<string[]>([]);
  editing = signal<RepositoryTargetConfig | null>(null);
  removing = signal<RepositoryTargetConfig | null>(null);
  ready = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');
  snapshot = signal<RepositoryFileSnapshot | null>(null);
  readAt = signal('');
  @ViewChild('outcome') outcome?: ElementRef<HTMLElement>;
  @ViewChild('auditRegion') auditRegion?: ElementRef<HTMLElement>;
  @ViewChild('auditHeading') auditHeading?: ElementRef<HTMLElement>;
  recoverySending = signal(false);
  reviewTargetId = signal('');
  valueReviewLoading = signal<string|null>(null);
  recoveryValue = signal<{auditId:string;result:DeletionRecoveryValueReview;targetLabel?:string;targetId?:string;recoveryInput?:LocalRecoveryInput;confirming?:boolean}|null>(null);
  recoveryPreview = signal<{auditId:string;result:DeletionRecoveryPreview}|null>(null);
  auditLoading = signal(false);
  auditPage = signal<DeletionAuditPage | null>(null);
  effectSummary = signal<RepositoryEffectSummary | null>(null);
  previewResult = signal<RepositorySyncPreview | null>(null);
  choices = signal(new Map<string, SyncResolutionChoice>());
  draft = signal<RepositoryResolutionDraft | null>(null);
  confirmApply = signal(false);
  changePage = signal(0);
  changePages = computed(() =>
    Math.max(
      1,
      Math.ceil((this.draft()?.localChangePlan.changes.length ?? 0) / 50),
    ),
  );
  changeRows = computed(
    () =>
      this.draft()?.localChangePlan.changes.slice(
        this.changePage() * 50,
        (this.changePage() + 1) * 50,
      ) ?? [],
  );
  requiredChoices = computed(
    () =>
      this.previewResult()?.decisions.filter(
        (d) => d.kind !== 'unchanged' && d.kind !== 'converged',
      ).length ?? 0,
  );
  clearDraft() {
    this.choices.set(new Map());
    this.draft.set(null);
    this.confirmApply.set(false);
    this.changePage.set(0);
  }
  choose(key: string, value: string) {
    if (this.busy()) return;
    const p = this.previewResult();
    if (
      !p?.decisions.some(
        (d) =>
          d.key === key && d.kind !== 'unchanged' && d.kind !== 'converged',
      )
    )
      return;
    const next = new Map(this.choices());
    if (value === 'base' || value === 'local' || value === 'remote')
      next.set(key, value);
    else next.delete(key);
    this.choices.set(next);
    this.draft.set(null);
    this.confirmApply.set(false);
    this.changePage.set(0);
    this.error.set('');
  }
  async resolve(t: RepositoryTargetConfig) {
    const p = this.previewResult();
    if (
      this.busy() ||
      p?.targetId !== t.id ||
      this.choices().size !== this.requiredChoices()
    )
      return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.draft.set(null);
    this.confirmApply.set(false);
    this.changePage.set(0);
    this.error.set('');
    this.message.set('');
    try {
      const draft = await this.api.resolveRepositoryPreview(
        this.projectId,
        t.id,
        {
          expectedRevision: p.targetRevision,
          expectedFingerprint: p.fingerprint,
          choices: Object.fromEntries(this.choices()),
        },
      );
      if (generation === this.generation) this.draft.set(draft);
    } catch (e) {
      if (generation !== this.generation) return;
      // A failure may mean any compared source changed. Require a fresh review.
      this.previewResult.set(null);
      this.clearDraft();
      this.previewPage.set(0);
      this.error.set(
        e instanceof Error ? e.message : 'Could not prepare repository draft',
      );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async apply(t: RepositoryTargetConfig) {
    const p = this.previewResult(), d = this.draft();
    if (this.busy() || !this.confirmApply() || !d || p?.targetId !== t.id || d.targetId !== t.id || !d.localChangePlan.changes.length) return;
    const generation = ++this.generation;
    this.clearArchivedRecoveryReview();
    const projectId = this.projectId;
    const input = { expectedRevision: d.targetRevision, expectedFingerprint: d.previewFingerprint,
      expectedDraftDigest: d.contentDigest, choices: Object.fromEntries(this.choices()) };
    this.busy.set(true); this.error.set(''); this.message.set('');
    try {
      const result = await this.api.applyRepositoryLocal(projectId, t.id, input);
      if (generation !== this.generation) return;
      this.message.set(`Local values applied: ${result.updatedValues} set, ${result.removedValues} removed; ${result.pendingEffectIntents} effects queued. Repository files and accepted baseline unchanged. Sync not completed. Compare again before another apply.`);
    } catch (e) {
      if (generation !== this.generation) return;
      this.error.set((e instanceof Error ? e.message : 'Local apply result unavailable') + ' Compare again before another apply. If the response was lost, local values may already have changed.');
    } finally {
      if (generation === this.generation) {
        this.previewResult.set(null); this.clearDraft(); this.previewPage.set(0);
        this.snapshot.set(null);
    this.reviewTargetId.set('');
    this.auditPage.set(null);
    this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null); this.effectSummary.set(null); this.baselineView.set(null); this.confirmBaseline.set(false);
        this.busy.set(false);
        window.scrollTo({top: 0, behavior: 'instant'});
      }
    }
  }
  downloadDraft() {
    const draft = this.draft();
    if (!draft) return;
    const url = URL.createObjectURL(
      new Blob([draft.json], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'open-locale-repository-draft.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  previewPage = signal(0);
  previewPages = computed(() =>
    Math.max(1, Math.ceil((this.previewResult()?.decisions.length ?? 0) / 50)),
  );
  previewRows = computed(
    () =>
      this.previewResult()?.decisions.slice(
        this.previewPage() * 50,
        (this.previewPage() + 1) * 50,
      ) ?? [],
  );
  baselineView = signal<RepositoryBaselineView | null>(null);
  confirmBaseline = signal(false);
  private generation = 0;
  private subscription?: Subscription;
  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}
  ngOnInit() {
    this.subscription = this.route.paramMap.subscribe(
      (p) => void this.load(p.get('id') ?? ''),
    );
  }
  ngOnDestroy() {
    this.generation++;
    this.recoverySending.set(false);
    this.reviewTargetId.set('');
    this.auditPage.set(null);
    this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null);
    this.auditLoading.set(false);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.subscription?.unsubscribe();
  }
  recoveryReason(result: DeletionRecoveryPreview) {
    if (result.eligibleNow) return 'Current checks pass for this deleted flat value.';
    const reasons: Record<string,string> = {
      'audit-unavailable':'This audit is unavailable.', 'unsupported-snapshot':'This archived snapshot is unsupported.',
      'key-changed':'The key was deleted or renamed.', 'unsupported-current-key':'The current key type or length limit blocks recovery.',
      'locale-unavailable':'The project locale is unavailable.', 'value-exists':'A current locale value already exists. It will not be overwritten.',
      'deletion-generation-changed':'This is no longer the current deletion generation.',
    };
    return reasons[result.reason] ?? 'Current recovery checks do not pass.';
  }
  valueReviewReason(result: DeletionRecoveryValueReview) {
    if(result.reviewAvailable)return 'Archived flat value for review only.';
    const reasons:Record<string,string>={
      'baseline-unavailable':'No current accepted comparison baseline is available for this target. Review the repository file and baseline separately before another recovery review. No value was restored.',
      'target-unavailable':'This repository target is unavailable. Refresh configurations and select a current target before reviewing again.',
      'target-scope-mismatch':'This target does not match the deleted value branch and locale. Select a matching target before reviewing again.',
      'review-value-too-large':'Archived value exceeds the 32768-byte review limit.',
      'value-exists':'A current locale value already exists. It will not be overwritten. Check the current value before any further recovery.',
      'deletion-generation-changed':'This is no longer the current deletion generation. Load the newest audit page and review again.',
      'audit-unavailable':'This audit is unavailable. Load the newest audit page before reviewing again.',
      'unsupported-snapshot':'This archived snapshot is unsupported for value review.',
      'key-changed':'The key was deleted or renamed. This archived value cannot be reviewed for recovery.',
      'unsupported-current-key':'The current key type or length limit blocks archived value review.',
      'locale-unavailable':'The project locale is unavailable. This archived value cannot be reviewed for recovery.',
    };
    return reasons[result.reason]??'Current checks do not allow value review.';
  }
  changeReviewTarget(targetId:string) {
    if(targetId && !this.targets().some(t=>t.id===targetId))return;
    if(this.busy() && !this.valueReviewLoading())return;
    ++this.generation;this.reviewTargetId.set(targetId);
    this.valueReviewLoading.set(null);this.recoveryValue.set(null);this.recoveryPreview.set(null);this.busy.set(false);
    this.message.set('Review scope changed. Any late value response will be hidden. Review again.');
  }
  async reviewRecoveryValue(auditId: string) {
    if (this.busy() || !this.auditPage()?.audits.some(a=>a.id===auditId)) return;
    const target=this.targets().find(t=>t.id===this.reviewTargetId());
    if(this.reviewTargetId()&&!target)return;
    const generation=++this.generation;
    this.busy.set(true); this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null); this.error.set(''); this.message.set(''); this.valueReviewLoading.set(auditId);
    try {
      const raw=target?await this.api.reviewRepositoryRecovery(this.projectId,target.id,auditId):await this.api.reviewDeletionRecoveryValue(this.projectId,auditId);
      const available=raw.reviewAvailable===true&&typeof raw.value==='string'&&new TextEncoder().encode(raw.value).byteLength<=32768;
      // Keep only the exact fields needed for this explicit local recovery,not raw response scopes.
      const result:DeletionRecoveryValueReview={source:'deletion-recovery-value-review',asOf:raw.asOf,reviewAvailable:available,reason:raw.reviewAvailable===true&&!available?'invalid-review-response':raw.reason,value:available?raw.value:null,maxValueBytes:32768,canRestore:false,snapshotIncluded:false,historyReplay:false,reservationHeld:false};
      const targetLabel=target?`${target.localBranch} / ${target.locale} / ${target.owner}/${target.repo} / ${target.path}`:undefined;
      const recoveryInput=target&&available?reviewedRecoveryInput(raw,target):undefined;
      if(generation===this.generation){this.recoveryValue.set({auditId,result,targetLabel,targetId:target?.id,recoveryInput});this.landValueFocus(auditId,generation,true);}
    } catch {
      if(generation===this.generation)this.error.set('Could not review archived value. No value was restored. Review again to retry.');
    } finally { if(generation===this.generation){this.busy.set(false);this.valueReviewLoading.set(null);} }
  }
  recoveryBindingsUnavailable() {
    const review=this.recoveryValue();
    return !!review?.targetId && review.result.reviewAvailable && !review.recoveryInput;
  }
  prepareLocalRecovery() {
    const review=this.recoveryValue();
    if(this.busy()||!review?.recoveryInput||review.targetId!==this.reviewTargetId())return;
    this.recoveryValue.set({...review,confirming:true});
    this.landRecoveryConfirmation(review.auditId,this.generation,true);
  }
  cancelLocalRecovery() {
    const review=this.recoveryValue();
    if(this.busy()||!review)return;
    this.recoveryValue.set({...review,confirming:false});
    this.message.set('Recovery canceled. No request was sent.');
    this.landRecoveryConfirmation(review.auditId,this.generation,false);
  }
  private landRecoveryConfirmation(auditId:string,generation:number,confirming:boolean) {
    setTimeout(()=>{
      const review=this.recoveryValue();
      if(generation!==this.generation||review?.auditId!==auditId||!!review.confirming!==confirming)return;
      const regions=this.auditRegion?.nativeElement.querySelectorAll<HTMLElement>('[data-value-result-id]');
      const region=Array.from(regions??[]).find(n=>n.getAttribute('data-value-result-id')===auditId);
      const node=region?.querySelector<HTMLElement>(confirming?'[aria-label="Confirm local recovery"]':'[name=auditRecoverPrepare]');
      node?.focus({preventScroll:true});node?.scrollIntoView({block:'center',behavior:'instant'});
    },0);
  }
  async recoverLocalValue() {
    const review=this.recoveryValue();
    if(this.busy()||!review?.confirming||!review.recoveryInput||!review.targetId||review.targetId!==this.reviewTargetId())return;
    const projectId=this.projectId,targetId=review.targetId,auditId=review.auditId,input={...review.recoveryInput};
    const generation=++this.generation;
    this.recoveryValue.set(null);this.recoveryPreview.set(null);this.busy.set(true);this.error.set('');this.message.set('');
    this.recoverySending.set(true);this.landRecoveryOutcome(generation);
    try{
      const result=await this.api.recoverRepositoryLocal(projectId,targetId,auditId,input);
      if(generation!==this.generation)return;
      this.message.set(`Local value recovered: ${result.restoredValues}; ${result.pendingEffectIntents} effect queued. Repository files and accepted baseline unchanged. Sync not completed. Review again before another recovery.`);
    }catch{
      if(generation===this.generation)this.error.set('Recovery result unavailable. If the response was lost, the local value may already have changed. Check the current value and review again before another request. No automatic retry was sent.');
    }finally{
      if(generation===this.generation){this.recoverySending.set(false);this.busy.set(false);this.landRecoveryOutcome(generation);}
    }
  }
  private landRecoveryOutcome(generation:number) {
    setTimeout(()=>{if(generation!==this.generation)return;this.outcome?.nativeElement.focus({preventScroll:true});this.outcome?.nativeElement.scrollIntoView({block:'center',behavior:'instant'});},0);
  }
  cancelValueReview() {
    const auditId=this.valueReviewLoading();
    if (!auditId) return;
    ++this.generation;
    this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.busy.set(false);
    this.message.set('Value review canceled. Any late response will be hidden. No value was restored.');
    this.landValueFocus(auditId,this.generation,false);
  }
  hideValueReview() {
    const auditId=this.recoveryValue()?.auditId;
    if (!auditId) return;
    this.recoveryValue.set(null);
    this.landValueFocus(auditId,this.generation,false);
  }
  private landValueFocus(auditId:string,generation:number,result:boolean) {
    // Wait for Angular's conditional DOM. Never steal focus after a newer action
    // or route change has superseded this review.
    setTimeout(()=>{
      if(generation!==this.generation)return;
      const attr=result?'data-value-result-id':'data-value-audit-id';
      const nodes=this.auditRegion?.nativeElement.querySelectorAll<HTMLElement>('['+attr+']');
      const node=Array.from(nodes??[]).find(n=>n.getAttribute(attr)===auditId);
      node?.focus({preventScroll:true});
      if(result)node?.scrollIntoView({block:'center',behavior:'instant'});
    },0);
  }
  async checkRecovery(auditId: string) {
    if (this.busy() || !this.auditPage()?.audits.some(a=>a.id===auditId)) return;
    const generation=++this.generation;
    this.busy.set(true); this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null); this.error.set(''); this.message.set('');
    try {
      const result=await this.api.previewDeletionRecovery(this.projectId,auditId);
      if(generation===this.generation)this.recoveryPreview.set({auditId,result});
    } catch {
      if(generation===this.generation)this.error.set('Could not check recovery eligibility. No value was restored. Check again to retry.');
    } finally { if(generation===this.generation)this.busy.set(false); }
  }
  async loadAudits(cursor?: string) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.auditLoading.set(true);
    this.reviewTargetId.set('');
    this.auditPage.set(null);
    this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null);
    this.error.set(''); this.message.set('');
    try {
      const result = await this.api.listDeletionAudits(this.projectId, cursor);
      if (generation === this.generation) {
        this.auditPage.set(result);
        const heading = this.auditHeading?.nativeElement;
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    } catch {
      if (generation === this.generation) this.error.set('Could not load audit metadata. Nothing was restored or deleted. Load newest audit page to retry.');
    } finally {
      if (generation === this.generation) { this.busy.set(false); this.auditLoading.set(false); }
    }
  }
  async loadEffects(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.effectSummary.set(null);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.repositoryEffectSummary(this.projectId, t.id);
      if (generation !== this.generation) return;
      this.effectSummary.set(result);
    } catch {
      if (generation === this.generation) this.error.set('Could not load effect summary. No effects were run. Load again to refresh.');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async load(id: string) {
    const generation = ++this.generation;
    this.projectId = id;
    this.recoverySending.set(false);
    this.reviewTargetId.set('');
    this.auditPage.set(null);
    this.valueReviewLoading.set(null); this.recoveryValue.set(null); this.recoveryPreview.set(null);
    this.auditLoading.set(false);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.ready.set(false);
    this.busy.set(false);
    this.targets.set([]);
    this.branches.set([]);
    this.locales.set([]);
    this.editing.set(null);
    this.removing.set(null);
    this.form = empty();
    this.error.set('');
    this.message.set('');
    try {
      const [project, branches, result] = await Promise.all([
        this.api.getProject(id),
        this.api.listBranches(id),
        this.api.listRepositoryTargets(id),
      ]);
      if (generation !== this.generation) return;
      this.branches.set(branches);
      this.locales.set(project.locales.map((l) => l.code));
      this.form.locale = project.baseLocale;
      this.targets.set(result.targets);
      this.ready.set(true);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not load configurations',
        );
    }
  }
  edit(t: RepositoryTargetConfig) {
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.editing.set({ ...t });
    this.form = {
      localBranch: t.localBranch,
      locale: t.locale,
      owner: t.owner,
      repo: t.repo,
      path: t.path,
      remoteBranch: t.remoteBranch,
    };
    this.removing.set(null);
    this.error.set('');
    this.message.set('');
  }
  cancel() {
    this.error.set('');
    this.message.set('');
    this.editing.set(null);
    this.form = { ...empty(), locale: this.locales()[0] ?? '' };
  }
  private clearArchivedRecoveryReview() {
    this.reviewTargetId.set('');this.valueReviewLoading.set(null);
    this.recoveryValue.set(null);this.recoveryPreview.set(null);
  }
  async refresh() {
    if (this.busy()) return;
    const generation = ++this.generation;
    // A configuration refresh invalidates private archived review and prepared confirmation,
    // even if the refresh fails or returns the same target revision.
    this.clearArchivedRecoveryReview();
    this.busy.set(true);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.listRepositoryTargets(this.projectId);
      if (generation !== this.generation) return;
      this.targets.set(result.targets);
      this.cancel();
      this.removing.set(null);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async save() {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.clearArchivedRecoveryReview();
    const form = { ...this.form },
      editing = this.editing();
    this.busy.set(true);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.saveRepositoryTarget(
        this.projectId,
        form,
        editing?.id,
        editing?.revision,
      );
      if (generation !== this.generation) return;
      this.targets.update((items) =>
        editing
          ? items.map((t) => (t.id === editing.id ? result.target : t))
          : [...items, result.target],
      );
      this.cancel();
      this.message.set('Configuration saved. Not connected; no sync was run.');
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async read(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const snapshot = await this.api.readRepositoryTarget(
        this.projectId,
        t.id,
        t.revision,
      );
      if (generation !== this.generation) return;
      this.snapshot.set(snapshot);
      this.readAt.set(new Date().toLocaleString());
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not read repository file',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  display(value: string | null) {
    return value === null
      ? '[missing]'
      : value === ''
        ? '[empty string]'
        : value;
  }
  async preview(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.previewRepositoryTarget(
        this.projectId,
        t.id,
        t.revision,
      );
      if (generation !== this.generation) return;
      this.previewResult.set(result);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not compare repository',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async loadBaseline(t: RepositoryTargetConfig) {
    if (this.busy()) return;
    const generation = ++this.generation;
    this.busy.set(true);
    this.error.set('');
    this.confirmBaseline.set(false);
    this.baselineView.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.message.set('');
    try {
      const view = await this.api.getRepositoryBaseline(this.projectId, t.id);
      if (generation !== this.generation) return;
      if (view.targetRevision !== t.revision)
        throw new Error('Repository target changed; refresh configurations');
      this.baselineView.set(view);
    } catch (e) {
      if (generation === this.generation)
        this.error.set(
          e instanceof Error ? e.message : 'Could not load baseline',
        );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async acceptBaseline(t: RepositoryTargetConfig) {
    const snapshot = this.snapshot(),
      view = this.baselineView();
    if (
      this.busy() ||
      !this.confirmBaseline() ||
      snapshot?.targetId !== t.id ||
      view?.targetId !== t.id
    )
      return;
    const generation = ++this.generation;
    this.clearArchivedRecoveryReview();
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const result = await this.api.acceptRepositoryBaseline(
        this.projectId,
        t.id,
        {
          expectedRevision: snapshot.targetRevision,
          expectedRemoteSha: snapshot.remoteSha,
          expectedContentDigest: snapshot.contentDigest,
          expectedBaselineVersion: view.baseline?.version ?? 0,
        },
      );
      if (generation !== this.generation) return;
      this.baselineView.set({
        ...view,
        baseline: result.baseline,
        baselineAccepted: true,
      });
      this.confirmBaseline.set(false);
      this.message.set(
        'Comparison baseline accepted. No import, repository write or sync was run.',
      );
    } catch (e) {
      if (generation !== this.generation) return;
      this.snapshot.set(null);
    this.effectSummary.set(null);
      this.previewResult.set(null);
      this.clearDraft();
      this.previewPage.set(0);
      this.baselineView.set(null);
      this.confirmBaseline.set(false);
      this.error.set(
        e instanceof Error ? e.message : 'Could not accept baseline',
      );
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
  async remove(t: RepositoryTargetConfig) {
    if (this.busy() || this.removing()?.id !== t.id) return;
    const generation = ++this.generation;
    this.clearArchivedRecoveryReview();
    this.busy.set(true);
    this.snapshot.set(null);
    this.effectSummary.set(null);
    this.previewResult.set(null);
    this.clearDraft();
    this.previewPage.set(0);
    this.baselineView.set(null);
    this.confirmBaseline.set(false);
    this.error.set('');
    this.message.set('');
    try {
      await this.api.removeRepositoryTarget(this.projectId, t.id, t.revision);
      if (generation !== this.generation) return;
      this.targets.update((items) => items.filter((item) => item.id !== t.id));
      this.removing.set(null);
      if (this.editing()?.id === t.id) this.cancel();
      this.message.set(
        'Configuration removed. Repository files and translations unchanged.',
      );
    } catch (e) {
      if (generation === this.generation)
        this.error.set(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      if (generation === this.generation) this.busy.set(false);
    }
  }
}
