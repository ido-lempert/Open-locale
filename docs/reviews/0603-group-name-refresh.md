# Preserve unrelated Settings drafts after explicit group-name Save

## Developer review
Refresh groups only after accepted name-only update. Keep submitted trimmed name,
exact newer raw text, optimistic accepted name, per-row pending guards and receipt.
Unit mock uses actual listGroups; prior assertions retained. No API/schema change.

## Product review
A rename must not erase unrelated general/new-group/rule drafts. Explicit Save,
real duplicate409,403 refusal and truthful accepted receipt on503 remain.

## Design review
Help explains groups-only refresh and kept forms. Real desktop/mobile pending
rename and discard screenshots inspected06:06: readable/fit. Rename mobile starts
at name input; discard mobile starts at discard, name above viewport. Initial
visual review caught rename copy appended to unrelated member/group locale help;
restricted it to group-name help and reran units/build/focus/discard, all RC0.

## Security review
Only disposable local group-name fixtures. Server permissions, grants, memberships,
task assignments and validation unchanged. No account, worker, credential-scope,
spend or license change. No HTML rendering changes.

## QA review
Initial units RC0 webactual/APIcached. Extended real browser/API/PostgreSQL proof
checks groups-only GETs and unrelated drafts on success/503, retaining existing
snapshot, pending, explicit Save,409,403 and saved-grant/task assertions.
FocusFIRST15/0; deliberate broad-reload negative13PASS/2FAILRC1; restored15/0.
Related discardFIRST9/1RC1:503 injection still targeted old project GET. Changed
only its fault target to groups GET, retaining every assertion; rerun10/0RC0.
Final copy focus15/0 and discard10/0. Units/build after copy fix RC0 webactual/
APIcached. API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 firstRC0.
Final developer/product/design/security/QA review: intended groups-only refresh
verified without widening mutation payload, permissions or accepted-state claims.
No further fixes. Final four rename/discard screenshots inspected07:34; readable,
no horizontal overflow, with mobile scroll positions as recorded above.
Sync staged95+144=239 and native116+111+19=246 (four startup repeats) firstRC0,
each stage separate. Browser219 FIRST2532PASS/0FAIL; no fixture or app changes
during broad regression. Config sync16/native14/docs4/glossary-reset3/runner4,
syntax2/diffRC0. Final API/web units/build RC0 (2/2cached each).
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
