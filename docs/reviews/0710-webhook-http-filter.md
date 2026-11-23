# Loaded webhook HTTP status presence filter

## Developer
Local null-vs-recorded HTTP status filter independent of success flag. Combines
with event/status/time order without mutating source rows. Refresh preserves,
visit resets, invalid/departed choice refuses. Clear preserves other choices.

## Product
Unavailable HTTP status does not identify cause or receiver outcome. No-match
explains combined choices, not successful empty journal. All loaded source rows
remain in download. No extra read, send, retry or receiver-processing claim.

## Designer
Actual desktop and390px screenshots inspected. Explicit presence choices, clear
control and scope distinguish success from HTTP metadata. Controls/scope wrap
without horizontal overflow. Rows fall below screenshot viewport; not an all-row
visual claim. Download/search scope updated for new filter.

## Security
No raw private error details, payload/secret exposure, new requests, permission,
worker, license, registration, spend or token scope change.

## QA and integration
- Five new unit cases. Success-flag-proxy mutation failed exactly1 selected case,
  restored before278unique web files/3456tests green (136/1825 +142/1631).
- New actual browser10/0 covers presence/null, combined no-match, all filters/order,
  source download, clear/refresh preservation,390px fit and no writes.
- Existing journal16/download10/order8/status8/search9 =51/0. Download scope-copy
  expectation initially failed after clearer text; updated and reran10/0.
- Web built/API cached, syntax/diff and docs4/138routes pass. Existing bundle
  warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
