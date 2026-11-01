# 0195 - Internal read-only deletion recovery diagnostic

## Developer pass
Internal function only,no HTTP route/writer. Project-scoped audit lookup,512KiB bound,
flat row scope,value/history shape cap1000,matching key/name/current nonplural/length,
current project locale,absent current translation,and exact removal marker generation.
Returns digest+metadata or typed reason,never archived value/history. Not a transaction
execution token:future executor must re-authorize/revalidate inside write transaction.

## Product pass
A narrow diagnostic building block toward safe recovery,not restoration completion.
No history replay,status/provenance restoration,write or public endpoint. Legacy audits
without current generation fail closed. Current canRestore=false metadata API/UI stays
true. No external acceptance,baseline advance/remote write.22FULL/7PARTIAL/1MISSING
coverage/defaultOFF unchanged.

## Designer pass
No UI change or recovery UI claim. Current actual480x900audit-focus pixels inspected:
heading outline,scope/no-restore notices,button and card metadata readable,no overflow.
Escaped markup key/2099time deliberate fixtures. Existing browser131 remains green.

## Security pass
Missing/wrong-project audit denied;malformed/plural/mismatched/oversized snapshot denied.
Current renamed/length/plural key,missing locale,existing value,old/missing generation
denied. Diagnostic reads do not mutate archive. No grant,restore token or authorization
inference:caller-provided project ID only narrows internal data lookup. No registration,
credential-scope expansion,spend,license/audience or production data/settings changes.

## QA/integration pass
Sync362->377 includes actual local removal candidate/digest/privacy,wrong-project,
null/row mismatch/plural/history mismatch/oversize snapshot,current length/name/plural,
old/missing marker,removed locale rollback fixture,unchanged archive and recreated
value overwrite denial. Initial374,expanded377RC0. No failures,startup issues,timeouts
or interrupted calls129.

Final43integration/config legs14completed failclosed batches,individual+outerRC0.
API248/30,web61/7,both builds,reaper4RC0(48nonvisual inventory). Migration17,sync377,
browser131,automation132,webhook45,134routes. Native staged116+128=244total/242unique,
all242literal labels covered,inner+outerRC0,checkpoint removed. Staged,not uninterrupted.
No app edits after broad verification;only review added afterward.
