# 0397 - Targeted editor tags

## Developer review
Confirmed tag response publishes returned normalized tags to loaded key metadata,
never clears/replaces cells. Captured keys generation/destroy fence stops old
completion. Same-key pending guard; other selected tag draft untouched. List read
invalidates selected edit/error, pending IDs cleared when each request settles.
No tag CAS, automatic retry, cancellation or exactly-once outcome claim.

## Product review
Tag editing must not erase unrelated unsaved translations via full list reload.
Active tag filter retains current row to protect local text, with guidance to run
filter again. Failure outcome unconfirmed, fixed inline check-server guidance.
No automatic full refresh or draft persistence.

## Designer review
Actual retained translation and scoped tag-error pixels inspected. First fixed
message inside inline tags overlapped history/comments under inherited nowrap.
White-space override alone still crowded controls; moved error to its own block
below key controls. Final pixels readable without overlap. Not a responsive audit.

## Security review
No API/backend/provider/credential scope changes. Fixed error hides raw details.
Late completion suppressed after grid replacement or destroy, no accidental
retargeting. No worker/license/spend changes. Upload scope must be recovered again
before commit.

## QA/integration review
API265/31 web432/29 (+6) uncached builds0 initial424.67kB. Browser5 real held
translation PUT leaves DB Original while normalized tag PATCH commits, no key-list
GET/draft loss; pending guard, fixed failure/no auto retry. Broad64 bounded legs
have completed results; final template-only placement followed by new browser5.
Combined basic+browser host limit killed browser startup after basic all0; owned
Nx cleaned, stale fixture socket retry aborted, changed test port55601/final5.
New browser catch initially yielded0 despite abort due dependency exitCode reset;
now abort increments failures and exit derives from failure count, final5/RC0.
Combined a+b host limit interrupted b after SDK, a complete preserved, remaining
legs separately passed; snapshot stale socket belonged to interrupted own fixture
PID4072 zombie/TCP refused, removed socket/lock, snapshots61 final0. No unknown
process killed. SyncSTAGED95+144239unique inner/outer0/checkpoint removed.
Nativefirst116/0, second host120s kill incomplete; clean restart first116/0 then
second host120s kill incomplete again. Both owned Nx/checkpoints cleaned. Native
full staged result remains PENDING, not canonical uninterrupted or complete.
Final docs/config/reaper still pending. Coverage/defaultOFF/external acceptance
limits unchanged. Do not commit until final required coverage resolved.

Follow-up verification attempt: reversible three-segment runner prototype added
only checkpoint boundary/control code, but first attempt timed out navigation30s
before checks and next attempt host120s killed after second key creation. Runtime
now too slow even for previously successful first segment. Prototype reverted
entirely to committed runner; no new staging capability claimed. Owned Nx group/
checkpoint cleaned. Final required native coverage remains pending; no commit.


Final continuation: fresh runtime unchanged committed native runner on new owned
fixture port55604, first116/outer0 and second128/outer0, combined244total242unique,
checkpoint removed. No app/test edits since final native. This resolves pending
coverage, not a claim that any interrupted run succeeded or canonical uninterrupted
success. Prior native failures/prototype chronology above remains intentionally
preserved. Final config16/docs4-138routes/reaper4 all0. Broad64 legs completed
across recorded bounded calls, not one uninterrupted sweep. API265/31 web432/29
uncached builds0 initial424.67kB. Earlier browser legs preceded final template-only
error placement; tagbrowser5 and final native cover final placement. No coverage
promotion/defaultOFF/external acceptance change. All five review passes complete;
original upload evidence and live target must be rechecked immediately before push.
