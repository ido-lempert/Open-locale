# 0270 - Progress denominator and filled counts in one statement

## Developer review
One SQL CTE scopes branch keys, counts denominator and groups filled translation
statuses. LEFT JOIN totals preserves one zero-total row when no filled groups
exist. Null sentinel row skipped. No separate key.count read. Existing retired
status and locale projection logic retained.

## Product review
Key total and filled status counts now share one statement snapshot rather than
separate potentially drifting reads. Project/locales and branch lookup remain
separate, so this is not whole-report snapshot consistency. Zero-key percent0,
empty value untranslated and retained retired-status counts unchanged. Coverage
22 FULL/7 PARTIAL/1 MISSING/defaultOFF unchanged.

## Designer review
No UI changes. Fresh480x900 local report fixture inspected: zero-keyprogress,
full actorIDs/group-user-nulltaskrows readable, existing progress scroll retained.
Image is not concurrent count proof; unit and actualPGHTTP contracts are.

## Security review
Branch UUID parameter bound, authorization precedes query as before. Statement
snapshot does not lock authorization or provide fresh permission guarantee. No DB
resource bounds/timeout/transaction-wide snapshot or parity claims.

## QA/integration review
API263->265/31: empty sentinel and filled retired status cases verify singlequery,
no key.count, branchparameter and arithmetic. Existing actualPGHTTP111 checks pass,
including retired status/empty value/empty branch. No held-concurrentmutation test
or targeted old-source control claimed. Web146/9 unchanged.43unique legs/12fully
completedgreenbatches individual/inner/outer0. Sync644/browser212/builds/reaper4/
docs4/138routes0. No failures/startup/timeouts/interruption. Web562.75kBvs500warning.
NativeSTAGED116+128=244total/242unique PG55534innerouter0/checkpointremoved,
NOTuninterrupted. Noapp/testchangesafter native.
