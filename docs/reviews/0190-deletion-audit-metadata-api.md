# 0190 - Read-only deletion audit metadata API

## Developer pass
GET sync/deletion-audits authorizes JWT session/project admin before query. Latest50
project-scoped rows ordered createdAt/id descending. Explicit select excludes
snapshot JSON at database boundary. Returns audit/key IDs,keyName,locale,actorId,
createdAt only. Metadata survives key deletion. No mutation/restore or UI this slice.

## Product pass
Preserved deletion audits are discoverable without exposing archived translations
or history. snapshotIncluded=false/canRestore=false explicit. No-store. README/plan/
spec document shape and limits;routes133->134. DefaultOFF unchanged,no production
settings/data action,remote write,baseline advance,accepted sync or external
acceptance.22FULL/7PARTIAL/1MISSING unchanged.

## Designer pass
No web list yet,no UI claim. Existing actual480x900 summary pixels inspected:
counts/checkpoints/timestamps/fullnotices readable,separate actions,no overflow.
Screenshot starts remote-branch metadata after scroll,whole summary visible.
Browser118 retained real pointer summary/apply flows.

## Security pass
Unauth401,contributor403,outsider404,API token403 even read/write scope. Session admin
allowed. Only intended metadata returned,never snapshot/value/history. Forged same
keyId in another project excluded. Existing audit snapshot unchanged after repeated
reads. No credential scope,spend,registration,license or audience changes.

## QA/integration pass
Sync332->344:twelve actualHTTP checks empty project,session/contributor/outsider/
API-token/admin auth,real removed-row metadata exact whitelist/no private value,
no-store,cross-project exclusion,bounded50 stable UUID tie order,no snapshot mutation,
deleted-key discoverability. Initial342,expanded final344RC0. Docs134routes.
No failures,startup issues,timeouts or interrupted calls124.

Final43integration/config legs14completed fail-closed batches,all individual+outer
RC0. API248/30,web55/7,both builds,reaper4RC0. Migration14,sync344,browser118,
automation132,webhook45. Native staged116+128=244total/242unique,all242literal
source labels covered,inner+outerRC0,checkpoint removed;not uninterrupted. All app
changes preceded broad verification;only this review added afterward.
