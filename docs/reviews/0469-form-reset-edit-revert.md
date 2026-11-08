# 0469 Cancel local form discard on user edit

## Developer review
Exact snapshot comparison alone allowed an edited-then-reverted form to revive
an older discard prompt. Every project/task/glossary new-form ngModelChange now
clears pending reset and reset receipt before applying the value. Existing exact
comparison remains a second guard for captured/programmatic changes. No API,
storage or creation/recovery change. All13 inputs/choices covered.

## Product review
An edit cancels the prior discard decision, even when the user restores the same
value. Another discard needs a fresh prompt. An old discard receipt cannot revive
when a new draft is emptied. Existing unknown outcomes and local backup scope
unchanged; no server undo or automatic persistence implied.

## Design review
Desktop/390px original screenshots inspected: unchanged readable inline warning
and spaced Keep/Discard, no visible overflow. This changes interaction lifecycle,
not layout. Current focused glossary reset pointer protection retained.

## Security review
User-edit handlers clear local confirmation/receipt only. No new data collection,
request/destination, dependency, license, worker, registration, spend or credential
scope. Server unknown-state guards and independent security fields unchanged.

## QA/integration review
Unit6/web1022 in99 suites/API265 in31/builds0 (API cached). New real browser17/0
exercises all13 fields/choices with DOM edit/exact revert and captured handler,
plus three receipt edit/revert cases, zero API effects and no runtime errors.
All API/96 isolated browsers0. Sync95+144=239unique; native116+111+19=246total
242unique/four repeats all inner/outer0. No failed/aborted checks this slice.
Config16/14/docs4-138routes/reaper4 all0. Completed results preserved across continuation; staged/no uninterrupted claim.
Coverage22FULL7PARTIAL1MISSING/defaultOFF unchanged.
