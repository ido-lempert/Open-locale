# 0457 Download loaded project dashboards

## Developer review
Separate export for loaded usage/task reports, not the existing branch export.
Readiness requires both current data objects, neither pending nor failed and a
live component. Existing read generations prevent prior visits/read responses
from owning current data. Any dashboard read or project change clears feedback;
branch reads remain independent. Serialization whitelists displayed figures,
actor/assignee identity fields and each report's window/cutoff. The loaded usage
days value is used, not mutable selector state. Local object URL cleaned even
when anchor activation throws. No API/schema/dependency changes.

## Product review
Explicit button for all-project dashboard figures, regardless of branch selector.
File names scope/version/project, includes singleDatabaseSnapshot:false and
individual captured windows. No translation values, task descriptions, branch
figures, newer server state, complete history, saved-file or sharing claim.
Separate read warning stays visible. Existing refresh buttons are the only way
to include newer changes. Branch report error does not block independent export.

## Design review
Final desktop/390px pixels inspected: download control, private identity warning,
separate-read/cutoff scope and requested-not-saved notice readable without document
horizontal overflow. Initial screenshot captured sticky header mid-page after
scrollIntoView; harness now resets document/main scroll before full-page capture.
Final screenshots re-inspected. Existing wide progress table remains scrollable;
this slice does not claim to redesign populated tables.

## Security review
Explicit local download only; no requests, sharing, account changes, registration,
spend, worker enablement or credential changes. Whitelists exclude extra object
fields, actor email, task descriptions and byDay detail not shown in dashboard.
Private actor/assignee names and IDs are named in warning. Pending/error/missing/
departed checks apply to captured handler, not only disabled button. Fixed failure
copy never includes exception text. Owner upload and live remote checks separate.

## QA/integration review
New unit11, web938 in87 suites/API265 in31/builds0 (unchanged API build cached).
New browser13/0 twice: real PostgreSQL/API figures and exact downloaded file scope,
individual windows, no download requests/writes, newer unread task exclusion,
held usage/task blocking, failed task read/current recovery, branch independence,
reused project reset, departed handler and runtime errors. Unit exact JSON covers
extra private-field exclusions, loaded selector mismatch, both report failures,
missing data and activation-throw cleanup. All API groups and84/84 isolated browser
suites final0. Two editor-keys browser attempts aborted before assertions because
PostgreSQL55588 could not bind; unchanged retry after independent work14/0. No
application/test fix from that infrastructure failure and no assertion failures.
Separate sync95+144=239unique, native116+111+19=246total/242unique/four startup
repeats all inner/outer0. Config16/14/docs4-138routes/reaper4 all0. Completed checks
preserved across continuation; no uninterrupted claim. Coverage22FULL7PARTIAL
1MISSING and automation defaultOFF unchanged.
