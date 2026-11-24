# Type-safe loaded project search metadata

## Developer
Local search checks string type before case folding name/slug/locale code.
Existing valid literal case-insensitive matching, full loaded rows and exact
source values stay unchanged. This does not validate locale arrays/row shapes.

## Product
Malformed fields cannot break project search or become invented searchable
text through coercion. Clear restores all loaded cards. New-project form,
creation receipts, security state and explicit refresh remain independent.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Search, counts,
no-match guidance and retained form/security fit without page overflow. No
new unfiltered malformed-display acceptance or visual redesign claim.

## Security
No nonstring case methods or text coercion. Search makes no API call or change
to two-factor settings. No service, registration, token scope, spend, worker
or license changes.

## QA and integration
- Full web296 suites/3,664tests (136/1,811 +160/1,853).
- Negative original unsafe search restoration fails7/7 targeted cases;
  fixed version restored before complete green full runs.
- Actual metadata9/search7/refresh5 browser21/0, clean exits.
- Metadata fixture installs source values locally. Existing search/refresh
  verify real API data. Draft/security retention and zero extra effects checked.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
