# Optional new-key maximum length

## Developer review
Existing create DTO accepts positive integer maxLength and service writes it.
Prisma optional Int maps to PostgreSQL signed32-bit integer. UI blank omits;
ASCII digits only, at most10digits, numeric1..2147483647. No whitespace trimming,
rounding, exponent conversion or truncation. Typed existing API client extended.
Capture raw limit with name/description/branch. Clear only unchanged complete
triple on confirmed success; preserve newer edits/unknown-result pause/targeted
insertion/destroy fences. Existing edits/reload/branch behavior untouched.

## Product review
Completes creation side of loaded advisory464. Explicit optional/blanknolimit/
range/UTF16/QA/nottypingorsaveblocker/newkeyonly scope. Existing server limit
cannot be edited here. New form text stays local until add. No extra GET, schema
or endpoint. Limit is QA metadata, not a translation validation promise.

## Design review
Desktop4-column newkey/description/limit/button with wrapping scope and mobile
singlecolumn. Focusedfirst18/0 but pixel review caught oldbuttoncolumn3 putting
button before limit; appcolumn4fix, fixed18/0. Inspected final desktop/390px
readable fields/unknownerror/retained values/correctorder/nooverflow. Added scope
makes desktop form taller, no compact-layout claim.

## Security review
Existing authenticated create permission; only validated integer added, no
untrusted HTML. Rawdescription preserved literal through existing path. Invalid
programmatic input refuses call. Unknown result retains fields and pauses replay
without private error text. No external registration/worker/scope/spend/license
or credentials change. Fixture database and local servers only.

## QA review
19newunits first CLI launchRC1 obsolete Jest testPathPattern, corrected plural
flag19/0, no app/test change for this. Invalid0/negative/fraction/exponent/spaces/
overflow/Infinity/markup preserved/refused;1/3/2147483647/0003 numeric request;
blankomit; each newer name/description/limit keeps fulltriple; failurepaused.
RealPGfocusedfirst18/0/fixed18/0: limit3 persisted exact and feeds returnedloaded
advisory/noGET; maxInt2147483647persisted; local translation/description retained,
newerlimit4retained/pendingduplicateguard;unchangedtripleclear;invalid0/-1/1.5/
1e2/leadingwhitespace/overflow localrefusal; unknown5retains/pauses/noPRIVATE.
Oldapp1PASS2FAIL missingfield/selectorabortRC1, apprestored. Browser names clarified
pair->triple after fixed run, require current final rerun. Broad checks remain.
No external acceptance promotion, coverage22FULL7PARTIAL1MISSING/defaultOFF.

## Verification checkpoint
Current focusedfinal18/0 after namesclarified. Fullweb1592/155actual (+19/+1),
API265/31cached; finalwebbuildactual/APIcachedRC0. APIa/b/c/d/syncpreview644/
automations132/2fa37/saml55allfirst0/positivePASS/zeroFAIL. Sync95+144=239 and
native116+111+19=246total242unique4startuprepeat allfirst0, staged not uninterrupted.
Config16/14/docs4/harness3/reaper4all0. Stable157browserlist /tmp/browser465-list;
001-020allfirstRC0/positivePASS/zeroFAIL. No executable changes during broadchecks.
Remaining021-157/finaldocs/owner+livetodo+repoauthority/commitpush/postpushchecks.
Browser checkpoint021-090 allfirstRC0/positivePASS/zeroFAIL. Source unchanged;
next091, preserve001-090 and earlier full checks.

Final157isolatedbrowser suites allfirstRC0/1737PASS/zeroFAIL. No executable
changes during sweep. Final157regenerated desktop/mobile images inspected;
correctfieldorder/usableinputs/scope/retainedunknownvalues/nooverflow.
Finaldocs4/diffcheck0. Originalauthenticatedownerrequests/live todo recovered;
exact named publicrepo/main/pushright/currentremotebase verified before push.
No account/worker/credentialscope/spend/license change.
