# Local new-branch name validation

## Developer review
Mirror existing CreateBranchDto/service regex exactly against existing trimmed
submission: ASCII letter/digit first, then letters/digits/dot/dash/underscore,
1-40 total. Same method for Add and programmatic guard. Raw invalid input kept,
no silent maxlength truncation, no write/read/state clearing on local rejection.
Existing outer trim remains explicit. Branch starts-empty/listrefresh/captured
rawdraft clear/unknownpause/destroy fences unchanged. No switch or key read.

## Product review
Avoid predictable syntax rejection entering unknown-result pause. Not duplicate,
admin or success prediction. No clone, nonempty branch creation, rename or merge
change. Valid server errors still pause, no blanket400 recovery.

## Design review
Linked rules, nonempty invalid aria-invalid and fixed full-row status. First
18PASS1FAILRC1: actual40char branch widened native select beyond390px. Scoped
branch select max-width100% fixed overflow. Fixed19/0, final19/0, extended19/0
checks picker boundary explicitly. Desktop390pxinvalid/picker pixels inspected,
readable rules/rawname/disabled Add and no document overflow. Taller toolbar,
scroll required; no compactness/global grid fix claim.

## Security review
Client guard not a replacement for backend syntax/permissions. Fixed rules/status,
raw input never innerHTML. Private server errors suppressed. No external/worker/
account/spend/license/credential-scope changes. Real localPG only.

## QA review
18newunits; fullweb1661/159actualfirst0. Eleven invalidcases/rawkeep/noAPI/read/
pause/stateclear; fivevalid including40chars and outertrim, correction and
validserverfailurepause. RealPG/browser first18PASS1FAILRC1 overflow; fixed19/0.
Oldapp0PASS2FAIL/abortRC1 rulesfalse/missinginvalidselector; currentrestored19/0;
extendedpickerbound19/0. Teninvalidrawnames zeroPOSTGET/nopause, correction,
actual40char emptybranch/keycount0/listonlyrefresh/currentmain/localtranslation/
newerrawdraft; trim actualsecondcreate/clear; valid503pause/no replay/privateerror.
Before regression branch-unknown111fixture now waits retained invalid raw name
marker+disabled Add after successful current-list read, not enabled Add. Raw
newer draft remains unchanged; no failing regression/appfix claim.
Broad verification below; coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.

## Broad checkpoint
Finalweb1661/159actual/API265/31cachedunitsRC0;webactual/APIcachedbuildRC0.
APIa/b/c/d/syncpreview644/auto132/2fa37/saml55allfirstRC0/positivePASS/zeroFAIL.
Sync95+144239unique first0 before nativefixture-only change/sameapp. Nativefirst
initial114PASS2FAILRC1: cart.note missing after pointer Add; later ordinalrow QA
placeholder expectation failed. First hit target not captured/rootunknown.
Fixture explicit scrollcenter before thirdkey Add+hittrue/enabled252..284px
screenshot inspected; freshfirst116/0,middle111/tail19first0.246total242unique/
4startuprepeat, stagednotuninterrupted/no definitiveclickroot or appfix claim.
Config16/14/docs4/harness3/reaper4all0. Stable161browserlist/tmp/browser469-list.
Browser001-040allfirstRC0/positivePASS/zeroFAIL. No source changes during sweep.
Completed checks retained; next041-161 then finaldocs/owner+livetodo/live repo/push.
Browser041-081first0.082first preassertionPG55714bindabort0PASS1FAIL misleading
RC0 rejected. Localclient55714->API3000TIME_WAIT06/inode0/directbindEADDRINUSE
observed; fullfirst log retained. Independent083/084first0, unchanged082second
10/0 after expiry. No sourcefix/appfailure claim; legacy falsegreen not fixed.
Next085; app/source unchanged during sweep, completed checks retained.
Browser085-140firstRC0/positivePASS/zeroFAIL. Finalvalid001-140:139first/
082secondunchanged. No executable changes during sweep, completed checks kept.
Next141-161 then finaldocs/owner+livetodo/live repo/commitpush/postchecks.

Final001-161allvalidRC0/positivePASS/zeroFAIL:1829PASS;160first/082second
unchanged. No executable source changes during sweep. Finaldesktop390pxinvalid/
picker pixels re-inspected. No externalacceptance/defaultworker or uninterrupted
run claim. Existing acceptance gaps/coverage counts unchanged.
