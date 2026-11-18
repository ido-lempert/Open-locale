# Explicit read-only team group-list Refresh

## Developer review
GET groups only, preserving new-group fields, row name/role/locale/add-member
maps, receipts and independent errors. Duplicate/global busy/deleting and any
independent group name/role/locales/member write refuse Refresh. Later accepted
submissions invalidate older reads: create, rename, role/scope Save, member Add/
remove and group delete. Full reload invalidates before groups GET; project and
lifetime guard fence late results. No API/schema change. Direct member removal
preserves saved group memberships, so it needs no group-list invalidation.

## Product review
Team-wide group metadata and saved memberships only, not effective-access
verification. Direct team members are not refreshed; saved group membership
can remain for someone no longer in the direct member list. New fields and row
drafts stay local even for absent groups, never auto-saved. Failed reads retain
the previous snapshot with retry guidance. No grant/member/group is changed by
Refresh. Existing combined-access display remains a snapshot, not live proof.

## Design review
Named Refresh and live status linked to literal scope help. Four actual success/
failure desktop1278x899/mobile390x844 screenshots inspected08:00: readable and
fit. Mobile heading partly above viewport, later controls below. Fixture names
only, no secrets or redaction required. Existing group explanation is retained.

## Security review
No raw errors in new feedback. Existing authenticated groups endpoint, no new
mutation, external call, worker, registration, credential change, spend or
license choice. Real held PATCH/PUT requests prove pending write refusal. Only
the epoch comparison removed makes seven stale mutation assertions fail.
Disposable fixture creates no tasks/tokens/webhooks/deliveries; direct membership
remains. Groups endpoint returns team-wide metadata and saved memberships, not
an effective-access authorization check.

## QA review
Nineteen new units, initial units/build FIRST RC0 actualweb/APIcached. Focus
FIRST21/0 RC0. Deliberate epoch comparison removal14PASS/7targetedFAIL RC1:
actual name/locales/member Add/role/member remove/create/delete outcomes.
Restored21/0 RC0. Real pending independent group writes, read-only retry,
empty groups with orphan draft retention and actual departure are covered.
Related group name15/role12/locales17/member Add13/member remove17/delete17
FIRST RC0, each suite separate. 227 browser suites CURRENT2675PASS/0FAIL, all
RC0. Browser212 FIRST zero assertions/one suite-abort failure despite RC0:
Postgres55990 could not bind. No active Postgres remained at inspection;
unchanged retry14/0 RC0. First log preserved. Other226 suites FIRST RC0.
All API checks FIRST RC0, including tags9/preview644/automations132/2FA37/SAML55.
Sync95+144=239/native116+111+19=246 FIRST RC0, stages separate, native56058,
four repeated startup checks. Configsync16/native14/docs4/glossary-reset3/runner4
RC0. No app/fixture changes during broad verification. Completed results retained
across run boundaries, not a single uninterrupted claim. Final units/build RC0,
2/2cached each; initial actualweb runs retained. Final five-perspective review
found no further fixes. Four images re-inspected09:33 readable/fit with mobile
caveats above. Final docs/syntax/diff checks follow this closeout text.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
