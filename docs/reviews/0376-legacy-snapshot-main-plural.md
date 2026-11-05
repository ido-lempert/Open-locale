# 0376 - Legacy snapshot main-branch and plural compatibility

## Developer review
Stored pre-branch JSON omits key/translation branch and translation pluralForms.
Real API writes create same-named main/feature keys; main has live plural forms.
Restore must retain main ID, recover metadata/value/status, remove feature key,
and preserve existing main forms. Explicit fixture omission assertions. Prior58
retained, now61. Test-only/no application or schema change.

## Product review
Verify existing legacy fallback after tuple identity fix. Omitted pluralForms means
preserve surviving live row, not invent missing forms for recreated translations.
No all-legacy-format/malformed-payload compatibility claim.

## Designer review
No UI/visual change or new screenshot claim. Existing snapshotbrowser44 passed
against rebuilt API; evidence is actual HTTP restore and persisted translation.

## Security review
Local disposable fixture only, no production hook/external account/provider/scope/
spend/license/audience change. Original upload recovered, live repo/push/main checked.
Merge55574 checked available to avoid303 stale55464 socket.

## QA/integration review
Snapshots58->61 inner/outer0, no failure/timeout310. API265/31 and web304/14 uncached,
builds0.49unique bounded integration/config legs final inner/outer0, including
snapshotbrowser44/docs4/138routes/config16/reaper4. Syncbrowser95+144=239unique STAGED
both0/checkpointremoved, not canonical uninterrupted. Native116+128=244total242unique
STAGED both0/checkpointremoved, not uninterrupted. Native55554 bind checked; each
browser/native stage isolated. No app/test edit after stages; review/PLAN only,
then final docs rerun0.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
