# 0378 - Safe automation activity identity

## Developer review
Activity previously offered automation.run filtering but no detail summary. Adds
safe string rule name and fixed known-action labels. Own-property mapping avoids
prototype names. Top-level error or per-locale results error fields yield recorded
error; everything else is recorded run (outcome not confirmed), never success.
Malformed containers/name/action do not throw or stringify nested private objects.
Four unit cases include multiple malformed/partial inputs and error value types.
Initial Object.hasOwn compiled in tests but failed configured browser lib build;
fixed with hasOwnProperty.call rather than expanding compiler configuration.

## Product review
Existing settings link routes to project Activity; choose ran automation filter.
Existing membership/filters/refresh/pagination remain. Caveat visible for selected
automation filter or mixed feed containing run records: best-effort/not complete,
partial errors possible, no delivery/processing receipt. No raw error/notification
message exposure. Actual task effect exists in browser fixture but UI deliberately
does not infer effect completion from missing error. No complete run ledger,
per-rule stable ID filter, retry, worker, API/schema or permission expansion.

## Designer review
Inspected actual desktop1278x899 and390x844 mobile pixels. Long literal hostile
rule name wraps; rule/action/error or unconfirmed result readable; fixed caveat
and existing filters/refresh fit with no overlap/crop/horizontal overflow. Existing
activity list design reused. No new asset or hosted page.

## Security review
Plain Angular interpolation only, no HTML rendering. Known action labels rather
than arbitrary nested config, raw stored errors/messages not shown. Rule/key names
remain existing project-member-visible activity, not new audience. Existing API
and authorization unchanged. No external service, worker enablement, credentials,
spend/license choice. Original named-repo upload authority checked before push.

## QA/integration review
API265/31 web313/15 uncached, both builds0 after initial web build failure described
above (initial tests/APIbuild0; buildweb1 inner/outer1). No other failure/timeout312.
Activitybrowser28->36 actual real DB/API/browser checks final inner/outer0: actual
key trigger creates task and records invalid-assignee failure; settings link,
filtered identity/error summaries, raw-error omission/literal hostile rule text,
mobile no overflow and scoped caveat. Separate seeded partial-locale error fixture
is not claimed as actual provider failure. Prior28 browser checks retained.
All50 bounded integration/config legs final inner/outer0, including automation132,
sync-preview644, docs4/138routes, config16 and unchanged journalbrowser16. Reaper4.
Each browser/native stage isolated. Sync STAGED95+144=239unique and native STAGED
116+128=244total242unique inner/outer0, checkpointsremoved. No canonical
uninterrupted claim. No app/test edit after stages; docs/README/PLAN only.
Docker static-only; coverage22FULL/7PARTIAL/1MISSING and defaultOFF unchanged.

Final initial bundle591.78kB vs500 warning (previous590.34kB).
