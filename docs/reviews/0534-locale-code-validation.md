# Local locale-code syntax validation

## Developer review
Same existing AddLocaleDto regex against existing trimmed submission. Button and
programmatic guard share validNewLocaleCode. Raw text retained, no API call/read,
receipt clearing or unknown pause on local rejection. Existing outer trim remains,
not a new normalization policy. Removed mismatched UI maxlength10: API/PG accept
longer segmented codes. No backend/schema or locale removal change.

## Product review
Avoid predictable syntax rejection and unknown-result pause. Examples and exact
shape stated, explicitly not language registry validity, availability or admin
permission prediction. No duplicate check or complete BCP47 validator claim.
Successful existing-code response stays idempotent; valid server failures still
pause conservatively, no blanket400 recovery.

## Design review
Rules linked via aria-describedby, nonempty invalid aria-invalid and fixed status.
First21/0 then actual pixels showed desktop correction status beside export form;
scoped full-row status fixed, restored final21/0. Final desktop390px pixels
inspected readable rules, rawinvalid and disabled Add with no horizontal overflow.
Longer toolbar needs scrolling, no compactness/global grid fix claim.

## Security review
Client guard not security boundary; backend validation/permissions retained.
Fixed rules/status text, raw input not innerHTML, private server errors suppressed.
No accounts/worker/provider/spend/license/credential scope change. Actual localPG
only, no external language registration or locale service query.

## QA review
22newunits; first focused CLI invocation ran allweb1643tests/158suitesactualRC0,
not merely selected file. Invalid13 cases/rawkeep/noAPI/noGET/no pause/statekeep;
valid7 including longsegments and outertrim, correction and serverfailurepause.
ActualPG/browser first21/0, oldapp0PASS2FAIL/abortRC1 missingrules/invalidselector,
restored final21/0 after status layout fix. Twelve invalidrawcodes noPOSTGET,
correction without reload, longcode real insertion/localtranslation/newerdraft,
outertrim actualfr/unchangedclear, valid503pause/no replay/privateerror/reads.
Existing locale-create browser fixture updated before regression to await
confirmed empty input rather than Add enabled after unchanged success, because
empty Add is now intentionallydisabled. No failing regression/appfix claim.
Broad verification is recorded below. Coverage22FULL7PARTIAL1MISSING/defaultOFF and external
acceptance gaps unchanged.

## Broad checkpoint
Final current-source webactual/APIcached unitsRC0; initial actualweb1643/158;
webactual/APIcachedbuildRC0. APIa/b/c/d/syncpreview644/auto132/2fa37/saml55
allfirstRC0/positivePASS/zeroFAIL. Sync95+144239unique first0. Native116+111+19
246total242unique4startuprepeats first0, separate calls/checkpoints, not an
uninterrupted run. Config16/14/docs4/harness3/reaper4first0. No failed/aborted
regression checks yet. Stable160 browser list /tmp/browser468-list, next sweep.
Browser001-020 firstRC0/positivePASS/zeroFAIL, no source changes during sweep.
Checkpoint preserved; next021-160, then finaldocs/owner+livetodo/live repo/push.
Browser021-055first0.056first0PASS2FAILRC1 failedfocusedretryassertion then
missingretrycontrol; screenshot showed unintended file-sync-preview navigation,
not editor/private-error leakage in editor. Earlier hit target not recorded,
root not established. Fixture adds scrollcenter before both pointer retry clicks,
preclick hit-target/enabled diagnostic plus screenshot. Second6/0 currentfixture;
no app change/root-cause claim. Only056fixture changed during sweep so far,
completed001-055 retained. Next057.
057-060first0.061first1PASS+abortRC1 Requestalreadyhandled at second preview:
fixture continued prior held request when new pointer click produced no held
request. Earlier click target not recorded, root not established. Fixture now
clears heldPreview, waits actual new heldrequest/exactcount, explicitly scrolls
preview center and logs hit-target/enabled with screenshot. Second5/0; no app
change/definitive earlier-click cause claim.056+061onlyfixtures changed midsweep.
Browser062-085firstRC0/positivePASS/zeroFAIL. Finalvalid001-085:83first,
056+061secondfixture. Appunchanged; completed checks preserved. Next086-160.
086-110first0.111first2PASS+timeoutabortRC1 failedbranch-readwait after pointer
click; first hit target not recorded/rootunknown. Fixture explicit scrollcenter
and preclickhit/enabled screenshot; second7/0, no appfix/rootclaim. Threefixtures
changed midsweep:056/061/111. Appunchanged. Next112.
112-151firstRC0/positivePASS/zeroFAIL. Finalvalid001-151:148first,
056/061/111secondfixture. Appunchanged; completed checks preserved. Next152-160.

Final001-160allvalidRC0/positivePASS/zeroFAIL:1810PASS;157first,
056/061/111secondfixture. Only those three fixtures changed during sweep; all
app source unchanged. Existing locale-create fixture changed before sweep.
Final desktop390pxinvalid screenshots re-inspected, no horizontal overflow.
No uninterrupted-run/external-acceptance/default-worker change claim.
