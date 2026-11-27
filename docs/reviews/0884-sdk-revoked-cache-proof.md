# SDK revoked-token cached OTA proof

## Developer
No SDK implementation change. Actual SDK test now revokes its real API token
and checks latest/version calls with exact/list/wildcard validators. Normal
workflow completes before revocation; fixture cleanup remains unchanged.

## Product
Cached validator must not turn revoked credentials into notModified success.
Confirms current behavior, not a newly fixed authorization flaw.

## Designer
SDK/API proof only, no UI/screenshot claim.

## Security
All six revoked credential combinations throw OpenLocaleError401 with OTA path,
not cached success or body. Token issued only in isolated local test database.
No real account credential changes, provider/worker/license/scope/spend/share/
registry changes.

## QA/integration
Real SDK73 checks (67prior+6new) pass. Mutation treating401 as304 causes exactly
six new failures; SDK restored and73 green. URL74/redirect100/startup3/OTA117
rerun green. Syntax/diff/docs pass. No build/unit/browser/native/provider rerun
claim. Latest817 API34/318/formats269,804 OTA browsers85, whole-web797315/3864.
22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged. Five perspectives
complete before commit, no scoped findings remain.
