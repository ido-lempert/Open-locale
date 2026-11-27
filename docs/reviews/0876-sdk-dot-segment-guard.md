# SDK named-helper dot-segment guard

## Developer
Shared pathComponent wraps encoding and rejects exact dot/parent-dot segments.
All named helper path components use it; generic request(path) stays explicit
caller control. Numeric versions keep their previous string conversion.

## Product
URL parsers normalize dot-only components even after encodeURIComponent.
Named helpers now throw local OpenLocaleError status0 rather than request a
different endpoint. Synchronous invalid-argument error, not network response.

## Designer
SDK-only validation, no UI or screenshot claim.

## Security
Six representative component positions reject before fetch. Not a full URL/
Unicode/identifier audit; server authorization remains required. Percent text
is encoded as literal input, not pre-decoded. No token/provider/worker/license/
spend/sharing/registry changes.

## QA/integration
Baseline actual SDK/HTTP six new assertions fail because fetch was called.
Fixed SDK66 checks (60prior+6new) and OTA117 pass. First fixed run aborted because
fixture assumed async rejection; changed fixture to capture synchronous invalid
argument error, then green. Syntax/diff/docs pass. No build/unit/browser/native/
provider rerun claim. Latest807 API34/318,804 OTA browsers85, whole-web797315/3864.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five reviews complete
before commit, no scoped findings remain.
