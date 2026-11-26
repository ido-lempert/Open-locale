# OTA version storage-range validation

## Developer
Confirmed real HTTP requests for2147483648,-2147483649 and9007199254740993
returned500 from the PostgreSQL/Prisma version path. ParseIntPipe alone does
not bound the storage integer. Added safe-integer/signed-int32 check before
bundle lookup. Absent in-range values retain404, including both endpoints,
zero and negative values. Latest/publish paths unchanged.

## Product
Bad version input now returns400 rather than internal error. No positive-only
policy introduced: preserve existing absent-version semantics. Retained
version, branch pin, pruning and conditional download behavior rerun.

## Designer
API-only change. No UI/layout change and no new screenshot inspection claim.

## Security
Guard executes after JwtAuthGuard and before storage lookup. Fixed message
has no database details. No auth relaxation, worker enablement, license,
provider, spending, sharing or credential-scope change.

## QA/integration
New real PostgreSQL/HTTP regression reproduces3 failures on old build and
passes all8 added cases after guard. Original46 plus8 new checks =54, final
rerun green. Very long integer already returned400 before this fix; preserved.
API build and syntax/diff/docs checks pass. No web/browser/native/provider
rerun claim. Latest whole-web checkpoint772:315suites3863tests. Existing
22FULL/7PARTIAL/1MISSING and external acceptance gaps unchanged.
Five review perspectives completed before commit; no scoped findings remain.
