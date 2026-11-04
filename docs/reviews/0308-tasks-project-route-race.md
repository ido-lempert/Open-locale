# 0308 - Tasks project route race

## Developer review
Test-only actual browser/API route-reuse proof. Older assigned-to-me read held,
pending removes old rows, new project task loads, then older response released.
Verifies current list bytes, loading/error/empty state, back link and reset filters
remain unchanged. Existing unit fences now have real transport/DOM coverage.

## Product review
Late empty oldproject result must not hide currentproject task or suggest current
project has none. Actual old payload is empty while new payload contains distinct
title, making the race discriminating. No product/API behavior change or metadata/
mutation lifecycle claim.

## Designer review
Fresh480x900 final currentproject capture inspected: all-status/everyone controls,
existing form and current task fit, no document overflow. No UI/design change.

## Security review
Own isolated local fixtures only; original owner has authorized access to both
projects. Real response released after scope changed; no private old rows admitted.
No provider request, credentials/account scope/spend/license change.

## QA/integration review
API265/31/web198/12 uncached0/builds0. Tasksbrowser5->8 (held pending, late response,
no runtime errors); tasks80/Activity22/reports118/sync644/syncbrowser239/QA14 unchanged.
46uniqueintegration/configlegs inner/outer0; reaper4/docs4/138routes0. No failures/
timeouts/interruption. Native STAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, not uninterrupted. No app/test edits after native. Bundle574.87kB
vs500warning unchanged. Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/
1MISSING/defaultOFF unchanged; no remote/baseline advance/accepted sync/enabledworker.
Existing report snapshot/window caveats unchanged.
