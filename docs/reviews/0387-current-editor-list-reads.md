# 0387 - Current editor list reads

## Developer review
List generation fences success/error/finally and destroy. Search keystrokes
invalidate immediately before debounce and clear context panes. Explicit reload
clears pending timer, captures project ID/request options, marks loading. Only
current successful response rebuilds keys/cells. Failure retains old cells, sets
fixed independent error, never raw service text. Current successful read still
replaces drafts: no save-vs-reload reconciliation or reused-project-route fix.

## Product review
Older branch/filter/search response cannot revert grid or draft cells. Previous
grid remains marked and inert until current successful read; prevents editing old
branch bytes under changed toolbar. Empty guidance only after successful settled
zero-key result. Explicit retry warns grid replacement/keep unsaved work. Review
caught inert grid blocks copying; added readonly local-value/plural-form text in
outside-grid details on failure. Not a saved-data export/import file. No automatic
retry/cancellation. Existing toolbar mutations remain available and server guarded;
this is not a whole-editor lock or transactional refresh guarantee.

## Designer review
Existing grid/style retained. Loading status/failure alert above table, retry and
copy-details affordance readable in actual desktop screenshots. Browser confirms
copy textarea readonly and outside inert grid. Failure screenshot inspected after
copy affordance added. Expanded-copy desktop pixels also inspected: fullwidth readonly textarea and
local-draft/not-saved-data explanation readable.
Existing wide-grid mobile/accessibility not audited. Inert grid not keyboard-focus
reachable during failure, selectable copy is provided outside it.

## Security review
Fixed read error cannot echo backend text. Old response cannot replace selected
request/cells; no automatic resubmit. Local retained text uses textarea value, no
HTML insertion/network/download/share. Includes local drafts deliberately and is
labeled not confirmed saved data. Existing authorization unchanged. No API/schema,
worker enablement/spend/license/credential change or external registration.
Original named-repo upload permission recovered before commit.

## QA/integration review
API265/31 web366/21 uncached/builds0. Unit6 cover old success/error, new success then
old success preserving newer cell, current failure/draft/retry, predebounce invalidation/
destroy, late destroyed rejection. Browser initial8PASS0, review adds copy affordance
and final9PASS0 inner/outer0. Actual held feature/main reads, old response after
new grid/draft, failure inert prior values/fixed error/no false empty, retry current
feature result, predebounce search invalidation, route-away late503. Browser draft
autosaves (not uncommitted proof); unit verifies in-memory retained draft. No321
failed check/timeout/interruption. API-side batches a/b ran before final copy UI
addition, independent API/tests unchanged; later web suites/build cover final app.
All56 bounded integration/config legs final0 (55prior+keys browser), config16/
docs4-138routes/reaper4. Each browser/native stage isolated. Sync STAGED95+144239unique,
native STAGED116+128244total242unique all inner/outer0, not canonical uninterrupted.
Checkpoints removed. After final native only added expanded-copy screenshot
capture to keys browser; unchanged assertions rerun9PASS0, no app change. Docker static-only,
coverage22FULL7PARTIAL1MISSING/defaultOFF and external acceptance limits unchanged.

Finalinitial413.77kB below unchanged500budget.
