# Type-safe loaded task search metadata

## Developer
Task title/description search requires strings before case folding. No source
coercion/mutation, changed due-date ordering or full loaded list replacement.
This is not validation of malformed whole task rows or status fields.

## Product
Malformed text fields cannot break filtered task list or become invented
search text. Local draft, dependencies, server filters, receipts and unknown
pause remain intact. Search never recovers or replays a mutation.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Search/order,
count and scope fit; existing unknown pause keeps download disabled. No new
unfiltered malformed-display or layout acceptance claim.

## Security
No nonstring case methods or object text coercion in search. No additional API
reads/writes, sharing, services, registrations, token scope, spend, worker or
license changes.

## QA and integration
- Full web298 suites/3,678tests (136/1,808 +162/1,870).
- Negative original unsafe search restoration fails7/7 targeted cases;
  fixed version restored before complete green full runs.
- Actual metadata8/search9/download11 browser28/0, clean exits.
- Metadata fixtures install loaded fields locally; existing search/download
  verify actual persisted tasks, unknown-write pause and explicit recovery.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
