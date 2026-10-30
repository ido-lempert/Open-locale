# 0111 - Build descendant reaping

## Developer pass
Reproduced web build RC0 followed by outer cleanup EXIT1. Direct process-list
difference found an orphaned defunct esbuild child reparented to PID1 after
build ended. API build alone returned clean. Added Linux subreaper wrapper:
adopt grandchildren and wait for their exits. Preserve command exit status;
live leftovers get bounded cleanup and force failure, never green. No unrelated
process kill. Sweep Nx legs use direct installed CLI, daemon/isolation off and
wrapper. Separate runner self-check leg added.

## Product pass
Verification tooling only. No product UI, auth, sync behavior or coverage
promotion. Historical outer-envelope caveat remains true for prior runs;
new clean evidence applies only to commands actually rerun with this wrapper.

## Designer pass
No UI changes or new visual claim.

## Security pass
Linux prctl adoption scope is this wrapper's descendants. Cleanup targets only
adopted direct children under its /proc child list, never broad process names.
Command failure preserved, live leftover forces error. No credentials or new
external operations. Unsupported subreaper platform fails explicitly.

## QA/integration pass
Four subprocess checks: success0, failure7, forked orphan adoption, live leftover
forced cleanup returns1. Real web build repeated with wrapper returns both
innerRC0 and clean outerRC0, unlike preceding unwrapped run. Final sweep/test
results reported with their actual outer-envelope outcome, not assumed fixed
for every possible process tree or unrelated tool.
