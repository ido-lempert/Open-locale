# Guard webhook journal recorded-time display

## Developer
Guarded time formatting replaces unbounded template DatePipe. Invalid/empty
recorded times show fixed fallback and omit datetime; valid medium plus timezone
labels preserve exact formatting. No data normalization, endpoint or status change.

## Product
Malformed timestamp metadata cannot hide delivery status rows. Read-only journal
scope and HTTP-status-vs-receiver-processing caveat remain; no retry/send action.
Original downloaded timestamp metadata remains unchanged, not repaired or verified.

## Designer
Actual desktop and390px screenshots inspected. Fixed fallback wraps in delivery
rows alongside HTTP/status/attempt metadata, both success/failure readable without
horizontal overflow. Mobile is a scrolled view, not all journal controls at once.

## Security
Malformed time cannot become raw label or datetime markup. Existing payload/error/
secret exclusion and private-metadata download warning unchanged. No credentials,
permissions, worker, external destination or receiver request added.

## QA and integration
- Ten new unit cases for malformed/nonstring values and exact valid locale/
  timezone labels. Raw fallback mutation failed exactly1 selected test, restored
  before web units136files/1805tests plus136files/1582tests,
 272unique files/3387tests green.
- New browser7/0 uses actual local database journal and deliberate malformed/empty
  response metadata. Checks both status rows, invalid datetime omission, original
  JSON values, no secrets, filters, explicit recovery, no writes and390px fit.
- Existing journal16/download10/event-search9/status8 =43/0. Web compiled, API
  dependency valid cache; docs138routes, syntax/diff pass. Existing initial bundle
  warning persists. No whole-product/native/sync/receiver-processing acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged. No spend,
registration or token-scope expansion.
