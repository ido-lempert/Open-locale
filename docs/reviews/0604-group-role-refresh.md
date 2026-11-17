# Preserve unrelated Settings drafts after explicit group-role Save

## Developer review
Refresh groups only after accepted role-only update. Keep submitted role snapshot,
optimistic accepted role, exact newer selection, per-row pending guards and receipt.
Unit mock uses actual listGroups; all prior assertions retained. No API/schema change.

## Product review
Role Save must not erase unrelated general/new-group/rule drafts. Explicit second
Save,403 refusal and truthful accepted receipt on503 remain. Grants stay team-wide.

## Design review
Help explains groups-only refresh and kept forms without hiding grant consequences.
Four real role/discard desktop1278x899/mobile390x844 screenshots inspected07:38:
readable/fit. Role mobile starts at selector; discard mobile at discard, name
above viewport. No layout change.

## Security review
Only disposable local groups. Server permissions, roles/grants and memberships
unchanged. UI optimistic accepted role and effective grants derive from groups as
before; no account, credential-scope, worker, spend or license change.

## QA review
Extended real browser/API/PostgreSQL proof checks groups-only GETs and unrelated
drafts on success/503, retaining submitted role/pending/second Save/refusal tests.
Initial units/build RC0 webactual/APIcached. FocusFIRST12/0; deliberate broad-
reload negative10PASS/2FAILRC1; restored12/0. Related discardFIRST10/0.
Final five-perspective closeout: groups-only refresh matches scope, payload and
accepted-state behavior unchanged. No further code fixes. Four final role/discard
screenshots inspected09:13: readable/fit with mobile scroll positions above.
API a/b/c/d plus sync-preview644/automations132/2FA37/SAML55 firstRC0. Sync
staged95+144=239 and native116+111+19=246 (four startup repeats) firstRC0,
each stage separately. Browser219 FIRST2534PASS/0FAIL; no app or fixture changes
during broad verification. Config sync16/native14/docs4/glossary-reset3/runner4,
syntax1/diffRC0. Final API/web units/build RC0 (2/2cached each).
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
