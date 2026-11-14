# Discard local project details

## Developer review
Compare raw name/description against loaded project. Explicit reset copies only
those two values without API/reload. No project means no reset; busy blocks
button/direct method. Successful PATCH updates accepted project fields before
GET so a failed refresh cannot restore stale details. Unrelated project metadata
and forms preserved. Refused PATCH leaves fallback unchanged.

## Product review
Return to last loaded/accepted details, not undo or current-server sync. Help
states this. Empty/invalid raw drafts resettable. Review caught stale existing
receipt saying newer draft was kept after discard; reset now retains saved fact
but says local drafts were discarded without refreshing/undoing. No receipt is
created without an earlier saved receipt. Errors remain. Existing team-admin
gate/API unchanged.

## Design review
Non-submit Discard button below Save, full plain help, disabled without changes
or while busy. Actual desktop1278x899/mobile390x844 inspected: both fields, Save,
Discard and full help readable with no horizontal overflow. Other locale draft
visible below. Screenshot state is unsaved name after a refused save; error
remains in existing page error location, not in this top-of-page view.

## Security review
No request from reset, backend/auth/default/worker unchanged. Accepted fallback
updated only after successful authorized API response, not before refused write.
No credential/account/scope, spend or license change. Tests use disposable local
PostgreSQL/browser only. No claim of newer server state or external acceptance.

## QA review
Seven new unit cases and first build web actual/API cachedRC0. First focused9/0;
no-op substitution2PASS2FAILRC1 at both-field reset; restored9/0RC0. PM receipt
fix then reviewed full units and build web actual/API cachedRC0, focused9/0RC0
with assertions that saved fact remains but no stale kept-draft claim. RealPG
both fields reset without GET/write, unrelated locale draft, busy direct guard,
accepted success/503 fallback, refused403 fallback unchanged, errors/receipts,
mobile/runtime checks. API a/b/c/d and separate sync-preview644/automations132/
2FA37/SAML55 firstRC0. Sync95+144=239 and native116+111+19=246 firstRC0,
each stage own call, checkpoints cleaned; testPG55968 from start. Config16/14/
docs4/glossary harness3/reaper4 firstRC0. All196 browser suites final2257PASSzeroFAILRC0 each own call,195 first passes.
Suite194 first2PASS2FAILRC1 at four-control discard; diagnostic9PASS1FAILRC1,
correct component state but DOM rendering raced after click/select. Existing
group-discard fixture adds two-frame waits, all assertions retained, no app fix.
Corrected10/0RC0, repeated no-op2/2RC1, restored10/0RC0. Completed results
preserved, not uninterrupted or all first-pass. Final units/build both cachedRC0.
Latest General desktop/mobile pixels re-inspected: fields/Save/Discard/full help
readable without overflow, independent locale draft below. Final docs4/diff/node
checksRC0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
