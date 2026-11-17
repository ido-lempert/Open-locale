# Hide one-time API-token reveal locally

## Developer review
Explicit Hide clears the local createdToken signal only. Existing metadata,
drafts, errors, busy state and access stay. Pending list refresh cannot restore
the reveal; a later accepted explicit Create clears hidden status and reveals
its own token. Refusal retains hidden status. No API/schema change.

## Product review
Copy-before-hide wording names the one-way local effect, without suggesting
revocation or clearing clipboard, browser history or earlier copies. Accepted
newer-draft receipt remains after Hide, with truthful hidden-reveal wording;
Discard after Hide no longer claims that a token is revealed above.
Webhook-secret hiding and pending clipboard operations remain separate.

## Design review
Hide has a clear button and linked explanation. Token text wraps at390px.
Actual control and hidden desktop1278x899/mobile390x844 screenshots inspected
17:18: readable and fit. Mobile begins at token/hidden notice; panel heading
above viewport. Disposable token bytes redacted to same-length repeated R only
in screenshot DOM; actual unredacted mobile overflow assertion runs first.

## Security review
No server call from Hide and no revocation/rotation/scope change. Clearing a
signal is not a memory-zeroization guarantee. UI makes no clipboard/history
cleanup claim. Browser fixture only creates disposable local read tokens,
checks real API authentication, logs no bytes and revokes them before teardown.
No live user credential, worker, registration, spend or license change.

## QA review
Seven new units cover no-op, isolated clearing while busy, truthful receipts,
held refresh success/failure, later Create and refusal. Initial units/buildRC0
actual web/APIcached. FocusFIRST14/0. Deliberate retained-reveal negative4PASS,
1 assertedFAIL plus1 intentional early-abortFAIL RC1; restored14/0. Visual-only
fixture changes14/0. Review added wrapping/linked help and actual mobile check:
units/buildRC0 actual web/APIcached, final focused15/0. Existing token-pending
FIRST12/0 and token-name-discardFIRST8/0. Browser177 first aborted before assertions on occupied PG55950 (0PASS/1 suite-abort
FAIL RC1); temporary database-port-only copy56037 recovered12/0 RC0. Tracked
fixture unchanged and copy removed. Other completed browser suites firstRC0.
Final five-perspective closeout: local Hide, truthful limits and newer-draft
receipt work as intended; no further code fixes. Four final control/hidden
screenshots re-inspected19:01, readable/fit with mobile scroll limits above.
Browser220 current2559PASS/0FAIL including177 recovery12/0; other219 suites
FIRST2547/0. Original177 startup abort remains above, not uninterrupted.
API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 FIRST0.
Sync95+144=239 and native116+111+19=246 FIRST0, four startup repeats; each stage
separate, native56036 environment-only. Configsync16/native14/docs4/glossary-reset3/
runner4 RC0. Final units/build RC0,2/2cached each; initial actual web retained.
Final docs4/syntax1/diff RC0. No app/fixture changes during broad verification.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
