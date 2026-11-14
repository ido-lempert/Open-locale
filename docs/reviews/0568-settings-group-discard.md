# Discard one group's unsaved edits

## Developer review
Delete only the target key from four local draft maps. No API call or reload,
no mutation of accepted groups, error or saved notices. Raw empty name/role/scope
keys count as drafts; empty add-member selection alone does not. Same-group
name/role/scope/member pending guard applies to both button and direct method.
Another group's pending request or draft remains independent.

## Product review
Explicit per-group reset avoids retyping accepted values or reloading Settings
and losing unrelated work. It does not undo saved changes, fetch current server
values or clear errors. Help states the last-loaded/accepted fallback. Current
canManageGroup rendering retained. No permission or server contract change.

## Design review
Explicit non-submit Discard unsaved edits button, disabled without draft or while
pending; plain help directly below. Actual desktop1278x899/mobile390x844 pixels
inspected after restored focused test: button and full no-refresh/no-undo help
readable without horizontal overflow. Group heading/name above scrolled views.
Delete remains separate below; no success claim added for this local operation.

## Security review
Local deletion only, no backend/auth/default/worker change, no API request or
credential access. Draft reset cannot remove or add group grants/membership.
Pending guard preserves newer edits during writes. Existing UI management gate
unchanged; UI is not server authority. No external provider, registration,
spend or license decision. Only disposable local demo writes in tests.

## QA review
10 new unit cases first web actual/API cachedRC0; first build web actual/API
cachedRC0. First focused10PASS0FAILRC0; isolated no-op discard substitution
2PASS2FAILRC1 at four-control reset boundary; restored10PASS0FAILRC0, not full old
HEAD. RealPG/browser: all four raw drafts reset without GET/write, other group
preserved, pending button/direct guard, accepted success and503 fallback,
receipts/error preserved, role/scope/membership unchanged, mobile/runtime checks.
API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync95+144=239 and native116+111+19=246 firstRC0, each stage own call,
checkpoints cleaned; native testPG55968 from start. Config16/14/docs4/glossary
harness3 firstRC0. Reaper first command wrong filenameRC2 (no test executed),
correct existing script4PASS0FAILRC0. All194 browser suites first2236PASS0FAILRC0, each own call. Final units/build
both cachedRC0. Latest desktop/mobile pixels re-inspected after broad run: discard
action and full no-refresh/no-undo help readable, no horizontal overflow; heading
and name above scrolled view. Final docs4/diff/node checksRC0. Coverage22FULL7PARTIAL1MISSING/defaultOFF and external
acceptance gaps unchanged.
