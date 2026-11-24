# Type-safe loaded saved-search key metadata

## Developer
Loaded key-name filtering requires a string before case folding. Empty filter
returns the original loaded array; no source coercion, repair or API changes.
This does not validate malformed whole rows or alter display of raw metadata.

## Product
Malformed loaded key fields cannot break filtering or become invented search
text. Full report still retains every loaded row, regardless of local filter.
Saved query, branch, locale and matched-value copy guards remain unchanged.

## Designer
Inspected actual desktop and390px screenshots: local filter/count, scope and
download guidance wrap without horizontal overflow. Mobile screenshot captures
the filter/download region, not the full page. No new malformed-row display claim.

## Security
No nonstring method call or object string coercion in key matching. Local-only
fixtures and real persisted browser regressions show no extra API reads/writes.
No sharing, services, registrations, spend, worker, license or token-scope change.

## QA and integration
- Full web299 suites/3,685tests (136/1,808 +163/1,877) pass.
- Unsafe original key matching fails7/7 targeted tests; fixed code restored.
- Actual metadata8/loaded-key15/clear11 browser checks pass34/0, clean exits.
- Metadata installs raw loaded fields locally; regressions use persisted keys.
- Full report preserves numeric/array keys even when local filter hides all rows.
- Production web and API builds, docs4/138routes, syntax and diff checks pass.
- Initial combined full-unit invocation timed out in second stage; only complete
  standalone second-stage rerun counted. Invalid stage-argument setup excluded.
- Not whole-product/native/sync/external acceptance. Coverage22 FULL/7 PARTIAL/
  1 MISSING and prior external acceptance gaps unchanged.

Five review passes complete with no remaining scoped issue.
