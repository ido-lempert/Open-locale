# Explicit read-only API-token list Refresh

## Developer review
Named Refresh handler reads token metadata only, preserving all drafts, reveals,
copy state and independent errors. Pending duplicates refuse. Epoch/project/
lifetime fences prevent older reads overriding later Create/revoke results or
publishing after departure. Existing full reload invalidates before token read.
No API, schema, worker or provider change.

## Product review
Explicit refresh does not create/revoke tokens, copy secrets, authenticate a
token or reload other Settings forms. Empty list is valid and keeps the reveal.
Help warns a kept reveal may belong to a token no longer in the list. Failure
retains the last snapshot with explicit retry guidance, never a saved claim.

## Design review
Linked scope help and named live status; pending button disabled. Four actual
success/failure desktop1278x899/mobile390x844 images inspected Nov18 01:40:
readable and fit; mobile section heading is above viewport and later rows below.
Only local disposable token DOM redacted same-length R after real unredacted
390px overflow assertion. Fixed fixture to set390 before that assertion.

## Security review
No raw errors or credential bytes in status/logs. Local real API/Postgres tokens
created and revoked only in isolated fixture; cleanup asserts no tokens/tasks/
webhooks/deliveries remain. Refresh never copies or changes credentials. Epoch
negative discriminates late actual revoke and Create. No live registration,
credential, spend, license or worker changes.

## QA review
Ten new units cover read-only state preservation, bounded failure/retry/empty,
duplicates, busy/destruction/project guards and late Create/revoke results.
Initial units/build RC0, actual web/APIcached. Focus FIRST13/0. After fixture
390px correction, deliberate epoch fence removal11PASS/2targetedFAIL RC1;
restored13/0 RC0. Related tokenCopy17/revoke15/pending-draft12 RC0.
A mistyped pending-suite npm name returned RC1 before any assertions; corrected
script name passes12/0, no app change. API batches current RC0 including preview644/automations132/2FA37/SAML55.
Tags FIRST occupied55436 aborted before assertions RC1; temporary port-only
copy56049 recovered9/0 RC0, removed and tracked fixture unchanged.
Sync95+144=239 FIRST RC0. Native first116/0; middle interrupted at outer120s
with partial passes and no completion receipt, not counted. Owned leftover web
stopped. Retry hit stale56048 socket before assertions RC1/2FAILURES and
removed checkpoint. Rebuild first56050 timed out on initial browser navigation
after2PASS RC1. Remaining owned interrupted Chrome groups stopped. Rebuilt
first56051 passed116/0; middle again outer120s interrupted with partial passes,
not counted; only owned leftover groups stopped. Retained private first backup.
Polled wrapper then completed original middle on56052:111/0 RC0; tail19/0 RC0.
Current native246 checks across stages includes four repeated startup checks.
No application or tracked fixture changes during retries. Configsync16/native14/
docs4/glossary-reset3/runner4 RC0. Initial wrong runner filename RC2 before
execution; correct reaped-runner-test.py passes4/0. Browser sweep in progress. Suite034 FIRST8PASS/1FAIL RC1 at destination
history assertion. Its generic form wait could match the still-mounted editor
before route departure. Temporary copy waiting for Settings token-name control
passed9/0 RC0. Promoted that destination-specific wait as fixture-only fix,
removed temporary copy; no app change. Original failure log retained.
Suite220 FIRST and unchanged retry each4PASS/1suite-abortFAIL RC1 waiting
for Hide notice after screenshot viewport reset. Diagnostic explicitly re-centers
Hide and waits two animation frames before the same native browser click:
15/0 RC0. Promoted fixture-only layout-settle fix; actual suite22015/0 RC0.
Both failed logs retained; temporary copy removed. Nine intended changed files.
224 browser suites CURRENT2624PASS/0FAIL, all current RC0. No app changes during
broad checks; two tracked fixture-only race corrections above. Final units/build RC0,2/2cached each; initial actual web runs retained.
Final five-perspective pass found no further app fixes. Four success/failure
images re-inspected04:39: readable/fit, mobile heading above and later rows below.
Final docs/syntax/diff checks follow this closeout text.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
