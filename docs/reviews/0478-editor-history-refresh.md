# 0478 Refresh open translation history

## Developer review
Explicit healthy-history refresh reuses the selected-key reader and existing
generation fencing. Guard requires current loaded key, settled healthy history,
settled healthy keys, no pending/uncertain key deletion and not departed.
Captured duplicates refuse. Local translation cells retained; no API, storage,
restore, save or editor reload change.

## Product review
Read newer saved translation context without closing the pane or losing local
work. Scope says loaded project locales, at most50 newest returned changes,
separate reads rather than a database snapshot or complete history. No restore
or automatic-refresh promise. Failed read keeps existing retry recovery.

## Design review
Final desktop and390px screenshots inspected after sweep. Refresh button and
scope wrap within the pane; mobile translation input remains full-width and
readable. Pointer mousedown retains focused translation without blur autosave.
History author/time content wraps on mobile. No extra confirmation needed for
this read-only action.

## Security review
No endpoint, dependency, license, registration, spending, worker or credential
changes. Existing escaped history rendering, selected-key fencing and guarded
mutations unchanged. Fixed failure text does not show private backend content.
Captured refresh cannot bypass key uncertainty/loading/error/departed guards.

## QA/integration review
11 new units/web1100 in108 suites/API265 in31/both builds0 (API cached).
New real browser9/0 first pass and9/0 in sweep: actual new saved translation,
focused pointer zero writes, exactly two locale-history-only reads, retained
local translation, duplicate guard, fixed read error/existing retry, late-close
fencing and390px scope/button. Unit verifies newest50 sorting across locales
and nine guarded states. No failed or aborted runs this slice.
All API/105 isolated browsers first-pass0. Separate sync95+144=239unique;
native116+111+19=246total/242unique/four startup repeats, all inner/outer0.
Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across
continuation; staged/no uninterrupted claim. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged.
