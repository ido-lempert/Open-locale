# Clear all local QA filters

## Developer
One guarded action clears query and issue type only. Destroyed components reject
captured handlers; exact loaded finding objects, branch/locale, loading state
and feedback remain intact. Whitespace-only query stays clearable.

## Product
Clear all local filters restores loaded findings without running checks again,
refreshing options or changing branch/locale. Existing individual clear buttons
and full loaded findings download remain separate and unchanged.

## Designer
Inspected actual desktop and390px screenshots of filtered-empty state. Combined
clear and its explicit retained-scope guidance fit and wrap. Button disables
when neither filter is set; keyboard Enter activation verified.

## Security
No API read/write, new sharing or expanded download. Existing private-file scope
notice retained. No new services, registrations, token scopes, spend, worker or
license changes.

## QA and integration
- Focused4/0; full web292 suites/3,636tests (136/1,818 +156/1,818).
- Negative omission of type clear fails exactly1 focused test, then restored.
- Actual clear8/search10/type7 browser25/0. First new suite all-PASS run had
  process cleanup failure, excluded; complete daemon-off rerun exits cleanly.
- Production web build, cached API build, docs4/138routes, syntax/diff pass.
- Browser checks exact loaded array, zero API effects, feedback retention,
  keyboard activation, whitespace/type-only clear, departed handler and mobile.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and external acceptance gaps unchanged.

Five review passes complete, no remaining scoped issue.
