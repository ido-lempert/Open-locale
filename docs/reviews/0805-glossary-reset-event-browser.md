# Confirmed glossary reset callback regression

## Developer
Capture a real local-edit row before inline reset confirmation. After confirmed
reset, edit its replacement then invoke the captured input/blur callbacks.
Verify exact newer local text, review feedback and unsaved marker remain.
Temporary reference is removed. No application code changed.

## Product
Complements738 actual API-refresh boundary with explicit local reset boundary.
Old events cannot resurrect discarded text or submit the newer local draft.
Reset still uses last loaded comparison, not unread server state.

## Designer
No layout/copy changes or new screenshot claim. Existing focused reset/cancel,
confirmation, narrow viewport and departure checks remain in the browser.

## Security
Browser observes zero writes and exactly one explicit list read. Fixture setup
and separate server mutation remain outside browser request counters. No new
external provider, credentials, worker, license, spend or sharing changes.

## QA/integration
- Actual local API/PostgreSQL reset browser10/0, then intentional current-row
mutation fails exactly the new reset-lineage check (9PASS/1FAIL, exit1).
Restore rerun10/0 exit0; no app change or negative mutation retained.
- Glossary17 suites257 tests pass. Docs4 checks/138routes, syntax/diff pass.
- Test-only, no production build/new screenshot/full-product/native/sync/provider
or all-backend rerun claim. Latest whole-web736312 suites3820 tests; coverage
22 FULL/7 PARTIAL/1 MISSING/defaultOFF/external acceptance gaps unchanged.

Five review perspectives complete, no remaining scoped failure before commit.
