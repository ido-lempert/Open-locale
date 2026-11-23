# Local task due-date order

## Developer
Optional validated loaded/due state affects only a copied visible-row array. Full parsed timestamps preserve time-of-day ordering; equal timestamps and undated/invalid values keep loaded sequence. Search composes with sorting. Dependencies and export continue using the untouched loaded array. Ordinary reads retain the choice; a project visit resets loaded order. No API change.

## Product
Default remains server order. Explicit wording limits this to loaded rows under current filters, not live deadlines or project-wide priority. Undated rows come last. Choosing an order makes no request, changes no task and clears no outcome pause or form.

## Designer
Inspected actual 1280px and390px screenshots. Native labeled selector and wrapping scope guidance fit without horizontal overflow. Rows retain UTC date labels. Regression runs exposed short pointer targets scrolling underneath the sticky header. Centered test targets before real pointer clicks; did not bypass disabled behavior or change application semantics.

## Security
No new endpoint, external destination, storage, permissions or automatic task operation. Existing server checks and stale-response/mutation guards remain unchanged. Sorting text never becomes markup.

## QA and integration
- Focused ordering/search tests8 cover timestamp precision, equal-date stability, invalid/undated order, no array mutation, search composition, form and uncertainty retention, invalid/destroyed setters and project/reset lifecycle. Exact metadata-download test also runs with due ordering selected.
- Nonoverlapping web stages136files/1702tests plus136files/1545tests =272unique files/3247tests passed. Staged, not uninterrupted.
- Enhanced search/order real-browser suite9/0. Reversed-comparator negative probe failed exactly the ordering assertion,8pass/1fail; restored9/0.
- Full affected task browser set: row-ready6, action-receipt6, action-unknown10, details22, delete11, baseline31, search9, options8, create-receipt5, create-unknown10, download11, draft-download12, local-draft17, draft-reset12, retained-options11, row-retained12. All193 assertions passed.
- Baseline initially failed the disabled-refresh pointer probe; create-unknown initially failed to click submit, then failed the mobile clear-search pointer. Screenshots and actual rendered state showed sticky-header overlap. Final probes center targets and use real pointer clicks, preserving the original checks. Temporary diagnostic/requestSubmit/native-click workarounds removed.
- Real task HTTP/PostgreSQL checks80/0, API/web builds, docs consistency, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
