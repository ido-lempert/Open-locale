# 0241 - Safe denied archived-review guidance

## Developer pass
Replace nested generic denial template with fixed value-review reason mapping.
Available review retains read-only label;known denied baseline/target/scope/value/
generation/audit/key/locale/size conditions have static descriptions. Unknown
reason remains generic,never raw provider text. No API/server behavior change.

## Product pass
Missing/current-mismatch baseline now explains separate repository-file/baseline
review before another recovery review. Existing locale value says no overwrite,
check current value. Scope mismatch asks for matching target,not a write. Other
conditions explain why unavailable without inventing an execution route. Same
snapshot/no-reservation/no-restore disclaimer stays. No auto retry,remote write,
baseline advance,sync acceptance or enabled worker.22FULL/7PARTIAL/1MISSING/default
OFF unchanged.

## Designer pass
Actual480x900 missing-baseline and existing-value screenshots inspected twice,
including final run. Full fixed notice,target path,snapshot/limits and hide control
readable inside focused region,no private value/prepare/confirm. Lower audit card
continues below viewport,no horizontal overflow visible. Fixture data only.

## Security pass
Static whitelist maps only supported reason identifiers. Unknown/raw reason text
not interpolated. Unit arbitrary private markup reason stays generic;available
review ignores reason. Actual browser baseline missing after coordinate save and
value-existing after committed/lost response verify guidance plus denied controls.
No new disclosures beyond already-authenticated reason,no new grants/API,no
negative-control claim. Server checks remain authoritative.

## QA/integration pass
Web93->98/7(+5mapping/safe fallback cases),API248/30 unchanged. Browser179 unchanged
count,two existing actual-boundary checks strengthened for specific guidance;both
initial and finalRC0.43unique integration/config legs in10completed green batches,
individual/outerRC0. Sync644,builds API/web,reaper4,docs4/138routesRC0. No failures,
startup issues,timeouts or interruptions175. Existing~555kBvs500kB web budget warning
persists,not build failure. Native STAGED116+128=244total/242unique,inner/outerRC0,
checkpoint removed,not uninterrupted. No app/test changes afterward;web98/browser
179reran,then docs only. No external exactly-once/delivery claim.
