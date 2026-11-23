# Local activity recorded-time order

## Developer
Optional loaded/newest/oldest signal composes with existing metadata search.
Sorting copies rows, compares full parsed instants including offsets/subseconds,
keeps stable ties and puts unavailable values last in both directions. Unknown
order values and destroyed handlers do nothing. Refresh/pagination preserve the
view; project changes reset it. No API, cursor or mutation changes.

## Product
This helps inspect only loaded events. Guidance separates local ordering from
server scope, complete history, newer records and confirmation of action success.
JSON preserves loaded source order and raw timestamp metadata, not local sorting.
Default remains loaded order. No coverage-ledger status upgrade.

## Designer
Visually inspected actual1280px desktop and390px screenshots from the browser.
Labeled native select, local-only scope and search remain readable without
horizontal overflow. Desktop shows oldest and unavailable-last rows. Mobile
screenshot focuses on selector and guidance, not a claim that every row fits
one viewport. Existing long read-scope caveats remain scrollable.

## Security
No writes, permissions, storage or external destinations added. Sorting handles
invalid/empty timestamp values without exposing their raw content in labels.
Existing download whitelist remains unchanged. Test fixtures and interceptions
are local; no credential, worker or provider changes.

## QA and integration
- Four new unit cases cover full-instant/subsecond order, offset-equivalent stable
  ties, unavailable-last, nonmutation, invalid/destroyed handlers, search,
  pagination, refresh and project reuse. Existing download test now sets order.
- Reversing only the oldest comparator failed exactly the targeted test. Restored
  before staged web units:136files/1726tests plus136files/1568tests,
 272unique files/3294tests passed.
- New browser path passed12 assertions and exited cleanly under run-reaped.py.
  PostgreSQL-seeded IDs plus deliberately intercepted timestamp/page responses
  exercise order, search, pagination, download content, refresh, route reset,
  no writes and390px overflow. Not an all-unmocked API claim.
- Existing activity36, clear13, download11 and timestamp6 browser assertions pass.
  Oversized combined command timed out during timestamp test, not counted green;
  completed earlier suites retained and timestamp rerun passed on existing
  test-only alternate port after stale socket. No application workaround.
- Initial new browser attempts passed assertions but failed descendant cleanup;
  disabling Nx daemon in its local child environment fixed the test. Final rerun
  passed12/0 with normal cleanup. Build first compiled web successfully with API
  cache; restored final build passed with valid cache and NX_DAEMON=false.
  Existing initial-bundle warning persists:505.13kB against500kB warning budget.
- Syntax, docs consistency and diff checks pass. No whole-product browser/native/
  sync or external acceptance claim. Screenshots:activity-order-desktop.png and
  activity-order-mobile.png.

Five review passes completed with test-cleanup fix before commit. Standing
22 FULL/7 PARTIAL/1 MISSING coverage, disabled workers, unchosen license and
external-acceptance gaps unchanged. No spend, registration or token-scope change.
