# 0490 Safe focused comment pane toggle

## Developer review
Current loaded key, healthy grid, no pending/unknown same-key deletion and not
departed required by UI and captured toggle. Pointer mousedown preserves local
translation focus. Closing still invalidates comment generation and clears pane,
including pending reads. Existing draft/locale reset-on-open and post/delete/
mutation-continuation behavior unchanged. No API/storage change.

## Product review
Opening/closing comments previously blurred a focused translation and autosaved
its local draft. Open now reads only current thread; close makes no request.
Local translations remain untouched. Not a comment-draft retention change:
opening still starts the existing empty draft/scope. No post/delete/replay.

## Design review
Actual final desktop/390px pixels inspected. Retained translation/local-draft
notice, stored comment, scope, reply/delete and full-width new-comment input
readable. Existing labels/layout unchanged. Pointer action leaves translation
focused while thread opens/closes.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured unavailable/deleted/absent/departed keys cannot select/read comments.
Existing authenticated reads/generation/mutation fences preserved; no unrelated
translation write on pointer toggle.

## QA/integration review
9 new units/web1244 in120 suites/API265 in31/builds0(APIcached).
Older comment/recovery fixtures proactively set loaded A/B keys/healthy grid
before first unit run. Intentional old-app discriminator0PASS6FAIL: focused open,
no-save stored result, close, held-close and unavailable assertions failed, then
expected-form abort after captured toggle changed pane state. Full log retained.
Real browser7/0 initial+sweep: focused local draft/open one thread GET/zero
writes, close no requests, held-close late fence, captured unavailable refusal,
actual stored comment and390px. All API first-attempt0/117 isolated browsers
final0. Glossary-create-unknown initial+immediate retry preassertionPG55704 bind
abort0PASS, unchanged delayed9/0, no app/test fix/both full logs retained.
Separate sync95+144=239unique; native116+111+19=246total242unique/four startup
repeats, each inner/outer0 first pass. Config16/14/docs4-138routes/reaper4 all0.
Completed checks preserved across continuations; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
