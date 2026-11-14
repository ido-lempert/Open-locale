# Explicit MEMBER-group locale scope Save

## Developer review
Existing allowedLocales-only updateGroup PATCH, no role body or API change. Local
raw per-group draft; trimmed deduplicated snapshot, clear only unchanged raw text,
retain newer text. Accepted state reflected locally before reload; failed refresh
does not disable a newer explicit revert. Same-group role/scope pending guards
work both ways and span PATCH/reload. Other groups' drafts preserved.

## Product review
Group locale scope was displayed but not editable without replacing the group.
Explicit Save now edits MEMBER-group scope while preserving membership and other
grants. Blank grants all locales for every group member across every team project.
No project hiding. UI edits accept current-project codes only; broader backend
API unchanged. Existing canManageGroup controls and server rank rule remain.
ADMIN scope not editable here, no automatic Save or second request.

## Design review
Labeled group write locales, explicit Save locales and saving state, known-code
and blank/team-wide/other-grant warning, visible invalid correction, ARIA help.
Actual desktop1278x899/mobile390x844 pixels inspected after restored focused run:
saved en scope and newer he draft distinct, Save/warning/full receipt readable,
no horizontal overflow. Mobile group identity/saved badge above viewport.

## Security review
No backend/permission/worker/default change. Existing strict group-rank rule is
server authority, UI is not authorization. Unknown current-project codes and
nonblank empty comma entries cannot submit, blank explicitly broadens all locales.
Actual PG/browser member writes verify removed group locale denied, newly saved
group locale allowed, unchanged direct locale still allowed, blank all allowed.
Only disposable demo membership/group used. No actual account grants, external
request, credential change, registration, spend or license choice.

## QA review
19 new unit cases first full web actual/API cached RC0. First buildRC1 copied
member template variable m in group row; corrected to g, web actual/API cachedRC0.
First focused14PASS1FAILRC1 old direct-locale receipt text expectation; fixture
corrected to group wording,15/0RC0. Isolated auto-save-on-typing substitution
3PASS2FAILRC1 at local-only boundary; restored15/0RC0, not full old HEAD.
Checks include invalid/comma-only local draft, no PATCH/GET on typing, snapshot
locale-only request, duplicate/cross-role guard, newer text retention/receipt,
actual write permissions/union, second explicit Save, blank all-locales effect,
403 no saved claim/refresh,503 accepted scope plus newer revert enabled, direct
member grant/group membership unchanged, zero runtime errors. Broad: all192 browser suites first2213PASS/0FAIL/RC0, each in its own call.
API a/b/c/d and separate sync-preview644/automations132/2FA37/SAML55 firstRC0.
Sync stages95+144=239 firstRC0, cleaned checkpoint. Native first116RC0 then
middle109PASS2FAILRC1: promotion and dependent activity detail. Diagnostic fresh
first116RC0/middle109PASS2FAILRC1 reproduced. Enabled Save role rectangle top5/
bottom37 was under sticky header, after physical click no pending/request. Taller
scope editor changed scroll geometry. Restored diagnostic-free fixture, center
scroll before both physical Save role clicks, all original assertions retained,
no app change. Fresh final native116+111+19=246RC0, cleaned checkpoint, not
first-pass or uninterrupted. Config16/14/docs4/glossary harness3/reaper4 firstRC0.
Final units/build web+API both cachedRC0. Desktop/mobile screenshots re-inspected
after broad checks with same reviewed state. Final docs4/diff/node checksRC0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance gaps unchanged.
