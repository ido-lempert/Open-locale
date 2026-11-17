# Hide one-time webhook signing-secret reveal locally

## Developer review
Hide clears only the local createdWebhook reveal. Metadata, drafts, errors and
busy state remain. Held list refresh cannot restore it. A later accepted Create
clears hidden status and reveals only its own secret; refusal keeps status.
No API or schema change.

## Product review
Copy-before-hide help explains the one-way screen effect, without implying
delete, disable, rotation or clipboard/history cleanup. Accepted newer-draft
receipt stays truthful after Hide and Discard. Pending clipboard work remains
separate. No worker enablement or external delivery acceptance claim.

## Design review
Explicit button has linked help; secret and controls wrap at390px. Four actual
control/hidden desktop1278x899/mobile390x844 screenshots inspected19:06:
readable and fit. Mobile starts at control/notice, heading above viewport.
Disposable local signing secret is redacted with same-length R only in screenshot
DOM; actual unredacted mobile overflow check runs first.

## Security review
Hide sends no request and preserves the exact stored secret and active state,
verified against real local PostgreSQL. Clearing a signal is not a memory
zeroization guarantee. No clipboard/history cleanup claim. Fixture logs no
secret bytes, creates only disposable local hooks, triggers no project writes
or deliveries, and deletes fixtures at teardown. No live credential, worker,
registration, spend or license change.

## QA review
Seven new units cover no-op, isolated busy clearing, receipt accuracy, held
refresh success/failure, later accepted Create and refusal/no-event attempt.
Initial units/build RC0 actual web/APIcached. Focus FIRST15/0. Deliberate retained
reveal negative4PASS/1assertedFAIL plus1suite-abortFAIL RC1. Restored16/0 includes
new exact stored-secret preservation proof. Existing webhook-pending FIRST13/0,
URL-discard FIRST8/0. Browser092 FIRST aborted before assertions on occupied
PG55730:0PASS/1suite-abortFAIL RC1. Temporary database-port-only copy56040
recovered17/0 RC0, copy removed and tracked fixture unchanged. Other220 suites
FIRST2558/0;221 current2575/0. Original startup abort remains recorded, not
an uninterrupted result. API a/b/c/d plus sync-preview644/automations132/2FA37/
SAML55 FIRST RC0. Sync95+144=239 and native116+111+19=246 FIRST RC0, each
stage separate; native56039 environment-only with four startup repeats.
Configsync16/native14/docs4/glossary-reset3/runner4 RC0. Final units/build RC0,
2/2cached each; initial actual web retained. Final docs4/syntax1/diff RC0.
Final five-perspective review found no further code fixes: screen-only Hide,
truthful scope and accepted-newer-draft receipt verified. Four control/hidden
screenshots re-inspected20:32, readable/fit with mobile scroll caveat above.
No app or fixture changes during broad verification.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
