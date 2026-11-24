# Guard loaded delivery attempt and duration metadata

## Developer
Shared nonnegative safe-integer guard drives fixed attempt/duration labels.
Zero retained, no coercion of strings/objects/arrays. No source row mutation;
download retains original metrics and all existing filters/order unchanged.

## Product
Malformed metadata does not masquerade as real counts or elapsed time. Zero
attempts remains valid for delivery rejected before request. No worker/retry,
recorded success, HTTP status or receiver-processing behavior change.

## Designer
Actual desktop/390px screenshots inspected. Attempts unavailable and Duration
unavailable wrap with readable status/event/time. Valid zero/count labels keep
existing form. No horizontal overflow; scrolled mobile shows fallback rows.

## Security
No raw arbitrary metric values reach labels. Private error/payload/signing-secret
exclusions remain. No added requests, permissions, worker, license, registration,
spend or token scope changes.

## QA and integration
-17new unit cases cover malformed/nonfinite/unsafe/fractional values and valid
 zero/common/max-safe integers.
- Zero-rejection mutation failed exactly1 selected case; restored before281unique
 web files/3499tests green (136/1825 +145/1674).
- New actual browser7/0 covers fallback rows, exact zero/count labels,390px fit,
 filter/order usability, source download preservation and explicit read-only reread.
- Existing journal16/HTTP-metadata7/download10 =33/0. Download ran on alternate
 disposable PG port to avoid prior stale socket; no application change.
- Web built/API cached, syntax/diff and docs4/138routes pass. Existing bundle
 warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
