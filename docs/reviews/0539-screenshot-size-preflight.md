# Local screenshot size preflight

## Developer review
Size >2*1024*1024 before mutation epoch/state/API; existing input value reset
unchanged. Fixed feedback keyed to current pane, cleared on explicit close/grid reload and
next within-bound selection. Pane switches hide other-key feedback; returning to
that key can show its last rejection until close or next within-bound selection.
Blocked events cannot replace unknown feedback.
No change to valid-upload/read/count/generation/uncertainty behavior or backend.

## Product review
Known oversized files need no upload or unknown-result pause. Reusable chooser,
fixed correction, exact bytes/2MiB rules. Size-only, not image type/signature/end
validation, supported image or server acceptance promise. Zero/exactlimit still
reach server; local readiness is not acceptance. No file stored/automatic retry.

## Design review
Chooser linked exact-byte guidance, fixed wrapped status below. Actual desktop/
390px pixels inspected readable, no overflow. Existing max2MB label supplemented
with exact2,097,152bytes/2MiB; no file-name echo or misleading success banner.

## Security review
Server MIME/signature/end/size/permission checks remain authoritative. No reading
or uploading rejected bytes; no raw HTML/privateerror. LocalPG only, no external
account/registration/worker/spend/credential-scope/license changes.

## QA review
13newunits:2oversize/noAPI/read/pause/countchange,3withinbound stillserver (not
acceptance),6blocked state guards,closeclear,validfailurepause/noreplay.
Fullweb1737/163actual/API265/31cached0,buildwebactual/APIcached0.
Focusedfirst4PASS+abortRC1 missing .shots-toggle following mobilecloseclick;
original hit/state not captured, root unknown. Fixture centers toggle and records
hittrue/enabled top406/553px; fixed9/0. No appfix from abort. Oldapp0PASS2FAIL/
timeoutabortRC1, restoredfinal9/0. RealPG oversize noPOSTGETpause; close/reopenclear;
smaller validPNG reallypersistsonce; valid503unknownpause/no replay/privateerror;
explicitcurrentreadstillrecovers. No exactlimit acceptance claim.
Broad pending; coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.

## Broad checkpoint
APIa/b/c/d/syncpreview644/auto132/2fa37/saml55allfirstRC0/positivePASS/zeroFAIL.
Sync95+144239unique and native116+111+19246total/242unique/4startuprepeats allfirst0,
eachstageowncall/checkpoint, notuninterrupted. Config16/14/docs4/harness3/reaper4
allfirst0. No executable changes sincefinalfocused; browser sweep pending.
Finalunitsweb1737/163/API265/31cachedRC0 afterfirstwebactual/APIcached0.
Browser001-020allfirstRC0/positivePASS/zeroFAIL; no executable changes during
sweep. Completed checks retained; next021-165 then finaldocs/authority/live repo/
commitpush/postchecks. No active process/credential/human blocker.
Browser021-080allfirstRC0/positivePASS/zeroFAIL/no executablechanges; completed
checks retained. Next081-165 then closeout.
Browser081-140allfirstRC0/positivePASS/zeroFAIL/no executablechanges; completed
checks retained. Next141-165 then closeout.

## Final verification
All165browserfirstRC0/positivePASS/zeroFAIL,1874PASS.Eachsuiteowncall/completed
checksretained. No executable changes during sweep. API/staged/config/unit/build
evidence above preserved. Finaldoc closeout only afterward. Finaldesktop/390px
screens inspected: exactbyte guidance/correction/chooser readable/nooverflow.
