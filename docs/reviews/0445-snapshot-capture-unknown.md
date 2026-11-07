# 0445 Unconfirmed snapshot capture recovery

## Developer review
Capture failure now enters explicit unknown state; UI and captured handlers block
capture/restore before another POST/confirmation. Current successful list read
clears unknown and its own bounded error, preserving draft and unrelated errors.
Failed read remains blocked. Capture epoch plus pending-at-read-start/currently-
pending checks prevent reads begun before/during a capture from clearing its later
unknown state. Project reset/destruction fences retained. Confirmed capture with
failed follow-up read is not unknown. No API/schema/dependency change.

## Product review
A failed response is not proof capture failed. Keep label, require checking and
successful explicit refresh before another capture/restore, never auto-replay.
Read recovery does not claim exactly-once execution or identify a request by label;
people must inspect the list before repeating. Existing list pagination/retention
and restore caveats remain. State is visit-local, not durable cross-device state.

## Design review
Actual desktop/390px pixels inspected. First review caught duplicated contradictory
failed/unconfirmed banners; unknown now shows only its specific recovery guidance,
with draft visible, Take snapshot/Restore disabled, Refresh available. Reran web
units/build/browser7/0 and inspected corrected pixels before broad regressions.
No overflow. Failed list read remains separately visible with unknown guidance.

## Security review
No automatic POST retry, unknown-state captured handlers refuse before confirmation,
raw exception stays private. Current successful read unlocks only within existing
project/read/mutation fences. Does not cancel requests, guarantee idempotency or
modify backend authorization. Original owner upload instruction recovered; live
named repository verified before commit. No external account/worker/scope change.

## QA/integration review
Unit7/web825 in75 suites/API265 in31 suites/builds0. New real local API/Postgres
browser7 (twice0) forwards genuine capture, verifies PostgreSQL commit, then drops
the browser response. Checks unknown/draft/single commit, zero automatic reads/
replay/restore/confirmation, failed explicit read remains blocked, current read
shows committed snapshot and unlocks without replay, explicit next capture once,
narrow layout. Units cover read-before/during races, confirmed-capture failed read,
project/destroy fences and unrelated error preservation.
Existing snapshot-browser initial30PASS2FAIL expected old failure wording/enabled
capture after failure/retained error after successful read. Fixture updated for new
blocked/unconfirmed/recovered UX, then44/0. No app fix from that failure.
All API/72 isolated browsers final0. Sync separate95/144=239unique; native separate
116/111/19=246total242unique/four startup repeats, all inner/outer0. Final configs
16/14/docs4-138routes/reaper4 all0; checkpoints consumed. Continued across run
boundary with no interrupted tests or restarted completed checks. No canonical
uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
