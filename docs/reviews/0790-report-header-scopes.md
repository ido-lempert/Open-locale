# Report table header relationships

## Developer
All five report tables have explicit leaf column scope. Progress grouped
headings use colgroup scope, with matching physical column groups for locale,
progress, filled values and optional workflow. Conditional workflow group
handles zero, one and multiple columns without changing report projections.

## Product
Explicit relationships across progress, quality, usage actions/actors and task
workload. No new reports, filters or counts. Loaded totals/raw downloads retained.

## Designer
Inspected desktop full page and390px focused quality screenshots. Grouped
progress labels still aligned; quality, usage and workload keep spacing/borders.
Internal scroll/focus outline visible with no document overflow. No redesign.

## Security
Semantic-only markup. No raw HTML, new data, provider, credential, worker,
license, sharing or spending change. Raw private downloads unchanged.

## QA/integration
- Report web7 suites81 tests pass.
- Actual local browser21/0: leaf/group scopes and physical colgroups, negative
missing scope detected/restored, zero/one/four workflow columns, prior spacing
negative, keyboard scroll/focus, literal own counts, filters/full raw download,
source identity and zero new reads/writes. Rerun green after adding edge cases.
- Real backend report PostgreSQL integration118 assertions passes.
- Production web build, docs4 checks/138routes, syntax/diff checks pass.
- Browser real API/PostgreSQL plus local report signal fixtures. No full-product/
native/sync/provider rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING and
external acceptance gaps unchanged.

Five review perspectives complete, no scoped issue remaining before commit.
