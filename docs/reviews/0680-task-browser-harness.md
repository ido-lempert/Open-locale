# Fail-closed task browser verification set

## Developer
Fifteen remaining task browser scripts now have the existing details/creation-validation completion guard. Unfinished execution and recorded failures force nonzero status at process exit, even if embedded PostgreSQL startup cleanup awaits an already-fired event. Normal completion still exits from the assertion count. Exceptions increment failures. Default ports stay unchanged; one test-only port override enables real occupied-port checks. Final consistency inspection found deletion used an older final-exit expression; aligned it and reran its occupied-port and success paths.

## Product
This closes a verification gap, not a new product capability. Successful task feature checks are distinct from failed infrastructure startup. No API, application UI, saved user data, worker or delivery behavior changes.

## Designer
No application pixels or interactions changed. Existing browser success paths still execute against the actual interface. No new screenshot claim is needed for this verification-only slice.

## Security
Port injection remains process-local test configuration. The harness uses direct subprocess arguments, never a shell command. Automatic discovery reads local package scripts only and excludes the separately listed details case. No credentials, permissions, external requests or destinations added.

## QA and integration
- Expanded real occupied-port regression discovers the remaining task browser scripts from package.json, plus explicit details and creation-validation entries. Seventeen unique cases,51 assertions passed in four nonoverlapping bounded groups. Each asserts actual startup abort, nonzero unsignalled/non-timeout exit and no application PASS assertions.
- Before the guard, the initial combined probe reproduced misleading zero exits in nine newly selected suites, then hit the outer command budget before the remaining cases. No test processes remained. Subsequent coverage used bounded groups. Did not claim that interrupted run completed.
- Removing only the search suite exit guard/final explicit result reproduced exactly the nonzero-exit assertion failure:2pass/1fail. Restored3/0. An unmatched harness filter exits1 rather than succeeding with zero cases.
- All15 changed normal browser success paths passed,171 assertions: row-ready6, action-receipt6, action-unknown10, deletion11, baseline31, search9, options8, create-receipt5, create-unknown10, download11, draft-download12, local-draft17, reset12, retained-options11, row-retained12. No whole-product browser/sync/native rerun claimed.
- Nonoverlapping staged web units136files/1702tests plus136files/1545tests =272unique files/3247tests passed. API/web builds reused valid cached outputs because application code is unchanged. Syntax, docs consistency and diff checks passed.

Five review passes found no remaining issue. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
