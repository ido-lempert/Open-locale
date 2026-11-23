# Edit loaded task due date

## Developer
The bound editor snapshots the original full due-date value and refuses Save if that loaded value changes. Only a different calendar day sends dueDate; untouched or reverted days omit it, preserving the original timestamp including milliseconds. Changed dates send explicit midnight UTC; empty sends null. Calendar validation rejects impossible days and year 0000. Existing title/description, generation, object-identity, pending and unknown-result guards remain in force.

## Product
Closes the existing-task due-date edit/clear gap. The calendar field is explicitly UTC, not the viewer's timezone. Stored timestamp is visible beside the conversion warning. This is a calendar-day editor, not arbitrary time editing or optimistic concurrency with newer server state. No new backend route, provider request or automatic save. Uncertain outcomes require checking server state rather than replaying edits.

## Designer
Inspected actual desktop and 390px mobile-bottom screenshots. Date input, stored timestamp, conversion/clear warning, and Save/Close controls remain readable inside the panel without overlap or horizontal input overflow. The date has a label, linked helper text, aria-invalid and a visible invalid-date status. Added minimum/maximum calendar bounds and the visible original timestamp during review.

## Security
Only the existing scoped task update endpoint is used. The payload adds only dueDate when changed; no status, assignment, dependency or lock fields. No HTML insertion, external destination or private exception text. Date changes inherit stale object/project/generation guards and unknown-write blocking. This does not claim to detect concurrent unseen server edits.

## QA and integration
- Focused units 41/0, covering untouched full timestamps, explicit UTC date, null clearing, changed originals, leap years, impossible dates, year limits, invalid direct Save, reverted dates and unknown-result retention.
- Nonoverlapping web stages: 136 files/1681 tests plus 136 files/1526 tests, totaling 272 unique files/3207 tests. Staged, not one uninterrupted run.
- Feature browser 17/0, including actual PostgreSQL/HTTP persistence and clear, unchanged non-midnight/millisecond timestamp, pending/unknown handling and desktop/mobile layout.
- Negative probe changed only new-date serialization from midnight to noon. Exactly the UTC persistence assertion failed, 16 pass/1 fail, exit 1. Restored source reran 17/0.
- All 16 affected task browser suites exited successfully, with 155 explicit PASS assertions plus the baseline task suite. No whole-product browser/sync/native rerun claimed.
- One oversized regression batch hit its execution limit during the baseline task suite. No surviving server/test processes remained; that suite and all remaining suites were rerun successfully in smaller batches. Unit stages had completed successfully before the limit.
- Real task PostgreSQL/HTTP integration checks 80/0, API/web build, docs consistency, script syntax and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps, 22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license are unchanged. No spend, registration or token-scope expansion.
