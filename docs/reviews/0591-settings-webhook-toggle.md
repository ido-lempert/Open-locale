# Guard webhook active-state changes and preserve drafts

## Developer review
Loaded id/active state and busy guard refuse stale/missing/duplicate calls. API
receives only intended active boolean. Accepted state updates local row and receipt
before webhooks-only refresh. Refusal preserves state and allows explicit retry.
No API/schema change. Cross-client changes remain outside the local guard.

## Product review
Enable/Disable remains an explicit reversible action, not an implicit draft save.
Receipt distinguishes accepted change from failed refresh, keeps URL/events/secret/
history and notes in-progress work may finish. Other forms and reveal preserved.
No worker enabled or external webhook changed in development.

## Design review
Initial focused9PASS1FAIL exposed existing long one-time signing-secret overflow
at390px. Added wrapping for token/secret reveals, layout-fixed10/0 and expanded
restored11/0. Four disabled/enabled desktop1278x899/mobile390x844 pixels inspected:
receipt, retained URL draft and controls readable, fit. Selected target is above
mobile receipt viewport; other webhook controls visible. Additional390px reveal pixels inspected: long disposable secret wraps, Copy button
remains visible, target disabled badge and Enable button readable.

## Security review
Only disposable local DB rows, no emitted events or delivery requests. Server
admin check, public URL validation and revision invalidation unchanged. Exact
URL/events/signing-secret and delivery-history bytes compared before/after.
No external setup/spend/account/worker/credentials/scope/license change.

## QA review
Five initial units and firstbuildRC0 webactual/APIcached. Focus FIRST9/1RC1
mobile-overflow app failure, CSS wrap fix10/0. Expanded discriminating stale-state-
only negative1PASS2FAILRC1 (assertion and abort); restored11/0. Actual local
browser/API/PostgreSQL proves missing/stale/403/heldduplicate/other-target/delete
blocking, disable503 accepted local+server/no stale replay, fresh explicit enable,
webhooks-only reads, other-state/draft/reveal/history/metadata preservation. No
runtime errors or additional tasks/translations/deliveries.

Full regression: all217 independent browsers FIRST RC0,2487PASS/0FAIL.
API a/b/c/d, sync-preview644/automations132/2FA37/SAML55 all FIRST0.
Sync first95+second144=239 FIRST0. Native first116/0; middle first16PASS0FAIL
incompleteRC1 readiness timeout: old fixture clicked disabled Enable control
while accepted local badge preceded refresh completion. Fixture-only await usable
Enable, retaining assertions. Failed stage cleaned checkpoint; recreated first116,
corrected middle111,tail19 all0 combined246 (four repeated startup checks), not
all-first. Failed log retained, no app change for native issue. Config16/14/docs4/
glossary-reset3/runner4/syntax/diff0. Final units/build bothcachedRC0; docs4/syntax2/diff0. Five review passes closed
after regression and five final screenshot pixel inspections.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
