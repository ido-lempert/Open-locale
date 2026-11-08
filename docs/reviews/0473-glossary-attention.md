# 0473 Local glossary attention filters

## Developer review
All/save-unconfirmed/delete-unconfirmed intersects literal existing text search.
Only recorded row IDs decide attention; pending operations or ordinary local
text are not inferred failures. Hidden rows/uncertainties retained. Refresh keeps
filter, reused project resets, invalid/departed calls refuse. Combined JSON stays
all loaded rows. Visible-row blur guard prevents filter-removal blur from saving
hidden local edits; ordinary visible blur keeps existing autosave route.

## Product review
Find blocked rows without retrying or clearing uncertainty. Scope says recorded
in this page, not current server truth. Filtered-empty differs from actual empty.
Explicit refresh still owns recovery. Unknown save remains read-only; delete
uncertainty remains blocked. Hidden local drafts remain available on All.

## Design review
Final desktop/390px screenshots inspected: active attention button has primary
styling plus aria-pressed, controls wrap, row warnings and scope readable without
overflow. Pointerdown prevention plus hidden-row blur guard avoid filter-driven
autosave. New-term form and independent backup unchanged.

## Security review
Local filtering only, no new request/storage/dependency/license/registration,
worker/spend/credential scope. No permission, retry or server-confirmation claim.
Full local backup includes the same private rows regardless of filters, explicitly
scoped. Hidden-row blur does not introduce a new save path.

## QA/integration review
Eight units/web1050 in103 suites/API265 in31/both builds0 (API cached). New real
browser13/0 twice after fixes: actual committed-then-lost PATCH/DELETE, read-only
unknown save, intersection/filtered-empty, zero filter effects, actual full JSON
with both unknown flags despite zero visible, current recovery, reused project,
departure and390px. Initial8PASS2FAIL exposed hidden-row blur autosave plus mobile
refresh click timeout. App visible-row blur guard fixed autosave; unit guards and
actual pointer zero-write proof added. Fixture refresh DOM click fixed timeout.
Active button styling added after visual review; units/build/browser rerun after
app changes. Initial log retained.
All API/100 isolated browsers final0; no existing regression failures this slice.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuation; staged/no uninterrupted claim. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged.
