# 0479 Refresh selected translation memory

## Developer review
Explicit refresh reuses the existing source/locale lookup and generation fences.
Readiness shares conservative apply preconditions without changing apply:
current unchanged source, empty clean target with known version, no target save,
review or unknown outcome, no bulk/import/key uncertainty, settled healthy
memory selection and current loaded key. Captured duplicates refuse. No API,
storage, mutation, automatic refresh or translation reload changes.

## Product review
An empty selected target can look for newer memory without refocusing elsewhere.
A settled no-match now has explicit guidance rather than disappearing silently.
Scope says current local source/locale, at most three suggestions and no apply,
save or reload. Failed reads keep separate existing retry. Refresh does not
verify translation quality, reconcile local values or change memory entries.

## Design review
Final desktop/390px pixels inspected after sweep. Button, lookup scope and
suggestion are readable; mobile target input remains full-width. Pointer
mousedown keeps target focus without blur autosave. Scope wraps within current
cell. Existing selection lifetime and keyboard apply behavior unchanged.

## Security review
Read-only affordance, no endpoint/dependency/license/registration/spend/worker
or credential changes. Existing escaped suggestion rendering and guarded apply
remain. No raw backend error displayed. Captured refresh cannot bypass pending,
stale source, unknown target/key or departed state. No browser-visible secret.

## QA/integration review
18 new units/web1118 in109 suites/API265 in31/both builds0 (API test/build
cached). New real browser10/0 first pass and10/0 in sweep: settled no-match,
actual new stored memory, focused pointer one memory-only read/zero writes,
pending/duplicate refusal, no apply, fixed error/existing retry, late target edit
fencing and390px. Units cover16 guarded states and duplicate/error handling.
No failed or aborted runs this slice. All API/106 isolated browsers first-pass0.
Separate sync95+144=239unique; native116+111+19=246total/242unique/four startup
repeats, all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed
results preserved across continuation; staged/no uninterrupted claim.
Coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.
