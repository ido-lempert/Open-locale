# Fail-closed activity, history and account browser checks

## Developer
Eleven older activity/history/identity browser scripts now share explicit completion and recorded-failure guards. Unfinished execution or failures force nonzero status even when embedded PostgreSQL startup cleanup awaits an already-fired event. Default ports stay unchanged; a test-only override enables occupied-port coverage. Three newer timestamp suites already have the full pattern and remain unchanged, with their own port overrides preserved in discovery.

## Product
Read recovery, filters and account protections must not be treated as verified when startup fails before assertions. Verification-only: no activity, history, identity, password, unlink or provider behavior changes.

## Designer
No application pixels or interactions changed. Normal success paths still execute against the real local interface. No new screenshot claim for this slice.

## Security
Harness discovers local package scripts and invokes direct subprocess arguments without a shell. Port overrides remain process-local. No credentials, permissions, external destination, account change or real provider registration added.

## QA and integration
- Activity occupied-port probe reproduced misleading zero exit before the fix,2pass/1fail.
- All14 unique actual occupied-port cases passed42 assertions in four nonoverlapping bounded groups. Each checks real startup abort, nonzero unsignalled/non-timeout exit and zero application PASS assertions. Unmatched filter exits1.
- Removing only clear-filter exit protection reproduced exactly nonzero-exit assertion failure,2pass/1fail; restored3/0.
- All11 changed normal browser paths passed123 assertions: history-search7, history6, history-download10, link-configuration11, link-guards5, identity-refresh7, identity-guards7, activity-clear13, activity36, activity-download11, history-attention10. Three unchanged timestamp suites were checked on startup-abort paths, not rerun on normal paths. No whole-product browser/sync/native rerun claimed.
- Nonoverlapping staged web units136files/1722tests plus136files/1568tests =272unique files/3290tests passed. API/web builds reused valid cache because application code is unchanged. Script syntax, docs consistency138routes and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
