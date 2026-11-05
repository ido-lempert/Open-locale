# 0363 - Manual snapshot insert failure and retry

## Developer review
Test-only addition. Real database trigger rejects a named snapshot INSERT, actual
HTTP POST must return500, persisted snapshot and snapshot.created audit counts stay
unchanged. Same-label retry after trigger cleanup returns201 and persists exactly
one snapshot whose ID/label match exactly one new audit. No production hook/schema
or application change. Existing32 assertions remain; two new checks make34.

## Product review
Complements296 audit-write rollback proof with the earlier snapshot-write failure
boundary and successful recovery. Not an exactly-once or automatic retry feature.
No serializable capture, automatic capture/prune or full restore atomicity claim.
Network-response uncertainty after commit remains separate.

## Designer review
No visual/UI change; no new screenshot claim. Existing snapshot browser44 verified
against rebuilt API. This slice's evidence is HTTP response plus persisted DB rows.

## Security review
Fault injection is confined to disposable local PostgreSQL. Trigger and function
are removed in finally before retry; no production test hook or external account,
registration, token scope, spending, audience or license change. Owner's original
upload instruction recovered directly; live target/push/main checked at publication.

## QA/integration review
Snapshots32->34, all pass, including unchanged32 assertions. API265/31, web304/14
uncached and both builds0. All49 unique bounded integration/config legs final inner/
outer0; snapshotbrowser44, docs4/138 routes, sync-stage-config16, reaper4.
One command typo invoked nonexistent npm label snapshots-browser: RC1/0 checks,
empty log. Correct actual snapshot-browser ran44/inner0/outer0. No app/test failure
or timeout in297. No test/application edit after completed native/sync stages.
Syncbrowser95+144=239unique STAGED, both0/checkpointremoved; not canonical
uninterrupted. Native116+128=244total/242unique STAGED, both0/checkpointremoved,
not uninterrupted. Port55554 bind checked available before first native stage.
Each browser suite and each native stage ran in its own call.

Docker static-only; coverage22FULL/7PARTIAL/1MISSING/defaultOFF unchanged. No accepted
remote sync/baseline advance/worker enablement. Report snapshot/window caveats remain.
Bundle586.40kB vs500kB warning unchanged.
