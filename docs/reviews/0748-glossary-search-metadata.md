# Type-safe loaded glossary search metadata

## Developer
Search verifies string type before case folding term/notes/translation fields.
Valid literal matching, loaded rows and attention intersection retained. This
is not validation of malformed translation containers or whole row shapes.

## Product
Malformed field values cannot break filtered glossary or become invented
searchable text. Local drafts and unknown-save/delete IDs remain untouched;
search does not recover uncertainty or retry a write.

## Designer
Inspected actual desktop and390px filtered-empty screenshots. Attention controls,
search, match count and no-match guidance fit without page overflow. No new
unfiltered malformed-display or visual redesign acceptance claim.

## Security
No nonstring case method or object text coercion. No API effects or expanded
sharing. No new service, registration, token scope, spend, worker or license.

## QA and integration
- Full web297 suites/3,671tests (136/1,808 +161/1,863).
- Original unsafe search restoration fails7/7 targeted negative cases;
  fixed version restored before complete green full runs.
- Actual metadata10/search7/attention13 browser30/0, clean exits.
- Metadata fixtures install fields locally. Existing search/attention verify
  actual saved/local text, lost-response writes, backup and recovery behavior.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
