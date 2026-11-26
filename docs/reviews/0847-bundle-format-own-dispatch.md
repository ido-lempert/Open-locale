# Bundle format dispatch accepts only configured own entries

## Developer
Normal-object format maps inherited constructor/toString/__proto__/
hasOwnProperty. Real HTTP export returned500; import returned201 with skipped
entries instead of rejecting unsupported formats. Gate both lookup sites with
Object.prototype.hasOwnProperty.call, leaving all12 configured entries intact.
Initial Object.hasOwn build attempt failed current TypeScript lib; switched
to compatible existing pattern, no compiler-target change.

## Product
Unsupported bundle formats consistently return400 rather than export failure
or misleading successful empty import. Supported formats and round-trip,
branch/grant, archive and plural behavior remain green.

## Designer
API-only, existing error shape retained, no screenshot/UI change claim.

## Security
Reject inherited property names before importer/exporter dispatch or archive
processing. No source identity/auth relaxation, no arbitrary method invocation
or pollution claim. No provider, worker, license, spending, sharing or token
scope change. Fixed regression requests use local test accounts/data.

## QA/integration
Baseline real PostgreSQL/HTTP formats suite:208 pass,8 new targeted failures
(four export500/four import201). Fixed suite216 pass. API build green after
compatibility correction; syntax/diff/docs pass. No web/browser/native/
provider rerun claim. Existing coverage22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five review perspectives complete before commit;
no scoped findings remain.
