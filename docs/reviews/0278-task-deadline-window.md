# 0278 - Task deadline window metadata

## Developer review
Additive asOf/dueSoonThrough use the exact captured Date objects already bound
to deadline SQL. No new query or clock. Unit verifies returned object identity
against SQL parameters; actualHTTP verifies canonical ISO timestamps exactly
seven days apart. Web interface and OpenAPI operation summary updated. Existing
status/deadline statement and separate assignment aggregation unchanged.

## Product review
Users can see the exact due-soon cutoff instead of guessing when the dashboard
was calculated. Both endpoints inclusive for due soon; overdue is before asOf.
UI states workload is read separately, not one database snapshot. Metadata is
not authorization freshness or whole-report consistency. Coverage22FULL/
7PARTIAL/1MISSING/defaultOFF unchanged; no remote sync/baseline/worker change.

## Designer review
Fresh480x1032 fullpage inspected: exact ISO bounds wrap in readable text above
assignment rows. Full task rows visible in fullpage with ordinary verticalscroll.
Existing progress horizontal scroll unchanged. No changed text clipping.

## Security review
No new secret/private identity fields, destinations or permissions. Successful
report no-store and authorization remain unchanged. Original owner's instruction
recovered; no account registration, token scope change, spend or license choice.
SQL parameterization unchanged. No atomicity or memory-erasure claim.

## QA/integration review
Reports117->118 actualHTTP metadata; browser221->222 response-to-visible-text
bounds/caveat. API265/31 and web146/9 uncached0, builds0. All43unique integration/
config legs in13completed green batches inner/outer0; sync644/reaper4/docs4/
138routes0. No failures/startup problems/timeouts/interruptions this slice.
Native STAGED116+128=244total/242unique PG55534 inner/outer0/checkpointremoved,
NOT uninterrupted. No app/test changes after native; browser222rerun0 afterward.
Bundle warning563.94kB vs500(previous563.64). Docker static only, no daemon claim.
