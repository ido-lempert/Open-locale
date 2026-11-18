# Explicit read-only direct member-list Refresh

## Developer review
GET members only, preserving add fields, row drafts/notices and independent
errors. Pending duplicate/global busy/removal and any independent member role/
locale write refuse Refresh, including captured handler calls. Later accepted
submission starts invalidate older reads: Add, remove, role Save, locale Save.
Full reload invalidates before member GET; project/lifetime guard fences departure.
No API/schema change. Server listMembers returns direct team grants only.

## Product review
Explicit metadata snapshot, not effective-access verification. Groups are not
reloaded, so help does not claim inherited grants are current. Add fields and
row drafts stay local even when a member disappears, never auto-saved. Failed
reads retain list with retry. Refresh adds/removes nobody and saves no grants.

## Design review
Named Refresh and live status linked to scope help. Four actual success/failure
desktop1278x899/mobile390x844 screenshots inspected06:27: readable and fit.
Mobile section heading is partly above viewport and later row controls below.
Fixture identities only, no secrets or redaction required for this slice.

## Security review
No raw errors in feedback. Same existing authenticated project-members endpoint,
no mutation, external call, worker, credential change, registration, spend or
license change. Real held role/locale PATCHs prove independent pending blocking.
Stale response negative discriminates actual role/locale/remove/Add outcomes.
Fixture uses isolated disposable accounts and removes non-owner team memberships;
no tokens/tasks/webhooks/deliveries created. No effective-access claim.

## QA review
Fifteen new unit cases. Initial units RC1: generated handler/invalidation names
were inconsistent after text transformation, so new tests could not call them.
Corrected names and independent row-pending predicate; units RC0 actualweb/APIcache.
Initial build RC0 actualweb/APIcache. Focus FIRST16/0 RC0. Deliberate epoch fence
removal12PASS/4targetedFAIL RC1 at real role/locale/remove/Add stale reads;
restored16/0 RC0. Related role13/locales17/remove16 FIRST RC0.
226 browser suites FIRST2654PASS/0FAIL, all RC0, each suite separate.
All API checks FIRST RC0 including tags9/preview644/automations132/2FA37/SAML55.
One mistyped batch selector invoked nonexistent test:d, RC1 with zero assertions;
corrected explicit OTA46/incontext41/edit51/OIDC55/groups44 scripts passed.
Sync95+144=239/native116+111+19=246 FIRST RC0, each stage separate; native56056,
four repeated startup checks. Configsync16/native14/docs4/glossary-reset3/runner4
RC0. Completed results retained across run boundaries, no restarted checks and
no app/fixture changes during broad verification. Final units/build RC0,2/2cached
each; initial actual web runs retained. Final five-perspective review found no
further fixes. Four success/failure images re-inspected07:56: readable and fit,
with mobile caveats above. Final docs/syntax/diff checks follow this closeout.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
