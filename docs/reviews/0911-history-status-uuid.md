# Translation history/status UUID validation

## Developer
Per-key history GET/status PATCH apply existing ParseUUIDPipe to project/key
IDs. Bulk status and other remaining routes unchanged. Uncached API build and
API34/318 pass. SDK runtime unchanged.

## Product
Malformed IDs400 rather than500 for both routes. Absent valid project/key404
and unauthenticated401 retained. Existing status/history workflow14 green.

## Designer
API-only validation. No UI/screenshot/visual claim.

## Security
Auth precedes validation; malformed IDs rejected before database. Local
synthetic tokens/data only. No worker/license/spend/provider/token scope/
registry change.

## QA/integration
Baseline8 malformed project/key plain/punctuation requests returned500 and
failed intended400 assertions. SDK168 (154prior+14), two absent-valid404 and
one unauthenticated401 per route included. Status/history14, OTA117/browser26/
providers2/132/URL81/redirect100/startup3/strict relative-package types and
package runtime2 pass. Docs/diff pass. No new formats/application-browser/
whole-web/Docker/external claim.22FULL/7PARTIAL/1MISSING/defaultOFF/external
gaps unchanged. Five reviews complete before commit, no scoped issue remains.
