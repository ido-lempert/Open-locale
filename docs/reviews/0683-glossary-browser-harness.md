# Fail-closed glossary browser verification set

## Developer
Fifteen glossary browser scripts now share explicit completion and recorded-failure guards. Unfinished execution and failures force nonzero status even when embedded PostgreSQL startup cleanup awaits an already-fired event. Normal completion retains assertion counts. Default ports stay unchanged; a test-only override enables occupied-port checks. New-term-reset already had the full pattern and stays unchanged, with its existing named port override preserved in the harness.

## Product
Inline saves, term edits and uncertain create/delete recovery cannot be treated as verified when infrastructure fails before assertions. This changes verification only, not glossary semantics, API, local drafts or saved user data.

## Designer
No application pixels or interactions changed. Actual browser success paths still run against the unchanged interface. No new screenshot claim for this verification-only slice.

## Security
Harness discovers local package scripts and invokes direct subprocess arguments without a shell. Test ports remain process-local. No credentials, permissions, external destinations or worker changes.

## QA and integration
- Search occupied-port probe reproduced the original misleading zero-exit defect before the fix:2pass/1fail.
- All16 unique occupied-port cases passed48 assertions in five nonoverlapping bounded groups. Each checks actual startup abort, nonzero unsignalled/non-timeout exit and zero application PASS assertions. Optional regex filter rejects no matches, confirmed exit1.
- Removing only search exit protection reproduced exactly the nonzero-exit assertion failure:2pass/1fail; restored3/0.
- All15 changed normal browser suites passed185 assertions: save-unknown7, delete-confirm12, baseline38, search7, delete-local6, create-local4, create-unknown9, draft-download10, local-text11, reset-local9, new-term-draft12, new-term-download15, attention13, create-validation11, term-edit21. New-term-reset success path was not rerun because its source is unchanged; occupied-port path was checked. No whole-product browser/sync/native rerun claimed.
- Nonoverlapping staged web units136files/1702tests plus136files/1548tests =272unique files/3250tests passed. API/web builds reused valid cached outputs because application code is unchanged. Syntax, docs consistency and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
