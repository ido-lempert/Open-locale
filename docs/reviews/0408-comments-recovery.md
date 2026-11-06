# 0408 - Comment unknown-result recovery

## Developer review
Shared pending handler captures thread generation. Unknown write state keyed to
original key even after pane change/reload; successful later current read unlocks.
Mutation epoch fences reads begun during a write. Confirmed post clears only exact
submitted draft/scope/reply, newer draft survives. Confirmed write and refresh failure
remain separate. Delete requires known comment and reply requires known root.

## Product review
Fixed thread-local check-current guidance, retained editable draft, no blind replay
until successful current read. Pending explanation clarifies close does not cancel.
Pending comments globally block other comment writes; unknown state blocks only its
key. Pending/unknown work guards key deletion. Unknown state is component-local,
not persisted exactly-once recovery. No translation-grid reload or auto replay.

## Designer review
Actual unknown-post and pending/newer-draft desktop screenshots inspected. Guidance,
current-read action and draft readable without overlap. Existing inline thread layout
retained, no responsive audit. Draft can still be lost by deliberately closing thread;
no cross-thread draft persistence added.

## Security review
Runtime pending/unknown/current-read/grid guards, known delete/root reply identities.
Fixed mutation errors avoid backend detail disclosure. Interpolation/mention rendering
unchanged. No API/schema/worker/provider/spend/license/credential-scope changes.
Original owner upload evidence and live target checked before push.

## QA/integration review
API265/31 web591/40 (+16), uncached builds0 initial440.48kB. New browser8/0 first run:
unknown post/draft/replay block, failed read remains blocked, explicit success unlock,
held duplicate/newer draft, exactly one persisted post, unknown delete/replay block,
original-key delete with new-thread draft retained. Pixels inspected. Existing delete
unit fixture now includes its known comment identity. No failing tests this slice.
Broad API/browser suites final0 across isolated calls. SyncSTAGED95+144239unique and
nativeSTAGED116+128244total242unique inner/outer0/checkpoints removed. No interruptions,
not canonical uninterrupted claims. OIDC55 on55633. Final sync-config16/native-config10/docs4-138routes/reaper4 all0.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
