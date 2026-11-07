# 0455 Reset local glossary translation text

## Developer review
Per-current-row reset uses last loaded/confirmed comparison, not new remote data.
Inline pending confirmation captures exact row/comparison/project/read generation;
Discard rechecks all and changed readiness. Edit/read/mutation/departure clears
stale prompt. Clean/pending/unknown/stale/departed handlers refuse reset. Whole
translation map copied, new-term form unchanged. No API/schema/dependency change.

## Product review
Explicit Discard/Keep prompt says local text is lost and offers copy/download
first. Restores page comparison only, does not undo server changes or read newer
values. No automatic reads/writes. Existing keyboard focus/blur autosave remains;
pointer activation of reset/confirmation preserves field focus and sends nothing.

## Design review
Actual final inline-confirmation desktop/390px pixels inspected and sent: warning,
Discard/Keep buttons and narrow full-width translation field readable with no
horizontal overflow. Row reset stays alongside unsaved feedback. Native modal
replaced by inline confirmation after interaction failure, not merely wording.

## Security review
Exact row/reference/comparison/generation guards prevent delayed confirmation
from discarding newer text or a newer read. Pending/unconfirmed work cannot be
reset. No server mutation/new sharing/external service/worker/account/spend/
credential-scope change. Owner upload and live repository state checked separately.

## QA/integration review
New unit15/web923 in85 suites/API265 in31/builds0. Final browser9/0 twice for
inline design: actual focused cancel/reset no API effects, exact loaded comparison
not newer unread server text, retained new-term draft, stale/departed handler,
current explicit read advances comparison. Initial native-confirm browser3PASS
then missing-control abort; retry1FAIL then timeout, diagnostic run exposed late
blur-triggered autosave after modal closure. Temporary prompt-only guard did not
fix delayed blur. Inline replacement removes modal/focus-loss cause; final tests
prove zero writes. No broad regression failures: all API/82 isolated browsers0.
Separate sync95+144=239unique/native116+111+19=246total/242unique/four startup
repeats inner/outer0; config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuation, no uninterrupted claim. Coverage22FULL7PARTIAL
1MISSING/defaultOFF unchanged.
