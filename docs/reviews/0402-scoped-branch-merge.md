# 0402 - Scoped branch-merge continuation

## Developer review
Preview captures source branch/list generation, only current response publishes.
Reload/branch switch/cancel/destroy invalidate preview, including open confirmation.
Pending duplicate preview and merge guards; write captures original preview snapshot.
No source-grid reload after merge. Scope change suppresses late result UI but cannot
cancel submitted server operation. Existing merge preview-time protections unchanged.

## Product review
Merge targets main, so reloading source after success only risks unrelated local
work. Keep source cells and explain copy-first opening main. Modal explicitly says
only saved server values merge, unsaved drafts excluded. Unknown result closes old
prompt with check-main guidance; new preview remains explicit, not safe-to-replay
or exactly-once claim. No server-side capability/acceptance change.

## Designer review
Actual pending modal and retained source-draft pixels inspected, readable/wrapped,
confirmation and cancel disabled with Merging label. Saved-values-only text visible
before commit. Not keyboard focus-trap/responsive audit; modal layout inherited.

## Security review
Fixed errors suppress service details. Captured scope/list generation prevents old
preview from being confirmed in another branch. Handler guards do not rely only on
button disabled. No API/schema/worker/provider/credential scope/spend/license change.
Original owner upload evidence/live target to recheck before push.

## QA/integration review
API265/31 web489/34 (+13), uncached builds0. Browser5 real old preview held then
branch switch stays closed; source PUT held while merge copies saved Feature to
main, local source draft/no key GET, duplicate confirm/cancel guard, runtime clean.
Initial0+abort wrong preview endpoint matcher (/merge-preview vs /merge/preview),
fixed. Then4PASS1FAIL queried disabled DOM before render; exact disabled-state wait,
final5. No app correction for those fixture issues. Added modal saved-values text,
reran unit/build before broad checks. All broad API/browser legs final0 in bounded
calls, browser suites/native stages isolated. SyncSTAGED95+144239unique inner/outer0
checkpoint removed; nativeSTAGED116+128244total242unique inner/outer0/checkpoint
removed, not canonical uninterrupted claims. Final config16/docs4-138routes/reaper4 all0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
