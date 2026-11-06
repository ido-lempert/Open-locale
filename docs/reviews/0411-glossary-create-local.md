# 0411 - Targeted glossary term creation

## Developer review
Confirmed create inserts/sorts only its returned row into the same-generation usable
list, initializes only that row's translation baseline, and never replaces existing
row objects or refetches. Duplicate returned IDs preserve local values. Changed,
loading or failed list stays intact. Newer form draft retained; project/destroy
fence late completion. Existing create pending boundary unchanged.

## Product review
Adding a term must not discard unrelated local translations or race their saves.
Separate confirmed receipt names the submitted term. If the current list cannot
accept the returned row, copy-first explicit refresh guidance explains how to find
it without suggesting create again. Unknown creation remains check-before-retry;
no idempotency, durable receipt or general mutation reconciliation added.

## Designer review
Inspected actual desktop screenshot with Beta receipt/row, Alpha local translation
still saving and newer term draft. Receipt sits above form, text and columns readable
without overlap. Existing refresh replacement warning remains visible. No new
responsive audit; existing glossary narrow-viewport assertions still pass.

## Security review
Receipt interpolates captured submitted term without raw server errors. No added
API/schema/worker/provider/credential-scope/license/spend changes. Original owner
upload evidence and live target checked before push; coverage remains unchanged.

## QA/integration review
Unit9 covers pending/local row identity/newer draft/no GET, changed/loading/failed
list, duplicate ID, new-row baseline, failure/reset and scope/destroy. API265/31,
web622/43, uncached builds0 initial441.27kB. Initial unit617PASS5FAIL: four obsolete
completion-GET expectations and one bootstrap microtask assertion corrected.
New real browser4/0 first run holds Alpha PATCH and Beta POST: duplicate blocked,
Beta persists once/no GET, Alpha DB Original/local draft still saving, independent
Alpha save then completes. Pixels inspected. Existing glossary runner initially
1PASS1FAIL timeout expecting automatic completion GET; fixture now explicitly
refreshes after receipt, retains failed-read/retry tests, final38/0. Broad API/browser
final0 in isolated browser calls. SyncSTAGED95+144239unique/nativeSTAGED116+128244total
242unique, inner/outer0/checkpoints removed. No interrupted verification or canonical
uninterrupted claim. Final sync-config16/native-config10/docs4-138routes/reaper4 all0.
22FULL7PARTIAL1MISSING/defaultOFF/external acceptance unchanged.
