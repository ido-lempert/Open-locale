# 0396 - Scoped editor empty results

## Developer review
Empty successful key list distinguishes active search/tag/status filters from
unfiltered branch result. Clear filters explicitly resets only those three and
uses existing fenced reload; branch/import-export locale retained. Runtime guards
reject destroyed/pending/failed/unfiltered calls. UI appears only with zero rows,
not as draft-discard shortcut. Existing general filter-change draft behavior not
redesigned. No API or server counts added.

## Product review
A completed review queue can be empty while keys still exist; do not tell users
to create their first key. No-match guidance and explicit clear give a useful next
step. Empty branch names current scope rather than claiming whole project empty.
No count of other branches or permission-bypass claim. Pending/error still separate.

## Designer review
Desktop no-match and empty-branch pixels inspected. Current branch, explanation
and Clear key filters readable, no clipped controls. Existing empty table structure
preserved. No automatic reset, navigation or save. Not a full mobile/accessibility
audit. Button label names key filters so branch remains intentionally selected.

## Security review
Existing access enforcement unchanged. Text uses Angular escaped branch value.
Clear triggers read only, no content mutation or new external data route. No
credentials/provider/worker/license/spend changes. Original repository upload
scope recovered before commit.

## QA/integration review
API265/31 web426/28 (+8) uncached/builds0 initial423.27kB below500budget.
Keys browser14 (+3) real filtered no-match/no branch-empty claim, explicit clear
returns feature Beta and leaves branch selected, empty unfiltered branch named
without clear button. Review browser12PASS1FAIL first reload value asserted before
render; exact First editor wait fixed/final13PASS0. No other330 failure/timeout.
All63 bounded legs final0; config16/docs4-138routes/reaper4. SyncSTAGED95+144239unique/
nativeSTAGED116+128244total242unique inner/outer0, checkpoints removed, no app/test
edits after native; not canonical uninterrupted. Docker static-only; coverage
22FULL7PARTIAL1MISSING/defaultOFF/external acceptance limits unchanged.
