# 0491 Safe focused screenshot pane toggle

## Developer review
UI and captured toggle require current loaded key, healthy grid, no pending or
unknown same-key deletion and not departed. Pointer mousedown preserves focused
translation. Existing screenshot list/image reader, generation invalidation,
object URL cleanup and mutation continuation unchanged. No API/storage change.

## Product review
Opening/closing screenshots previously blurred and autosaved a focused local
translation. Open now reads only list and stored image bytes; close makes no
request. No upload/delete/save/replay or translation reload added. These reads
are separate and not a database snapshot.

## Design review
Actual desktop/390px pixels inspected: retained local translation/local-draft
notice and full-width screenshot pane readable. Stored1pxPNG fixture displayed
at existing image size. Refresh explanation, stored filename, delete and upload
controls fit. Existing labels/layout unchanged.

## Security review
No endpoint/dependency/license/registration/spend/worker/credential change.
Captured unavailable/deleted/absent/departed key refuses selection/read. Existing
authenticated reads and mutation/generation fences preserved. Pointer toggle
cannot trigger unrelated translation save.

## QA/integration review
9newunits/web1253in121/API265in31/builds0(APIcached). Older screenshot/mutation
fixtures proactively grounded loadedA/B/healthygrid; lifecycle test restores
loaded keys after explicit reload before reopening. First unit run green.
Intentionaloldapp0PASS6FAIL: five safety assertions then expected-list abort
after captured toggle changed pane. Full discriminator log retained.
New real browser7/0 initial+sweep: focused localdraft/open only list+actualPNG
GETs/zero writes, close revokes URL/no requests, held-list close fences late
image, captured unavailable refusal, actual stored PNG/390px/runtime.
AllAPI/118isolated browser suites first-attempt0 afterfix/no failure or abort.
Separate sync95+144=239unique/native116+111+19=246total242unique/four startup
repeats, every stage inner/outer0 firstpass. Config16/14/docs4-138routes/reaper4
all0. Completed checks preserved across continuations; staged/not uninterrupted.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
