# 0388 - Fresh translation-memory choices

## Developer review
Each focus clears options and increments generation, including same-cell refocus.
Current callback requires generation/selected-cell/current source/empty target.
Edits (plain and plural), list read/search and destroy invalidate. Apply validates
currently offered text, same source, empty target, settled nonerror read and usable
grid, then normal save. Focus no longer keeps another cell's options while waiting.
No API/MT-provider change; plural-memory semantics and project-route reuse unchanged.
Requests finish server-side, no cancellation/idempotency/draft merge guarantee.

## Product review
Typed target cannot be silently replaced by delayed suggestion; source changes
require a new read. Loading and fixed failure/retry visible, no auto apply/retry.
Empty successful suggestions stay unobtrusive as before. Choices still capped3,
score remains memory similarity, not translation quality. Retry only reads local
project memory. Applying remains explicit and saves unverified through normal path.

## Designer review
Existing cell/RTL/score style retained. Pending status, failure alert and retry
below relevant target. Button uses click rather than mousedown-only application;
mousedown prevents blur, keyboard Enter works. Actual desktop failure/retry pixels
inspected, readable inline controls and stored-memory option, no pane clipping.
Not whole-grid mobile/accessibility audit or claim of all assistive-input support.

## Security review
Fixed error no raw backend message. Offered-text/source/empty-target checks avoid
stale/programmatic apply outside displayed selection. Plain text interpolation
unchanged. No external connection or worker enablement/spend/license/credential
change. Test held responses local disposable DB/API/browser only. Original owner's
named-repository upload evidence recovered before commit.

## QA/integration review
API265/31 web373/22 uncached/builds0, initial415.22kB below500budget.
Unit7: old success/error same-cell, target/source edit invalidation, failure/retry
clears prior options, only offered apply, direct state-change apply rejection,
reload/destroy. Browser8PASS0: same-cell response reorder/loading, current fresh
option, target typed clears, late option after typing hidden, fixed failure,
actual stored memory retry, keyboard Enter applies/persists unverified/no runtime
errors. No322 failure/timeout/interruption. Existing native mouse-click TM apply
also passes. All57 bounded integration/config legs final0 (56prior+TM browser),
config16/docs4-138routes/reaper4. Each browser/native stage isolated. SyncSTAGED
95+144239unique/nativeSTAGED116+128244total242unique inner/outer0, not canonical
uninterrupted. Checkpoints removed/no app-test edit after native. Docker static-only,
coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance limits unchanged.
