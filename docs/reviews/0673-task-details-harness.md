# Fail-closed task-details browser verification

## Developer
Confirmed the installed database helper's startup rejects after a child close, then stop registers an exit handler for that already exited process. This can leave cleanup awaiting forever with an empty event loop, bypassing the final explicit exit. A completion flag and synchronous exit guard, following the existing glossary-reset harness pattern, now preserve failure in that path. Normal complete runs still explicitly exit from their assertion results. The database port override is confined to this test fixture.

## Product
Prevents infrastructure aborts being mistaken for a verified task feature. Does not change application behavior, database schema or test expectations. It is not a global fix for other browser harnesses and does not claim to repair the database helper's cleanup behavior.

## Designer
No UI or visual output changes. Verified the healthy actual browser suite still completes all22 assertions, including desktop/mobile input fit and date rendering. No new screenshot deliverable is needed for this test-only change.

## Security
The fault test binds an OS-assigned IPv4 port and passes that numeric port to its own child test. No external request, credential or production setting. Child has a bounded30-second timeout and runs inside the existing process-reaping wrapper. Assertions require a real startup abort, no application PASS lines, and a nonzero status without timeout or signal; arbitrary child failure cannot satisfy the whole test.

## QA and integration
- New occupied-port harness3/0 initial and restored. Real PostgreSQL startup fails on its occupied port and returns nonzero without timeout/signal; no application assertions are counted.
- Negative probe removed only the synchronous exit guard. Exactly the nonzero-status assertion failed,2pass/1fail,exit1, proving the prior misleading zero exit is detected. Source restored and3/0 reran.
- Healthy real task-details browser22/0 with actual HTTP/PostgreSQL, including date/save/clear/unknown outcomes and multi-timezone display.
- Existing glossary-reset occupied-port harness3/0, confirming the established pattern remains green.
- Script syntax, API/web build, docs consistency4/138routes and diff checks passed.
- No application code changed. No staged unit or broad task/product browser/sync/native rerun claimed for this harness-only change.

Five review passes found no remaining issue in this scoped fix. Other browser harnesses may still have the same cleanup weakness; this change covers only task-details. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
