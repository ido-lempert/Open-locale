# 0125 - Reviewed sync draft UI

## Developer pass
UI uses real resolve-preview API, scoped fingerprint and explicit choices kept
in a Map across comparison pages. Selection/file/scope edits clear old draft;
preview replaces selection state. Generation guards ignore stale success/error
and finally after choice/input/navigation/destruction and overlapping requests.
Transient errors preserve choices for retry; server stale-review error clears
preview/choices. Readonly draft textarea and exact-byte JSON download; object URL
revoked. Five lifecycle unit tests include overlapping requests and destruction.

## Product pass
No import/save/push/apply. Explicit choices needed for every differing key, not
only conflicts. Labels distinguish missing selection (omit key) from empty value.
Unchanged/converged kept automatically. Choice progress counts across pages.
No accepted baseline or repository verification claimed. Draft output/digest and
warnings state nothing applied and no repository/local translation changes.
GitHub sync remains incomplete. No coverage promotion or external acceptance.

## Designer pass
Inspected real desktop,480px full page and horizontally scrolled choice column
screenshots. Initial image exposed narrow crushed key cells: minimum table/key/
select widths fixed. Draft textarea/digest wrap inside viewport; long table has
its own keyboard-focusable scroll region and instruction. Explicit key labels
on selects, disabled incomplete prepare, loading and error states. Screenshot
capture initially needed scroll-top/scroll-settle corrections, not app fixes.

## Security pass
Angular interpolation and readonly value binding, no innerHTML for file content.
Hostile file text remains literal in real browser. Only authenticated admin API
can prepare, no changes to authorization. Browser stores no new persistent data;
download only after explicit click, fixed filename. Generation checks prevent
late draft from crossing edited choices/files or project route scopes. No token,
provider setup, credential scope or outbound repository write introduced.

## QA/integration pass
Sync browser26->42 checks: real draft JSON and downloaded bytes, incomplete
one-sided choices, not-applied warning,480px fit, selection edit invalidation,
transient503 choice preservation/retry, held successful reply after choice edit,
stale review after real import409/reset, fresh choices, explicit missing omission
vs empty string, held reply after file edit, pagination choice retention. Existing
XSS, no-write, permission, scope reuse/history tests retained. Five lifecycle unit
tests: web24->29 in5->6 suites. API227/27 unchanged. Both builds/reaper4 RC0.

43 integration/config legs all individualRC0 in completed fail-closed batches;
unit/build/reaper legs give48-leg sweep inventory. Native visual first116+
second128=244 total, two repeated startup checks =242 unique, every source label
covered. Both stage inner/outerRC0, checkpoint removed. Staged not uninterrupted.

Interim verification issues: first browser pagination test clicked Previous before
Angular rendered, fixed await. Second new absent-value fixture had both sides
absent (correctly converged, no choice); fixture changed to missing-vs-remote
conflict, not app workaround. Combined regression call hit120sec during
incontext-edit; incomplete batch not counted. Retry could not start due dead
postmaster socket55468. Verified zombie owner/TCP refused, removed stale socket;
isolated incontext-edit51/RC0, all affected legs rerun in completed batches.
No assertion failures hidden. No active services retained after final verification.
