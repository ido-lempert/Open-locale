# Fail-closed snapshot browser verification set

## Developer
Ten snapshot browser scripts now share explicit completion and recorded-failure guards. Unfinished execution and failures force nonzero status even when embedded PostgreSQL startup cleanup awaits an already-fired event. Normal completion retains assertion counts. Default ports stay unchanged; a test-only override enables occupied-port coverage. Metadata-fallback and restore-identity already had partial completion guards and are aligned with the full pattern, not described as previously unprotected.

## Product
Capture and restore verification must not pass when infrastructure aborts before any application assertion. This changes verification only, not snapshot contents, restore semantics, API or saved user data.

## Designer
No application pixels or interaction changes. Actual browser success paths still exercise the unchanged interface. No new UI screenshot claim for this slice.

## Security
Harness discovers local package scripts and invokes direct subprocess arguments without a shell. Test ports remain process-local. No credentials, permissions, destinations, external provider calls or workers added.

## QA and integration
- Search occupied-port probe reproduced the original misleading zero-exit defect before the fix:2pass/1fail.
- All10 unique actual occupied-port cases passed30 assertions in three nonoverlapping bounded groups. Each checks real startup abort, nonzero exit without timeout/signal and zero application PASS assertions. Optional regex filtering rejects unmatched cases; confirmed exit1.
- Removing only search exit protection reproduced exactly the nonzero-exit assertion failure:2pass/1fail; restored3/0.
- All10 changed normal browser suites passed122 assertions: metadata-fallback8, restore-identity13, restore-ready5, restore-unknown4, search7, baseline44, capture-unknown7, download11, kind12, label-validation11. No whole-product browser/sync/native rerun claimed.
- Nonoverlapping web unit stages136files/1702tests plus136files/1545tests =272unique files/3247tests passed. API/web builds reused valid cached outputs because application code is unchanged. Script syntax, docs consistency and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
