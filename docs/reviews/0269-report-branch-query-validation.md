# 0269 - Report branch query validation

## Developer review
Shared progress/quality controller helper accepts omitted branch or a single
valid branch-name string, matching creation grammar1..40 ASCII letters/digits/
dot/dash/underscore with alphanumeric first character. Empty/repeated/malformed
input rejected400 before service. Existing unknown valid name stays404.

## Product review
Omitted branch resolves/reports main. Empty branch is now400 rather than silently
resolving main while quality echoes empty branch. No UI/schema/route additions.
Coverage22 FULL/7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
No UI changes. Fresh480x900 local actor/task fixture inspected: identity rows and
counts readable; existing progress horizontal scroll retained. Image is not
branch-input validation proof; actualHTTP fixtures establish those responses.

## Security review
Validating string type prevents repeated query arrays reaching Prisma branch
lookups. Bound/authorized service reads remain unchanged. Express simple query
parser treats branch[x] as a separate literal key, not a branch object; fixture
checks it leaves branch omitted/defaultmain, not an object rejection claim.

## QA/integration review
Reports97->111(+14): each route empty/repeated/space/41chars400,bracketkeydefault
main,omittedmain,unknownvalid404. Initial109PASS2FAIL wrongly expected bracketkey
400. Corrected test to actual simple-query semantics; final111green. No production
fix needed for bracketkey. API263/31/web146/9uncachedunchanged.43uniquelegs/12fully
completedgreenbatches individual/inner/outer0. Sync644/browser212/builds/reaper4/
docs4/138routes0. No startupissues/timeouts/interruption/targetednegativecontrol.
Web562.75kBvs500warning. NativeSTAGED116+128=244total/242unique PG55534innerouter0/
checkpointremoved,NOTuninterrupted. Noapp/testchangesafter native.
