# OTA exact loaded publish branch preflight

## Developer review
Guard rejects a missing exact loaded publish branch before invalidating metadata
refresh, busy/error/receipt changes or requests. Existing busy/departure and valid
publish behavior unchanged. Earlier publication metadata, branch and drafts stay.
Older publication-refresh unit fixture now loads main so its publish fence still
executes a valid publish. Pre-translation branches remain independent.

## Product review
Previously missing-choice feedback did not block Publish. Now explicit loaded
choice required; no fallback or normalization. Refresh remains read-only. Server
still owns current permission/branch checks. Publish is a saved branch snapshot,
not deployment to a CDN or device. No new worker or distribution claim.

## Designer review
Persistent Publish branch label and linked rules/aria-invalid; disabled button
and missing-choice explanation state how to recover without losing drafts.
Initial four images inspected23:08, readable/fits390px. Native dropdown obscured
some desktop text; capture now closes/defocuses it. Refined broad-run four images inspected November20 01:40, dropdown closed,
text unobscured. Mobile previous receipt below missing-state viewport, published
receipt visible. Full selected name repeated in missing-choice text.

## Security review
Real branch removed via local API then choices refreshed. Enter/captured handler
zero effects with full branch/receipt/errors kept. Empty/case/space/markup/long
unknown choices rejected. Explicit main creates one real disposable publication;
403 leaves saved list without refresh. No third-party, real account, API,
permission rule, worker, spend, registration, license or credential-scope change.

## QA review
12 new unit cases; earlier OTA refresh fixture adapted. Units actualweb95s and
build16.4s exit0/APIcached. FocusedFIRST17/0. Initial negative timed out because
removed guard reached held POST while handler awaited it. App restored, orphaned
Chrome cleaned; log retained. Retry hit stale Unix socket lock (recorded PID
confirmed defunct, no listener), removed only that stale socket/lock. Startup
incomplete logged FAIL but dependency returned0. Added suite exit-event fail-closed
guard; deliberate occupied-port startup now exit1. Changed unavailable-branch
interception to404 so guard negative completes:9PASS/8targetedFAIL exit1, restored
17/0. Guarded17/0 and capture refinement17/0. All logs retained, no first-run
negative claim. All API/sync239/native246/config/harness first-run0. All244 broad browser
suites current2951PASS/0FAIL;084 initial bind/retry retained below, all other243
first-run0,each own call,no app/fixture edits. Final units/build2/2 cached exit0,
docs4PASS,syntax/diff0. Publication awaits exact-base check. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged.

## Reversible checkpoint, November 19 23:31
All API groups, sync239, native246 on56095, config16/14/docs4/glossary3/runner4
first-run0. Each browser/native stage own call, checkpoints removed. Broad
browser001-009 of244 first-run0, no broad exceptions or app/fixture edits.
Remaining010-244, final checks, refined pixels/review closeout and publication.
Earlier focused negative timeout/startup failure chronology retained above.
No active process, credential file, lease or human blocker. Eight intended files.

## Reversible checkpoint, November 20 00:04
Broad browser010-068 first-run0, each own call. Cumulative001-068 of244 green,
no broad exceptions or app/fixture edits. Completed logs retained. Remaining
069-244, final checks, refined pixels/review closeout and publication. No active
process, credential file, lease or human blocker.

## Reversible checkpoint, November 20 00:37
Broad browser069-128 current green.084 initially failed to bind PostgreSQL55718
before assertions,0PASS/1 suite-aborted FAIL with dependency exit0. No PostgreSQL
server; socket evidence showed client55718 to API3000 TIME_WAIT. Waited45s,
unchanged same-port retry11PASS/0FAIL. Initial log retained. All other001-128
first-run0, each own call, no app/fixture edits. Remaining129-244, final checks,
refined pixels/review closeout and publication. No active process, credential
file, lease or human blocker.

## Reversible checkpoint, November 20 01:10
Broad browser129-189 first-run0, each own call. Cumulative001-189 current green,
with084 initial bind/retry chronology retained; all other188 first-run0. No app/
fixture edits. Logs retained. Remaining190-244, final checks, refined pixels/
review closeout and publication. No active process, credential file, lease or
human blocker.

## Final five-pass closeout, November 20 01:41
Developer: exact missing-choice guard/effect ordering inspected, valid publication
behavior unchanged, adapted earlier fixture still exercises refresh fencing.
Product: missing-choice warning now has an enforced block with explicit recovery,
no fallback, current permission promise or deployment claim. Designer: four
latest images inspected01:40, readable/fits390px, dropdown closed; missing name
fully repeated above select, mobile earlier receipt below viewport. Security:
negative guard9PASS/8targetedFAIL and occupied-port fail-closed exit1 establish
both behavior and harness failures; real disposable main publication persisted,
403 keeps saved metadata. QA: all staged/broad/final results and prior timeout/
stale-socket/bind exceptions retained, no uninterrupted canonical-run claim.
Eight intended files only; no real account, worker, spend, registration, license
or credential-scope change.
