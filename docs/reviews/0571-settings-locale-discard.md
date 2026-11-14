# Discard local add-locale draft

## Developer review
Clear newLocale only, raw nonempty including whitespace/invalid values. Busy
blocks button/direct method. No API/reload/project mutation. Preserve errors and
other forms. Existing saved-add receipt becomes accurate discarded-draft wording;
no receipt invented when none existed.

## Product review
Explicit draft-only reset, not locale removal or server refresh. Saved locale
and existing list stay. A failed refresh after accepted addition does not turn
reset into undo. Existing team-admin rendering and API unchanged.

## Design review
Non-submit Discard locale draft button below Add with full plain help. Actual
desktop1278x899/mobile390x844 pixels inspected: action/help/full saved receipt
readable without horizontal overflow. Mobile input/list above scrolled view.
Screenshot has newly typed invalid draft after earlier discard; receipt describes
earlier discard, not a promise about future edits. Remove stays separate in list.

## Security review
No API call from reset, no backend/auth/default/worker change, no credential scope,
account, spend or license choice. Only disposable local PostgreSQL/browser adds
locales in tests. Existing saved locale not deleted, no external acceptance claim.

## QA review
Seven new units and first build web actual/API cachedRC0. RealPG/browser first7/0,
no-op substitution1PASS2FAILRC1 at raw invalid reset, restored7/0RC0. No full old
HEAD claim. No GET/write/remove on reset, other form preserved, busy direct guard,
accepted addition/503 saved locale preserved, receipt/error retained, mobile and
runtime checks. API a/b/c/d and separate sync-preview644/automations132/2FA37/
SAML55 firstRC0. Sync95+144=239/native116+111+19=246 firstRC0 each stage own
call, checkpoints cleaned, nativePG55968 from start. Config16/14/docs4/glossary
harness3/reaper4 firstRC0. All197 browser suites final2264PASSzeroFAILRC0, each own call,195 first passes.
035 first PostgreSQL55586 bind-startup failure (zeroPASS1FAILRC1) before app
assertions; no current socket found, nothing killed, unchanged retry10/0RC0.
114 first and second PostgreSQL55774 bind-startup failures (zeroPASS1FAILRC1
each) before app assertions; socket evidence was TIME_WAIT to app3000, not a
listener. Nothing killed; waited35seconds, unchanged third8/0RC0. No app or
fixture changes during broad checks. Final unit/build both cachedRC0. Staged
checks span continuation runs, not one uninterrupted canonical run.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
