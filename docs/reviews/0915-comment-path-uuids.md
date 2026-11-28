# Comment path UUID validation

## Developer
Comment list/add/delete validate projectId/keyId; delete also commentId using
existing ParseUUIDPipe. Screenshot routes unchanged. Uncached API build and
API34/318 pass, SDK unchanged.

## Product
Malformed path IDs400 rather than500. Absent valid project/key/comment404 and
auth401 retained. Original comment stays alone after invalid writes.

## Designer
API-only change, no UI/screenshot/visual claim.

## Security
Auth first, invalid IDs before database access. Local synthetic data/tokens
only. No worker/license/spend/provider/token scope/registry change.

## QA/integration
Baseline8 malformed path requests500 failed intended400 assertions. SDK234
(215prior+19), comments33, OTA117/browser26/providers2/132/URL81/redirect100/
startup3/strict relative-package types/package runtime2 pass. New cases include
per-route absent project/key404/auth401, malformed/absent comment ID and original
comment preservation. Docs/diff pass. No fresh formats/application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five perspectives complete before commit, no scoped issue remains.
