# 0480 Pause unconfirmed tag edits

## Developer review
Same-key unknown tag outcome guards now cover open and save handlers as well as
visible input/toggle. Explicit recovery requires a current loaded unknown key,
healthy settled grid, no pending tag writes and not departed. Existing grid
read-only/copy/retry path preserves translation cells until explicit reload.
No API, payload, storage, normal confirmed-save or other-key tag behavior change.

## Product review
Notice previously said check server tags first while still allowing another
write. Now behavior matches warning. Review retained values does not retry,
read or discard; copy translations before explicit key reload. Successful read
can replace local values and shows current saved metadata, not confirmation of
which earlier request succeeded. Failed read stays paused. No cancellation or
exactly-once claim.

## Design review
Paused and recovery desktop/390px pixels inspected. Inline warning wraps; same
key tag toggle disabled; recovery button readable. Recovery control disabled
while any tag write pending, matching handler guard. Pointer mousedown avoids
translation blur autosave. Existing full-width retained copy and explicit retry
fit mobile. No new modal or hidden destructive step.

## Security review
Unknown result cannot trigger captured duplicate tag write. No endpoint,
dependency, license, registration, spend, worker or credential change. Fixed
error excludes backend detail. Recovery is local until explicit key read;
retained copy remains private, not saved-state or import-file evidence.

## QA/integration review
9 new units/web1127 in110 suites/API265 in31/both builds0 (API test/build cached).
New real browser9/0 initial and after control refinement. Actual committed-then-
lost PATCH, same-key/captured guards, focused recovery zero reads/writes, exact
retained text copy, failed/read success/current metadata re-enable and390px.
Sweep initial+unchanged retry6PASS then detached-node abort at second Retry keys.
Fixture could inspect previous error DOM before read settled; wait for settled
component+DOM and use DOM retry click, then9/0 twice. No app change for failure.
All API/107 isolated browsers final0. Existing QA-search twice5PASS then line44
clear-search timeout; diagnostic third run showed unchanged query/input and same
2/2 count. Fixture's unchanged-count wait could finish before formerly disabled
clear control rendered enabled. Explicit enabled-control wait then10/0, no QA
app change. Full initial/diagnostic logs retained. Older failures' causes remain
unestablished rather than retroactively inferred.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
results preserved across continuation; staged/no uninterrupted claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
