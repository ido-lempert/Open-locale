# Discard one member's unsaved edits

## Developer review
Clear only the target key from local role and locale draft maps. No API/reload,
accepted member/error/receipt mutation. Raw empty keys remain discardable. Both
same-member pending write flags block button and direct method. Other member
pending or raw drafts stay independent, including a locale draft hidden by a
saved promotion. Existing non-owner/team-admin rendering retained.

## Product review
Return to last loaded/accepted direct grant without refreshing Settings or
undoing saved changes. Saved role/scope and inherited union unchanged. Explicit
help names limits; no new success claim for a local reset. No server contract,
permission, registration, worker, spend or license choice.

## Design review
Non-submit Discard unsaved edits action, disabled without draft or while pending,
help immediately below and Remove separate. Actual desktop1278x899/mobile390x844
pixels inspected after restored test: action and full no-refresh/no-undo help
readable without horizontal overflow. Target identity/role above scrolled views;
other member's independent draft visible below.

## Security review
No request or server/default/auth change. Discard cannot grant/revoke access or
change inherited group membership. Two pending guards preserve newer edits
during writes. Existing rendering gate unchanged, UI not authority. Only local
disposable PostgreSQL/browser fixture makes writes. No external acceptance claim.

## QA review
Seven new units first web actual/API cachedRC0, build web actual/API cachedRC0.
Focused realPG first12PASS0FAILRC0; no-op substitution2PASS2FAILRC1; restored
9PASS3FAILRC1, diagnostic11PASS1FAILRC1: component draft/accepted state correct,
DOM assertions raced Angular rendering after select/click. Fixture now waits
two animation frames after those interactions; all original assertions retained,
no app fix. Corrected12/0RC0; repeated no-op2/2RC1, restored12/0RC0. Not full old
HEAD. Both drafts/invalid scope reset without GET/write, other member preserved,
role and scope pending direct guards, accepted scope/ADMIN not undone,503 local
MEMBER fallback keeps error and both receipts, hidden scope not sent, inherited
group unchanged, mobile/runtime checks. API a/b/c/d and separate sync-preview644/
automations132/2FA37/SAML55 firstRC0. Sync95+144=239 and native116+111+19=246
firstRC0 each stage own call, checkpoints cleaned; testPG55968 from start.
Config16/14/docs4/glossary harness3/reaper4 firstRC0. All195 browser suites first2248PASS
zeroFAILRC0 each own call. Final units/build both cachedRC0. Latest desktop/mobile
pixels re-inspected after broad run: discard action and full no-refresh/no-undo
help readable without overflow; target identity/role above scrolled views. Final
docs4/diff/node checksRC0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
