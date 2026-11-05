# 0357 - Long snapshot label wrapping

## Developer review
Scoped snapshot-label min-width0/max-width100%/overflow-wrap:anywhere allows flex
item wrapping. No truncation, template/method/API/schema change. Fixture uses actual
200-character unbroken server label, not synthetic HTML only. No app/test edits after
native stages.

## Product review
Long labels remain complete and their named Restore action remains reachable without
horizontal scrolling. This verifies the 360px fixture, not every viewport/font/label
combination. Snapshot limit/confirmation/mutation semantics unchanged.

## Designer review
Inspected pre-fix1233px-wide overflow screenshot and fixed360x1481 full-page pixels.
Complete label wraps into multiple lines, Restore remains inside viewport, draft and
refresh retained. No ellipsis/clipping workaround or broad responsive claim.

## Security review
Text layout only; named action still includes exact label, no HTML interpretation
or authorization/concurrency change. No new account/provider/scope/disclosure/spend/
license/registration. Original owner upload recovered and live repository/push/main
checked before publication.

## QA/integration review
Discriminating pre-fix snapshotbrowser37PASS1FAIL inner/outer1: unbroken max label
exceeds360px. First edit targeted nonexistent styles.css (no edit); basic suite ran0
before actual styles.scss correction. All basics rerun after fix0; final snapshot
browser36->38 inner/outer0 includes complete text/named restore bounds/no pageoverflow
and retained draft/available actions/no runtime failure. No timeout/interruption291.
API265/31/web304/14 uncached0/builds0;49unique bounded integration/config legs final
inner/outer0 incl docs4/138routes/config16/reaper4. Each browser/native stage isolated.
Syncbrowser STAGED95+144=239unique both0/checkpointremoved, not canonical uninterrupted.
Native STAGED116+128=244total/242unique both0/checkpointremoved, not uninterrupted.
No app/test changes after verification.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no accepted
remote sync/baseline advance/worker enablement; report snapshot/window caveats remain.
Bundle586.40kBvs500warning (prior586.35kB).
