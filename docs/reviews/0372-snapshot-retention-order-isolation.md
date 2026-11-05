# 0372 - Snapshot retention order and isolation

## Developer review
New isolated fixture seeds27 automatic snapshots with distinct past dates and one
older manual row. Actual import captures current pre-import state and prunes.
Assert exact newest24 seeded IDs plus one new automatic capture, oldest3 absent,
manual full row unchanged and other project's complete snapshot row array unchanged.
Existing49 assertions retained, now51. No application/schema change.

## Product review
Count25 alone could hide pruning the wrong rows. Verify identity/order, manual
preservation and project isolation independently. Seed dates avoid timestamp ties;
this does not establish a deterministic policy for equal timestamps or pruning
atomicity. Other project is same user's separate project, not a cross-user fixture.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API. Evidence is actual import plus complete persisted row checks.

## Security review
No production hook/external account/provider/scope/spend/license/audience change.
Local disposable DB fixtures. Original owner upload recovered, live repo/push/main
checked. Existing merge override55574 bind checked; unknown55464 socket not touched.

## QA/integration review
Snapshots49->51 inner/outer0, no failure/timeout306. API265/31 and web304/14 uncached,
builds0.49unique bounded integration/config legs final inner/outer0, including
snapshotbrowser44/docs4/138routes/config16/reaper4. Syncbrowser95+144=239unique STAGED
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Native55554 bind checked; each
browser/native stage isolated. No app/test edit after stages; review/PLAN only,
then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
