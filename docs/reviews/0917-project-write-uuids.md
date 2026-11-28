# Project and locale write UUID validation

## Developer
Project update/delete and locale add/remove use existing ParseUUIDPipe for id.
Member/group routes unchanged. Uncached API build/API34/318 pass. SDK unchanged.

## Product
Malformed project IDs400 instead of500, absent valid404/auth401 preserved.
Original project name and locales unchanged after invalid writes.

## Designer
API-only validation, no UI/screenshot/visual claim.

## Security
Auth first, malformed IDs before service/database. Existing embed-origin session
restriction unchanged. Local synthetic data/tokens only. No worker/license/
spend/provider/token scope/registry change.

## QA/integration
Baseline8 malformed500 fail intended400 checks. SDK251 (234prior+17) includes
malformed plain/punctuation, absent404/auth401 per route and data preservation.
OTA117/browser26/providers2/132/URL81/redirect100/startup3/relative-package strict
types/package runtime2 pass. Docs/diff pass. No fresh application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external gaps
unchanged. Five reviews complete before commit, no scoped issue remaining.
