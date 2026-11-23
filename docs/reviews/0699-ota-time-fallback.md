# Guard retained OTA publication-time display

## Developer
Publication time uses bounded formatting rather than unguarded template DatePipe.
Invalid/empty input shows Publication time unavailable and omits datetime.
Valid timestamps preserve exact medium-date plus timezone formatting. No mutation,
normalization, endpoint or bundle identity change; raw download stays original.

## Product
Unavailable metadata must not hide retained translations or imply newer content.
Existing read-only retained/publication pin/no-delivery caveats stay intact.
Refresh recovers valid metadata explicitly, no automatic repair or publishing.

## Designer
Actual desktop and390px screenshots inspected. Fallback wraps inside publication
summary, search/filter controls and retained values remain readable. No horizontal
overflow. Mobile screenshot focuses on summary/controls, not all loaded rows.

## Security
Malformed metadata cannot become datetime markup or raw fallback text. Existing
Angular escaping, bundle download scope and private-content warnings remain.
No new destination, permission, credential, worker or client-delivery behavior.

## QA and integration
- Ten new unit cases cover malformed/nonstring values and exact valid locale/
  timezone labels. Raw fallback mutation failed exactly one selected invalid-time
  test; restored before staged units136files/1805tests plus136files/1572tests,
 272unique files/3377tests green.
- New browser8/0 uses actual API publication and deliberately intercepted invalid/
  empty metadata. Checks retained values/pin, omitted invalid datetime, source JSON
  preservation, local search, refresh recovery, no writes and390px fit.
- Existing OTA bundle25/download9/value-filter11 =45/0. Web production compiled,
  API dependency valid cache. Existing initial-bundle warning persists. Docs138
  routes, syntax/diff pass. No whole-product/native/sync/client delivery acceptance.

Five review passes found no remaining issue. Coverage22 FULL/7 PARTIAL/1 MISSING,
external gaps, disabled workers and unchosen license unchanged. No spend,
registration or token-scope expansion.
