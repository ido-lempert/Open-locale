# Fail-closed new-task validation verification

## Developer
Applies the established completion/exit guard to the new-task validation browser fixture. Startup cleanup can await a database exit event that already fired; the synchronous exit guard keeps that incomplete run nonzero even when final cleanup is unreachable. Normal completed assertion results still determine healthy exit. Existing occupied-port regression now iterates both task fixtures with independent numeric environment overrides, rather than duplicating its runner.

## Product
Protects the creation validation evidence shipped in606 from a known false-green infrastructure path. No application behavior changes. Coverage is explicitly the two named task fixtures, not every browser suite or a repair of the database helper's cleanup behavior.

## Designer
No UI changes or new visual deliverable. Healthy actual browser runs still pass the existing desktop/mobile validation and date-editor assertions. Existing screenshots remain representative of unchanged application output.

## Security
The regression holds an OS-assigned IPv4 port while each bounded child attempts real startup. Only fixture-local port overrides change. No production setting, external destination or credential. Tests demand the actual port-conflict abort, a nonzero unsignaled result without timeout, and no application PASS assertions. Other unrelated startup failures alone cannot pass all checks.

## QA and integration
- Expanded real occupied-port harness6/0 initial and restored, covering details and creation validation.
- Negative probe removed only creation validation's exit guard. Exactly its nonzero-status assertion failed,5pass/1fail,exit1. Existing details guard remained green. Restored6/0.
- Healthy real creation-validation browser12/0 and task-details browser22/0 through HTTP/PostgreSQL. No logged FAIL assertions in either run.
- API/web build, docs consistency4/138routes, both script syntax checks and diff checks passed.
- Test-only change. No broad product browser, staged units, sync or native rerun claimed.

Five review passes found no remaining issue in the scoped change. Other fixtures may still share this cleanup weakness. Standing external-acceptance gaps,22 FULL/7 PARTIAL/1 MISSING, disabled workers and unchosen license unchanged. No spend, registration or token-scope expansion.
