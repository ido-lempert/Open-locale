# 0489 Safe focused history pane toggle

## Developer review
History toggle requires a current loaded key, healthy key grid, no pending or
unknown same-key deletion and not departed. UI/captured handler share guard.
Pointer mousedown keeps translation focus. Closing during pending history read
still invalidates generation and clears pane; late results cannot reopen it.
Existing locale reader/refresh/retry semantics unchanged. No API/storage change.

## Product review
Opening/closing history previously blurred a focused translation and autosaved
its local draft. Explicit history pointer action now reads saved history only
when opening; closing makes no request. Local values remain distinct from saved
history. No restore/write/apply. At most50 newest combined returned changes and
separate locale reads remain, not complete history or one database snapshot.

## Design review
Actual final desktop/390px pixels inspected: full-width mobile translation,
local-draft notice, history control, wrapped scope and saved entries readable.
Added separate mobile history screenshot because first viewport showed toggle
but clipped the saved entries below the fold. Screenshot-only fixture refinement
reran7/0. Labels/layout otherwise unchanged.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured unavailable/deleted/absent/departed keys cannot select or fetch history.
Existing authenticated reads and generation fences preserved. No unrelated
translation write when opening or closing via pointer.

## QA/integration review
9 new units/web1235 in119 suites/API265 in31/builds0(finalcached).
Intentional old-app discriminator0PASS6FAIL: focused open, saved-history/no-save,
close, held-close and captured-unavailable assertions failed, then expected-list
abort after captured toggle changed pane state. Initial full-unit run aborted:
older history fixtures lacked loaded keys/healthy grid, so guard skipped reads
and a rejected deferred promise was unconsumed. Fixtures now set loaded A/B keys
and healthy grid; all units rerun0. Full logs retained; no app change afterward.
Real browser7/0 initial, screenshot refinement and sweep: focused local draft,
open only two locale-history GETs/zero autosave, close no requests, pending close
fences late response, captured unavailable refusal, actual saved history/390px.
All API/116 isolated browsers first-attempt0 after fix, no regression abort.
Separate sync95+144=239unique; native116+111+19=246total242unique/four startup
repeats, all inner/outer0 first pass. Config16/14/docs4-138routes/reaper4 all0.
Completed checks preserved across continuations; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
