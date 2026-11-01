# 0207 - Authorize deletion-audit metadata in page snapshot

## Developer pass
Bounded metadata query now runs in RepeatableRead with effective admin recheck using
shared ProjectsService transaction-aware policy. Existing preflight,cursor validation,
projection,limit51/keyset ordering and response schema remain. Actual emitted SQL
EXPLAIN tests now use real ProjectsService auth rather than no-op mock.

## Product pass
Committed direct demotion/removal or group grant removal after preflight but before
page snapshot denies metadata. Direct/group admins keep access. Each page request
has its own snapshot,not a frozen cross-page view. Revocation after snapshot begins
retains snapshot semantics,not continuous authorization. No restore/token/history
replay,repository effect composition,baseline advance or remote writes. Coverage
22FULL/7PARTIAL/1MISSING/defaultOFF unchanged.

## Designer pass
No UI changes. Inspected current actual480x900pixel screenshot after browser test:
full UTC snapshot/not-live/refresh/no-reservation/no-restore notice,metadata/button
readable inside card. Upper summary partly under sticky header;full relevant card
visible. Local fixtures,not user/production data.

## Security pass
Effective team/group authorization shares same transaction snapshot as metadata.
Removed direct member404,demoted direct member/removed group grant403. Session-only,
no-store,metadata-only whitelist remains. No additional external registration,
credential scope,spend,license/audience or production changes. Other read routes
remain outside this bounded slice.

## QA/integration pass
Sync448->453 adds direct/group positives and actual PostgreSQL committed interleavings
for direct demotion/removal/group removal between successful preflight and snapshot.
Negative control omits page in-snapshot check:450pass/3expectedfail exactly revocation
assertions. Restored fix,final453RC0. Real Prisma first/older page SQL plans still use
ordered index without Sort against20000mixed rows.

OIDC-link initial startup failed port55480 already in use immediately after prior
OIDC-browser49 completed:zero checks/FAIL suite aborted,inner0 caught by wrapperRC1.
Standalone OIDC-link12RC0 and repeated OIDC-browser49RC0 without app changes. No
call timeouts/interruption141. Final43integration/config legs15completed all-green
batches,individual/outerRC0. API248tests/30suites,web65/7,both builds,reaper4RC0.
Migration22,sync453,browser138,automation132,webhook45,135routes. Native staged
116+128=244total/242unique labels,all literal labels covered,inner/outerRC0,checkpoint
removed. Staged,not uninterrupted. Negative-control source restored byte-for-byte
before final broad verification,no later app edits. Only review added afterward.
