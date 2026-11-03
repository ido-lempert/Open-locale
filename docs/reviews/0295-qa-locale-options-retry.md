# 0295 - QA locale options retry

## Developer review
Extracted independent project-metadata loader with own request generation plus
project/destroy fences. Retry does not rerun checks, clear findings or change
selected locale. Three units cover failure/recovery preservation and stale success/
loading/error fences. Existing project/destroy guards retained. No API/query/schema
change. Browser review found request counter removed with interception before retry;
separate counter now stays attached through retry, reran assertions green.

## Product review
Locale metadata failure is no longer silent all-locales-only UI. Fixed notice,
explicit retry and independent loading status preserve successful QA findings.
Actual metadata503/retry restores Hebrew option with table text unchanged and one
actual QA request across initial read/retry. No automatic retry guarantee.

## Designer review
Fresh480x900 fullpage inspected: metadata failure notice/retry/filter above retained
findings readable, no changed-copy clipping. Existing table scroll owns horizontal
overflow; all columns not simultaneously visible at480. Selector aria-busy and
separate status avoid implying check loading depends on locale discovery.

## Security review
Metadata error fixed/nonprivate; existing read-only project endpoint/permissions.
Separate same-project generation fences success/error/finally; no private raw
metadata faults displayed. No account/scope/spend/license changes. Owner request
and todo rechecked. No network-abort or memory-erasure claim.

## QA/integration review
Web173->176/11 (three units), API265/31/reports118/sync644/syncbrowser239/activity8
unchanged. QAbrowser9->11 adds metadata failure and retry/no-extra-QA-read proof.
45uniqueintegration/config legs completed inner/outer0; no failures/timeouts/
interruption. Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/
242unique PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test
edits after native; finalQA11 rerun0. Bundle571.25kBvs500warning(previous570.37).
Docker static only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF
unchanged; no remote/baseline advance/accepted sync/enabledworker. Structural QA
not translation certification; existing report snapshot/window caveats unchanged.
