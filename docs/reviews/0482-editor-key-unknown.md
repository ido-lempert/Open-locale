# 0482 Pause unconfirmed key creation

## Developer review
Unknown outcome guards form and captured create handler. Recovery requires
original creation branch without key filters, settled healthy grid, no create
or tag write pending and not departed. Existing local copy/retry route keeps
translation cells until explicit reload. Read captures branch/filter scope and
create epoch; only current unfiltered original-branch read outside a pending
create clears uncertainty. No API/storage/payload/normal confirmed insertion
change. Other-branch, filtered and pre-unknown reads do not clear pause.

## Product review
Notice previously required checking before retry but allowed another create.
Now creation stays paused until a relevant fresh read succeeds. Recovery does
not read/write/discard; copy local values before explicit retry. Read can replace
local translations, not the newer key-name draft. Missing key does not prove
that earlier create never happened. No cancellation/exactly-once claim.

## Design review
Final desktop/390px pixels inspected after browser sweep. Paused create button,
branch-specific warning and recovery control wrap within viewport. Existing
copy-before-retry text explains replacement. Recovery is disabled for wrong
branch/filters or already-paused grid, matching handler. Pointer mousedown avoids
translation blur autosave. New key-name input stays editable.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Unknown create cannot replay through captured handler. Only relevant current
read clears pause; fixed warning omits private backend detail. Local retained
copy is not saved-state or import-file evidence and is not shared.

## QA/integration review
16 new units/web1151 in112 suites/API265 in31/both builds0 (API test/build cached).
New real browser8/0 first pass and sweep: committed-then-lost POST/form/captured
pause, focused pointer recovery zero reads/writes, exact retained translation
copy, failed read pause and successful current original-branch unfiltered read
showing actual key without replay and retaining newer name. Units cover original
branch/filter/old-read epoch discrimination and recovery guards.
All API/109 isolated browser suites final0. Existing tasks-retained-options
initial+immediate retry preassertion0PASS PG55750 bind abort; unchanged delayed
11/0, no app/test fix, both full logs retained.
Native first initial+immediate retry preassertionPG55680 bind abort (zero checks);
unchanged delayed first116/0 then middle111/0/tail19/0, no app/test fix. All logs
retained. Separate sync95+144=239unique; native116+111+19=246total/242unique/four
startup repeats, all completed inner/outer0. Config16/14/docs4-138routes/reaper4
all0. Completed results preserved across continuation; staged/no uninterrupted
claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
