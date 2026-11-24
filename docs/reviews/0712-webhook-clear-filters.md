# Clear combined webhook journal filters

## Developer
One guarded local handler resets three filters only. Time order, source rows,
project/webhook scope and download feedback remain. Whitespace input is clearable.
Captured departed handler refuses. Loading/error state unchanged.

## Product
Makes an empty combined intersection recoverable without three separate clears.
No refresh, download, send/retry, receiver-processing or freshness claim. A failed
read stays failed rather than becoming successful empty state.

## Designer
Actual desktop/390px screenshots inspected. Explicit Clear all filters button,
disabled when choices empty, adjacent scope names what stays. Ordered rows and
control/read-only scope wrap without horizontal overflow. Scrolled mobile view.

## Security
No new requests, private metadata disclosure, action, permission, worker, license,
registration, spend or token scope change. Existing download warning retained.

## QA and integration
- Four new unit cases cover exact filter reset, preserved order/data/feedback,
  whitespace, failed/loading state and destruction fence.
- Omitted HTTP clear mutation failed exactly1 selected case; restored before
  279unique web files/3460tests green (136/1825 +143/1635).
- New actual browser8/0: empty intersection, full list recovery without reads,
  retained order,390px fit, whitespace, failed read and explicit retry.
- Existing HTTP10/download10/order8/event-search9 =37/0.
- Web built/API cached, syntax/diff and docs4/138routes pass. Existing bundle
  warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
