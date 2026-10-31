# 0132 - Explicit comparison baseline acceptance UI

## Developer pass
Load accepted baseline independently from fresh verified snapshot. Acceptance
available only after both reviewed views and explicit confirmation. Sends exact
snapshot revision/SHA/digest and stored baseline version, no bytes supplied by
browser. Busy/generation guards suppress duplicate/late scope-crossing responses.
Failure clears stale snapshot/baseline views for fresh review; records remain.
Load/edit/refresh/read/mutations/destruction invalidate viewed baseline and
confirmation. Three lifecycle tests for confirmation, failed and late acceptance.

## Product pass
Current accepted comparison bytes/version/actor/time distinct from fetched file.
Confirmation names replacement-only effect, no local import/repository write/
future apply permission. Acceptance notice explicitly not sync. Prior baseline
preserved on rejected changed remote. Config warning still says coordinates do
not accept baseline by themselves. README reflects UI. No external acceptance,
credential enrollment, two-way sync or coverage promotion claimed.

## Designer pass
Inspected actual desktop/480px screenshots. Separate snapshot and accepted
baseline headings/readonly fields, wrapped digest and actor ID, clear no-sync
copy. Confirmation/cancel, empty baseline and success/error states covered by real
browser. No document overflow. Existing config/edit/remove/read remain visible.

## Security pass
No HTML execution from stored/fetched JSON, readonly textarea value binding.
Server owns authentication, stale snapshot and baseline-version checks. Explicit
confirmation sends only reviewed references, not a caller-owned baseline body.
No persistent browser storage. Held real successful acceptance after same-component
project navigation stores only original target and cannot display bytes/message
in new scope. No automatic acceptance from read, page load or cancel.

## QA/integration pass
Sync browser64->74: initial empty baseline, confirmation/cancel/no write, exact
real acceptance/version and unchanged translations,480px fit, reload persistence,
changed remote rejection/prior baseline intact, late real acceptance navigation
and original-project-only persistence. Three unit tests web38->41/7 suites.
API244/29 unchanged; both builds/reaper4 RC0.43 integration/config legs in nine
completed fail-closed batches all individual/outerRC0; unit/build/reaper give48-leg
inventory. Native visual116+128=244 total/two repeated startups/242 unique, every
source assertion covered, both stage inner/outerRC0, checkpoint removed. Staged,
not uninterrupted. No failures/interrupted verification this slice. Services clean.
