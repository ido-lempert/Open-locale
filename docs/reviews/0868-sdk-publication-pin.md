# SDK optional OTA publication pin

## Developer
Both latest and version helpers forward optional publicationId using existing
URLSearchParams query builder. Undefined omitted; explicit empty string kept
so a caller's invalid pin cannot silently downgrade to unpinned lookup. Added
exported OtaOptions type, preserving branch/etag compatibility.

## Product
SDK clients can use server publication identity without raw requests. Version
numbers can repeat after branch recreation, so publicationId is the identity
guard. Latest with a pin remains a latest lookup that rejects a different
publication, not a historical lookup. Legacy no-pin behavior unchanged.

## Designer
SDK-only capability, no UI change or screenshot claim.

## Security
Server remains authority for membership/branch/locale/pin. Wrong and empty pins
must404 before wildcard304. No fallback to unpinned data on errors. Digest and
304 cached-byte caveats unchanged. No secret scope/provider/worker/license/
spend/sharing changes or package registry publication.

## QA/integration
Real SDK/PostgreSQL/HTTP baseline failed exactly4 wrong/empty pin checks,
because old helpers dropped supplied pins. Fixed SDK33 checks pass (20prior+
13new): both endpoints correct-pin/body/conditional/wrong/empty plus isolated
branch and recreation old-pin rejection/new-pin reads. Actual OTA108 checks
rerun green. SDK declaration typecheck, both JS syntax checks, diff and docs
pass. No new API unit/whole-web/browser/native/provider rerun claim. Latest
API79934/318, whole-web797315/3864. Acceptance22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no scoped issues.
