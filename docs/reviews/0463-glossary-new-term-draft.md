# 0463 Explain local new-term form state

## Developer review
Computed presence includes exact raw term/notes and do-not-translate choice,
including whitespace, independently of loaded-row translation drafts. Normal,
pending and uncertain creation labels are distinct. Existing confirmed create
clears only unchanged submitted form; newer edits and project reset keep existing
behavior. No request/storage/reset/navigation changes or API/schema changes.

## Product review
Normal form guidance denies automatic save/restoration and suggests copying or
local glossary backup when available. Pending add names current editable form
versus submitted term and no repeat. Uncertain add stays unconfirmed with copy/
check-before-add guidance, never an unsaved-server claim. List failures do not
hide local form or falsely promise backup. Separate loaded-row text unchanged.

## Design review
Desktop/390px screenshots inspected: new-term feedback directly above form,
existing loaded-row/backup scope below. Text and controls readable without document
horizontal overflow; existing mobile stacked translation rows stay full width.
No CSS change or pixel correction needed.

## Security review
Computed text only, no HTML interpretation or added network/storage/side effects.
Creation uncertainty and no-replay guards unchanged. No dependency/license/spend,
registration/worker enablement/credential-scope change. Upload authority and live
repo/base separately verified before commit.

## QA/integration review
Unit4/web967 in93 suites/API265 in31/builds0 (unchanged API cached). New browser12/0
covers real held creation/newer editable form/confirmed receipt/committed POST
then dropped response/failed recovery/current recovery/choice-only/reused project.
All API groups and90 isolated browsers final0. Existing QA-search5PASS then
Clear-search wait timeout at line44; unchanged retry10/0, exact intermittent cause
unestablished and initial log retained. No app/test fix for that failure.
Separate sync95+144=239unique/native116+111+19=246total242unique/four startup repeats,
all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks preserved
across continuation; explicitly staged/no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
