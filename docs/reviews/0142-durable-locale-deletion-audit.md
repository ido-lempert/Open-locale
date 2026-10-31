# 0142 - Durable locale-value deletion audit

## Developer pass
New project-owned deletion audit stores key identity/name,locale,actor and JSON
snapshot independent of translation/key FK lifetime. Project cascade/actor set-null
explicit. Isolated writer supports existing-key locale removal: exact row plus
full ordered history archived before cascade deletion, activity same transaction.
1000 history/512KiB bound rejects rather than truncates. Sets retain prior rules.
No new route/production caller. Fresh-schema and historical migration tests green.

## Product pass
Removes only selected locale translation, never project key/other locales. Audit
survives translation recreation/key deletion, project deletion intentionally removes
private audit. No UI reader or restore endpoint yet; no end-user restore claim.
TM/webhook/automation/target-baseline authorization still production integration
work. No actual public apply or sync completion. Coverage22FULL/7PARTIAL/1MISSING
unchanged, no external acceptance.

## Designer pass
No UI change/new screenshot; existing review UI98 browser checks retained. README/
plan explain retention/bounds/no public execution rather than implying recovery UI.

## Security pass
Audit stays in authorized project database, no new disclosure/read endpoint.
Deletion and exact archive commit/rollback together. Over-bound history refuses
mutation and partial audit. ActorFK tracks local user, project cascade avoids
orphaned private data. Existing Serializable/key/row preconditions retained.
No credentials/registration/scope expansion/spend/license choice.

## QA/integration pass
Sync177->184 real PG: exact row/full ordered history archive, removal rollback,
locale/key/other-locale preservation, recreation new-row identity/audit survival,
over-history and over-byte refusal without truncation/partial audit,key deletion
survival. Initial schema duplicated User relation/omitted Project relation; caught
by generate, corrected and clean build. First audit equality asserted JSONB object
key order, fixed canonical object comparison while preserving array order/data.
API248/30,web48/7,both builds,reaper4 RC0.43 integration/config legs passed;14
completed clean fail-closed batches all individual/outerRC0. One combined browser
call host120sec interrupted afterOIDC+SAML-link passed while SAML-browser started.
Confirmed interrupted PG defunct/port refused, removed only dead socket; test web
already defunct. Both SAML browser legs rerun smaller clean RC0. No repeated send.
Native visual116+128=244/two repeated startups/242 unique,all source labels covered,
both inner/outerRC0,checkpoint removed,staged not uninterrupted. TM15442/visual15434.
48 inventory legs with units/builds/reaper. No active services retained.
