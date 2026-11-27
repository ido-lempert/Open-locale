# SDK version locale path encoding

## Developer
Version helper now encodeURIComponent-encodes locale as one path component.
Latest already used URLSearchParams for locale. No response shape, branch/pin
handling or normal locale behavior changes. Other SDK path arguments not
claimed audited by this slice.

## Product
A locale containing a query delimiter previously selected an unintended branch;
a fragment delimiter silently truncated the locale to an existing one. Caller
input is now treated literally and unsupported locale returns404. Valid locale
and branch/pin combinations still pass existing real integration checks.

## Designer
SDK-only routing correction, no UI/screenshot claim.

## Security
Prevents query/fragment-like locale text altering intended request scope. Does
not bypass server authorization, and no such bypass is claimed. Encoded-query
input remains literal rather than being decoded twice into a branch selector.
No token scope, worker/license/provider/spend/sharing or registry changes.

## QA/integration
Real SDK/PostgreSQL/HTTP baseline failed exactly2 new cases: branch-query locale
and fragment locale returned an existing bundle instead of rejecting. Fixed
SDK42 checks pass (38prior+4new), including literal slash and already-encoded
query. Actual OTA108 checks rerun green. JS syntax/diff/docs pass. No API/web
build or unit/browser/native/provider rerun claim. Latest checkpoint804 API34/
318 and six OTA browsers85; whole-web797315/3864.22FULL/7PARTIAL/1MISSING/defaultOFF/
external gaps unchanged. Five reviews complete before commit, no scoped issues.
