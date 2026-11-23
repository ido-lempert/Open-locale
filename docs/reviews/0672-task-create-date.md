# Validate new-task calendar dates

## Developer
New-task creation reuses the loaded-editor calendar validator. Both button state and direct Create require an empty value or a real four-digit calendar date from year 0001 through 9999. Impossible dates, year zero, timestamps and malformed strings are rejected before mutation counters, notices or pending state change. Existing date-only payloads remain unchanged; empty dates remain omitted. No backend behavior changes.

## Product
Avoids a predictable invalid date reaching the server and unnecessarily entering unknown-create recovery. Optional due dates explicitly describe midnight UTC and the date range. The local form and earlier receipt remain untouched on invalid direct Create. This is not validation of selected IDs, assignments or lock permissions, and does not strengthen server concurrency guarantees.

## Designer
Inspected actual desktop and 390px mobile screenshots. UTC/range helper text and correction status are readable and inside the panel. The native date input has an explicit accessible UTC label, linked helper, aria-invalid and native min/max bounds. Invalid programmatic dates can appear blank in the browser's native input, but correction status remains visible until corrected or cleared; local state remains available in the existing form download.

## Security
No new endpoint, destination or automatic action. The new guard executes before create state or requests change. It does not bypass server validation and does not claim to verify IDs. Existing unknown-outcome replay protection and late-result fences remain intact. HTML-like text continues to render literally.

## QA and integration
- Focused units 85/0 across new-task validation and loaded-task edit specs. Added 15 cases for invalid dates/state preservation, valid boundary years/leap day/empty payloads and correction.
- Nonoverlapping web stages: 136 files/1681 tests plus136 files/1541 tests =272 unique files/3222 tests. Staged, not uninterrupted.
- Feature browser12/0 initial and restored. Invalid programmatic calendar date blocks direct Create with zero POST/read/PATCH and no unknown pause; correction persists an actual leap-day timestamp through HTTP/PostgreSQL. Existing text, private-error and replay checks remain green.
- Negative probe removed only direct Create's calendar guard. Boundary assertion failed as intended; dependent screenshot then aborted because the invalid request changed state and removed the status. 7 earlier assertions passed. Source restored; full12/0 reran.
- All16 affected task browser suites passed191 assertions, including loaded-editor22/0 and multi-timezone date persistence. One oversized batch timed out during that suite's startup. Dead PostgreSQL zombie left a socket lock, causing two reruns to log suite-aborted failures despite exit0. These were not counted as passes. Confirmed the process was a zombie, removed only its stale test socket/lock, and reran22/0 successfully. No active processes were killed on an uncertain identity.
- Real task HTTP/PostgreSQL80/0; API/web builds, docs consistency4/138routes, script syntax and diff checks passed.
- No whole-product browser/sync/native rerun claimed.

Five review passes found no remaining issue in this change. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. The existing browser harness can return exit0 on an early PostgreSQL-startup failure, so verification also checked FAIL output and actual expected assertion counts. No spend, registration or token-scope expansion.
