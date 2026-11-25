# Fail-closed metadata-settings guard browser verification

## Developer
Webhook toggle, OTA/SAML refresh and token-copy suites require completed
assertions and retain nonzero exit if startup cleanup stops early. Existing
caught-abort counters stay intact. Configurable PostgreSQL port supports real
harness; child Nx daemon disabled consistently.

## Product
Test-only. No toggle, metadata read, token-copy/reveal, accepted-write receipt,
draft preservation or clipboard-result fencing behavior changes.

## Designer
No application visual change. Existing desktop/mobile assertions rerun without
new screenshot acceptance claim. Harness separates startup abort, nonzero exit
and absence of application PASS assertions.

## Security
Disposable isolated fixtures and harness-owned listener only. No live account
changes or external IdP contact. Disposable tokens revoked; existing secret,
clipboard, stale-read and unrelated-effect assertions preserved. No service,
registration, token scope, spend, worker, sharing or license changes.

## QA and integration
- Real occupied-port startup harness12/0 after negative probe.
- Original webhook-toggle exit with caught-abort counter intact reproduces zero
  exit and exactly1 targeted harness failure. Fixed version restored.
- Empty harness selection rejects.
- Actual webhook11/OTA14/SAML21/token-copy17 browser63/0 clean exits.
- Cached API build, docs4/138routes, syntax and diff checks pass.
- No application build/unit rerun or whole-product/native/sync/external claim.
  Coverage22 FULL/7 PARTIAL/1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
