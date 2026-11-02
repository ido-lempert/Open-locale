# 0217 - Recovery composition under actual PostgreSQL contention

## Developer pass
No app change. Real transaction tests cover both entry-scope copies,project/target/
baseline locking and composed race outcomes. Initial test parse error reused an
existing scopeReady identifier;new block scope fixed it before any test ran.

## Product pass
Composed recovery remains isolated,not a public restoration feature. No production
caller/UI,worker enablement,remote write or baseline advance. Direct team admin
restriction retained. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI change. Current480x900 focused archived-review screenshot inspected:full first
card,blue outline,escaped markup/readableUTC/no-reservation/no-restore notice and
hide/check controls,no overflow. Second card continues below viewport. Local fixture.

## Security pass
Actual pg_stat_activity Lock wait observed before caller mutates both recovery and
repository scopes. Original row/actor/target/revision/branch/locale persist and
rollback leaves counts unchanged. Negative control removing both entry copies:
521pass/1expectedfail on scope retention. Restored exact source:522passRC0.
Actual project/target/baseline blockers hit55P03 without partial writes,then recovery
succeeds after release. Per-lock2s is not total operation deadline. Two composed
recoveries actually contend:stale loser fails40001/P2034 and only one row/history/
activity/intent commits,absence marker removed. No secret or external state changes.

## QA/integration pass
Sync512->522(+10). Corrected and final522RC0. All43unique integration/config legs
passed. Final completed all-green batches cover41;sync/browser standalone512->522/
151RC0. API248/30,web74/7,both builds,reaper4RC0,migration22,automation132,webhook45,
136routes. Two oversized shell calls hit120s;partial batches not green outer runs.
Interrupted OIDC left dead postmaster socket,confirmed dead and cleaned,rerun55RC0.
Other affected final suites rerun with narrower calls and complete outerRC0.
Native staged116+128=244total/242unique,all literal labels covered,inner/outerRC0,
checkpoint removed. Staged,not uninterrupted. App source after negative-control
restoration equals150;only tests/docs changed. No production/external acceptance.
