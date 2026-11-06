# 0424 Loaded glossary search

## Developer review
Computed visibleTerms derives from the full loaded terms signal. Search changes
only capped query state; no reads, draft replacement or saved-baseline mutation.
Project visit clears query, destruction guards query edits. Existing create/delete/
save logic still uses the complete terms list, not the visible subset.

## Product review
Local discovery across term names, notes and translation values, including unsaved
local text. Literal case-insensitive substring semantics and loaded-only scope are
explicit. Match count distinguishes no-match from no terms; Clear shows all loaded
rows. Hidden paused rows retain their recovery state. No server search, pagination,
newer-server discovery or durable query/draft claim. Existing blur save still applies
when moving from an edited field to search; search itself submits no change.

## Design review
Inspected filtered/cleared desktop screenshots: full-width labeled search, Clear
control and match guidance readable; filtered paused local row and new-term draft
remain visible without overlap. Existing glossary table layout unchanged.

## Security review
No new API/privilege/schema/worker/provider/account/credential/license/spend changes.
Literal includes, not regular expression evaluation or rendered markup. Query capped
at200; existing Angular text rendering. Browser checks zero search-induced GETs or
extra writes. Original owner upload scope and live target checked before push.

## QA/integration review
Unit3 term/notes/Hebrew/translation/case/literal matching, complete-list identity,
local text/hidden draft retention and input cap/destroy guard. API265/31 web717/56
builds0 initial442.76kB. New real browser7/0 twice: notes/Hebrew/literal no-match,
Clear, actual failed PATCH leaves local draft read-only; hide/reveal preserves unknown
pause and form; no search reads/additional writes. Existing Glossary38/0 and mutation
recovery suites0. All API/isolated browsers0; sync staged95/144239unique, native separate
116/111/19 (246total242unique/four repeats), all inner/outer0. Final config16/14,
docs4-138routes/reaper4 all0. No failed/interrupted check or uninterrupted canonical
claim. Checkpoints removed.22FULL7PARTIAL1MISSING/defaultOFF/acceptance unchanged.
