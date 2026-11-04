# 0322 - Glossary translation-column discovery retry

## Developer review
Independent locale loading/error signals and loadLocales preserve existing visit/
destroy fences. Duplicate pending calls suppressed; new visit resets pending/error.
Retry reads only project metadata, not terms or drafts. Two units cover failure/
recovery preserving edits and pending duplicates; prior repeated-visit tests remain.
No API/schema/mutation behavior change.

## Product review
Failed discovery no longer silently hides translation columns as though none exist.
Fixed guidance says terms remain available and offers Retry translation columns.
No automatic polling/retry or forced term reload. Base-only successful project still
legitimately has no target columns, distinct from failure.

## Designer review
Independent loading/status and fixed error/retry explain missing columns. Actual
held retry proves term table stays visible. Inspected fresh480x900 recovered pixels:
retained Locale retry draft, real existing term and Hebrew field, no stale error,
no clipping. No wide-locale layout claim or redesign.

## Security review
Injected private-glossary-locales absent from page, fixed failure text. Existing
visit/destroy fence covers metadata success/error/finally; no cross-project leakage.
Local isolated fixtures only; no provider/account/scope/spend/license/audience change.
Original owner upload recovered and live remote/push checked before publication.

## QA/integration review
API265/31/web245->247/13 uncached0/builds0. Glossarybrowser19->22: rejected actual
metadataGET leaves terms available; held retry keeps draft/terms, no termGET; recovery
restores target columns.47unique integration/config legs including docs final inner/
outer0; Tasks80/Tasksbrowser23/Activity22/QA14/reports118/sync644/syncbrowser239 unchanged.
Reaper4/0/docs4/138routes0. Native STAGED116+128=244total/242unique PG55534 inner/outer0/
checkpointremoved, not uninterrupted. No app/test edits after native. Bundle580.38->581.31kBvs500warning. Docker static
only/no daemon claim. Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged; no remote
sync/baselineadvance/accepted sync/worker enablement. Existing report snapshot/window
caveats unchanged.

### Verification chronology
Automation standardPG55470 bind failed twice beforechecks/inner1/batchouter1, closed
TCP probe afterward. Temporary identical fixture changing onlyPG55541 passed132/
outer0, then removed. Later standard55470 passed132/innerouter0; no process killed.
Syncbrowser isolated first run exceeded outer120s late in report checks, incomplete.
Dead PG7792/closed55479 verified before stale socket removal; only interrupted Chrome
7913 and crashpads7920/7924 stopped. Clean isolated syncbrowser239/innerouter0. No
application/assertion failure. Final green results do not erase these attempts.
