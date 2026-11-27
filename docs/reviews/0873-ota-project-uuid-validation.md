# OTA malformed project UUID validation

## Developer
Added Nest ParseUUIDPipe to projectId on all four OTA controller endpoints:
list, publish, latest and version. Malformed IDs reject before service/storage.
Existing auth/session guards retain ordering. No service or schema change.

## Product
Closes generic500 gap documented806. Malformed OTA project identifiers now
return400; valid-but-absent project authorization behavior unchanged. SDK literal
path misuse checks strengthened back to400/404 instead of arbitrary rejection.

## Designer
API validation-only correction, no UI or screenshot claim.

## Security
Guards still run before parameter validation: unauthenticated malformed request
remains401. Wildcard cannot hide invalid identity. No authorization bypass or
SDK-wide validation claim. No worker/license/scope/provider/spend/share changes.

## QA/integration
Baseline actual PostgreSQL/HTTP exactly8 failures, two bad-ID forms across all
four routes returned500. Fixed OTA117 checks (108prior+9new) pass, SDK46 pass,
whole API34 suites318 tests pass. API compiled successfully initially but child
reaper forced cleanup and returned1; reran with NX_DAEMON=false, cached artifact
build clean0. Final HTTP and unit runs clean0. Syntax/diff/docs pass. No web/
browser/native/provider rerun claim. Latest804 OTA browsers85; whole-web797315/
3864.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five review
perspectives complete before commit; scoped findings fixed and rerun.
