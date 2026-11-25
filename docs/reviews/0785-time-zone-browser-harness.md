# Timezone browser startup and integration checkpoint

## Developer
New harness runs six existing timezone browser scripts against a real occupied
PostgreSQL port. Requires actual bind abort, nonzero exit without signal/timeout,
and no application PASS assertions. Filter supports bounded diagnosis; empty
selection rejects. No existing browser/application code change.

## Product
Verification cannot silently pass when startup never reaches assertions. This
checkpoint also reruns accumulated web units and production lazy-route recovery;
no new user-facing capability claimed.

## Designer
Test-only, no application visual change or new screenshot acceptance claim.
Production mobile-fit and visible pending/failure recovery assertions rerun.
Prior per-feature visual acceptance remains scoped to those actual captures.

## Security
Harness-owned temporary listener and disposable child PostgreSQL fixtures.
Negative probe temporarily forces one child zero exit and restores before
publication. No external provider, registration, credential scope, spend,
worker, sharing or license changes.

## QA and integration
- Six actual occupied-port startup cases18/0. Initial selection note said seven,
 corrected after inventory: history/activity/settings/snapshot/identities/editor.
- Forced-zero-exit activity child produces exactly1 targeted harness failure;
 original child restored and18 green. Empty selected cases rejects.
- Full web311 suites/3783 tests pass in136/1693 +175/2090 bounded stages.
- Production web/API builds and real production lazy-route browser22/0, including
 held/failed actual chunk, visible feedback, retained unsaved draft, no automatic
 reload and subsequent ordinary navigation recovery.
- Docs4/138routes, syntax/diff pass. No full feature-browser/native/sync/provider
 rerun claim. Coverage22 FULL/7 PARTIAL/1 MISSING/external acceptance unchanged.

Five review passes complete, case inventory corrected.
