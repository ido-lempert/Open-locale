# 0436 Identity provider configuration read retry

## Developer review
Configuration read extracted into a lifecycle-guarded method. Initial pending
state remains; a started pending read refuses duplicates. Destroyed/busy handlers
refuse reads, and late results cannot restore state. Separate configuration error
prevents start failures from offering this read-only recovery. No API/schema change.

## Product review
A transient provider-info failure no longer requires reload. Retry checks only
configuration, never replays a password or link-start request. Successful disabled
configuration is still an unavailable provider, not a retry error. Submitted-link
and validated-link caveats remain unchanged.

## Design review
Desktop and 390px failure/retry pixels inspected: button and bounded guidance fit,
no password form on failed configuration. Pending retry replaces the button with
status. No configuration, credential setup, or production IdP acceptance claim.

## Security review
Fixed configuration error excludes raw provider failure details. Retry does not
consume password or same-tab handoff state or submit a link. Existing server
password/ownership and browser provider URL/state validations unchanged. Only local
fixtures; no real identity/provider/account configuration changes.

## QA/integration review
Four new units (nine total in this file), web773/67 API265/31 builds0. Browser11:
OIDC/SAML failure, held single GET, recovery preserving draft without POST,
start-error distinction, destroyed late read/captured retry. Normal local link
flows OIDC12/SAML55 and all API/isolated browsers final0. Initial new suite had
11PASS0FAIL but strict outer1 for forced descendant cleanup with daemon environment
omitted; no-daemon rerun inner/outer0. First native command and post-documentation docs command used nonexistent scripts
and exited1 before startup; actual package entries rerun successfully, no app fix. Sync separately
95/144=239unique; native separately116/111/19=246total242unique/four repeated checks,
all inner/outer0. No interrupted test or canonical uninterrupted claim. Final
configs16/14/docs4-138routes/reaper4 all0, checkpoints removed. Coverage
22FULL7PARTIAL1MISSING/defaultOFF unchanged. Owner upload authority and live target
checked before commit/push.
