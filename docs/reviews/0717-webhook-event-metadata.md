# Guard loaded journal event names

## Developer
Nonempty string guard drives fixed unavailable label and safe local substring
search. Exact valid literal values retained, including outer whitespace. Empty
query retains malformed rows; nonempty query skips them. Source data unchanged.

## Product
Malformed metadata no longer interrupts filtering or masquerades as raw object
names. Fallback label is not a source event name and does not match search.
Clear restores loaded rows; download preserves original values. No send/retry.

## Designer
Actual desktop/390px screenshots inspected. Bounded event labels wrap with status,
HTTP/attempt/time metadata without horizontal overflow. Valid hostile-looking
string renders literal text. Mobile scrolled view, not all rows at once.

## Security
No coercion or untrusted markup from malformed event values. Existing Angular
literal interpolation retained for valid strings. No requests, permissions,
worker, license, registration, spend or token scope changes.

## QA and integration
-12new unit cases cover malformed/blank values, exact literal names, safe search
 and source preservation through clear.
- Removed search guard mutation failed exactly1 selected numeric case; restored
 before282unique web files/3511tests green (136/1825 +146/1686).
- New actual browser8/0: bounded names, literal markup,390px fit, guarded search,
 fallback not searchable, clear, raw download and no writes.
- Existing journal16/event-search9/clear8 =33/0.
- Web built/API cached, syntax/diff and docs4/138routes pass. Existing bundle
 warning persists. Not whole-product/native/sync/external acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged.
