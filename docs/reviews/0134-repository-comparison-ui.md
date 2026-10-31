# 0134 - Repository comparison UI

## Developer pass
One target comparison control calls the accepted-baseline preview endpoint with
saved target revision. The shared response type includes exact remote SHA.
Fifty-row pages reset on a new comparison; starting read/edit/refresh/save/remove,
baseline reload or scope navigation clears old comparison state. Generation
checks suppress late results, errors and busy resets. Duplicate requests guarded.
Finding fixed: a broad template insertion initially duplicated the compare control
inside baseline view. Removed the duplicate, then reran browser/lifecycle checks.

## Product pass
Accepted baseline, stored local values and fresh verified remote values have
separate columns. Missing and empty values differ, manual rows remain explicit.
No apply/import/push/save control, baseline advancement or sync completion claim.
Missing baseline error directs explicit acceptance. Repository bytes can change;
recompare obtains fresh bytes. Real provider acceptance and sync apply remain open.
Coverage remains 22 FULL / 7 PARTIAL / 1 MISSING, no promotion.

## Designer pass
Inspected actual desktop and 480px screenshots of real API-driven comparison.
Forms, notices, SHA and controls fit; table scroll is internal with keyboard focus
and a horizontal-scroll hint. Manual rows have text plus tint, not color alone.
Angular text interpolation renders hostile strings literally. Fifty-row pages
avoid rendering the entire bounded response. No new external design dependency.

## Security pass
No new API route or privilege. Session-admin endpoint retains scoped deployment
reader, post-I/O target/baseline checks, no-store and no effects. UI never collects
credentials or sends caller baseline/local/remote values. Failed refresh cannot
leave old comparison visible; late scope result cannot expose old-project data.
Existing read/acceptance/write restrictions remain intact. No external accounts,
expanded credentials, spending or license choice during implementation.

## QA/integration pass
Real PG/API/browser checks74->83: accepted/local/fresh remote columns, manual
conflict, missing/empty, hostile-string inertness, narrow overflow/scroll,50-row
pagination, missing baseline and held transport success after reused-route
navigation. Unit web41->44/7: failure invalidation, late destroy/navigation,
duplicate guard/edit/baseline reload. API244/29 unchanged; builds/reaper4 RC0.
All43 integration/config legs passed, sync133 retained, browser83. Initial browser
run timed out after74 passes at duplicated compare controls; fixed template and
waited on actual held transport, clean reruns83. One sweep batch was host-killed
at120sec after2FA/OIDC passed while SAML started; retry failed closed with zero
checks due dead interrupted postmaster socket. Verified defunct PID/closed port,
removed only dead socket/lock, SAML55 rerun RC0. Remaining legs bounded smaller.
Native visual116+128=244/two repeated startups/242 unique, both inner/outerRC0,
every source assertion covered; checkpoint removed. Staged, not uninterrupted.
