# 0380 - Pin OTA inspection to retained publication identity

## Developer review
New settings Inspect links pass publication UUID. Existing version/latest pull
APIs accept optional publicationId and compare exact row identity before producing
body/ETag or conditional304. Wrong/malformed/empty pin is404, not silent fallback.
Auth and project/locale/branch/version lookup precede identity check. No schema,
payload/digest change; unpinned old clients retain existing behavior. Component
captures query identity with generation fencing; focused unit covers query-only
same-scope identity replacement and late old read. Existing full-bundle local
paging remains, no server pagination/integrity-verification change.

## Product review
313 identified branch-name/version reuse after deletion/recreation. New inspection
links cannot silently select replacement publication under same branch/version;
stale pin errors without values. Fresh settings link reads replacement. Pin is
an equality constraint, not permanent retention or restoration: deleted/pruned
publication remains unavailable. Legacy unpinned links show explicit recreation
warning and suggest fresh Inspect link. No external/CDN/native acceptance claim.

## Designer review
Actual390px old-pin error, fresh replacement and long-value screenshots inspected.
UUID wraps, branch/version/locale remains readable, stale error has no bytes;
fresh version's own publication time and replacement bytes visible. No overlap/
horizontal overflow observed. Existing generic unavailable message avoids exposing
whether a private identity exists. No new visual asset/hosted page.

## Security review
Identity does not grant access: existing auth/membership checked first. Other-branch
ID cannot bypass scoped lookup; mismatch checked before304 even when a correct
ETag is sent. UUID is compared as string, never interpolated raw SQL. Existing
member/outsider denial checks retained. No audience/credential/worker/spend/license
change. Owner original named-repo upload recovered before publication.

## QA/integration review
API265/31 web319/16 uncached/builds0. OTA36->46 real HTTP/PG checks: exact pin200,
matching304, wrong-other-branch/malformed/empty/wrong identity404 before304; actual
branch delete/recreate producesv1/newUUID; oldpin404/newpin replacement/legacy read
stillworks. Browser17->19 real branch recreation, old querypin denied without bytes,
fresh settings pin replacement, prior17checks retained. No failure/timeout314.
All51 bounded integration/config legs final inner/outer0; docs4/138routes, config16,
reaper4. Each browser/stage isolated. Sync STAGED95+144=239unique and native STAGED
116+128=244total242unique final inner/outer0, checkpointsremoved. Not canonical
uninterrupted success. No app/test edits after final stages. Docker static-only,
coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. Bundle warning below.

Final bundle597.74kB vs500warning (previous597.29kB).
