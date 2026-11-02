# 0251 - Complete binding browser scope checks

## Developer pass
Test-only five-case browser extension. Otherwise complete well-shaped response
changes only selected target ID,revision,branch or locale. Each stays read-only.
Matching control exposes Prepare only,no Confirm/send. Unique rendered value per
case waits for that response rather than previous UI. No app/server changes.

## Product pass
Valid archived value remains reviewable even when preparation cannot proceed.
Scope mismatch does not silently switch target or refresh bindings. Matching
control is injected fixture,not server approval. Coverage22FULL/7PARTIAL/1MISSING/
defaultOFF unchanged,no remote write/baseline advance/accepted sync/enabled worker.

## Designer pass
Final480x900locale-mismatch screenshot inspected:full review notice,value,fixed
read-only explanation and Hide inside focused region,no Prepare/Confirm or
horizontal overflow. Lower audit below viewport. Visual UI unchanged;fixture image
shows scope-denial rendering,not server execution proof.

## Security pass
Single-field mismatch cases use otherwise complete valid shape,plus matching
control to avoid proving only malformed-input denial. Synthetic baseline/digests
are never sent to recovery endpoint. Client is not response authentication or
freshness/authority proof. No targeted old-source negative-control claim.

## QA/integration pass
Browser198->203(+4scope mismatches+1matching control),finaltwiceRC0. Initial200pass/
3FAIL:alternate target ID accidentally reused sameactualID,and constant rendered
value readiness could inspect previous response. Fixed fixture distinctUUID and
per-case value/wait;no app fix. No startup/timeouts/interruption185.
Uncached web132/8 API248/30,bothbuilds,reaper4,docs4/138routesRC0.43unique integration/
config legs in12completed green batches,individual/outerRC0,sync644. Existingweb
budget560.11kBvs500kBwarning. Native STAGED116+128=244total/242unique,PG55534,inner/
outerRC0,checkpointremoved,not uninterrupted. No app/test changes after native;
builds/API/browser203reran,then docs only. No external delivery/exactly-once claim.
