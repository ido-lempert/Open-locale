# 0486 Safe focused screenshot recovery reads

## Developer review
Dedicated recovery requires current selected loaded key with screenshot mutation
uncertainty/read error, no screenshot read/mutation pending, healthy key grid,
no key deletion/uncertainty and not departed. UI and captured handler share guard.
Existing reader owns image URL cleanup, pane/generation/mutation-epoch fencing.
Healthy refresh unchanged. Pointer mousedown preserves translation focus.
No API/storage/mutation change.

## Product review
Unknown-change check and failed-read retry previously read screenshots but could
autosave unrelated focused translation through blur. Both now avoid that write.
Recovery reads current list and image bytes, keeps local translations and never
replays deletion/upload. Failed read keeps mutation pause; complete current read
clears it. Separate reads are not one database snapshot or request attribution.
No durable uncertainty/exactly-once claim.

## Design review
Actual error and recovered desktop/390px pixels inspected. Wrapped warning,
recovery/retry, scope and retained image readable. Focused local translation
preserved; errors hide stale images. Pending recovery control disabled. No new
layout/copy beyond existing labels. Image fixture is a real decoded1px PNG,
shown enlarged; it is test evidence, not a user screenshot.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured healthy/wrong-key/pending recovery refuses. Fixed errors omit private
backend text. Authenticated screenshot access unchanged; object URL lifecycle
kept. No disclosure to new audience or unrelated translation write on recovery.

## QA/integration review
12 new units/web1196 in116 suites/API265 in31/builds0(APIcached).
Intentional old-app discriminator2PASS3FAIL: focused check/retry zero-autosave
failed, then missing-new-handler abort. Full log retained; app guard/pointer fix,
then real browser8/0 initial and sweep. Real committed-then-lost screenshot delete,
failed current read/focused held retry/captured duplicate, current list+actual
retained image bytes/removal/kept local translation,390px. Units cover all guards,
failed/successful reads, duplicate pending/departure.
All API/113 isolated browsers final0. Tasks-download initial+immediate retry
preassertionPG55710 bind abort0PASS, unchanged delayed11/0, no app/test fix, both
full logs retained. Sync95+144=239unique; native116+111+19=246total242unique/four
startup repeats, all completed inner/outer0 first pass. Config16/14/docs4-138routes/
reaper4 all0. Completed checks preserved across continuation; staged, not
uninterrupted. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
