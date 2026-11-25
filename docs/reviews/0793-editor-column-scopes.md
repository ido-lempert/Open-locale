# Editor grid column headings

## Developer
Key, dynamic locale and action headings declare col scope. Former blank heading
is Actions. Expanded metadata spans already match locale count plus two and are
asserted against actual headings. No handler/state/data changes.

## Product
Explicit heading relationships without changing translation editing, saves,
comments/history, filters, request scope or retained-draft behavior.

## Designer
Inspected desktop expanded-comment screenshot: Key/EN/HE/Actions fit and align.
Inspected390px comments: root/reply metadata and unsubmitted draft field fit.
No responsive redesign. Semantic scope does not intentionally change geometry.

## Security
No new data, API, provider, credential, worker/license/spend or sharing changes.
Existing unknown-outcome/retry protections and literal text remain unchanged.

## QA/integration
- Affected editor comment/history/key11 suites121 tests pass. Initial command
included nonexistent generic editor.component.spec.ts, failed ENOENT while ten
real suites passed. Corrected inventory and reran all eleven actual suites green.
- Actual editor metadata browser13/0: exact key/locale/action headings, missing
scope negative detected/restored, expanded-row span, timezone/fallback behavior,
retained comment draft, six metadata reads and zero writes.
- Independent actual key-read browser14/0: pending/error inert grid, handler
write guards, stale read/debounce, selectable retained draft and scoped empties.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Real API/PostgreSQL; metadata responses intercepted only for timestamp fixtures.
No full-product/native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/
1 MISSING and external acceptance gaps unchanged.

Five review perspectives complete; no remaining scoped issue before commit.
