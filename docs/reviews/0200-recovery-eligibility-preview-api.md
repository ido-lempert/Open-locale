# 0200 - Read-only recovery eligibility preview API

## Developer pass
Session-admin GET deletion-audits/:auditId/recovery-preview,UUID parameters,no-store.
Internal diagnostic runs in consistent RepeatableRead transaction. Explicit response
whitelist:source,eligibleNow,reason,canRestore=false,snapshotIncluded=false,
historyReplay=false,reservationHeld=false. No value,digest or snapshot metadata leak.
No mutation/row reservation/execution token. README/OpenAPI/plan updated,134->135routes.

## Product pass
Current eligibility reason helps inspect retained audit without archived bytes. Point-
in-time diagnostic only,not promise that future recovery succeeds. No public restore
mutation/UI or repository-effect composition. Existing metadata canRestore=false still
accurate.22FULL/7PARTIAL/1MISSING/defaultOFF unchanged,no accepted sync/external acceptance.

## Designer pass
No UI changes/eligibility UI claim. Current actual480x900audit-focus pixels inspected:
heading outline/notices/button/card metadata readable,no overflow. Escaped markup key
and2099timestamp deliberate fixtures. Existing browser131flow retained.

## Security pass
Session401,contributor403,outsider404,API-token403,owner/admin200. Missing/cross-project
audit returns safe audit-unavailable reason without private identifiers. Invalid UUID400.
Explicit whitelist excludes archived value/digest/history. Recreated value preview denies
without exposing current value. No registration/token-scope expansion/spend/license/
audience or production data/settings changes.

## QA/integration pass
Sync413->425twelve actualHTTP/PG checks:auth roles,exact response whitelist/flags,
no-store,cross-project/missing audit,invalid UUID,recreated-value denial,unchanged
archive after diagnostic reads. Initial424,expanded425RC0. No suite failures,startup
issues,timeouts or interruptions134.

Final43integration/config legs14completed failclosed batches,all individual+outerRC0.
API248/30,web61/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,sync425,
browser131,automation132,webhook45,135routes. Native staged116+128=244total/242unique,
all242literal labels covered,inner+outerRC0,checkpoint removed. Staged,not uninterrupted.
No app edits after broad verification;only review added afterward.
