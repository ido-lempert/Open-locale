# Local new-key name validation

## Developer review
Mirror existing API CreateKeyDTO /^[\w.-]{1,200}$/ exactly. Same method for Add
button readiness and programmatic add guard. Input retained raw, no trim,
truncation, maxlength or rewriting. Empty button disabled; nonempty invalid name
links rules via aria-describedby/aria-invalid and inline status. No API/read or
unconfirmed state transition on local rejection. Correct then create normally.
Existing capture tuple/insertion/destroy/unknown-result pause unchanged.

## Product review
Avoid predictable server rejection and unnecessary unknown-result pause for bad
name syntax. Explicit1-200ASCIIletters/digits/dot/dash/underscore/no spaces.
Not duplicate availability, permission or success prediction. Duplicate/auth/
network/server failures remain conservative unknownpause, no blanket400recovery.

## Design review
Inline rules fit existing scope row and wrap on mobile. First31/0 then pixels
caught combined scope UpTo2000 looking like a name rule after new name text;
clarified Keydescription:upto2000, final31/0. Desktop/390px/invalid-state pixels
inspected readablewrappedrules/form/retainedvalues/nooverflow. Longer formscope,
no compactness claim. Native input remains editable to correct invalid content.

## Security review
Same syntax as backend, not security boundary replacement. Backend permission/
validation retained; client programmatic invalid refuses write. Rules/feedback
fixed text, rawname never innerHTML. Serverprivateerror not surfaced; unknown
pause retained after valid request failure. No account/worker/scope/spend/license
or credential change, localPG fixture only.

## QA review
18newunitsfirst0:10invalid(empty/space/edges/interior/slash/Hebrew/emoji/markup/
201chars) preservecomplete tuple/noAPI/nounknownpause; valida/Z_1.x-y/200chars/./-/_,
exactpayload; local correction noGET/singlecreate; serverfailurepause persists
across changedname. RealPGbrowserfirst31/0/currentfinal31/0 aftercopyclarification;
eightinvalidrawnames noPOST/GET/nounknownpause, correctionenableswithoutreload,
actualcreate/200charplain success, metadata/plural/neweredit/unknownpause checks.
Oldapp0PASS2FAIL linkedrulesfalse/invalidselector timeoutRC1,currentrestored.
Full regression is recorded below. No external acceptance promotion; coverage
22FULL7PARTIAL1MISSING/defaultOFF unchanged.

## Broad checkpoint
Fullweb1621/157actual (+18/+1),API265/31cached/buildwebactualAPIcached0.
APIa/b/c/d/syncpreview644/auto132/2fa37/saml55allfirst0/positivePASS/zeroFAIL.
Sync95+144239first0 before native-fixture-only changes, same app source.
Nativefirst initial5PASS/incompleteRC1: old fixture expected Add enabled after
success but emptyname now intentionallydisabled. Fixture waits changed to
rowpresent+namecleared; freshfirst116/0. Middle87PASS1FAIL+abortRC1 missingmerge
modal/API diagnosticpreview201/noapp error. Root not established, earlier hit
target not recorded. Explicitscrollcenter+hittargetdiagnostic true/enabled at
116..149px plus screenshot; fresh currentnative116+111+19all0/246total242unique/
4startuprepeats. Not uninterrupted or definitive earlier-clickroot claim.
Config16/14/docs4/harness3/reaper4all0. Stable159browserlist/tmp/browser467-list;
001-035allfirstRC0/positivePASS/zeroFAIL. This was the early checkpoint;
final sweep and fixture change chronology follow.
Browser036-129finalvalid0:094first+secondPG55734EADDRINUSE0PASS1FAILmisleadingRC0
(rejected), socketlocalclient55734->API3000TIME_WAIT06/inode0/directbindEADDRINUSE;
unchangedthird13/0afterindependent095/096 passed. Logs first/second preserved.
112first6PASS+timeoutabortRC1 retainedname newer draft invalidnow yet fixturewait
Addenabled after successfulrecovery. Fixture now waits actualerrorremoval+invalid
marker and asserts retainedrawinvalidname+disabled; second8/0. Only112fixture
changed during sweep, appunchanged.130first0PASS1FAILtimeout waitingfirstkeyboard
resultcountfocus; unrelatedsavedsearchpage/noappcauseestablished. Unchanged retry10/0; cause
unknown, no app or fixture fix claimed. First log preserved. Runtime-generated
files restored after130, next131 fresh; no active process carried over.
Final001-159 allvalidRC0/positivePASS/zeroFAIL:1789PASS,156first,094third,
112second after fixture-only compatibility fix,130second unchanged. Only112
fixture changed during sweep; all app source unchanged. Completed suites retained.
Final desktop/390px/invalid screenshots re-inspected: readable rules, optional
metadata, disabled Add and retained raw invalid value, no horizontal overflow.
No external acceptance or default-worker change. These are staged runs, not
a canonical uninterrupted run. Existing acceptance gaps remain unchanged.
