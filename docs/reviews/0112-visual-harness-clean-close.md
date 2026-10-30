# 0112 - Broad visual harness clean close

## Developer pass
The prior build-wrapper fix did not rewrite the separate broad visual runner.
Its Nx serve parent termination still left descendant ownership ambiguous.
Launch its web server in an owned process group with daemon/isolation disabled,
terminate group and await close of both owned servers during finally. Add an
explicit test:visual command using the verified subreaper wrapper.

## Product pass
Test harness only, no product or coverage change. Historical visual innerRC0
and outerEXIT1 remain recorded as such. New clean-envelope claim applies only
to this rerun via the explicit wrapped command, not arbitrary legacy invocation.

## Designer pass
No UI changes. Existing broad visual flow rerun, not new feature screenshots.

## Security pass
Own child group only, no process-name kills or broad host cleanup. Subreaper
retains failure-preserving behavior. No credentials, external identity provider
request, or application data handling changed.

## QA/integration pass
Broad real browser/API/PostgreSQL visual flow reports242 PASS, zeroFAIL,
E2E_RC0 and wrapperRC0 with clean outer envelope. Same outcome must be checked
at final committed HEAD. Full existing sweep also required before push.
