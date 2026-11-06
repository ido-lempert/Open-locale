# 0401 - Targeted key deletion

## Developer review
Confirmed delete removes only matching current-generation key/cells, clears its
selected history/shots/comments/tag edit, clears TM. Other cells preserve identity.
Per-key pending handler/button guard; list replacement/destroy suppresses old
success/error. Unknown failure retains row and blocks blind replay until explicit
list read. No automatic refetch or idempotency/server delete CAS claim.

## Product review
Deleting one key must not erase unrelated drafts. Target dirty/plural/pending/
unconfirmed content/review and pending tags block deletion. Bulk pending blocks it.
Confirmed removal is still destructive; existing delete intent behavior unchanged.
This is not draft merge or general mutation recovery; screenshots/comments and
other editor mutations retain their existing independent workflows.

## Designer review
Pending row inert with status outside row, fixed error in full-width following row.
Actual retained-draft and failure desktop pixels inspected, readable/no overlap.
Delete title explains local-save/wait prerequisite. Not a responsive audit.

## Security review
Review added handler boundaries for content/review/tags and bulk during pending or
unknown delete, beyond inert UI. Fixed errors hide backend details. No API/schema/
worker/provider/credential scope/spend/license changes. Original upload evidence/
live target recheck before push. No external acceptance/coverage promotion.

## QA/integration review
API265/31 web476/33 (+17), uncached builds0. Browser4 real held unrelated PUT and
DELETE proves persisted removal/DB Original/local draft retained/no list GET,
pending duplicate guard/dirty row blocked, fixed unknown failure keeps row/no replay.
Initial unit474 then review added two boundary tests, final476; browser4 rerun after
review fixes. All broad final API/browser checks0 across bounded calls, each browser
suite/native stage isolated. SyncSTAGED95+144239unique inner/outer0/checkpoint removed;
nativeSTAGED116+128244total242unique inner/outer0/checkpoint removed, not canonical
uninterrupted claims. Final config16/docs4-138routes/reaper4 all0. Coverage22FULL7PARTIAL
1MISSING/defaultOFF unchanged. No interim failing test in335.
