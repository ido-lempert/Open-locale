# Preserve new-group drafts edited during Add

## Developer review
Snapshot raw name/role/locales before POST and derive existing trimmed name and
parsed locales from it. Clear name/locales only when all three still match after
success; otherwise retain entire newer draft. Existing role selection/reload/
busy/name checks remain. No automatic second POST, no backend/schema change.

## Product review
Receipt distinguishes created submitted group from newer uncreated draft and
asks review of role/locales before another Add. Next valid attempt clears it;
invalid/busy calls keep it. POST refusal does not claim created. Reload failure
after successful POST keeps accurate receipt with existing error. No persistence
on reload. Edits during reload already remain after unchanged clear.

## Design review
Receipt role=status near form. Desktop1278x899/mobile390x844 pixels inspected:
readable wrapped receipt, literal newer name, preserved role/locales, no document
overflow. No group-panel or membership redesign.

## Security review
Draft retention is not grant approval. Existing backend role/locale/permission
checks remain; no silent role/locale repair or auto submit. No raw draft in
receipt. Only local empty-group fixtures, no real membership/grant/account/
security/token-scope/external/worker/spend/registration/license change.

## QA review
10newunits:3pendingfields,unchanged,edit/revert,editduringreload,POSTfailure,
reloadfailure,invalid/busy,nextreceiptclear. Fullweb2090/178actualfirstRC0/API265/
31cachedRC0;buildwebactual/APIcachedRC0. Focusedfirst10/0,oldapp1PASS2FAILRC1,
restored10/0. RealPGheldPOST/exactoldname-role-locales/duplicateblock/allnewerdraft/
literalmarkup/onlyoldpersistedemptymembership/secondexplicitAdd/unchangedclear/
rolekept/403noreloadnocreatedclaim/503reloadaccuratereceipt+DBpersistedemptygroups.
APIa/b/c/d,sync-preview644/automations132/2fa37/SAML55allfirstRC0. Sync95+144=239/native116+111+19=246allfirstRC0separatecalls/stages,not uninterrupted. Config16/14/docs4/harness3/reaper4first0. Browser001-180allfirstRC0/2075PASS/0FAIL. Coverage22FULL7PARTIAL1MISSING/defaultOFF/external
acceptance unchanged.

Final full unit targets and builds RC0, both cached after first web actual/API cached.
Final docs4/4 RC0 and diff whitespace clean. Latest180 screenshots re-inspected
at1278x899 and390x844: complete readable wrapped receipt, literal draft,
role/locales preserved and no horizontal clipping.
