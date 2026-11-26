# OTA reset after retained read failure

## Developer
Async unit performs actual failed reload, resets local view, then successful
retry. Error persists until retry success, source values stay full and old
query/filter/page do not return. No app change.

## Product
Browser reset while data controls hidden does not imply recovery or enable
stale export. Explicit retained refresh restores first50 of51 values under
same pin; actual downloaded payload equals original retained data, not live
editor changes. No publication or client-delivery claim.

## Designer
No UI/copy/layout change or screenshot inspection claim. Existing reset,
error, first-page and raw download controls exercised.768 has inspected pixels.

## Security
Injected503 private body does not display, reset does not fetch or clear
failure, stale download blocked. Existing nonempty departed callback checks
rerun. No worker/provider/license/spend/share/credential-scope changes.

## QA/integration
OTA6 suites55 tests and value-filter browser20/0 first-attempt green, explicit
exit0. Three new failure/reset/retry browser assertions. Docs4checks138routes,
syntax/diff pass. No new build/full-web/all-backend/native/sync/provider claim.
Latest whole-web772315suites3863tests; coverage22FULL/7PARTIAL/1MISSING,
defaultOFF/external gaps unchanged. Five perspectives complete before commit,
no scoped findings remain. Test/docs-only publication.
