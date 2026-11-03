# 0292 - QA plural row identity

## Developer review
Finding loop tracks index because one key/locale/type can emit multiple category
findings. Whole result arrays are replaced together; no row-local editing state.
No invented category parsing or API identity change. Existing scope/retry fences
unchanged. Real plural translation writes emit two placeholder mismatch findings;
both distinct category details render without duplicate tracking diagnostics.

## Product review
Plural one/other findings must both be visible, not conflated by shared type.
Browser checks actual API count plus rendered rows/details; no fabricated provider
results. Current structural checks only, not translation-quality certification.
No API/query/schema change, no coverage/defaultOFF promotion.

## Designer review
First480x900 visual showed ugly wrapping of Untranslated and key names despite
no document overflow. Fixed with readable padding/borders, minimum table width,
nonwrapping key/locale/type, contained horizontal scroll. Updated left/right
screenshots inspected: identity/badges readable on left, both category details on
right. This is a scrollable table, not all columns simultaneously visible at480.

## Security review
No new endpoints/permissions/private fields. Detail still Angular text interpolation;
no HTML interpretation or external side effects. Fixed-error and stale-scope fences
from0291 unchanged. Owner request/todo rechecked; no registration/spend/license/
credential-scope changes.

## QA/integration review
QA browser6->9: actual two-category API findings, distinct rendered details/no
NG0955, separated columns/viewport. API265/31, web167/10, reports118/sync644/
syncbrowser239 green.44 unique integration/config legs completed inner/outer0;
no test failure/timeout/interruption. Developer/designer fixes rebuilt and QA9
rerun. Builds/reaper4/docs4/138routes0. Native STAGED116+128=244total/242unique
PG55534 inner/outer0/checkpointremoved, not uninterrupted. No app/test edits after
native; finalQA9 rerun0. Bundle568.85kBvs500warning(previous568.40). Docker static
only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged;
no remote/baseline advance/accepted sync/enabled worker.
