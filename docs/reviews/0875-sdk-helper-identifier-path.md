# SDK named helper identifier path encoding

## Developer
Encoded remaining projectId components in named SDK helpers and keyId in
translation write. Existing OTA encoding retained. Generic request(path) stays
caller-controlled by design. This is component escaping, not identifier syntax
validation or proof against every URL normalization case.

## Product
Literal identifier text containing paths/query/fragments cannot choose another
endpoint through named helper interpolation. Normal projects/keys/translation/
import/export workflows remain covered by existing integration suite.

## Designer
SDK-only routing change, no UI or screenshot claim.

## Security
Actual baseline can change existing authorized translation via malformed
identifier, not an authorization bypass. Regression checks state unchanged
when rejected. Malformed identifiers on non-OTA routes can still return generic
server500, not claimed clean4xx or server-wide validation. No worker/license/
provider/token scope/spend/sharing/registry change.

## QA/integration
Actual SDK/HTTP baseline13 failures:8 endpoint substitution cases,1 unchanged
state assertion,4 downstream bundle/integrity expectations contaminated by
wrong-scope fixture writes. Fixed fresh-database SDK60 checks pass (51prior+
9new); OTA117 rerun green. Syntax/diff/docs pass. No build/unit/browser/native/
provider rerun claim. Latest807 API34/318,804 OTA browsers85, whole-web797315/3864.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five perspectives
complete before commit, scoped findings fixed and rerun.
