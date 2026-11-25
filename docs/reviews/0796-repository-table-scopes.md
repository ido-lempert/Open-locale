# Repository review table column scopes

## Developer
Ten headings across comparison and local draft changes declare col scope. No
handlers, selections, fingerprinting, apply/recovery guards or source changes.
Empty change row retains four-column span.

## Product
Explicit relationships for read/review tables without implying completed sync,
repository writes or applied local draft. Existing not-applied wording retained.

## Designer
Inspected desktop two-table fixture and390px far-right draft table screenshots.
Headings aligned, current narrow scroll intentionally clips leading columns,
not document overflow. Review caught inconsistent unchanged fixture values;
changed to equal values and reran/re-inspected. No product logic change.

## Security
Semantic attributes only. No sync write, recovery action, provider, credential,
worker/license/spend/registration/sharing expansion. Denial flow protections
remain, zero mutations observed in browser workflow.

## QA/integration
- Repository2 suites106 tests pass.
- Actual local browser29/0 includes existing ten malformed/unknown denial pairs,
known overwrite guidance and zero writes; local component fixtures render both
review tables, ten scopes, missing-scope negative/restoration, empty change span,
and390px document fit. Rerun after fixture consistency correction green.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- Real API/PostgreSQL with denial response interception and local table signals.
Not a full sync acceptance test or remote-write/provider rerun. Latest full web
728 baseline312 suites3796 tests. Coverage22 FULL/7 PARTIAL/1 MISSING/external
acceptance gaps unchanged.

Five review perspectives complete; no remaining scoped issue before commit.
