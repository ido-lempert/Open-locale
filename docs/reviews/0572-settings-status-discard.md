# Discard local custom-status draft

## Developer review
Clear newStatus only, raw nonempty including whitespace/invalid values. Busy
blocks button/direct method. No API/reload/project mutation. Preserve errors and
other forms. Existing saved-status receipt becomes accurate discarded-draft
wording; no receipt invented when none existed. Add/remove API stays unchanged.

## Product review
Explicit draft-only reset, not status removal or server refresh. Saved statuses
and existing loaded list stay. A failed refresh after accepted addition does not
turn reset into undo. Existing team-admin rendering and API unchanged.

## Design review
Non-submit Discard status draft button below Add with plain help. Actual
1278x899 desktop and390x844 mobile pixels inspected: action/help/full saved receipt
readable without horizontal overflow. Mobile input/list above scrolled view.
Screenshot has newly typed invalid draft after earlier discard; receipt describes
earlier discard, not a promise about future edits. After503 loaded list remains
stale by design, while API verifies accepted status. Remove stays separate.

## Security review
No API call from reset, no backend/auth/default/worker change, no credential scope,
account, spend or license choice. Only disposable local PostgreSQL/browser writes
custom statuses in tests. No saved status deleted, no external acceptance claim.

## QA review
Seven new units first web actual/API cachedRC0, build same. RealPG/browser first
7PASS0FAILRC0, no-op substitution1PASS2FAILRC1 at raw invalid reset, restored
7/0RC0. Fixture review corrected locale-derived invalid samples to actual invalid
status syntax before first run. No GET/write/remove on reset, other form
preserved, busy direct guard, accepted addition/503 saved statuses preserved,
receipt/error retained, mobile/runtime checks. API a/b/c/d and separate
sync-preview644/automations132/2FA37/SAML55 firstRC0. Sync95+144=239/native
116+111+19=246 firstRC0, each stage own call; checkpoints cleaned, nativePG55968.
Config16/14/docs4/glossary harness3/reaper4 firstRC0. All198 browser suites final2271PASSzeroFAILRC0,195 first attempts.
Each suite ran in its own call.019 firstPG55664 bind-startup failure
zeroPASS1FAILRC1 before app assertions. Socket evidence TIME_WAIT local55664
to app3000, not listener; nothing killed,35second wait, unchanged retry6/0RC0.
188 first4PASS2FAILRC1; diagnostic4/2 showed correct original member PUT,
pending signal true/newer selection correct but button disabled still false
before Angular render. Subsequent actual membership/newer draft/receipt passed.
Fixture adds two animation frames after select/click, retains all assertions.
Corrected11/0RC0. First no-op attempt inserted early return and failed web
startup0PASS1FAILRC1, not discriminating. Corrected whole-method no-op
3PASS1FAILRC1 at missing PUT; restored11/0RC0.
190 first3PASS2FAILRC1; diagnostic3/2 showed one correct ADMIN PATCH, pending
signal true/MEMBER draft correct but disabled stale false; subsequent saved
role/newer draft/receipt passed. Same fixture-only interaction settle, no
assertion removed. Corrected11/0, whole-method no-op2PASS1FAILRC1 at missing
PATCH, restored11/0RC0. No app fixes during broad checks. Fixtures188/190
only changed their scheduling, not payloads/assertions. Final unit/build both
cachedRC0. Checks span continuation runs, not one uninterrupted canonical run.
Coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance gaps unchanged.
