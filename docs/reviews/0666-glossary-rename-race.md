# Real database glossary rename race

## Developer
Test-only change. A private transaction locks the existing term row. An HTTP rename passes the ordinary duplicate precheck and blocks on its UPDATE. The test observes the matching PostgreSQL Lock wait before inserting a differently cased winning term, then releases the lock in finally. The database unique index forces the API fallback. Lock and observation waits are bounded; the temporary winning row is removed after assertions. No production code changed.

## Product
Proves the conflict behavior under an actual race, rather than only a duplicate known before the request. Checks the fixed 409 response and preserves existing term, notes, translations and activity. The ordinary duplicate-precheck assertion remains separate.

## Designer
No UI, layout or user-facing text changed. No screenshot or new visual acceptance is needed for this test-only slice.

## Security
The test uses isolated local PostgreSQL data and existing authenticated HTTP routes. SQL values use parameter binding. Database diagnostics stay in the test; no production endpoint exposes them. The test never disables the functional unique index. No permissions, sharing or external service changes.

## QA and integration
- Expanded real PostgreSQL/HTTP glossary suite from 21 to 25 checks. Initial run passed all 25.
- Negative probe disabled only the race-error mapper, leaving the ordinary duplicate precheck intact. The race returned 500 and exactly its new 409 assertion failed: 24 pass / 1 fail, exit 1. Production source restored, rebuilt, 25 checks passed.
- Three additional complete runs each passed 25 checks, including observed row-lock wait, raced conflict and unchanged fields/activity.
- Full API units: 32 suites / 278 tests passed from cache. Restored API build passed. Script syntax and diff checks passed. No whole-product browser, web-unit, sync or native rerun claimed for a test-only change.

Five review passes found no remaining issue. Production API behavior, coverage classification, disabled workers and external-acceptance gaps remain unchanged. No spend, registration, token-scope expansion or license choice.
