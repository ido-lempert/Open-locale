# Local webhook journal recorded-time order

## Developer
Default loaded order retained. Optional newest/oldest comparator uses full
finite string instants, unavailable last, stable equal/unavailable ties. Source
array unchanged. Refresh keeps order; visit resets; invalid/departed choice refused.

## Product
Local display only within loaded50-record journal, not a new retention or fetch
scope. Status/event filters combine. Downloads keep all source rows in loaded
order. No send/retry, receiver-processing, read freshness or delivery claim.

## Designer
Actual desktop and390px screenshots inspected. Explicit order control and scope
explain unavailable-last, ties, filters and download differences. Wrapped rows
retain readable status/time metadata without horizontal overflow. Mobile is a
scrolled view rather than whole journal at once.

## Security
No added request, payload/secret exposure, action, permission, worker, license,
registration, spend or token scope. Existing private download warning remains.

## QA and integration
- Twelve new unit cases for full instants, ties, filter combination, source order,
  scope/reset/lifecycle and unavailable variants including pre-epoch valid time.
- Reversed unavailable placement mutation failed exactly1 selected test; restored
  before276unique web files/3430tests green (136/1815 +140/1615).
- New actual local browser8/0: default/newest/oldest, filters,390px scope/fit,
  original source download order, refresh preservation and no writes.
- Initial download assertion compared JSON property order; fixed test to compare
  each source field in row order, then reran8/0. Application unchanged for fix.
- Existing journal16/download10/event-search9/status8/time7 =50/0.
- Web built/API cached, docs4/138routes, syntax/diff pass. Existing bundle warning
  persists. Not whole-product/native/sync/external delivery acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
