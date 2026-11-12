# Local tag-draft limit validation

## Developer review
Existing comma split/trim/empty filter shared with save; max20 outgoing entries,
max40 per tag. Match installed backend class-validator/validator isLength: count
surrogate pairs and presentation-selector pairs once. No grapheme/UTF16-only claim.
Raw invalid draft and edit mode kept on Enter/blur/programmatic call, noAPI/read/
saving/errortransition; cancel remains available. No dedup before DTO validation,
server still merges duplicates. Valid save/unknownpause/generation fences unchanged.

## Product review
Prevent predictable tag limits from entering unknown-result pause. Fixed inline
rules/correction, not availability or save-success prediction. Existing empty
entries clear-all preserved. Not escaped-comma/CSV parsing or new tag syntax.
No automatic correction/truncation/dedup. Validserver failure remains unknown.

## Design review
Linked per-key rules/aria-invalid/full-row fixed status, raw input editable,
Cancel/Escape without write. Actual desktop390px pixels inspected readablewrapped
rules/correction/cancel/nooverflow. Longer key row needs scrolling, no compactness
claim. Existing translation blur/save behavior unchanged; retained local text not
claimed unsaved by focused test. Existing broader concurrency suites cover it.

## Security review
Client check not backend permission/DTO replacement. Fixed rules/status not raw
HTML. No privateerror disclosure. Parsed-array count before dedup matches DTO,
preventing misleading acceptance of21duplicateentries. No external/worker/account/
spend/license/credentialscope change, real localPG only.

## QA review
21newunits/fullweb1682/160actualfirst0. Invalidraw retention/noAPI/read/pause,
backend-validator comparison11cases(surrogates/presentationpairs/combining/lone
surrogates), valid20duplicate/empty semantics, correction/cancel/serverfailurepause.
Focused first8PASS+timeoutabortRC1: fixture programmaticreplace then blur on an
unfocusedfield, no actualblurevent. Fixture focuses before blur, fixed12/0.
Oldapp0PASS2FAIL/abortRC1 missingrules/invalidselector, restoredfinal12/0. No app
fix from fixturetimeout. ActualPG invalid4 Enter/blur/capturedcall noPATCHGET,
Unicode40emoji/presentationtag acceptedpersisted,21duplicates local/20sent then
realserverdedup, emptyclearall, correction/noreload/valid503pause/noreplay/private.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.

## Broad checkpoint
Finalweb1682/160actual/API265/31cachedunitsRC0;webactual/APIcachedbuildRC0.
APIa/b/c/d/syncpreview644/auto132/2fa37/saml55allfirstRC0/positivePASS/zeroFAIL.
Sync95+144239unique and native116+111+19246total242unique4startuprepeat allfirst0,
eachstageowncall/checkpoints, notuninterrupted. Config16/14/docs4/harness3/reaper4
allfirst0. Stable162browserlist/tmp/browser470-list; no executable changes since
focusedfinal, no broadfailed/aborted checks sofar.
Browser001-040allfirstRC0/positivePASS/zeroFAIL, no executable changes during
sweep. Completed checks kept; next041-162 then finaldocs/authority/live repo/push.
Browser041-140allfirstRC0/positivePASS/zeroFAIL, no executable changes during
sweep. Completed checks kept; next141-162 then finaldocs/authority/live repo/push.

## Final verification
Browser001-162 all first RC0/positivePASS/zeroFAIL: 1841 PASS total. Each suite
ran in its own call. No executable changes during sweep; only this documentation
closeout afterward. All staged/native/API/unit/config checks above preserved.
Screens inspected again at final closeout: readable wrapped tag rules, correction
and Cancel at desktop/390px, no horizontal overflow; desktop tag input remains
narrow and the row is taller. No external acceptance or worker enablement claim.
