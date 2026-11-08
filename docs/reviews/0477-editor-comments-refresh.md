# 0477 Refresh open comment thread

## Developer review
Explicit healthy-thread refresh uses current selected-key reader and existing
generation fencing. Guard requires current loaded key, settled healthy thread,
no pending/uncertain comment mutation or key uncertainty, not departed. Duplicate
captured calls refuse. Local translation and comment text/locale retained;
existing reader keeps present reply target and clears missing target. No API,
post/delete semantics or editor reload change.

## Product review
Read newer collaboration context without closing local comment work. Scope
explains current thread only, missing reply target clearing and no post/delete/
retry. Failed read and uncertain mutation keep separate recovery routes. No
automatic refresh or cancellation claim. Existing draft lifetime unchanged.

## Design review
Final desktop/390px pixels inspected. Visual review found squeezed mobile
comment input; wrap form at600px with full-width text input, locale/Post below.
Rebuilt/retested/recaptured final result. Refresh scope wraps and translation
input stays readable. Pointer mousedown keeps focused translation from blur
saving when refreshing. Desktop layout unchanged.

## Security review
Read-only affordance, no endpoint/storage/dependency/license/registration/spend,
worker or credential changes. Existing escaped comment rendering and guarded
mutations unchanged. Captured refresh cannot bypass pending/uncertain/key/departed
checks. Fixed failure message does not show private backend text.

## QA/integration review
14 new units/web1089 in107 suites/API265 in31/both builds0 (API cached). New
real browser initial7PASS then form-selector abort after retry sampled before
thread read settled. Fixture waits for form instead of refresh button, then11/0;
mobile design fix followed full rebuild/unit/browser11/0, then11/0 in sweep.
Actual new comment, focused pointer zero mutations, exactly one thread read,
retained local translation/text/locale/present reply, real deleted reply clears,
duplicate guard, failure/retry/uncertainty/late-close and390px full-width text.
Initial full log retained; no unit failures. All API/104 isolated browsers
first-pass0, no existing regression failures. Separate sync95+144=239unique;
native116+111+19=246total/242unique/four startup repeats, all inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed checks preserved across
continuation; staged/no uninterrupted claim. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged.
