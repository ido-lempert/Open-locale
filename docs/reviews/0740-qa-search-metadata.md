# Type-safe loaded QA search fields

## Developer
Local QA search checks string type before case folding key/locale/detail fields.
No string coercion, source mutation, altered exact type intersection or loaded
scope change. Other valid fields on the same finding remain searchable.

## Product
One malformed source field cannot break all filtered findings. Numbers, objects,
booleans and arrays do not become searchable invented text. Clear restores the
same loaded set. Full loaded findings download preserves raw metadata unchanged.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Existing count,
search, clear and guidance remain readable without horizontal overflow. No
new application visual layout or unfiltered malformed-rendering claim.

## Security
Search never invokes nonstring case methods or object text coercion. Literal
markup-looking strings remain escaped text. No new retrieval, sharing, services,
registration, token scope, spend, worker or license changes.

## QA and integration
- Full web293 suites/3,643tests (136/1,816 +157/1,827).
- Negative original unsafe search restoration fails all7 targeted tests;
  fixed version restored before complete green full runs.
- Actual metadata9/search10/clear8 browser27/0. First metadata all-PASS run had
  cleanup failure, excluded; complete clean rerun passed.
- Metadata fixture covers nonstring fields, valid key/detail matches, no coercion,
  raw download preservation, clear, mobile, zero added reads/writes and runtime.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
