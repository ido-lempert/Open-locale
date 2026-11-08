# 0468 Explicit local new-term form discard

## Developer review
Inline confirmation captures exact term/notes/do-not-translate choice, project
visit and creation uncertainty. Confirm clears only new-term fields and obsolete
backup feedback. Pending/empty/no-project/departed/stale guards; creation/project/
departure clears prompt. Independent list/locale/row work does not block local
form discard. Loaded translation map and row-reset prompt remain untouched.

## Product review
Keep retains raw form. Discard warns to copy/download first, no local undo or
server term change. Unknown create/save/delete remains unknown; confirmed server
receipt/error retained. Empty form cannot unlock another create. Existing explicit
current read alone resolves uncertainty, not discard.

## Design review
Desktop/390px screenshots inspected: readable inline warning, spaced Keep/Discard,
no document overflow, full-width mobile translation input retained. Focused row
text remains visible separately from new-term form. No native modal or pixel fix
needed. Pointerdown prevention on all three reset controls preserves row focus.

## Security review
Only explicit new-term fields cleared. No new destination/request/storage or
external effect. Local row text and unknown server outcomes cannot be erased by
form reset. No dependency, license, worker, registration, spend or credential-scope
change. Focused changed row cannot autosave through pointer reset controls.

## QA/integration review
Unit12/web1016 in98 suites/API265 in31/builds0 (API cached). Dedicated real browser
12/0 focused pointer prompt/Keep/Discard with zero autosave requests and row loss,
stale form, held create, actual committed then dropped response, failed/current
recovery, reused project/departure. All API/95 isolated browsers0. Separate sync
95+144=239unique; native116+111+19=246total242unique/four startup repeats, all inner/
outer0. No failed/aborted checks this slice. Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across
continuation; staged/no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING/
defaultOFF unchanged.
