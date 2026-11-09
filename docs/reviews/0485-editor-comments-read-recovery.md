# 0485 Safe focused comment recovery reads

## Developer review
Dedicated recovery requires uncertainty/read error for current selected loaded
key, no comment write/read pending, healthy key grid, no key deletion/uncertainty
and not departed. UI and captured handler use same readiness. Uses existing reader
with pane/generation/mutation-epoch fencing; no API/storage or mutation change.
Healthy refresh unchanged. Pointer mousedown preserves translation focus.

## Product review
Recovery previously read comments directly but could autosave unrelated focused
translation through blur. Both current-check and failed-read retry now avoid that
write. Recovery reads thread only, keeps local comment text/locale and translation
values; it does not replay unknown comment changes. Existing successful current
read clears uncertainty, absent reply target clears, failed read stays paused.
No attribution/exactly-once/durable uncertainty claim.

## Design review
Actual error and recovered desktop/390px pixels inspected. Recovery buttons,
fixed errors, scope text, local translation and restored comment form readable.
Pending control disabled; comment draft remains in page state during read/error,
restored after success. No new layout or copy beyond existing recovery labels.
Screenshot-only fixture refinement reran8/0.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured pending/wrong-key recovery refuses. Fixed error omits private backend
text. Reads retain existing authenticated per-key access and disclose nothing to
new audiences. Pointer recovery cannot create unrelated translation writes.

## QA/integration review
12 new units/web1184 in115 suites/API265 in31/both builds0(APIcached).
Intentional pre-fix discriminator against old app2PASS3FAIL: focused unknown check
and retry zero-autosave assertions failed, then missing new-handler abort. Full
log retained. Added app guards/pointer prevention; actual browser8/0 initial after
fix, sweep and screenshot refinement. Real committed-then-lost post, current-read
failure, focused held retry/captured duplicate, persisted thread and retained
comment draft/locale/local translation,390px covered. Units exercise all guards,
failed/successful reads, pending duplicate and departure fencing.
All API/112 isolated browsers first-pass0 after fix; no post-fix failures.
Sync95+144=239unique; native116+111+19=246total242unique/four startup repeats,
completed inner/outer0 first pass. Config16/14/docs4-138routes/reaper4 all0.
Completed results preserved across continuation; staged, not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
