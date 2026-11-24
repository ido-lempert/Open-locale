# Bound malformed webhook recorded-success metadata

## Developer
Label requires exact true/false rather than truthiness. Null, omitted, strings,
numbers, arrays and objects are unavailable. Existing strict filter comparisons
remain unchanged; raw loaded objects and download keep original metadata.

## Product
Prevents false outcome claims from malformed loaded records. Exact booleans remain
independent of HTTP metadata, with existing receiver-processing caveat. No new
requests, sends, retries, retention or worker behavior. Unknown records stay in
all-record view but match neither existing Succeeded nor Failed filter.

## Designer
Inspected actual desktop and390px screenshots. Bounded unavailable label readable,
rows wrap without horizontal overflow. No arbitrary metadata in status text.

## Security
Angular text interpolation and fixed fallback. No new external service, secret,
registration, token scope, worker, spend or license. Raw download remains private
local source data, without repair or disclosure.

## QA and integration
-10new units;283web files/3,521tests green in136/1,825 +147/1,696 stages.
- Truthiness mutation rejected by exactly1 selected string-false case, restored.
- New browser8/0; existing status8/journal16/clear8 =32/0.
- Initial new browser clear assertion raced render; explicit DOM-settle wait added
  then full new suite8/0. Combined run timed out after both unit stages while
  browser started; partial browser discarded and clean alternate port rerun used.
- Web compiled; initial caller detected detached child afterward. Clean reaped
  web build rerun cached/successful. API cached. Existing bundle warning remains.
- Docs4/138routes, syntax/diff pass. Not whole-product/native/sync/external
  acceptance. Coverage22 FULL/7 PARTIAL/1 MISSING and external gaps unchanged.

All five review passes complete with no remaining scoped issue.
