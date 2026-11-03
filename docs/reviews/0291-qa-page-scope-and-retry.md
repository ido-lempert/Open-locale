# 0291 - QA page scope and retry

## Developer review
QA now subscribes to reused project routes, resets locale/options and clears old
findings before every request. Request generation plus project/destroy fences
protect success/error/finally; project metadata also scoped. Removed copied unused
repository fixture from dedicated browser harness and reran. Six unit tests cover
selected-locale retry, stale success/loading/error, project metadata/result scope,
destroy/no-new-request and route unsubscribe. No API/query/schema change.

## Product review
Pending and failed checks no longer retain stale findings or imply a successful
zero count. Error-only explicit retry retains chosen locale, fixed guidance hides
private fault details. Actual browser held Hebrew read -> reused new French-project
route -> late old response cannot replace zero findings/options/editor link.
503 then actual retry click recovers selected French locale. No automatic retry
promise. QA remains current checks, not translation-quality certification.

## Designer review
Fresh480x900 failure and recovered screenshots inspected: fixed error/button/filter
fit; no stale table/count on failure. Recovered zero state readable, no document
horizontal overflow. Existing finding table wrapped in horizontal scroll container.
Pending role=status and main aria-busy distinguish loading from zero success.

## Security review
Fixed nonprivate error, same read-only endpoint/permissions; stale private findings
cannot publish after locale/project/destroy changes. No account/scope/spend/license
change. User original and todo rechecked. No network-abort/memory-erasure claim.

## QA/integration review
Web161->167/10 (new six-test suite), API265/31, reports118/sync644/browser239 green.
New dedicated real PG/Chrome QA suite6 (PG55535) adds race/failure/retry/viewport
proof, bringing integration/config unique legs43->44. All completed inner/outer0;
no test failure/timeout/interruption. Builds/reaper4/docs4/138routes0.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
not uninterrupted. No app/test edits after native; finalQA6 rerun0 afterward.
Bundle568.40kBvs500warning(previous567.17). Docker static only/no daemon claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote/baseline/accepted
sync/enabledworker changes. Existing report separate-read/window caveats unchanged.
