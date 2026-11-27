# SDK no automatic HTTP redirects

## Developer
Both SDK fetch paths now set redirect:error, including raw export through
request(). No custom URL/network handling; default fetch rejects redirects.
Caller-supplied fetchImpl must honor fetch options, cannot be made trustworthy
by this SDK. No registry publication or dependencies added.

## Product
Configure final API URL directly, redirecting base URLs now fail instead of
following. Includes same-origin redirects deliberately, since no redirect
is required by current API contract. HTTP errors still behave as before.

## Designer
SDK transport-only correction, no UI/screenshot claim.

## Security
Real two-local-origin probe showed X-Api-Key fake test credential forwarded by
default redirect behavior. No real token/external endpoint/observed compromise.
Fixed SDK never contacts redirected target in probe. OTA digest rejection alone
was too late to prevent credential forwarding. No claim of leaked real data or
hostile incident. No scope/worker/license/provider/spend/sharing changes.

## QA/integration
Baseline5/6 failures: request/raw export silently followed, all3 paths forwarded
test header; OTA rejected only afterward on absent digest. Fixed redirect6
checks pass, target zero requests. Real SDK67/URL74/startup harness3/OTA117 green.
Syntax/diff/docs pass. No build/unit/browser/native/provider rerun claim. Latest
807 API34/318,804 OTA browsers85, whole-web797315/3864.22FULL/7PARTIAL/1MISSING/
defaultOFF/external gaps unchanged. Five perspectives complete before commit.
