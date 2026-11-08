# 0458 Filter loaded snapshots by kind

## Developer review
Local exact all/manual/automatic filter intersects existing trimmed literal
case-insensitive label search. No-filter path retains array identity; filtered
rows retain references for existing restore readiness checks. Explicit false
means manual, true means automatic; unknown metadata is not treated as manual.
Invalid/departed handlers refuse selection. Current reread retains kind, reused
project resets it. Full items and inventory export remain unchanged.

## Product review
Named manual captures can be isolated from recorded automatic snapshots without
reading or changing the project. Shown/loaded count and no-match guidance name
both filters and offer Clear kind/search. Empty filtered list is not a no-snapshots
claim. Download scope explicitly says all loaded metadata regardless of either
filter. Existing capture/restore uncertainty, draft, receipt and explicit current
recovery remain independent. No restore or newer-state inference from filtering.

## Design review
Final desktop/390px screenshots inspected: select, Clear controls, count, scope,
empty feedback and capture draft readable with no document horizontal overflow.
Existing toolbar wraps vertically at390px. No new CSS or changes to snapshot rows.
No visual correction needed.

## Security review
No network requests, server writes, dialogs or restore replay from filtering.
Unknown capture/restore pauses survive hide/reveal; restoring still uses original
current-row/read guards. No external service, spend, registration, dependency,
credential-scope, schema or automation changes. Existing metadata privacy/export
readiness stays in force; owner upload/live repository checked separately.

## QA/integration review
New unit5/web943 in88 suites/API265 in31/builds0 (unchanged API build cached).
New real browser12/0: one actual import automatic snapshot/two manual captures,
exact kind/search intersection, no-match guidance, downloaded three-row inventory
despite zero visible matches, zero filter effects, Clear behavior, actual failed
restore pause survives hide/reveal with one request/dialog/no replay, explicit
current refresh preserves kind and recovers, reused project reset/departed handler.
All API groups/85 isolated browser suites final0. Initial snapshot API aborted
before assertions on PostgreSQL55452 bind conflict; unchanged delayed retry61/0,
no app/test fix or assertion failures. Separate sync95+144=239unique and native
116+111+19=246total/242unique/four repeated startup checks all inner/outer0. Final
config16/14/docs4-138routes/reaper4 all0. Completed successful checks preserved
across continuation, no uninterrupted claim. Coverage22FULL7PARTIAL1MISSING and
automation defaultOFF unchanged.
