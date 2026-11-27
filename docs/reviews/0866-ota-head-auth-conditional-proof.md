# OTA HEAD and conditional authorization proof

## Developer
No application change. Extended real HTTP suite through implicit HEAD routing,
checking matching exact/strong/list/wildcard validators and unknown validators.
Same status, ETag, digest, private policy and empty body are checked together.
Read helper now exposes digest header for explicit denied-response assertions.

## Product
Confirmed HEAD clients can inspect cache metadata without downloading body.
New wildcard/list paths cannot hide removed membership, revoked credentials or
wrong publication pins. This proves existing behavior, not a new auth fix.

## Designer
HTTP-only verification. No UI change or new screenshot claim.

## Security
Authorization/scope checks still precede conditional processing. Tests cover
removed-member403/404, revoked-token401, wrong-pin404 with wildcard and lists.
Denied membership/token responses cannot carry prior bundle validator or any
bundle digest. No new sharing, credentials scope, worker, license or spend.

## QA/integration
Actual PostgreSQL/HTTP108 checks pass (96prior+12new). Six HEAD assertions,
two pin assertions and four removed-member/revoked-token assertions. Negative
probe temporarily disabled conditional handling only for HEAD: exactly four
new matching-HEAD assertions failed; controller restored before final build
and real HTTP green run. Tightened denied-response assertions to include absent
digest, then reran108 green. API build, docs4 checks138 routes, syntax and diff
pass. No application files changed. No new unit/whole-web/browser/native/
provider rerun claim; latest API79934 suites318 tests and whole-web797315/3864.
Acceptance ledger22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps unchanged.
Five perspectives complete before commit, no remaining scoped findings.
