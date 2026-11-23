# Local snapshot capture-time order

## Developer
Validated loaded/newest/oldest state affects only a copied visible-row array. Comparison uses full parsed capture timestamps, stable ties and unavailable times last in both directions. Original snapshot references and inventory array are unchanged. Label/kind filters compose with order. Current rereads retain order; project visits reset it; destroyed/invalid setters do nothing. No API change.

## Product
Loaded order remains default. Scope guidance makes clear that this is neither newer history nor a restore operation. Sorting cannot clear capture/restore uncertainty, modify capture draft or select a different restore identity. Downloads continue exporting complete loaded inventory in loaded order.

## Designer
Inspected actual1280px and390px screenshots. Native labeled selector, wrapping explanation and existing snapshot rows fit without horizontal overflow. Capture timestamps displayed at minute resolution may look equal; full loaded timestamps remain available in the existing identity disclosure, and guidance states full stored timestamp ordering.

## Security
No new endpoint, storage, external destination or automatic capture/restore. No identity or permission inference. Existing restore object-identity and mutation fences remain intact. No HTML insertion.

## QA and integration
- Focused search/order/download tests18/0 cover timestamp precision, stable ties, invalid/empty times last both ways, no loaded-array mutation, label/kind composition, form/receipt/uncertainty retention, invalid/destroyed setters and refresh/project lifecycle. Inventory whitelist assertion also runs with order selected.
- Nonoverlapping web unit stages136files/1702tests plus136files/1548tests =272unique files/3250tests passed. Staged, not uninterrupted.
- Enhanced real search/order browser11/0. Reversed comparator failed exactly the two direction checks,9pass/2fail. Restored11/0.
- Other affected snapshot browser suites: metadata-fallback8, restore-identity13, restore-ready5, restore-unknown4, baseline44, capture-unknown7, download11, kind12, label-validation11. Together126 affected browser assertions passed.
- Initial oversized regression batch hit outer time limit during baseline startup. No remaining processes; reran completed suites in bounded groups to capture exit status. Baseline default-port retry failed on the interrupted process stale socket lock before assertions; existing test-only alternate port then passed44/0. No application/test workaround or success claim for the interrupted run.
- Real snapshot HTTP/PostgreSQL checks61/0, API/web builds, docs consistency138routes, script syntax and diff checks passed. No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
