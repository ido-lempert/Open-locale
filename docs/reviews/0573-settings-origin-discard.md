# Discard local embed-origin draft

## Developer review
Clear newOrigin only, raw nonempty including whitespace/invalid values. Busy
blocks button/direct method. No API/reload/project mutation. Preserve errors and
other forms. Existing saved-origin receipt becomes accurate discarded-draft
wording; no receipt invented when none existed. Add/remove API stays unchanged.

## Product review
Explicit draft-only reset, not origin removal, access revocation or server
refresh. Saved origins and existing loaded list stay. A failed refresh after
accepted addition does not turn reset into undo. Existing team-admin rendering,
explicit Add and trust warning unchanged. No external acceptance promotion.

## Design review
Non-submit Discard origin draft button below Add with plain help. Actual
1278x899 desktop and390x844 mobile pixels inspected: action/help/full saved receipt
readable without horizontal overflow. Mobile input/list above scrolled view.
Screenshot has newly typed invalid draft after earlier discard; receipt describes
earlier discard, not a promise about future edits. After503 loaded list remains
stale by design, while API verifies accepted origin. Remove stays separate.

## Security review
No API call from reset, no backend/auth/default/worker change, no credential scope,
account, spend or license choice. Only disposable local PostgreSQL/browser writes
example origins in tests. No external host contacted, no saved origin removed,
no real-site permission or trust change.

## QA review
Seven new units first web actual/API cachedRC0, build same. Initial focused run
zeroPASS1FAILRC1 at API readiness, before app assertions: fixture text replacement
changed Response.status and503 status option to origin. Restored HTTP status
properties only; no app fix. Corrected7PASS0FAILRC0, no-op substitution1PASS2FAILRC1
at raw invalid reset, restored7/0RC0. No GET/PATCH/remove on reset, other form
preserved, busy direct guard, accepted addition/503 saved origins preserved,
receipt/error retained, mobile/runtime checks. API a/b/c/d and separate
sync-preview644/automations132/2FA37/SAML55 firstRC0. Sync95+144=239/native
116+111+19=246 firstRC0, each stage own call/checkpoints cleaned/nativePG55968.
Config16/14/docs4/glossary harness3/reaper4 firstRC0. All199 browser suites final2278PASSzeroFAILRC0 each own call,197 first
attempts.056 firstPG55788 bind
startup0PASS1FAILRC1 before app assertions; current sockets none, nothing killed,
unchanged retry6/0RC0.081 firstPG55712 bind startup0PASS1FAILRC1 before app
assertions; TIME_WAIT local55712 to55710, not listener, nothing killed, waited35
seconds, unchanged retry9/0RC0. No app or fixture changes during broad checks.
Final unit/build both cachedRC0; docs4/diff/script syntaxRC0. Checks span
continuation runs, not one uninterrupted canonical run.
Coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance gaps unchanged.
