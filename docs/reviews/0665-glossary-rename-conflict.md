# Friendly glossary rename conflicts

## Developer
Reviewed project authorization, exact term lookup, trimmed term validation and the excluding-self, project-scoped case-insensitive duplicate query. Existing functional database uniqueness remains the race boundary. The fallback matches the exact P2002 metadata observed against the real database: GlossaryTerm with target projectId and lower(term). It catches only the term update, not activity or transaction completion. Other error codes, models, targets and non-Prisma failures are rethrown. Create behavior, translations-only updates, schema and routes are unchanged.

## Product
Duplicate renames return the same fixed 409 message as duplicate creation rather than a generic 500. Self/case-only renames work, and another project's term does not block a rename. Failed renames do not change notes, translations or activity. The existing browser keeps conservative unconfirmed-write handling; this slice does not add automatic replay or claim a conflict-specific UI. Corrected review0664: uniqueness was already enforced by the database index, while friendly update-error handling was missing.

## Designer
No UI or layout changes. The existing glossary editor and recovery text remain unchanged. The real editor browser suite passed with focused translation text preserved. No new visual acceptance is claimed for this backend-only slice.

## Security
Authority is checked before term or duplicate lookup. Duplicate query includes project scope and excludes only the authorized current term. Fixed conflict text does not expose a term ID, private exception, constraint or another project's term. Activity errors and unrelated database errors are not relabeled as user conflicts. Database uniqueness and transactional rollback stay in place. No new sharing, credential handling, external service, worker or permission scope.

## QA and integration
- Focused service unit tests: 13 passed. They cover scoped query shape, duplicate refusal before write/activity, translations-only bypass, precise race mapping, unrelated/null errors, authority-first behavior and an activity error during a rename.
- Full API units: 32 suites / 278 tests passed, confirmed after probe restoration.
- Real PostgreSQL/HTTP glossary suite expanded from 15 to 21 passing checks: fixed duplicate-rename 409, unchanged term/notes/translations and activity on rejection, trimmed case-only self rename, cross-project allowance and cross-team denial.
- Negative probe disabled both the precheck refusal and race mapping. The real API returned 500 and exactly the targeted 409 assertion failed: 20 pass / 1 fail, exit 1. Source restored, API rebuilt and all 21 checks passed. First probe setup failed TypeScript compilation because a constant false branch prevented narrowing; it was restored and is not counted as the negative-test result.
- All 16 affected glossary browser suites passed, 190 checks total, including the 14-check term editor suite. They ran separately with the restored API. No whole-product browser, web-unit, sync or native-stage rerun is claimed for this backend-only slice.
- Final API/web build passed. Docs consistency passed 4 checks across 138 routes. Script syntax and diff checks passed.

No external-service acceptance is promoted by these local checks. Docker runtime, external delivery/CDN/provider/IdP and production-automation gaps remain. Accepted GitHub two-way remote write/baseline advance remains missing. No worker enablement, spend, registration, token-scope expansion or license choice. Coverage classification remains 22 FULL / 7 PARTIAL / 1 MISSING.
