# Glossary translation event row identity

## Developer
Translation setter requires exact current loaded row before clearing local reset/
download/delete feedback or replacing text. Same ID alone is insufficient after
read/immutable replacement. Existing latest-row edits during pending save remain
supported, as covered by prior concurrency tests.

## Product
Late event cannot overwrite newer loaded local text. No read/retry/autosave or
recovery added. Current edits remain local until existing blur-save behavior.

## Designer
No layout/visual changes and no new screenshot claim. Rejected stale event keeps
current text and existing draft/reset feedback rather than silently clearing it.

## Security
Guard is local row identity, not fresh authorization or server permission proof.
No backend/provider/credential, worker/license/spend/registration/share changes.
Unknown-save/destroyed existing restrictions remain.

## QA/integration
- Glossary17 suites254 tests pass. New tests: replaced same-ID event/feedback,
removed row, current edit remains supported after prior row becomes stale.
Existing pending-save/newer-text behavior stays green.
- Source negative removed identity guard and regression failed. Source restored,
local text suite16/0 rerun. No temporary mutation retained.
- Actual browser initial web4200 startup timeout before assertions; unchanged
retry21/0 including forced stale component handler/current edit, zero requests,
and prior typed search/columns/draft uncertainty checks.
- Production web build/docs4 checks/138routes/syntax/diff pass.
- No UI/full-product/native/sync/provider/backend rerun claim. Latest full web
728 baseline312 suites3796 tests. Coverage22 FULL/7 PARTIAL/1 MISSING/external
acceptance gaps unchanged.

Five review perspectives complete, scoped stale edit issue fixed before commit.
