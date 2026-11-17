# Preserve unrelated Settings drafts after group locale-scope Save

## Developer review
Refresh groups only after accepted scope-only update. Parsed/deduplicated snapshot,
optimistic accepted scope, exact newer raw text, pending guards and receipt stay.
Units mock actual listGroups with prior assertions retained. No API/schema change.

## Product review
Scope Save must not erase unrelated general/new-group/rule drafts. Explicit Save,
blank-all scope,403 refusal and truthful accepted receipt on503 remain. Grant
consequences stay team-wide and union with direct/other group grants.

## Design review
Help explains groups-only refresh and kept forms while retaining grant warnings.
Four real scope/discard desktop1278x899/mobile390x844 screenshots inspected09:17:
readable/fit. Scope mobile starts at input; discard mobile at button, name above
viewport.

## Security review
Only disposable local group fixtures. Server validation/authorization unchanged.
Retain real API authorization proof for removed and saved group locales and direct
grant union. No live user role/membership/account, worker, scope, spend or license
change. Refresh affects only local list state, not mutation payload.

## QA review
Extended real browser/API/PostgreSQL proof retains snapshot/pending/second Save,
blank-all/403/503 and actual authorization/effective union assertions; adds groups-
only GETs and unrelated draft retention. Initial units/build RC0 webactual/APIcached.
FocusFIRST17/0; deliberate broad-reload negative15PASS/2FAILRC1; restored17/0.
Related discardFIRST10/0.
Final five-perspective closeout: groups-only refresh matches scope; payload,
accepted-state and grant behavior unchanged. No further code fixes. Four final
scope/discard screenshots inspected10:47: readable/fit, with mobile scroll positions
as described above. API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55
firstRC0. Sync staged95+144=239 and native116+111+19=246 (four startup repeats)
firstRC0, each stage separately. Browser219 FIRST2536PASS/0FAIL; no app or fixture
changes during broad verification. Config sync16/native14/docs4/glossary-reset3/
runner4, syntax1/diffRC0. Final API/web units/build RC0 (2/2cached each).
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
